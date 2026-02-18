import Database from "better-sqlite3";
import path from "path";
import type {
  Transaction,
  Listing,
  AreaStats,
  PriceTrendPoint,
  MarketComparison,
} from "@/types";

const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "data", "dubai_realestate.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

function resolveArea(area: string): string {
  const conn = getDb();
  const row = conn
    .prepare(
      "SELECT canonical_name FROM area_aliases WHERE LOWER(alias) = LOWER(?) LIMIT 1"
    )
    .get(area) as { canonical_name: string } | undefined;
  return row?.canonical_name || area;
}

export function queryTransactions(params: {
  area?: string;
  property_type?: string;
  bedrooms?: string;
  date_from?: string;
  date_to?: string;
  trans_group?: string;
  limit?: number;
}): Transaction[] {
  const conn = getDb();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.area) {
    const canonical = resolveArea(params.area);
    conditions.push("area_name LIKE ?");
    values.push(`%${canonical}%`);
  }
  if (params.property_type) {
    conditions.push("(property_type LIKE ? OR property_sub_type LIKE ?)");
    values.push(`%${params.property_type}%`, `%${params.property_type}%`);
  }
  if (params.bedrooms) {
    conditions.push("rooms LIKE ?");
    values.push(`%${params.bedrooms}%`);
  }
  if (params.date_from) {
    conditions.push("instance_date >= ?");
    values.push(params.date_from);
  }
  if (params.date_to) {
    conditions.push("instance_date <= ?");
    values.push(params.date_to);
  }
  if (params.trans_group) {
    conditions.push("trans_group = ?");
    values.push(params.trans_group);
  } else {
    conditions.push("trans_group = 'Sales'");
  }

  conditions.push("actual_worth > 0");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit || 50;

  const sql = `SELECT * FROM transactions ${where} ORDER BY instance_date DESC LIMIT ?`;
  values.push(limit);

  return conn.prepare(sql).all(...values) as Transaction[];
}

export function queryListings(params: {
  area?: string;
  property_type?: string;
  bedrooms?: number;
  price_min?: number;
  price_max?: number;
  furnishing?: string;
  limit?: number;
}): Listing[] {
  const conn = getDb();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.area) {
    const canonical = resolveArea(params.area);
    conditions.push("area LIKE ?");
    values.push(`%${canonical}%`);
  }
  if (params.property_type) {
    conditions.push("property_type LIKE ?");
    values.push(`%${params.property_type}%`);
  }
  if (params.bedrooms !== undefined) {
    conditions.push("bedrooms = ?");
    values.push(params.bedrooms);
  }
  if (params.price_min) {
    conditions.push("price >= ?");
    values.push(params.price_min);
  }
  if (params.price_max) {
    conditions.push("price <= ?");
    values.push(params.price_max);
  }
  if (params.furnishing) {
    conditions.push("furnishing LIKE ?");
    values.push(`%${params.furnishing}%`);
  }

  conditions.push("price > 0");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit || 20;

  const sql = `SELECT * FROM listings ${where} ORDER BY price ASC LIMIT ?`;
  values.push(limit);

  return conn.prepare(sql).all(...values) as Listing[];
}

export function getAreaStats(params: {
  area: string;
  property_type?: string;
  bedrooms?: string;
  period?: string;
}): AreaStats[] {
  const conn = getDb();
  const canonical = resolveArea(params.area);
  const conditions: string[] = ["area_name LIKE ?"];
  const values: unknown[] = [`%${canonical}%`];

  if (params.property_type) {
    conditions.push("property_type LIKE ?");
    values.push(`%${params.property_type}%`);
  }
  if (params.bedrooms) {
    conditions.push("bedrooms LIKE ?");
    values.push(`%${params.bedrooms}%`);
  }

  const period = params.period || "last_1y";
  conditions.push("period = ?");
  values.push(period);

  const where = `WHERE ${conditions.join(" AND ")}`;

  return conn
    .prepare(
      `SELECT * FROM area_stats ${where} ORDER BY transaction_count DESC LIMIT 20`
    )
    .all(...values) as AreaStats[];
}

export function getPriceTrend(params: {
  area: string;
  property_type?: string;
  bedrooms?: string;
  period_years?: number;
}): PriceTrendPoint[] {
  const conn = getDb();
  const canonical = resolveArea(params.area);
  const years = params.period_years || 3;

  const conditions: string[] = [
    "area_name LIKE ?",
    "trans_group = 'Sales'",
    "actual_worth > 0",
    `instance_date >= date('now', '-${years} years')`,
  ];
  const values: unknown[] = [`%${canonical}%`];

  if (params.property_type) {
    conditions.push("(property_type LIKE ? OR property_sub_type LIKE ?)");
    values.push(`%${params.property_type}%`, `%${params.property_type}%`);
  }
  if (params.bedrooms) {
    conditions.push("rooms LIKE ?");
    values.push(`%${params.bedrooms}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const sql = `
    SELECT
      strftime('%Y-%m', instance_date) as period,
      ROUND(AVG(actual_worth), 0) as avg_price,
      ROUND(AVG(meter_sale_price * 0.0929), 0) as avg_price_sqft,
      COUNT(*) as transaction_count
    FROM transactions
    ${where}
    GROUP BY strftime('%Y-%m', instance_date)
    ORDER BY period ASC
  `;

  return conn.prepare(sql).all(...values) as PriceTrendPoint[];
}

export function compareListingToMarket(params: {
  area: string;
  property_type?: string;
  bedrooms?: number;
  price: number;
}): MarketComparison {
  const conn = getDb();
  const canonical = resolveArea(params.area);

  const conditions: string[] = [
    "area_name LIKE ?",
    "trans_group = 'Sales'",
    "actual_worth > 0",
    "instance_date >= date('now', '-1 year')",
  ];
  const values: unknown[] = [`%${canonical}%`];

  if (params.property_type) {
    conditions.push("(property_type LIKE ? OR property_sub_type LIKE ?)");
    values.push(`%${params.property_type}%`, `%${params.property_type}%`);
  }
  if (params.bedrooms !== undefined) {
    conditions.push("rooms LIKE ?");
    values.push(`%${params.bedrooms}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const row = conn
    .prepare(
      `SELECT AVG(actual_worth) as avg_price, COUNT(*) as count FROM transactions ${where}`
    )
    .get(...values) as { avg_price: number; count: number } | undefined;

  const marketAvg = row?.avg_price || 0;
  const count = row?.count || 0;
  const diffPct = marketAvg > 0 ? ((params.price - marketAvg) / marketAvg) * 100 : 0;

  let verdict = "Insufficient data";
  if (count >= 3) {
    if (diffPct < -15) verdict = "Significantly below market — potential opportunity";
    else if (diffPct < -5) verdict = "Below market average";
    else if (diffPct < 5) verdict = "At market rate";
    else if (diffPct < 15) verdict = "Above market average";
    else verdict = "Significantly above market — premium priced";
  }

  return {
    listing_price: params.price,
    market_avg: Math.round(marketAvg),
    difference_pct: Math.round(diffPct * 10) / 10,
    verdict,
    recent_transactions: count,
  };
}

export function searchUndervalued(params: {
  area?: string;
  property_type?: string;
  threshold_pct?: number;
  limit?: number;
}): Array<Listing & { market_avg: number; difference_pct: number }> {
  const conn = getDb();
  const threshold = params.threshold_pct || -10;
  const limit = params.limit || 10;

  const listingConditions: string[] = ["l.price > 0"];
  const values: unknown[] = [];

  if (params.area) {
    const canonical = resolveArea(params.area);
    listingConditions.push("l.area LIKE ?");
    values.push(`%${canonical}%`);
  }
  if (params.property_type) {
    listingConditions.push("l.property_type LIKE ?");
    values.push(`%${params.property_type}%`);
  }

  const listingWhere = listingConditions.length
    ? `WHERE ${listingConditions.join(" AND ")}`
    : "";

  const sql = `
    SELECT l.*,
      s.avg_price as market_avg,
      ROUND(((l.price - s.avg_price) / s.avg_price) * 100, 1) as difference_pct
    FROM listings l
    JOIN area_stats s ON LOWER(l.area) = LOWER(s.area_name)
      AND s.period = 'last_1y'
      AND s.property_type LIKE '%' || l.property_type || '%'
    ${listingWhere}
      AND s.avg_price > 0
      AND ((l.price - s.avg_price) / s.avg_price) * 100 <= ?
    ORDER BY difference_pct ASC
    LIMIT ?
  `;
  values.push(threshold, limit);

  return conn.prepare(sql).all(...values) as Array<
    Listing & { market_avg: number; difference_pct: number }
  >;
}
