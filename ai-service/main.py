from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health():
    # Simple readiness probe for the AI service
    return {"status": "AI service running"}
