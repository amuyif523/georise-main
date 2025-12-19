"""
Quick dataset validation and audit for incident classification data.

Usage:
  python validate_dataset.py --data ../data/incidents_labeled.csv
  python validate_dataset.py --data ../data/incidents_labeled.csv --extra ../data/incidents_am_aug.csv
"""

import argparse
from collections import Counter
from pathlib import Path
from typing import Iterable, List, Optional

import pandas as pd

LABEL_NAMES = ["FIRE", "MEDICAL", "CRIME", "TRAFFIC", "INFRASTRUCTURE", "OTHER"]


def load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    expected_cols = {"text", "category"}
    missing = expected_cols - set(df.columns)
    if missing:
        raise ValueError(f"{path} is missing required columns: {missing}")
    return df


def validate(df: pd.DataFrame, name: str) -> None:
    print(f"\n=== Audit: {name} ===")
    print(f"Rows: {len(df)}")

    # Basic null checks
    null_text = df["text"].isnull().sum()
    null_cat = df["category"].isnull().sum()
    if null_text or null_cat:
        print(f"Null text rows: {null_text}, null category rows: {null_cat}")

    # Category validity
    invalid_cats = set(df["category"].unique()) - set(LABEL_NAMES)
    if invalid_cats:
        print(f"Invalid categories found: {sorted(invalid_cats)}")

    # Distribution
    cat_counts = Counter(df["category"])
    print("Category distribution:")
    for k in LABEL_NAMES:
        print(f"  {k:15s} {cat_counts.get(k, 0)}")

    # Language distribution (optional column)
    if "lang" in df.columns:
        lang_counts = Counter(df["lang"])
        print("Language distribution:")
        for lang, count in lang_counts.most_common():
            print(f"  {lang:5s} {count}")

    # Duplicate text check
    dupes = df["text"].duplicated().sum()
    if dupes:
        print(f"Duplicate text rows: {dupes}")

    # Length statistics
    lengths = df["text"].astype(str).apply(len)
    print(
        f"Length chars: min={lengths.min()}, p50={int(lengths.median())}, p90={int(lengths.quantile(0.9))}, max={lengths.max()}"
    )


def main(data: Path, extra: Optional[Iterable[Path]]) -> None:
    base = load_csv(data)
    validate(base, f"{data.name}")

    merged = base.copy()
    if extra:
        for p in extra:
            df_extra = load_csv(p)
            validate(df_extra, f"{p.name}")
            merged = pd.concat([merged, df_extra], ignore_index=True)

        print("\n=== Combined dataset ===")
        validate(merged, "combined")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("../data/incidents_labeled.csv"))
    parser.add_argument(
        "--extra",
        type=Path,
        nargs="*",
        help="Optional extra CSV files to include in audit (same schema as base).",
    )
    args = parser.parse_args()
    main(args.data, args.extra)
