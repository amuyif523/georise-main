# AI Service (FastAPI)

How to run locally (CPU):

1. Create/activate venv:
   - `cd ai-service`
   - `python -m venv venv`
   - `.\venv\Scripts\activate`
2. Install deps: `pip install -r requirements.txt`
3. Start service: `uvicorn main:app --reload --port 8001`
4. Health check: `http://localhost:8001/health`

Model weights:

- Fine-tuned weights live in `models/afroxlmr_incident_classifier/`.
- Do **not** commit large weight files to git. Keep them local or store externally.
- Dependencies: `torch==2.3.1`, `transformers==4.46.3`, `numpy<2` (pin to avoid ABI issues with torch builds). The service will fall back to the base `Davlan/afro-xlmr-base` model if fine-tuned weights are absent so deployments stay live.
- Drop-in: place weights + `metadata.json` under `ai-service/models/afroxlmr_incident_classifier/` (metadata.version_tag is exposed via `/health`).

Training:

- Dataset: `data/incidents_labeled.csv`
- Extra Amharic/mixed augmentation: `data/incidents_am_aug.csv` (append with `--extra_data`)
- Script: `python training/train_incident_classifier.py --data data/incidents_labeled.csv --extra_data data/incidents_am_aug.csv --output models/afroxlmr_incident_classifier --epochs 3 --batch 4 --version_tag amharic-aug-2025-12`
- Stratified eval: `python training/evaluate_model.py --model models/afroxlmr_incident_classifier --data data/incidents_labeled.csv --extra_data data/incidents_am_aug.csv --batch 8 --save_report models/afroxlmr_incident_classifier/eval_report.json`
- Golden regression (quick): `python test_amharic_golden.py` (Amharic), `python test_multilingual_golden.py` (English/mixed). Both hit a running service on `:8001` and expect >=90% accuracy on the curated golden sets in `data/`.
- Data sanity: `python training/validate_dataset.py --data data/incidents_labeled.csv` to check category balance/nulls.

Latest training (batch=4, epochs=3) on ~650 rows:

- Validation accuracy: ~0.95
- Validation macro F1: ~0.94

Backups:

- Keep a copy of `data/incidents_labeled.csv` and the trained `models/afroxlmr_incident_classifier/` outside git (local drive or artifact storage).
- Use `training/validate_dataset.py` to audit new data, `test_amharic_golden.py` to check regressions (AI service running on :8001), and `training/evaluate_model.py` for full per-language metrics.
- Model metadata and version tag are stored in `models/afroxlmr_incident_classifier/metadata.json` and surfaced via `/health` in `model` field.
