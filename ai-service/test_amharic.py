import requests

API_URL = "http://localhost:8001/classify"

# Amharic-heavy smoke tests to ensure tokenizer/model handle UTF-8 cleanly
test_cases = [
    {
        "title": "እሳት በአፓርታማ",
        "description": "ከፍተኛ ጭስ በቤት ውስጥ እየወጣ ነው፣ ሰዎች እየወጡ ናቸው።",
        "expected": "FIRE",
    },
    {
        "title": "የህክምና አስቸኳይ",
        "description": "ሰው በመንገድ ላይ ወድቆ ደም እየፈሰሰ ነው፣ አስቸኳይ አምቡላንስ ይፈልጋል።",
        "expected": "MEDICAL",
    },
    {
        "title": "ትራፊክ አደጋ",
        "description": "ሁለት መኪናዎች በቦሌ አቅራቢያ ተጋጭተዋል፣ መንገድ ተዘግቷል።",
        "expected": "TRAFFIC",
    },
    {
        "title": "ስርቆት በገበያ",
        "description": "ወንጀለኛ ሰው ተደፍሮ ቦርሳው ተሰርቷል፣ ፖሊስ በፍጥነት ይደርሱ።",
        "expected": "CRIME",
    },
    {
        "title": "ኃይል ተቋርጧል",
        "description": "በአዲስ አበባ ሶፍ ከተማ መብራት ተቋርጦአል፣ ውሃ ፓምፕም ተሰናክሏል።",
        "expected": "INFRASTRUCTURE",
    },
]


def test_amharic_classification():
    print(f"Testing Amharic Classification against {API_URL}...\n")

    for case in test_cases:
        payload = {"title": case["title"], "description": case["description"]}

        try:
            response = requests.post(API_URL, json=payload)
            if response.status_code == 200:
                result = response.json()
                print(f"Input: {case['description']}")
                print(
                    f"Predicted: {result['predicted_category']} (Confidence: {result['confidence']:.2f})"
                )
                print(f"Severity: {result['severity_score']}")
                print(f"Expected: {case['expected']}")
                print("-" * 30)
            else:
                print(f"Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Connection failed: {e}")
            print("Make sure the AI service is running on port 8001")
            return


if __name__ == "__main__":
    test_amharic_classification()
