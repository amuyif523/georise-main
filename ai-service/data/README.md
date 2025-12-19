# Incident Dataset Notes (Amharic/English)

## Columns

- `id` (optional): numeric identifier
- `text`: combined title + description
- `category`: one of `FIRE, MEDICAL, CRIME, TRAFFIC, INFRASTRUCTURE, OTHER`
- `severity`: 0-5 (optional for training, kept for reference)
- `lang`: `am`, `en`, or `mix` (optional but recommended)

## Label QA Checklist

- Verify `category` is in the allowed set; no typos or variants (e.g., “traffic ”).
- Ensure `text` is non-empty, UTF-8 clean, and >15 chars unless intentionally short.
- Remove duplicates or near-duplicates unless needed for balance.
- Confirm `lang` matches the text; mark code-switch as `mix`.
- For Amharic rows, spot-check for garbled characters; fix before merge.
- Keep class balance roughly even; add rows where low-count classes exist.

## Tools

- Validate/audit: `python ../training/validate_dataset.py --data incidents_labeled.csv --extra incidents_am_aug.csv`
- Train with extra data: `python ../training/train_incident_classifier.py --data incidents_labeled.csv --extra_data incidents_am_aug.csv`
- Golden set regression: `python ../test_amharic_golden.py` (AI service running on :8001)

## Augmentation workflow

1. Draft new rows in `incidents_am_aug.csv` (same schema as above).
2. Run validator to check categories/lang/length/dupes.
3. Train with `--extra_data incidents_am_aug.csv`; keep best checkpoint in `models/afroxlmr_incident_classifier/`.
4. Run golden regression; investigate any misclassifications before deploying.
