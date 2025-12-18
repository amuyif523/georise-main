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

Training:

- Dataset: `data/incidents_labeled.csv`
- Script: `python training/train_incident_classifier.py --data data/incidents_labeled.csv --output models/afroxlmr_incident_classifier --epochs 3 --batch 4`

Latest training (batch=4, epochs=3) on ~650 rows:

- Validation accuracy: ~0.95
- Validation macro F1: ~0.94

Backups:

- Keep a copy of `data/incidents_labeled.csv` and the trained `models/afroxlmr_incident_classifier/` outside git (local drive or artifact storage).
