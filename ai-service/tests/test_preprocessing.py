import pytest
from main import (
    heuristic_category,
    choose_category,
    response_category,
    high_certainty_keyword_match,
    strip_location_nouns,
)

# Mock KEYWORDS if necessary, or rely on loaded ones if main.py logic allows.
# Since main.py loads them at module level, we might need to patch it if we want deterministic tests without file dependency.
# However, testing with actual keywords is also good.

def test_heuristic_category_fire():
    text = "There is a large fire in the building"
    assert heuristic_category(text) == "FIRE"

def test_heuristic_category_medical():
    text = "Car accident with injuries, need ambulance"
    # Assuming 'accident' or 'injuries' maps to ACCIDENT or MEDICAL.
    # Based on main.py fallback: "medical", "injury", "ambulance" -> MEDICAL
    # "accident" -> likely TRAFFIC/ACCIDENT if keywords loaded.
    # Let's test fallback specifically if keywords missing, or general if present.
    assert heuristic_category(text) in ["MEDICAL", "ACCIDENT", "TRAFFIC"]

def test_heuristic_category_negation():
    text = "There is no fire here, false alarm"
    assert heuristic_category(text) == "OTHER"

def test_heuristic_category_amharic_fire():
    text = "በስፍራው ትልቅ እሳት አለ"
    assert heuristic_category(text) == "FIRE"

def test_heuristic_category_amharic_negation():
    text = "እሳት የለም"
    assert heuristic_category(text) == "OTHER"

def test_heuristic_category_crime_from_thieves():
    text = "Thieves are breaking in and stealing property"
    assert heuristic_category(text) == "CRIME"

def test_choose_category_overrides_bad_manual_category():
    category, reasoning = choose_category(
        "Thieves are breaking into the house right now",
        model_label="OTHER",
        confidence=0.2,
        manual_category="FIRE",
    )
    assert category == "CRIME"
    assert reasoning == "manual_mismatch:FIRE->CRIME"

def test_vehicle_theft_prefers_crime_over_traffic():
    text = "Someone stole my car and the thieves are driving away"
    assert heuristic_category(text) == "CRIME"

def test_response_category_maps_infrastructure_to_utility():
    assert response_category("INFRASTRUCTURE") == "UTILITY"

def test_crime_verb_overrides_pharmacy_location():
    text = "Thieves near the pharmacy are stealing phones"
    assert heuristic_category(text) == "CRIME"

def test_crime_verb_overrides_hospital_location_in_amharic():
    text = "ሆስፒታል አጠገብ ሌቦች ስልክ ቀሙ"
    assert heuristic_category(text) == "CRIME"

def test_high_certainty_keyword_match_for_short_fire_message():
    assert high_certainty_keyword_match("Fire near the masjid") == "FIRE"

def test_high_certainty_keyword_match_for_short_crime_message():
    assert high_certainty_keyword_match("Thieves near the pharmacy") == "CRIME"

def test_strip_location_nouns_removes_common_entities():
    stripped = strip_location_nouns("Fire near the masjid and pharmacy")
    assert "masjid" not in stripped.lower()
    assert "pharmacy" not in stripped.lower()
