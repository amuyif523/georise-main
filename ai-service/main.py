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
METADATA_PATH = MODEL_DIR / "metadata.json"
model_metadata = None


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
    version = None
    global model_metadata
    if MODEL_DIR.exists() and (MODEL_DIR / "config.json").exists():
        model_path = MODEL_DIR
        print(f"Loading local model from {model_path}")
        if METADATA_PATH.exists():
            try:
                import json

                model_metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
                version = model_metadata.get("version_tag")
            except Exception:
                version = None
                model_metadata = None
    else:
        model_path = DEFAULT_MODEL_NAME
        print(f"Loading default base model {model_path}")

    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
    model.eval()
    return tokenizer, model, version or str(model_path)


KEYWORDS_PATH = MODEL_DIR.parent / "data" / "keywords.json"
KEYWORDS = {}

def load_keywords():
    global KEYWORDS
    if KEYWORDS_PATH.exists():
        try:
            import json
            KEYWORDS = json.loads(KEYWORDS_PATH.read_text(encoding="utf-8"))
            print(f"Loaded {len(KEYWORDS)} keyword categories from {KEYWORDS_PATH}")
        except Exception as e:
            print(f"Failed to load keywords: {e}")
    else:
        print(f"Keywords file not found at {KEYWORDS_PATH}")

load_keywords()

def heuristic_category(text: str) -> str:
    t = text.lower()
    # Dynamic keyword lookup
    for category, words in KEYWORDS.items():
        if any(w in t for w in words):
            return category.upper()
    
    # Fallback to hardcoded if JSON missing or empty (Safety Net)
    if not KEYWORDS:
        if any(w in t for w in ["fire", "smoke", "flame", "burn", "ሙቀት", "እሳት", "ጭስ"]):
            return "FIRE"
        if any(w in t for w in ["medical", "injury", "blood", "ambulance", "ሕክምና"]):
            return "MEDICAL"
            
    return "OTHER"


tokenizer, model, model_version = load_model()


@app.get("/health")
def health():
    return {
        "status": "AI service running",
        "model": model_version,
        "metadata": model_metadata or {},
    }


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
