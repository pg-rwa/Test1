#!/usr/bin/env python3
"""
Ingest DLD transaction data from Dubai Pulse CSV into SQLite.

Usage:
  python scripts/ingest_dld.py                          # Downloads CSV from Dubai Pulse
  python scripts/ingest_dld.py --csv path/to/file.csv   # Uses a local CSV file
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("pandas is required. Install with: pip install pandas")
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None

CSV_URL = (
    "https://www.dubaipulse.gov.ae/dataset/3b25a6f5-9077-49d7-8a1e-bc6d5dea88fd"
    "/resource/a37511b0-ea36-485d-bccd-2d6cb24507e7/download/transactions.csv"
)

DB_PATH = os.environ.get("DATABASE_PATH", "data/dubai_realestate.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

# Column mapping: CSV column name -> DB column name
COLUMN_MAP = {
    "instance_date": "instance_date",
    "trans_group_en": "trans_group",
    "procedure_name_en": "procedure_name",
    "property_type_en": "property_type",
    "property_sub_type_en": "property_sub_type",
    "area_name_en": "area_name",
    "building_name_en": "building_name",
    "project_name_en": "project_name",
    "actual_worth": "actual_worth",
    "meter_sale_price": "meter_sale_price",
    "prop_sb_type_name_en": "property_sub_type",
    "rooms_en": "rooms",
    "nearest_landmark_en": "nearest_landmark",
    "nearest_metro_en": "nearest_metro",
    "nearest_mall_en": "nearest_mall",
}

# Columns we care about (try both naming conventions)
DESIRED_COLS = [
    "instance_date",
    "trans_group_en",
    "procedure_name_en",
    "property_type_en",
    "property_sub_type_en",
    "area_name_en",
    "building_name_en",
    "project_name_en",
    "actual_worth",
    "meter_sale_price",
    "rooms_en",
    "nearest_landmark_en",
    "nearest_metro_en",
    "nearest_mall_en",
]


def download_csv(dest: str) -> str:
    """Download the DLD transactions CSV from Dubai Pulse."""
    if requests is None:
        print("ERROR: 'requests' package is required for downloading.")
        print("Install with: pip install requests")
        sys.exit(1)

    print(f"Downloading DLD transactions CSV from Dubai Pulse...")
    print(f"URL: {CSV_URL}")
    resp = requests.get(CSV_URL, stream=True, timeout=300)
    resp.raise_for_status()

    total = int(resp.headers.get("content-length", 0))
    downloaded = 0

    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = (downloaded / total) * 100
                print(f"\r  Progress: {pct:.1f}% ({downloaded:,} / {total:,} bytes)", end="")

    print(f"\n  Saved to: {dest}")
    return dest


def init_db(db_path: str) -> sqlite3.Connection:
    """Initialize the SQLite database with schema."""
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    conn = sqlite3.connect(db_path)

    schema_sql = SCHEMA_PATH.read_text()
    conn.executescript(schema_sql)
    print(f"Database initialized at: {db_path}")
    return conn


def normalize_area_name(name: str) -> str:
    """Normalize area names to title case for consistency."""
    if not name or not isinstance(name, str):
        return ""
    return name.strip().title()


def ingest_csv(csv_path: str, conn: sqlite3.Connection) -> int:
    """Read CSV, clean data, and insert into SQLite."""
    print(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"  Raw rows: {len(df):,}")
    print(f"  Columns found: {list(df.columns)[:10]}... ({len(df.columns)} total)")

    # Find available columns (CSV column names vary between downloads)
    available = []
    for col in DESIRED_COLS:
        if col in df.columns:
            available.append(col)

    if not available:
        print(f"ERROR: None of the expected columns found in CSV.")
        print(f"  Expected: {DESIRED_COLS[:5]}...")
        print(f"  Found: {list(df.columns)[:10]}...")
        sys.exit(1)

    print(f"  Using {len(available)} columns: {available}")

    # Select and rename columns
    df = df[available].copy()
    rename_map = {col: COLUMN_MAP.get(col, col) for col in available}
    df = df.rename(columns=rename_map)

    # Handle property_size if available under alternate name
    if "procedure_area" in df.columns:
        df = df.rename(columns={"procedure_area": "property_size_sqm"})
    elif "property_size_sqm" not in df.columns:
        df["property_size_sqm"] = None

    # Ensure all target columns exist
    for col in [
        "instance_date", "trans_group", "procedure_name", "property_type",
        "property_sub_type", "area_name", "building_name", "project_name",
        "actual_worth", "meter_sale_price", "property_size_sqm", "rooms",
        "nearest_landmark", "nearest_metro", "nearest_mall",
    ]:
        if col not in df.columns:
            df[col] = None

    # Clean data
    df["area_name"] = df["area_name"].apply(normalize_area_name)
    df["building_name"] = df["building_name"].fillna("").astype(str).str.strip().str.title()
    df["project_name"] = df["project_name"].fillna("").astype(str).str.strip().str.title()
    df["actual_worth"] = pd.to_numeric(df["actual_worth"], errors="coerce")
    df["meter_sale_price"] = pd.to_numeric(df["meter_sale_price"], errors="coerce")
    df["property_size_sqm"] = pd.to_numeric(df["property_size_sqm"], errors="coerce")

    # Filter to sales transactions only (most relevant for price comparison)
    if "trans_group" in df.columns:
        sales_count = len(df[df["trans_group"] == "Sales"])
        print(f"  Sales transactions: {sales_count:,}")

    # Clear existing data and insert
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions")
    print("  Cleared existing transaction data.")

    # Insert in batches
    insert_cols = [
        "instance_date", "trans_group", "procedure_name", "property_type",
        "property_sub_type", "area_name", "building_name", "project_name",
        "actual_worth", "meter_sale_price", "property_size_sqm", "rooms",
        "nearest_landmark", "nearest_metro", "nearest_mall",
    ]

    placeholders = ",".join(["?"] * len(insert_cols))
    insert_sql = f"INSERT INTO transactions ({','.join(insert_cols)}) VALUES ({placeholders})"

    batch_size = 10000
    total_inserted = 0

    for start in range(0, len(df), batch_size):
        batch = df.iloc[start : start + batch_size]
        rows = [tuple(row[col] if pd.notna(row[col]) else None for col in insert_cols) for _, row in batch.iterrows()]
        cursor.executemany(insert_sql, rows)
        total_inserted += len(rows)
        print(f"\r  Inserted: {total_inserted:,} / {len(df):,}", end="")

    conn.commit()
    print(f"\n  Done! {total_inserted:,} transactions loaded.")
    return total_inserted


def main():
    parser = argparse.ArgumentParser(description="Ingest DLD transaction data into SQLite")
    parser.add_argument("--csv", help="Path to local CSV file (skips download)")
    parser.add_argument("--db", default=DB_PATH, help=f"Database path (default: {DB_PATH})")
    args = parser.parse_args()

    conn = init_db(args.db)

    if args.csv:
        csv_path = args.csv
    else:
        csv_path = "data/transactions.csv"
        if not os.path.exists(csv_path):
            download_csv(csv_path)
        else:
            print(f"Using existing CSV: {csv_path}")

    count = ingest_csv(csv_path, conn)
    conn.close()
    print(f"\nIngestion complete. {count:,} records in database.")


if __name__ == "__main__":
    main()
