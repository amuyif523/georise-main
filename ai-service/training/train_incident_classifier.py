"""
Minimal training script for the AfroXLMR incident classifier.

Usage (inside a virtualenv):
  pip install -r ../requirements.txt
  python train_incident_classifier.py --data ../data/incidents_labeled.csv --extra_data ../data/incidents_am_aug.csv --output ../models/afroxlmr_incident_classifier

This is sized for a small GPU/Colab. Adjust batch sizes/epochs as needed.
"""

import argparse
import numpy as np
import pandas as pd
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)


def load_dataset(path: str, label_names, extra_paths=None):
    df_list = [pd.read_csv(path)]
    if extra_paths:
        for p in extra_paths:
            df_list.append(pd.read_csv(p))
    df = pd.concat(df_list, ignore_index=True)
    label2id = {l: i for i, l in enumerate(label_names)}
    id2label = {i: l for l, i in label2id.items()}
    df["label"] = df["category"].map(label2id)
    if df["label"].isnull().any():
        # Filter out rows with unknown categories to keep training robust
        unknown_rows = df[df["label"].isnull()]
        unknown_cats = unknown_rows["category"].unique().tolist()
        print(f"Dropping rows with unknown categories: {unknown_cats}")
        df = df[~df["label"].isnull()].copy()
        df["label"] = df["label"].astype(int)
    else:
        df["label"] = df["label"].astype(int)
    df["label"] = df["label"].astype(int)
    ds = Dataset.from_pandas(df[["text", "label"]])
    # Simple split; avoid ClassLabel stratify issues
    ds = ds.train_test_split(test_size=0.2, seed=42)
    return ds, label2id, id2label


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="../data/incidents_labeled.csv", help="CSV with text,category,severity")
    parser.add_argument(
        "--extra_data",
        nargs="*",
        help="Optional additional CSV files to append for training (same schema as --data)",
    )
    parser.add_argument("--model_name", default="Davlan/afro-xlmr-base")
    parser.add_argument("--output", default="../models/afroxlmr_incident_classifier")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=8)
    args = parser.parse_args()

    label_names = ["FIRE", "MEDICAL", "CRIME", "TRAFFIC", "INFRASTRUCTURE", "OTHER"]
    ds, label2id, id2label = load_dataset(args.data, label_names, extra_paths=args.extra_data)

    tokenizer = AutoTokenizer.from_pretrained(args.model_name)

    def preprocess(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            padding="max_length",
            max_length=128,
        )

    train_ds = ds["train"].map(preprocess, batched=True)
    val_ds = ds["test"].map(preprocess, batched=True)
    cols = ["input_ids", "attention_mask", "label"]
    train_ds.set_format(type="torch", columns=cols)
    val_ds.set_format(type="torch", columns=cols)

    model = AutoModelForSequenceClassification.from_pretrained(
        args.model_name,
        num_labels=len(label_names),
        id2label=id2label,
        label2id=label2id,
    )

    def compute_metrics(pred):
        labels = pred.label_ids
        preds = np.argmax(pred.predictions, axis=-1)
        return {
            "accuracy": accuracy_score(labels, preds),
            "macro_f1": f1_score(labels, preds, average="macro"),
        }

    training_args = TrainingArguments(
        output_dir=args.output,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        num_train_epochs=args.epochs,
        learning_rate=2e-5,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)


if __name__ == "__main__":
    main()
