from pathlib import Path
from typing import Optional

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from utils.severity import infer_severity

app = FastAPI()

MODEL_DIR = Path(__file__).parent / "models" / "afroxlmr_incident_classifier"
DEFAULT_MODEL_NAME = "Davlan/afro-xlmr-base"


class ClassifyRequest(BaseModel):
    title: str
    description: str


class ClassifyResponse(BaseModel):
    predicted_category: str
    severity_score: int
    confidence: float
    model_version: str
    summary: Optional[str] = None


def load_model():
    """
    Load a local fine-tuned model if present; otherwise fall back to the base model
    so the service keeps running even without weights.
    """
    if MODEL_DIR.exists() and (MODEL_DIR / "config.json").exists():
        model_path = MODEL_DIR
        print(f"Loading local model from {model_path}")
    else:
        model_path = DEFAULT_MODEL_NAME
        print(f"Loading default base model {model_path}")

    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
    model.eval()
    return tokenizer, model, str(model_path)


def heuristic_category(text: str) -> str:
    t = text.lower()
    # English + Amharic keywords to guide fallback when the model is unsure
    if any(w in t for w in ["fire", "smoke", "flame", "burn", "ሙቀት", "እሳት", "ጭስ"]):
        return "FIRE"
    if any(
        w in t
        for w in [
            "medical",
            "injury",
            "blood",
            "hurt",
            "pain",
            "sick",
            "hospital",
            "ambulance",
            "ሕክምና",
            "ደም",
            "ጉዳት",
            "ወድቆ",
            "ህመም",
        ]
    ):
        return "MEDICAL"
    if any(
        w in t
        for w in [
            "crime",
            "theft",
            "robbery",
            "assault",
            "kill",
            "gun",
            "shoot",
            "police",
            "ወንጀል",
            "ስርቆት",
            "ጥቃት",
            "ግድያ",
            "ተደፍሯል",
            "ፖሊስ",
        ]
    ):
        return "POLICE"
    if any(
        w in t
        for w in [
            "traffic",
            "accident",
            "crash",
            "car",
            "vehicle",
            "road",
            "collision",
            "ትራፊክ",
            "መኪና",
            "አደጋ",
            "ግጭት",
            "መንገድ ተዘግቷል",
        ]
    ):
        return "TRAFFIC"
    if any(
        w in t
        for w in [
            "flood",
            "storm",
            "quake",
            "disaster",
            "water",
            "electric",
            "power",
            "light",
            "ኃይል",
            "መብራት",
            "ውሃ",
            "መስመር ተቋርጧል",
            "ዝናብ",
        ]
    ):
        return "INFRASTRUCTURE"
    return "OTHER"


tokenizer, model, model_version = load_model()


@app.get("/health")
def health():
    return {"status": "AI service running", "model": model_version}


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    try:
        text = (req.title.strip() + " " + req.description.strip()).strip()
        if not text:
            return ClassifyResponse(
                predicted_category="OTHER",
                severity_score=1,
                confidence=0.0,
                model_version=f"{model_version}-empty",
                summary="Empty description",
            )

        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding="max_length",
            max_length=128,
        )

        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

        pred_id = int(probs.argmax())

        # If using base model (not fine-tuned), id2label might be generic LABEL_0, etc.
        # Or if confidence is very low, fallback to heuristic.
        if "afro-xlmr-base" in str(model_version) and not MODEL_DIR.exists():
            pred_label = heuristic_category(text)
            confidence = 0.5
        else:
            pred_label = model.config.id2label.get(pred_id, "OTHER")
            confidence = float(probs[pred_id])

            # Fallback if label is generic
            if pred_label.startswith("LABEL_"):
                pred_label = heuristic_category(text)

        severity = infer_severity(pred_label, text)
        summary = req.title if req.title else text[:120]

        return ClassifyResponse(
            predicted_category=pred_label,
            severity_score=severity,
            confidence=confidence,
            model_version=model_version,
            summary=summary,
        )
    except Exception as e:
        print(f"Classification error: {e}")
        # Fallback response
        return ClassifyResponse(
            predicted_category="OTHER",
            severity_score=2,
            confidence=0.0,
            model_version="error-fallback",
            summary="Error processing request",
        )
