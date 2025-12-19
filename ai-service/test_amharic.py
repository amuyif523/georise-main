import requests

API_URL = "http://localhost:8001/classify"

# Amharic-heavy smoke tests to ensure tokenizer/model handle UTF-8 cleanly
test_cases = [
    {
        "title": "በቦሌ የተነሳ የእሳት አደጋ",
        "description": "በቦሌ አካባቢ ቤት እሳት ተነስቷል። ሰዎች በውስጥ አሉ ይታያል።",
        "expected": "FIRE",
    },
    {
        "title": "አደጋ በመኪና ጭነት መንገድ ላይ",
        "description": "በሜክሲኮ ዙሪያ መኪናዎች ተጋጭተዋል። ታማሚዎች አሉ ማለት ይቻላል።",
        "expected": "TRAFFIC",
    },
    {
        "title": "ታካሚ ወዲያውኑ ሕክምና ይፈልጋል",
        "description": "ሰው በሕይወት አደጋ ያለ የልብ ህመም ተያይዞበታል።",
        "expected": "MEDICAL",
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
                print("-" * 30)
            else:
                print(f"Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Connection failed: {e}")
            print("Make sure the AI service is running on port 8001")
            return


if __name__ == "__main__":
    test_amharic_classification()
