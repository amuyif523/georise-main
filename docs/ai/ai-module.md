# AI Module Summary

- Model: Davlan/afro-xlmr-base fine-tuned for 6 classes (FIRE, MEDICAL, CRIME, TRAFFIC, INFRASTRUCTURE, OTHER).
- Data: ~500–650 labeled Amharic/English/mixed incident texts (title+description); balanced per class.
- Training: Hugging Face Trainer (Colab), ~3 epochs, batch 4–8; metrics ~0.94 macro-F1 (latest run).
- Inference: FastAPI `/classify` returns predicted_category, severity_score, confidence, summary.
- Severity: heuristic booster via keywords (Amharic/English) + baseline per class.
- Integration: Backend IncidentService calls AI_ENDPOINT, stores category/severity + IncidentAIOutput.
