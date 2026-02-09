def infer_severity(base_label: str, text: str) -> int:
    """Simple heuristic to map label + keywords to a 0-5 severity."""
    t = (text or "").lower()

    base_map = {
        "FIRE": 3,
        "MEDICAL": 3,
        "CRIME": 2,
        "TRAFFIC": 3,
        "INFRASTRUCTURE": 2,
        "OTHER": 2,
    }
    score = base_map.get(base_label, 2)

    high_keywords = [
        "dead",
        "death",
        "killed",
        "died",
        "ሞት",
        "ተገደለ",
        "ሞተ",
        "explosion",
        "bomb",
        "ፍንዳታ",
        "ብዙ ሰዎች ተጎዱ",
    ]
    medium_keywords = [
        "injured",
        "injury",
        "ጉዳት",
        "ተጎዳ",
        "እሳት ቃጠሎ",
        "burn",
        "serious",
        "ወድቆ",
        "ደም",
    ]

    if any(w in t for w in high_keywords):
        score += 2
    elif any(w in t for w in medium_keywords):
        score += 1

    return max(0, min(5, score))
