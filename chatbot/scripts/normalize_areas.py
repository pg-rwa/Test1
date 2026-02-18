#!/usr/bin/env python3
"""
Build area name normalization mapping between DLD and PropertyFinder datasets.

Usage:
  python scripts/normalize_areas.py
"""

import os
import sqlite3
import sys
from pathlib import Path

DB_PATH = os.environ.get("DATABASE_PATH", "data/dubai_realestate.db")

# Known area name mappings: canonical -> [aliases]
KNOWN_MAPPINGS = {
    "Al Barsha": ["Al Barsha", "Al Barsha First", "Al Barsha Second", "Al Barsha Third"],
    "Arabian Ranches": ["Arabian Ranches", "Arabian Ranches 2", "Arabian Ranches Ii"],
    "Business Bay": ["Business Bay"],
    "City Walk": ["City Walk"],
    "Creek Harbour": ["Dubai Creek Harbour", "Creek Harbour"],
    "DAMAC Hills": ["Damac Hills", "Damac Hills 2", "DAMAC Hills"],
    "DIFC": ["Difc", "Dubai International Financial Centre", "DIFC"],
    "Discovery Gardens": ["Discovery Gardens"],
    "Downtown Dubai": ["Downtown Dubai", "Downtown Burj Dubai", "Burj Khalifa Zone"],
    "Dubai Hills Estate": ["Dubai Hills Estate", "Dubai Hills"],
    "Dubai Marina": ["Dubai Marina", "Marina"],
    "Dubai Silicon Oasis": ["Dubai Silicon Oasis", "Silicon Oasis"],
    "Dubai South": ["Dubai South", "Dubai World Central"],
    "Dubai Sports City": ["Dubai Sports City", "Sports City"],
    "Emirates Hills": ["Emirates Hills"],
    "International City": ["International City"],
    "Jebel Ali": ["Jebel Ali", "Jebel Ali Industrial"],
    "Jumeirah": ["Jumeirah", "Jumeirah First", "Jumeirah Second", "Jumeirah Third"],
    "Jumeirah Beach Residence": ["Jumeirah Beach Residence", "JBR", "Jumeirah Beach Res"],
    "Jumeirah Lake Towers": ["Jumeirah Lake Towers", "JLT", "Jumeirah Lakes Towers"],
    "Jumeirah Village Circle": ["Jumeirah Village Circle", "JVC"],
    "Jumeirah Village Triangle": ["Jumeirah Village Triangle", "JVT"],
    "Meydan": ["Meydan", "Meydan City", "Mohammed Bin Rashid Al Maktoum City"],
    "Motor City": ["Motor City", "Dubai Motor City"],
    "MBR City": ["Mbr City", "Mohammed Bin Rashid City", "MBR City"],
    "Palm Jumeirah": ["Palm Jumeirah", "Palm Jebel Ali"],
    "Production City": ["Dubai Production City", "Production City", "IMPZ"],
    "Sobha Hartland": ["Sobha Hartland"],
    "The Greens": ["The Greens", "Greens"],
    "The Springs": ["The Springs", "Springs"],
    "The Meadows": ["The Meadows", "Meadows"],
    "The Views": ["The Views", "Views"],
    "Town Square": ["Town Square", "Townsquare"],
    "Tilal Al Ghaf": ["Tilal Al Ghaf"],
    "Villanova": ["Villanova"],
    "Wasl Gate": ["Wasl Gate"],
    "World Trade Centre": ["World Trade Centre", "Wtc"],
    "Zabeel": ["Zabeel", "Za Abeel", "Zaabeel"],
}


def build_mappings(conn: sqlite3.Connection):
    """Build area alias mappings from known mappings + data discovery."""
    cursor = conn.cursor()

    # Clear existing
    cursor.execute("DELETE FROM area_aliases")

    # Insert known mappings
    count = 0
    for canonical, aliases in KNOWN_MAPPINGS.items():
        for alias in aliases:
            cursor.execute(
                "INSERT OR IGNORE INTO area_aliases (canonical_name, alias, source) VALUES (?, ?, ?)",
                (canonical, alias.strip().title(), "manual"),
            )
            count += 1

    # Discover additional area names from DLD data
    cursor.execute("SELECT DISTINCT area_name FROM transactions WHERE area_name IS NOT NULL AND area_name != ''")
    dld_areas = {row[0] for row in cursor.fetchall()}
    print(f"Distinct DLD areas: {len(dld_areas)}")

    # Discover area names from listings
    cursor.execute("SELECT DISTINCT area FROM listings WHERE area IS NOT NULL AND area != ''")
    pf_areas = {row[0] for row in cursor.fetchall()}
    print(f"Distinct PropertyFinder areas: {len(pf_areas)}")

    # Auto-map any area that exists in data but not in our known mappings
    all_canonical = {alias.strip().title() for aliases in KNOWN_MAPPINGS.values() for alias in aliases}

    for area in dld_areas | pf_areas:
        if area and area not in all_canonical:
            cursor.execute(
                "INSERT OR IGNORE INTO area_aliases (canonical_name, alias, source) VALUES (?, ?, ?)",
                (area, area, "auto"),
            )
            count += 1

    conn.commit()
    print(f"Total area aliases: {count}")

    # Show unmapped areas (areas in one dataset but not the other)
    dld_only = dld_areas - pf_areas - all_canonical
    pf_only = pf_areas - dld_areas - all_canonical

    if dld_only:
        print(f"\nAreas in DLD only (top 20):")
        for a in sorted(dld_only)[:20]:
            print(f"  - {a}")

    if pf_only:
        print(f"\nAreas in PropertyFinder only (top 20):")
        for a in sorted(pf_only)[:20]:
            print(f"  - {a}")


def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found: {DB_PATH}")
        print("Run ingest_dld.py first.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    build_mappings(conn)
    conn.close()
    print("\nArea normalization complete.")


if __name__ == "__main__":
    main()
