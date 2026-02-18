#!/usr/bin/env python3
"""
Ingest PropertyFinder listings via RapidAPI into SQLite.

Usage:
  python scripts/ingest_propertyfinder.py                        # Fetches from RapidAPI
  python scripts/ingest_propertyfinder.py --csv path/to/file.csv # Uses a local CSV file

Requires RAPIDAPI_KEY environment variable (or in .env.local).
"""

import argparse
import json
import os
import sqlite3
import sys
import time
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

DB_PATH = os.environ.get("DATABASE_PATH", "data/dubai_realestate.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

RAPIDAPI_HOST = "uae-real-estate-api-propertyfinder-ae-data.p.rapidapi.com"
RAPIDAPI_BASE = f"https://{RAPIDAPI_HOST}"


def load_env():
    """Load env vars from .env.local if present."""
    env_file = Path(__file__).parent.parent / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                if value and key.strip() not in os.environ:
                    os.environ[key.strip()] = value.strip()


def init_db(db_path: str) -> sqlite3.Connection:
    """Initialize the SQLite database with schema."""
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    conn = sqlite3.connect(db_path)
    schema_sql = SCHEMA_PATH.read_text()
    conn.executescript(schema_sql)
    return conn


def fetch_listings_rapidapi(max_pages: int = 50) -> list[dict]:
    """Fetch property listings from RapidAPI."""
    if requests is None:
        print("ERROR: 'requests' package required. Install with: pip install requests")
        sys.exit(1)

    api_key = os.environ.get("RAPIDAPI_KEY", "")
    if not api_key:
        print("ERROR: RAPIDAPI_KEY not set.")
        print("Get a free key at: https://rapidapi.com/market-data-point1-market-data-point-default/api/uae-real-estate-api-propertyfinder-ae-data")
        sys.exit(1)

    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }

    all_listings = []

    # Fetch residential sales listings for Dubai
    property_types = ["apartment", "villa", "townhouse", "penthouse"]

    for prop_type in property_types:
        print(f"\nFetching {prop_type} listings...")
        page = 1

        while page <= max_pages:
            params = {
                "city": "dubai",
                "property_type": prop_type,
                "purpose": "for-sale",
                "page": str(page),
            }

            try:
                resp = requests.get(
                    f"{RAPIDAPI_BASE}/properties",
                    headers=headers,
                    params=params,
                    timeout=30,
                )

                if resp.status_code == 429:
                    print(f"  Rate limited, waiting 2s...")
                    time.sleep(2)
                    continue

                if resp.status_code != 200:
                    print(f"  API error {resp.status_code}: {resp.text[:200]}")
                    break

                data = resp.json()
                listings = data.get("results", data.get("data", data.get("listings", [])))

                if not listings:
                    print(f"  No more results at page {page}.")
                    break

                all_listings.extend(listings)
                print(f"  Page {page}: {len(listings)} listings (total: {len(all_listings)})")
                page += 1
                time.sleep(0.5)  # Rate limit courtesy

            except requests.exceptions.RequestException as e:
                print(f"  Request error: {e}")
                time.sleep(2)
                page += 1

    print(f"\nTotal listings fetched: {len(all_listings)}")
    return all_listings


def normalize_listing(raw: dict) -> dict:
    """Normalize a raw API listing into our schema."""
    # Handle various API response formats
    return {
        "listing_id": str(raw.get("id", raw.get("listing_id", raw.get("reference", "")))),
        "title": raw.get("title", raw.get("name", "")),
        "price": raw.get("price", raw.get("asking_price", None)),
        "property_type": raw.get("property_type", raw.get("type", raw.get("category", ""))),
        "bedrooms": raw.get("bedrooms", raw.get("beds", raw.get("bedroom", None))),
        "bathrooms": raw.get("bathrooms", raw.get("baths", raw.get("bathroom", None))),
        "size_sqft": raw.get("size", raw.get("area", raw.get("size_sqft", raw.get("built_up_area", None)))),
        "area": raw.get("location", raw.get("area", raw.get("community", raw.get("neighbourhood", "")))),
        "building_name": raw.get("building", raw.get("building_name", raw.get("project", ""))),
        "furnishing": raw.get("furnishing", raw.get("furnished", "")),
        "listing_url": raw.get("url", raw.get("link", raw.get("listing_url", ""))),
        "agent_name": raw.get("agent_name", raw.get("agent", {}).get("name", "") if isinstance(raw.get("agent"), dict) else ""),
        "description": raw.get("description", ""),
        "amenities": json.dumps(raw.get("amenities", [])) if isinstance(raw.get("amenities"), list) else raw.get("amenities", ""),
        "latitude": raw.get("latitude", raw.get("lat", raw.get("geo", {}).get("lat") if isinstance(raw.get("geo"), dict) else None)),
        "longitude": raw.get("longitude", raw.get("lng", raw.get("lon", raw.get("geo", {}).get("lng") if isinstance(raw.get("geo"), dict) else None))),
        "listed_date": raw.get("listed_date", raw.get("created_at", raw.get("publish_date", ""))),
    }


def normalize_area_name(name) -> str:
    """Normalize area name to title case."""
    if not name or not isinstance(name, str):
        return ""
    return name.strip().title()


def ingest_listings(listings: list[dict], conn: sqlite3.Connection) -> int:
    """Insert normalized listings into SQLite."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM listings")
    print("Cleared existing listings data.")

    insert_sql = """
        INSERT OR IGNORE INTO listings
        (listing_id, title, price, property_type, bedrooms, bathrooms, size_sqft,
         area, building_name, furnishing, listing_url, agent_name, description,
         amenities, latitude, longitude, listed_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    count = 0
    for raw in listings:
        listing = normalize_listing(raw)
        listing["area"] = normalize_area_name(listing["area"])

        try:
            cursor.execute(insert_sql, (
                listing["listing_id"], listing["title"], listing["price"],
                listing["property_type"], listing["bedrooms"], listing["bathrooms"],
                listing["size_sqft"], listing["area"], listing["building_name"],
                listing["furnishing"], listing["listing_url"], listing["agent_name"],
                listing["description"], listing["amenities"], listing["latitude"],
                listing["longitude"], listing["listed_date"],
            ))
            count += 1
        except Exception as e:
            print(f"  Skip listing {listing.get('listing_id')}: {e}")

    conn.commit()
    print(f"Inserted {count:,} listings.")
    return count


def ingest_csv(csv_path: str, conn: sqlite3.Connection) -> int:
    """Ingest listings from a CSV file."""
    print(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"  Rows: {len(df):,}")

    listings = df.to_dict("records")
    return ingest_listings(listings, conn)


def main():
    load_env()

    parser = argparse.ArgumentParser(description="Ingest PropertyFinder listings into SQLite")
    parser.add_argument("--csv", help="Path to local CSV file (skips API)")
    parser.add_argument("--db", default=DB_PATH, help=f"Database path (default: {DB_PATH})")
    parser.add_argument("--max-pages", type=int, default=50, help="Max pages per property type (default: 50)")
    args = parser.parse_args()

    conn = init_db(args.db)

    if args.csv:
        count = ingest_csv(args.csv, conn)
    else:
        listings = fetch_listings_rapidapi(max_pages=args.max_pages)
        if listings:
            # Save raw data as backup
            raw_path = "data/propertyfinder_raw.json"
            os.makedirs("data", exist_ok=True)
            with open(raw_path, "w") as f:
                json.dump(listings, f, indent=2)
            print(f"Raw data saved to: {raw_path}")
            count = ingest_listings(listings, conn)
        else:
            print("No listings fetched. Check your RAPIDAPI_KEY.")
            count = 0

    conn.close()
    print(f"\nDone. {count:,} listings in database.")


if __name__ == "__main__":
    main()
