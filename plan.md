# Dubai Real Estate Chatbot — Implementation Plan

## Goal
Build a chatbot that uses **DXB Interact / DLD transaction data** (historical prices, transaction history, area analytics) and **cross-references current PropertyFinder listings** — giving users the ability to ask natural-language questions like:
- "What's the average price per sqft in Dubai Marina for 2-bed apartments?"
- "Show me undervalued listings in JVC compared to recent transactions"
- "What's the transaction trend for villas in Arabian Ranches over the last 2 years?"

---

## Architecture Overview

```
User ←→ Chat UI (Next.js) ←→ API Routes ←→ LLM (Claude) + Tools
                                                  ↓
                                     ┌────────────┴────────────┐
                                     │                         │
                              DLD Transaction DB        PropertyFinder DB
                              (SQLite / Postgres)       (SQLite / Postgres)
```

**Stack:** Next.js (React frontend + API routes), Claude API for LLM, SQLite for local dev (Postgres for production), Python scripts for data ingestion.

---

## Phase 1: Data Ingestion Layer

### 1.1 — DLD Transaction Data (from DXB Interact / Dubai Pulse)

**Source:** Dubai Pulse Open Data — DLD Transactions dataset
- CSV download: `dubaipulse.gov.ae` → `dld_transactions-open` (~1.5M rows, 46 columns)
- OR API: `api.dubaipulse.gov.ae/open/dld/dld_transactions-open-api` (requires free API key registration)

**Key fields to ingest:**
| Field | Description |
|-------|-------------|
| `instance_date` | Transaction date |
| `trans_group_en` | Sales / Mortgages / Gifts |
| `procedure_name_en` | Transaction procedure type |
| `property_type_en` | Land / Building / Villa / Unit |
| `property_sub_type_en` | Flat, Villa, Office, Shop, etc. |
| `area_name_en` | Area/community name |
| `building_name_en` | Building name |
| `project_name_en` | Project name |
| `actual_worth` | Transaction price (AED) |
| `meter_sale_price` | Price per sqm |
| `property_size_sqm` | Property size in sqm |
| `rooms_en` | Number of rooms |
| `nearest_landmark_en` | Nearest landmark |
| `nearest_metro_en` | Nearest metro station |
| `nearest_mall_en` | Nearest mall |

**Ingestion script:** `scripts/ingest_dld.py`
- Downloads CSV from Dubai Pulse (or calls API with pagination)
- Cleans and normalizes data (standardize area names, handle nulls)
- Loads into SQLite database (`data/dubai_realestate.db`)
- Creates indexes on `area_name_en`, `property_type_en`, `instance_date`, `rooms_en`
- Schedule: can be re-run monthly to pick up new transactions

### 1.2 — PropertyFinder Listings Data

**Source options (in order of preference):**
1. **RapidAPI — UAE Real Estate API** (`rapidapi.com/market-data-point1-...`) — 500K+ listings, updated daily, structured JSON. Requires RapidAPI key (free tier available).
2. **Manual CSV upload** — User can export/download listing data and upload it.
3. **Apify scraper** (`apify.com/dhrumil/propertyfinder-scraper`) — as a fallback if API access isn't available.

**Key fields to ingest:**
| Field | Description |
|-------|-------------|
| `listing_id` | Unique listing ID |
| `title` | Listing title |
| `price` | Asking price (AED) |
| `property_type` | Apartment, Villa, Townhouse, etc. |
| `bedrooms` | Number of bedrooms |
| `bathrooms` | Number of bathrooms |
| `size_sqft` | Property size |
| `area` / `community` | Location / community name |
| `building_name` | Building name |
| `furnishing` | Furnished / Unfurnished |
| `listing_url` | Link to PropertyFinder listing |
| `agent_name` | Agent name |
| `agent_phone` | Contact number |
| `description` | Listing description |
| `amenities` | List of amenities |
| `latitude` / `longitude` | Coordinates |
| `listed_date` | When listed |

**Ingestion script:** `scripts/ingest_propertyfinder.py`
- Calls RapidAPI endpoint with pagination (or processes uploaded CSV)
- Normalizes area/community names to match DLD naming conventions
- Loads into `listings` table in the same SQLite database
- Creates indexes on `area`, `property_type`, `bedrooms`, `price`

### 1.3 — Area Name Normalization

**Critical step.** DLD and PropertyFinder use different naming conventions for the same areas:
- DLD: `"JUMEIRAH VILLAGE CIRCLE"` → PropertyFinder: `"JVC"` or `"Jumeirah Village Circle"`
- DLD: `"BUSINESS BAY"` → PropertyFinder: `"Business Bay"`

**Implementation:** `scripts/normalize_areas.py`
- Create a mapping table (`area_aliases`) with canonical name + variants
- Use fuzzy matching (Levenshtein distance) for initial mapping, then manual review
- All queries go through this normalization layer

---

## Phase 2: Database Schema

### File: `scripts/schema.sql`

```sql
-- DLD Transactions (historical)
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  instance_date DATE,
  trans_group TEXT,          -- Sales, Mortgages, Gifts
  procedure_name TEXT,
  property_type TEXT,        -- Land, Building, Villa, Unit
  property_sub_type TEXT,    -- Flat, Villa, Office, etc.
  area_name TEXT,            -- Normalized area name
  building_name TEXT,
  project_name TEXT,
  actual_worth REAL,         -- Transaction price AED
  meter_sale_price REAL,     -- Price per sqm
  property_size_sqm REAL,
  rooms TEXT,
  nearest_landmark TEXT,
  nearest_metro TEXT,
  nearest_mall TEXT
);

-- PropertyFinder Listings (current market)
CREATE TABLE listings (
  id INTEGER PRIMARY KEY,
  listing_id TEXT UNIQUE,
  title TEXT,
  price REAL,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  size_sqft REAL,
  area TEXT,                 -- Normalized area name
  building_name TEXT,
  furnishing TEXT,
  listing_url TEXT,
  agent_name TEXT,
  description TEXT,
  amenities TEXT,
  latitude REAL,
  longitude REAL,
  listed_date DATE
);

-- Area name normalization
CREATE TABLE area_aliases (
  canonical_name TEXT,
  alias TEXT,
  source TEXT               -- 'dld' or 'propertyfinder'
);

-- Precomputed analytics (for fast chatbot responses)
CREATE TABLE area_stats (
  area_name TEXT,
  property_type TEXT,
  bedrooms TEXT,
  avg_price_sqft REAL,
  median_price REAL,
  transaction_count INTEGER,
  period TEXT,               -- e.g., '2025-Q4', '2024'
  last_updated TIMESTAMP
);
```

---

## Phase 3: Chatbot Backend (Claude + Tool Use)

### 3.1 — LLM Integration

**Model:** Claude (via Anthropic API)
**Pattern:** Tool-use / function-calling — Claude decides which database queries to run based on user questions.

### 3.2 — Tools Available to Claude

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `query_transactions` | Search DLD transaction history | `area`, `property_type`, `bedrooms`, `date_from`, `date_to`, `trans_group` |
| `query_listings` | Search current PropertyFinder listings | `area`, `property_type`, `bedrooms`, `price_min`, `price_max`, `furnishing` |
| `get_area_stats` | Get precomputed area statistics | `area`, `property_type`, `bedrooms`, `period` |
| `compare_listing_to_market` | Compare a listing's price to historical transaction averages | `listing_id` OR `area` + `property_type` + `bedrooms` + `price` |
| `get_price_trend` | Get price trend over time for an area | `area`, `property_type`, `bedrooms`, `period_years` |
| `search_undervalued` | Find listings priced below market average | `area`, `property_type`, `threshold_pct` |

### 3.3 — API Route: `app/api/chat/route.ts`

```
POST /api/chat
Body: { messages: [...], sessionId: string }
Response: SSE stream of Claude's response
```

Flow:
1. User sends message
2. API route sends conversation + tool definitions to Claude
3. Claude decides which tools to call (may call multiple)
4. API route executes tools (SQL queries against SQLite)
5. Tool results sent back to Claude
6. Claude synthesizes a natural-language response
7. Response streamed to frontend

---

## Phase 4: Frontend (Chat UI)

### File: `app/page.tsx` (main chat interface)

**Components:**
| Component | Purpose |
|-----------|---------|
| `ChatWindow` | Main chat container with message history |
| `MessageBubble` | Individual message (user/assistant) |
| `PropertyCard` | Rich card for listing results (image, price, beds, area, link) |
| `TransactionTable` | Table view for transaction results |
| `PriceChart` | Line/bar chart for price trends (using Recharts) |
| `AreaComparisonChart` | Compare stats across areas |
| `ChatInput` | Text input + send button |
| `SuggestedQuestions` | Quick-start prompts for new users |

**Suggested starter questions:**
- "What's the average price of a 2-bed apartment in Dubai Marina?"
- "Show me the cheapest 3-bed villas available in Arabian Ranches"
- "How have prices changed in Downtown Dubai over the last 3 years?"
- "Find me listings in JVC that are below market value"
- "Compare Business Bay vs JLT for 1-bed apartment investment"

---

## Phase 5: Matching Logic (DXB Interact ↔ PropertyFinder)

The core value: **overlay current asking prices (PropertyFinder) on top of actual transaction prices (DLD)** to surface insights.

### Matching Strategy

1. **Area + Property Type + Bedrooms** — Primary match key
   - Normalize area names across both datasets
   - Match on property type (Apartment ↔ Unit/Flat, Villa ↔ Villa, etc.)
   - Match on bedroom count

2. **Building-level matching** — Secondary (more precise)
   - Match `building_name` from PropertyFinder to `building_name_en` from DLD
   - Fuzzy matching needed (DLD: `"MARINA GATE 1"`, PF: `"Marina Gate Tower 1"`)

3. **Derived metrics per match:**
   - `asking_vs_sold_ratio` = Listing price / Avg recent transaction price
   - `price_per_sqft_listing` vs `price_per_sqft_transactions`
   - `days_on_market` estimate (if listing date available)
   - `area_trend` = price trend direction (up/down/flat)

---

## Phase 6: Project Structure

```
/
├── CLAUDE.md
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.example                 # API keys template
├── scripts/
│   ├── schema.sql               # Database schema
│   ├── ingest_dld.py            # Download & load DLD data
│   ├── ingest_propertyfinder.py # Fetch & load PF listings
│   ├── normalize_areas.py       # Area name mapping
│   └── compute_stats.py         # Precompute area_stats table
├── data/
│   └── dubai_realestate.db      # SQLite database (gitignored)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Chat UI
│   │   └── api/
│   │       └── chat/
│   │           └── route.ts     # Chat API endpoint
│   ├── lib/
│   │   ├── db.ts                # Database connection & queries
│   │   ├── tools.ts             # Tool definitions for Claude
│   │   ├── claude.ts            # Claude API client wrapper
│   │   └── normalize.ts         # Area name normalization
│   ├── components/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── PropertyCard.tsx
│   │   ├── TransactionTable.tsx
│   │   ├── PriceChart.tsx
│   │   └── ChatInput.tsx
│   └── types/
│       └── index.ts             # TypeScript interfaces
└── README.md
```

---

## Phase 7: Environment & API Keys Required

| Key | Source | Required For |
|-----|--------|-------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Claude API (chatbot brain) |
| `DUBAI_PULSE_API_KEY` | dubaipulse.gov.ae (free registration) | DLD transaction data |
| `DUBAI_PULSE_API_SECRET` | dubaipulse.gov.ae | DLD transaction data |
| `RAPIDAPI_KEY` | rapidapi.com (free tier) | PropertyFinder listings via RapidAPI |

---

## Implementation Order

| Step | What | Files |
|------|------|-------|
| **1** | Project scaffold (Next.js + deps) | `package.json`, configs |
| **2** | Database schema + ingestion scripts | `scripts/*` |
| **3** | Download & ingest DLD transaction data | `scripts/ingest_dld.py` |
| **4** | Ingest PropertyFinder listings | `scripts/ingest_propertyfinder.py` |
| **5** | Area name normalization mapping | `scripts/normalize_areas.py` |
| **6** | Precompute area statistics | `scripts/compute_stats.py` |
| **7** | Database query layer (TypeScript) | `src/lib/db.ts` |
| **8** | Claude tool definitions | `src/lib/tools.ts` |
| **9** | Chat API route (tool-use loop) | `src/app/api/chat/route.ts` |
| **10** | Chat UI components | `src/components/*` |
| **11** | Main page assembly | `src/app/page.tsx` |
| **12** | Testing & refinement | Manual QA |

---

## Key Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "@anthropic-ai/sdk": "latest",
    "better-sqlite3": "^11",
    "recharts": "^2",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/better-sqlite3": "^7"
  }
}
```

Python (for ingestion scripts):
```
pandas
requests
fuzzywuzzy
python-Levenshtein
sqlite3 (stdlib)
```

---

## Questions Before Proceeding

1. **Do you have a Dubai Pulse API key?** If not, we can start with the CSV download approach (free, no auth needed).
2. **Which PropertyFinder data source do you prefer?** RapidAPI (easiest), Apify scraper, or manual CSV upload?
3. **Deployment target?** Vercel (natural for Next.js) or self-hosted?
4. **Do you want user authentication** or is this an open/internal tool?
