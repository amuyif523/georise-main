import requests
import json
import time
from typing import List, Dict

# Configuration
API_URL = "http://localhost:8001/classify"
SECRET = "69f4d9d99112725f95e13a299905e3e740a592e538dbe59bd57d2fbebaaba082"

# Test Suite: [Message, Manual Selection, Expected Outcome]
TEST_CASES = [
    # 1. Standard Logic
    ["Large fire breaking out in the kitchen of the restaurant!", "FIRE", "FIRE"],
    ["Someone just snatched my phone and ran towards the station", "CRIME", "CRIME"],
    
    # 2. The "User is Wrong" Override Test
    ["Thieves are in my backyard with weapons, help!", "FIRE", "CRIME"], 
    ["My wife is having a heart attack, send an ambulance", "TRAFFIC", "MEDICAL"],
    
    # 3. The "Entity Conflict" Test (The Pharmacy Case)
    ["There are thieves near the pharmacy breaking windows", "MEDICAL", "CRIME"],
    ["A car crashed into the clinic entrance", "MEDICAL", "TRAFFIC"],
    
    # 4. Amharic Logic (Afro-XLMR specialized)
    ["ቤት ውስጥ እሳት ተነስቷል እባካችሁ እርዱን", "FIRE", "FIRE"], # Fire in house
    ["ሌቦች መኪናዬን እየሰረቁ ነው", "CRIME", "CRIME"],        # Thieves stealing car
    ["ከባድ የመኪና አደጋ ቦሌ አካባቢ ደርሷል", "TRAFFIC", "TRAFFIC"], # Car accident
    
    # 5. Label Mismatch / Normalization Test
    ["A power line fell and is sparking near a tree", "FIRE", "UTILITY"]
]

def run_batch_test():
    passed = 0
    total = len(TEST_CASES)
    
    print(f"\n🚀 GEORISE AI BATCH VALIDATOR | Target: {API_URL}")
    print("=" * 70)
    
    headers = {
        "Authorization": f"Bearer {SECRET}",
        "Content-Type": "application/json"
    }

    for msg, manual, expected in TEST_CASES:
        payload = {
            "title": "Automated Batch Test",
            "description": msg,
            "metadata": {"manualCategory": manual}
        }
        
        start_time = time.time()
        try:
            response = requests.post(API_URL, headers=headers, json=payload, timeout=5)
            latency = (time.time() - start_time) * 1000
            
            if response.status_code != 200:
                print(f"❌ HTTP {response.status_code} | Raw: {response.text}")
                continue

            result = response.json()
            
            # Key Hunter: Prioritizing 'category' but checking for 'label' or 'predicted_category'
            predicted = result.get("category") or result.get("predicted_category") or result.get("label")
            
            # Normalization check (Handling the Infrastructure -> Utility drift)
            if predicted == "INFRASTRUCTURE": predicted = "UTILITY"
            
            status = "✅ PASS" if predicted == expected else "❌ FAIL"
            if status == "✅ PASS": passed += 1
            
            print(f"{status} | Input: {msg[:40]}...")
            print(f"       | Result: [Manual: {manual}] -> [AI: {predicted}] (Expected: {expected})")
            print(f"       | Speed: {latency:.2f}ms")
            
            if result.get("reasoning"):
                print(f"       | Reasoning: {result['reasoning']}")
            print("-" * 40)
            
        except requests.exceptions.Timeout:
            print(f"⏰ TIMEOUT | Service took too long on: {msg[:20]}...")
        except Exception as e:
            print(f"💥 ERROR: {e}")
            break

    print("=" * 70)
    accuracy = (passed / total) * 100
    print(f"📊 FINAL SCORE: {passed}/{total} Passed ({accuracy:.1f}%)")
    
    if accuracy < 100:
        print("\n💡 TIP: If 'AI: None' appears, your main.py is missing a 'category' key in the return JSON.")
    print("=" * 70)

if __name__ == "__main__":
    run_batch_test()