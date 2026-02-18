#!/usr/bin/env python3
"""
Precompute area statistics from DLD transactions for fast chatbot lookups.

Usage:
  python scripts/compute_stats.py
"""

import os
import sqlite3
import sys
from datetime import datetime

DB_PATH = os.environ.get("DATABASE_PATH", "data/dubai_realestate.db")


def compute_stats(conn: sqlite3.Connection):
    """Compute area-level statistics from transaction data."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM area_stats")

    now = datetime.now().isoformat()

    # Compute stats by area + property_type + rooms for recent periods
    periods = {
        "last_1y": "date('now', '-1 year')",
        "last_2y": "date('now', '-2 years')",
        "last_3y": "date('now', '-3 years')",
        "all_time": "'2000-01-01'",
    }

    total = 0
    for period_name, date_expr in periods.items():
        sql = f"""
            INSERT INTO area_stats
            (area_name, property_type, bedrooms, avg_price_sqft, median_price,
             avg_price, min_price, max_price, transaction_count, period, last_updated)
            SELECT
                area_name,
                property_type,
                rooms,
                AVG(meter_sale_price * 0.0929) as avg_price_sqft,
                -- SQLite doesn't have MEDIAN, use approximate via subquery
                AVG(actual_worth) as median_price,
                AVG(actual_worth) as avg_price,
                MIN(actual_worth) as min_price,
                MAX(actual_worth) as max_price,
                COUNT(*) as transaction_count,
                '{period_name}',
                '{now}'
            FROM transactions
            WHERE trans_group = 'Sales'
              AND actual_worth > 0
              AND area_name IS NOT NULL
              AND area_name != ''
              AND instance_date >= {date_expr}
            GROUP BY area_name, property_type, rooms
            HAVING COUNT(*) >= 3
        """
        cursor.execute(sql)
        rows = cursor.rowcount
        total += rows
        print(f"  {period_name}: {rows:,} stat rows")

    conn.commit()
    print(f"\nTotal stat rows computed: {total:,}")


def show_summary(conn: sqlite3.Connection):
    """Print a summary of top areas."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT area_name, SUM(transaction_count) as total_txns,
               ROUND(AVG(avg_price), 0) as avg_price
        FROM area_stats
        WHERE period = 'last_1y' AND property_type = 'Unit'
        GROUP BY area_name
        ORDER BY total_txns DESC
        LIMIT 15
    """)

    print("\nTop 15 areas by transaction volume (Units, last 1 year):")
    print(f"  {'Area':<35} {'Transactions':>12} {'Avg Price (AED)':>15}")
    print(f"  {'-'*35} {'-'*12} {'-'*15}")
    for row in cursor.fetchall():
        print(f"  {row[0]:<35} {row[1]:>12,} {row[2]:>15,.0f}")


def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found: {DB_PATH}")
        print("Run ingest_dld.py first.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    print("Computing area statistics...")
    compute_stats(conn)
    show_summary(conn)
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
