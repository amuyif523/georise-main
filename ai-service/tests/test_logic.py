import pytest
from utils.severity import infer_severity

@pytest.mark.parametrize("label,text,expected", [
    ("FIRE", "This is a fire", 3),  # Base score for FIRE is 3
    ("CRIME", "Theft reported", 2), # Base score for CRIME is 2
    ("MEDICAL", "Injury reported", 4), # Base 3 + Medium keyword "injury" (+1) = 4? No, "injury" is medium.
    # checking logic:
    # BASE: FIRE=3, CRIME=2, MEDICAL=3
    # HIGH (+2): dead, death, killed, explosion, bomb...
    # MEDIUM (+1): injured, injury, burn, serious...
    
    # Cases:
    ("FIRE", "Huge explosion caused fire", 5), # 3 + 2 = 5
    ("MEDICAL", "Person died in accident", 5), # 3 + 2 = 5
    ("TRAFFIC", "Car crash, minor injury", 4), # 3 + 1 = 4
    ("OTHER", "Lost cat", 2), # 2
    ("CRIME", "Stolen bike", 2), # 2
    ("CRIME", "Armed robbery, serious threat", 3), # 2 + 1 (serious) = 3
])
def test_infer_severity(label, text, expected):
    assert infer_severity(label, text) == expected

def test_infer_severity_caps():
    # Test 0-5 clamping
    # If we had a base of 3 and +2+2 (if logic allowed stacking, but it uses elif), max is 5.
    # Let's try to exceed if possible? 
    # Current logic: max 5.
    assert infer_severity("FIRE", "Explosion death killed") == 5 # 3 + 2 = 5.
    
    # Test empty text
    assert infer_severity("OTHER", "") == 2
    assert infer_severity("OTHER", None) == 2
