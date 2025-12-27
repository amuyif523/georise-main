#!/usr/bin/env bash
set -euo pipefail

# Simple helper to run language-stratified eval + golden regression.
# Assumes venv is active and model weights exist locally.

python training/evaluate_model.py \
  --model models/afroxlmr_incident_classifier \
  --data data/incidents_labeled.csv \
  --extra_data data/incidents_am_aug.csv \
  --batch 8 \
  --save_report models/afroxlmr_incident_classifier/eval_report_ci.json

python test_amharic_golden.py
