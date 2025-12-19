"""
Evaluate a trained incident classifier with per-language metrics.

Usage:
  python evaluate_model.py --model ../models/afroxlmr_incident_classifier --data ../data/incidents_labeled.csv --extra_data ../data/incidents_am_aug.csv
"""

import argparse
import json
from pathlib import Path

import pandas as pd
from datasets import Dataset
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

LABEL_NAMES = ["FIRE", "MEDICAL", "CRIME", "TRAFFIC", "INFRASTRUCTURE", "OTHER"]


def load_dataset(paths):
    dfs = [pd.read_csv(p) for p in paths]
    df = pd.concat(dfs, ignore_index=True)
    label2id = {l: i for i, l in enumerate(LABEL_NAMES)}
    df["label"] = df["category"].map(label2id).astype(int)
    return df, label2id


def _metrics(labels, preds, num_labels: int):
    total = len(labels)
    correct = sum(1 for a, b in zip(labels, preds) if a == b)
    accuracy = correct / total if total else 0.0

    per_label_f1 = []
    for cls in range(num_labels):
        tp = sum(1 for a, p in zip(labels, preds) if a == cls and p == cls)
        fp = sum(1 for a, p in zip(labels, preds) if a != cls and p == cls)
        fn = sum(1 for a, p in zip(labels, preds) if a == cls and p != cls)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        per_label_f1.append(f1)
    macro_f1 = sum(per_label_f1) / num_labels if num_labels else 0.0
    return {"accuracy": accuracy, "macro_f1": macro_f1}


def evaluate(model_path: Path, data_paths, batch_size: int):
    df, label2id = load_dataset(data_paths)
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()

    def preprocess(batch):
        return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=128)

    ds = Dataset.from_pandas(df[["text", "label", "lang"]] if "lang" in df.columns else df[["text", "label"]])
    ds = ds.map(preprocess, batched=True)
    ds.set_format(type="torch", columns=["input_ids", "attention_mask", "label"])

    # Manual batching to avoid full-mem load
    all_preds: list[int] = []
    for i in range(0, len(ds), batch_size):
        batch = ds.select(range(i, min(i + batch_size, len(ds))))
        with torch.no_grad():  # type: ignore[name-defined]
            outputs = model(
                input_ids=batch["input_ids"],
                attention_mask=batch["attention_mask"],
            )
            preds = outputs.logits.argmax(dim=-1).cpu().tolist()
            all_preds.extend(preds)

    labels = list(ds["label"])
    base_metrics = _metrics(labels, all_preds, num_labels=len(LABEL_NAMES))

    per_lang = {}
    if "lang" in df.columns:
        for lang in df["lang"].unique():
            mask = df["lang"] == lang
            idx = [i for i, flag in enumerate(mask) if flag]
            l_labels = [labels[i] for i in idx]
            l_preds = [all_preds[i] for i in idx]
            per_lang[lang] = {**_metrics(l_labels, l_preds, num_labels=len(LABEL_NAMES)), "count": int(mask.sum())}

    report = {"overall": base_metrics, "per_language": per_lang}
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, default=Path("../models/afroxlmr_incident_classifier"))
    parser.add_argument("--data", type=Path, nargs="+", default=[Path("../data/incidents_labeled.csv")])
    parser.add_argument("--extra_data", type=Path, nargs="*", help="Additional CSVs to include")
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--save_report", type=Path, help="Optional path to save JSON report")
    args = parser.parse_args()

    paths = args.data + (args.extra_data or [])
    report = evaluate(args.model, paths, batch_size=args.batch)

    print(json.dumps(report, indent=2))
    if args.save_report:
        Path(args.save_report).write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Saved report to {args.save_report}")
