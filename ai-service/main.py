from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class ClassifyRequest(BaseModel):
    title: str
    description: str


class ClassifyResponse(BaseModel):
    predicted_category: str
    severity_score: int
    confidence: float
    model_version: str
    summary: str | None = None


@app.get("/health")
def health():
    return {"status": "AI service running"}


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    text = (req.title + " " + req.description).lower()

    # Simple keyword heuristic – stub to be replaced in Sprint 4
    if any(w in text for w in ["fire", "smoke", "ቃጠሎ", "እሳት"]):
        return ClassifyResponse(
            predicted_category="FIRE",
            severity_score=4,
            confidence=0.6,
            model_version="stub-amharic-v0",
            summary="Likely fire-related incident",
        )
    if any(w in text for w in ["accident", "crash", "car", "የመኪና አደጋ"]):
        return ClassifyResponse(
            predicted_category="TRAFFIC",
            severity_score=3,
            confidence=0.6,
            model_version="stub-amharic-v0",
            summary="Likely traffic-related incident",
        )
    if any(w in text for w in ["blood", "injury", "ሕክምና", "ደም"]):
        return ClassifyResponse(
            predicted_category="MEDICAL",
            severity_score=4,
            confidence=0.6,
            model_version="stub-amharic-v0",
            summary="Likely medical emergency",
        )

    return ClassifyResponse(
        predicted_category="OTHER",
        severity_score=2,
        confidence=0.3,
        model_version="stub-amharic-v0",
        summary="Unclassified incident – needs human review",
    )
