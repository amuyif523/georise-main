import os
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
    Load a local fine-tuned model if present; otherwise fall back to base model.
    This keeps the endpoint working even before you drop trained weights.
    """
    model_path = MODEL_DIR if MODEL_DIR.exists() else DEFAULT_MODEL_NAME
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()
    return tokenizer, model, str(model_path)


tokenizer, model, model_version = load_model()


@app.get("/health")
def health():
    return {"status": "AI service running", "model": model_version}


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
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
    pred_label = model.config.id2label.get(pred_id, "OTHER")
    confidence = float(probs[pred_id])

    severity = infer_severity(pred_label, text)
    summary = req.title if req.title else text[:120]

    return ClassifyResponse(
        predicted_category=pred_label,
        severity_score=severity,
        confidence=confidence,
        model_version=model_version,
        summary=summary,
    )
