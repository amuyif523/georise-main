import pytest
from main import heuristic_category, KEYWORDS

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
