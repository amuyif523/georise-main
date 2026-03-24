import os
import json
import traceback
from pathlib import Path
from typing import Optional

import torch
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from utils.severity import infer_severity

load_dotenv(Path(__file__).parent / ".env", override=True)

# --- Configuration & Constants ---
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET")

print(f"DEBUG: Current Dir: {os.getcwd()}")
print(f"DEBUG: .env exists? {(Path(__file__).parent / '.env').exists()}")
print(f"DEBUG: Secret loaded? {'Yes' if INTERNAL_SERVICE_SECRET else 'No'}")
print(
    f"DEBUG: Secret length: {len(INTERNAL_SERVICE_SECRET) if INTERNAL_SERVICE_SECRET else 0}"
)

MODEL_DIR = Path(__file__).parent / "models" / "afroxlmr_incident_classifier"
DEFAULT_MODEL_NAME = os.getenv("MODEL_NAME", "Davlan/afro-xlmr-base")
MAX_SEQUENCE_LENGTH = int(os.getenv("MAX_SEQUENCE_LENGTH", "128"))
METADATA_PATH = MODEL_DIR / "metadata.json"
KEYWORDS_PATH = Path(__file__).parent / "data" / "keywords.json"
ALLOWED_CATEGORIES = {
    "FIRE",
    "MEDICAL",
    "TRAFFIC",
    "CRIME",
    "INFRASTRUCTURE",
    "UTILITY",
    "OTHER",
}
CATEGORY_ALIASES = {
    "POLICE": "CRIME",
    "ACCIDENT": "TRAFFIC",
    "UTILITY": "INFRASTRUCTURE",
    "UNSPECIFIED": "OTHER",
    "UNKNOWN": "OTHER",
}

# --- Globals ---
model_metadata = None
KEYWORDS = {}
NEUTRAL_LOCATIONS = []
VERB_WEIGHT = 2.0
LOCATION_WEIGHT = 1.0
SEVERITY_PRIORITY = {
    "CRIME": 5,
    "FIRE": 5,
    "MEDICAL": 4,
    "TRAFFIC": 3,
    "INFRASTRUCTURE": 2,
    "OTHER": 1,
}
INTENT_KEYWORDS = {
    "CRIME": [
        "thief",
        "thieves",
        "snatched",
        "stole",
        "steal",
        "stolen",
        "robbed",
        "robbery",
        "robber",
        "burglary",
        "intruder",
        "breaking in",
        "break-in",
        "armed",
        "attack",
        "መሳሪያ",
        "ተኩስ",
        "ሌባ",
        "ሌቦች",
        "ሰረቁ",
        "ተሰረቀ",
        "ዘረፉ",
        "ቀሙ",
        "ቦርሳ ቀሙ",
        "ስልክ ቀሙ",
        "ቤት ገብተው",
        "ቤት ሰብረው ገቡ",
        "ወንጀል",
    ],
    "FIRE": [
        "fire",
        "smoke",
        "flame",
        "burn",
        "explosion",
        "sparking",
        "እሳት",
        "ጭስ",
        "ቃጠሎ",
    ],
    "MEDICAL": [
        "ambulance",
        "injury",
        "injured",
        "blood",
        "hurt",
        "heart attack",
        "pain",
        "unconscious",
        "ሕክምና",
        "ደም",
        "ጉዳት",
        "አምቡላንስ",
        "ህመም",
    ],
    "TRAFFIC": [
        "accident",
        "crash",
        "collision",
        "blocked",
        "hit",
        "overturned",
        "ትራፊክ",
        "ተጋጨ",
        "ተጋጭተዋል",
        "አደጋ",
    ],
    "INFRASTRUCTURE": [
        "collapse",
        "pothole",
        "flood",
        "power outage",
        "internet down",
        "wire down",
        "ፈራረሰ",
        "ቀዳዳ",
        "ውሃ",
        "ኃይል",
    ],
}
LOCATION_KEYWORDS = {
    "MEDICAL": ["doctor", "medical", "sick", "ሕክምና", "ዶክተር"],
    "TRAFFIC": ["car", "vehicle", "truck", "taxi", "መኪና", "ታክሲ", "gaari"],
    "INFRASTRUCTURE": ["road", "bridge", "electric", "water", "internet", "power", "መንገድ", "ድልድይ"],
}

# --- Helper Functions ---


def load_keywords():
    global KEYWORDS
    global NEUTRAL_LOCATIONS
    if KEYWORDS_PATH.exists():
        try:
            payload = json.loads(KEYWORDS_PATH.read_text(encoding="utf-8"))
            NEUTRAL_LOCATIONS = payload.pop("neutral_locations", [])
            KEYWORDS = payload
            print(f"Loaded {len(KEYWORDS)} keyword categories from {KEYWORDS_PATH}")
        except Exception as e:
            print(f"Failed to load keywords: {e}")
    else:
        print(f"Keywords file not found at {KEYWORDS_PATH}")


def load_model():
    """
    Load a local fine-tuned model if present; otherwise fall back to the base model
    so the service keeps running even without weights.
    """
    version = None
    global model_metadata
    model_path = DEFAULT_MODEL_NAME

    if MODEL_DIR.exists() and (MODEL_DIR / "config.json").exists():
        model_path = MODEL_DIR
        print(f"Loading local model from {model_path}")
        if METADATA_PATH.exists():
            try:
                model_metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
                version = model_metadata.get("version_tag")
            except Exception:
                version = None
                model_metadata = None
    else:
        print(f"Loading default base model {model_path}")

    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
    model.eval()
    return tokenizer, model, version or str(model_path)


def normalize_category(label: Optional[str]) -> str:
    if not label:
        return "OTHER"
    normalized = label.strip().upper().replace("-", "_").replace(" ", "_")
    normalized = CATEGORY_ALIASES.get(normalized, normalized)
    return normalized if normalized in ALLOWED_CATEGORIES else "OTHER"


def heuristic_category(text: str) -> str:
    t = text.lower()

    # Negation / Safety Check (Highest Priority for OTHER)
    negations = [
        "no incident",
        "no danger",
        "no fire",
        "false alarm",
        "test only",
        "አደጋ የለም",
        "ምንም እሳት የለም",
        "በስህተት",
        "ምንም አይጠበቅም",
        "የለም",
    ]
    if any(n in t for n in negations):
        return "OTHER"
    scores = {category: 0.0 for category in ["CRIME", "FIRE", "MEDICAL", "TRAFFIC", "INFRASTRUCTURE"]}

    neutral_hits = [location for location in NEUTRAL_LOCATIONS if location in t]

    for category, words in KEYWORDS.items():
        normalized_category = normalize_category(category)
        if normalized_category not in scores:
            continue
        for word in words:
            if word in t:
                weight = LOCATION_WEIGHT
                if word in INTENT_KEYWORDS.get(normalized_category, []):
                    weight = VERB_WEIGHT
                elif word in LOCATION_KEYWORDS.get(normalized_category, []):
                    weight = LOCATION_WEIGHT
                scores[normalized_category] += weight

    for category, words in INTENT_KEYWORDS.items():
        for word in words:
            if word in t:
                scores[category] += VERB_WEIGHT

    for category, words in LOCATION_KEYWORDS.items():
        for word in words:
            if word in t:
                scores[category] += LOCATION_WEIGHT

    # Neutral locations should not push the classifier toward MEDICAL/TRAFFIC on their own.
    if neutral_hits:
        scores["MEDICAL"] = max(0.0, scores["MEDICAL"] - len(neutral_hits) * LOCATION_WEIGHT)
        scores["TRAFFIC"] = max(0.0, scores["TRAFFIC"] - len(neutral_hits) * 0.5)

    crime_intent_present = any(word in t for word in INTENT_KEYWORDS["CRIME"])
    if crime_intent_present:
        scores["CRIME"] += VERB_WEIGHT

    best_category = max(
        scores,
        key=lambda category: (scores[category], SEVERITY_PRIORITY[category]),
    )

    if scores[best_category] <= 0:
        return "OTHER"

    if crime_intent_present:
        return "CRIME"

    return best_category


def choose_category(
    text: str,
    model_label: Optional[str],
    confidence: float,
    manual_category: Optional[str] = None,
):
    normalized_model = normalize_category(model_label)
    normalized_manual = normalize_category(manual_category) if manual_category else None
    heuristic = heuristic_category(text)

    if heuristic != "OTHER" and normalized_manual and normalized_manual != heuristic:
        return heuristic, f"manual_mismatch:{normalized_manual}->{heuristic}"

    if heuristic != "OTHER" and (normalized_model == "OTHER" or confidence < 0.60):
        return heuristic, "heuristic_override"

    if normalized_model != "OTHER":
        return normalized_model, "model"

    if heuristic != "OTHER":
        return heuristic, "heuristic_fallback"

    if normalized_manual and normalized_manual != "OTHER":
        return normalized_manual, "manual_fallback"

    return "OTHER", "default_fallback"


def response_category(label: str) -> str:
    normalized = normalize_category(label)
    if normalized == "INFRASTRUCTURE":
        return "UTILITY"
    return normalized


# --- Initialization ---
load_keywords()
tokenizer, model, model_version = load_model()
# ... (rest of imports/config)

# --- FastAPI App & Security ---
app = FastAPI()
security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not INTERNAL_SERVICE_SECRET:
        print(
            "❌ WARNING: INTERNAL_SERVICE_SECRET is not set!"
        )  # Log warning as requested
        # Require secret to be set for security
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfigured: INTERNAL_SERVICE_SECRET missing",
        )
    if credentials.credentials != INTERNAL_SERVICE_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )


# --- Models ---
class ClassifyRequest(BaseModel):
    title: str
    description: str
    metadata: Optional[dict] = None


class ClassifyResponse(BaseModel):
    predicted_category: str
    severity_score: int
    confidence: float
    model_version: str
    summary: Optional[str] = None
    reasoning: Optional[str] = None


# --- Routes ---

HIGH_CERTAINTY_KEYWORDS = {
    "FIRE": ["fire", "smoke", "እሳት", "ጭስ"],
    "CRIME": ["thief", "thieves", "robbery", "stolen", "ሌባ", "ጠመንጃ"],
}
FORCED_OVERRIDE_KEYWORDS = {
    "FIRE": ["fire"],
    "CRIME": ["thieves"],
}
MODEL_STRIP_LOCATIONS = [
    "masjid",
    "pharmacy",
    "church",
    "school",
    "mall",
    "mosque",
    "ፋርማሲ",
    "ሆስፒታል",
    "ክሊኒክ",
    "ቤተክርስቲያን",
    "መስጊድ",
    "ትምህርት ቤት",
]


def word_count(text: str) -> int:
    return len([part for part in text.split() if part.strip()])


def high_certainty_keyword_match(text: str):
    t = text.lower()
    for category, keywords in HIGH_CERTAINTY_KEYWORDS.items():
        if any(keyword in t for keyword in keywords):
            return category
    return None


def forced_override_match(text: str):
    t = text.lower()
    for category, keywords in FORCED_OVERRIDE_KEYWORDS.items():
        if any(keyword in t for keyword in keywords):
            return category
    return None


def strip_location_nouns(text: str) -> str:
    cleaned = text
    for noun in MODEL_STRIP_LOCATIONS:
        cleaned = cleaned.replace(noun, " ")
        cleaned = cleaned.replace(noun.title(), " ")
        cleaned = cleaned.replace(noun.upper(), " ")
    return " ".join(cleaned.split())


@app.get("/health", dependencies=[Depends(verify_token)])
def health():
    try:
        ready = model is not None
        return {
            "status": "AI service running" if ready else "Model loading...",
            "ready": ready,
            "model": model_version,
            "metadata": model_metadata or {},
        }
    except Exception:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Health check failed")


@app.post(
    "/classify", response_model=ClassifyResponse, dependencies=[Depends(verify_token)]
)
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
                reasoning="Empty description",
            )

        forced_override = forced_override_match(text)
        if forced_override:
            severity = infer_severity(forced_override, text)
            return ClassifyResponse(
                predicted_category=response_category(forced_override),
                severity_score=severity,
                confidence=1.0,
                model_version=f"{model_version}-forced-override",
                summary=req.title if req.title else text[:120],
                reasoning="Keyword match",
            )

        short_message = word_count(text) < 10
        forced_category = high_certainty_keyword_match(text)
        if short_message and forced_category:
            severity = infer_severity(forced_category, text)
            return ClassifyResponse(
                predicted_category=response_category(forced_category),
                severity_score=severity,
                confidence=1.0,
                model_version=f"{model_version}-keyword-fastpath",
                summary=req.title if req.title else text[:120],
                reasoning="Keyword match",
            )

        inference_text = strip_location_nouns(text)
        if not inference_text:
            inference_text = text

        inputs = tokenizer(
            inference_text,
            return_tensors="pt",
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQUENCE_LENGTH,
        )

        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

        pred_id = int(probs.argmax())

        # Logic for base model or low confidence
        if "afro-xlmr-base" in str(model_version) and not MODEL_DIR.exists():
            raw_label = heuristic_category(text)
            confidence = 0.5
        else:
            raw_label = model.config.id2label.get(pred_id, "OTHER")
            confidence = float(probs[pred_id])

            if raw_label.startswith("LABEL_"):
                raw_label = heuristic_category(text)

        pred_label, reasoning = choose_category(
            text,
            raw_label,
            confidence,
            (req.metadata or {}).get("manualCategory"),
        )

        if short_message and pred_label in {"FIRE", "CRIME"} and confidence < 0.35:
            pred_label = heuristic_category(text)
            if pred_label in {"FIRE", "CRIME"}:
                confidence = 0.35
                reasoning = "short_message_confidence_floor"

        severity = infer_severity(pred_label, text)
        response_label = response_category(pred_label)
        summary_base = req.title if req.title else text[:120]
        summary = f"{summary_base} [reasoning:{reasoning}]"

        return ClassifyResponse(
            predicted_category=response_label,
            severity_score=severity,
            confidence=confidence,
            model_version=model_version,
            summary=summary,
            reasoning=reasoning,
        )
    except Exception as e:
        print(f"Classification error: {e}")
        return ClassifyResponse(
            predicted_category="OTHER",
            severity_score=2,
            confidence=0.0,
            model_version="error-fallback",
            summary="Error processing request",
            reasoning="Error processing request",
        )
