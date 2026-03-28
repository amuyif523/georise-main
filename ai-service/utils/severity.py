RUBRIC_PROMPT = """
Analyze this incident in Addis Ababa. Rate severity from 1-10 using:
1. Life Threat: active victims, trapped people, unconscious persons, bleeding, deaths.
2. Spread Potential: fire spread, gas/chemical hazard, dense structures, risk of escalation.
3. Systemic Impact: major road blocked, airport/hospital disruption, substation or utility outage.
Prioritize human life first, then spread risk, then citywide disruption.
""".strip()


def _count_matches(text: str, keywords: list[str]) -> int:
    return sum(1 for keyword in keywords if keyword in text)


def infer_severity(base_label: str, text: str) -> int:
    """Rubric-based 1-10 severity model tuned for urban incident triage."""
    t = (text or "").lower()

    base_map = {
        "FIRE": 4,
        "MEDICAL": 4,
        "CRIME": 3,
        "TRAFFIC": 4,
        "INFRASTRUCTURE": 3,
        "UTILITY": 3,
        "OTHER": 3,
    }

    life_threat_terms = [
        "dead",
        "death",
        "killed",
        "died",
        "trapped",
        "bleeding",
        "unconscious",
        "critical",
        "mass casualty",
        "child trapped",
        "ሞት",
        "ተገደለ",
        "ሞተ",
        "ተቆልፎ",
        "ደም",
        "ብዙ ሰዎች ተጎዱ",
    ]
    spread_terms = [
        "explosion",
        "bomb",
        "gas leak",
        "chemical",
        "smoke everywhere",
        "spreading",
        "apartment",
        "market",
        "factory",
        "warehouse",
        "school",
        "hospital",
        "substation",
        "fuel",
        "ፍንዳታ",
        "ኬሚካል",
        "ጭስ",
        "እሳት ቃጠሎ",
    ]
    systemic_terms = [
        "road blocked",
        "ring road",
        "traffic lights",
        "bridge",
        "airport",
        "hospital access",
        "power outage",
        "substation",
        "water main",
        "telecom",
        "blackout",
        "grid failure",
        "au",
        "african union",
        "bole",
        "piazza",
        "mercato",
        "መንገድ ተዘግቷል",
        "መብራት ጠፍቷል",
        "አየር ማረፊያ",
    ]

    life_score = min(4, _count_matches(t, life_threat_terms))
    spread_score = min(3, _count_matches(t, spread_terms))
    systemic_score = min(3, _count_matches(t, systemic_terms))

    if base_label == "MEDICAL" and life_score == 0:
        life_score = 1
    if base_label == "FIRE" and spread_score == 0:
        spread_score = 1
    if base_label == "TRAFFIC" and systemic_score == 0:
        systemic_score = 1
    if base_label in {"INFRASTRUCTURE", "UTILITY"} and systemic_score == 0:
        systemic_score = 1

    score = max(
        base_map.get(base_label, 3),
        base_map.get(base_label, 3) + life_score + spread_score + systemic_score - 1,
    )

    return max(1, min(10, score))
