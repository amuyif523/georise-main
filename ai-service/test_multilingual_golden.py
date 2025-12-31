"""
Golden-set regression for English/mixed incidents.
Requires the AI service running locally on port 8001.

Usage:
  python test_multilingual_golden.py
"""

import csv
from pathlib import Path
import time

import requests

API_URL = "http://localhost:8001/classify"
GOLDEN_PATH = Path("data/golden_multilingual.csv")


def wait_for_service():
  for _ in range(10):
    try:
      res = requests.get("http://localhost:8001/health", timeout=2)
      if res.status_code == 200:
        return
    except Exception:
      time.sleep(1)


def run():
  wait_for_service()
  rows = list(csv.DictReader(GOLDEN_PATH.open(encoding="utf-8")))
  total = len(rows)
  correct = 0
  results = []

  print(f"Running golden regression against {API_URL} ({total} cases)...\n")

  for row in rows:
    payload = {"title": "", "description": row["text"]}
    res = requests.post(API_URL, json=payload, timeout=10)
    if res.status_code != 200:
      print(f"Case {row['id']} error: {res.status_code} {res.text}")
      continue
    data = res.json()
    pred = data.get("predicted_category")
    ok = pred == row["category"]
    correct += int(ok)
    results.append((row["id"], row["category"], pred, ok, data.get("confidence")))

  accuracy = correct / total if total else 0
  print(f"\nAccuracy: {correct}/{total} = {accuracy:.2%}")
  print("Mismatches:")
  for rid, gold, pred, ok, conf in results:
    if not ok:
      print(f"  id={rid}: expected {gold}, got {pred} (conf={conf})")

  if accuracy < 0.9:
    raise SystemExit("Golden accuracy below threshold")


if __name__ == "__main__":
  run()
