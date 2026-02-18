#!/usr/bin/env node
/**
 * Seed the SQLite database with realistic Dubai real estate sample data.
 * Run: node scripts/seed_sample_data.js
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "dubai_realestate.db");
const db = new Database(DB_PATH);

// Enable WAL for better performance
db.pragma("journal_mode = WAL");

// ──────────────────────── Area aliases ────────────────────────
const AREA_ALIASES = [
  ["Dubai Marina", "Dubai Marina", "dld"],
  ["Dubai Marina", "Marina", "common"],
  ["Jumeirah Village Circle", "Jumeirah Village Circle", "dld"],
  ["Jumeirah Village Circle", "JVC", "common"],
  ["Business Bay", "Business Bay", "dld"],
  ["Downtown Dubai", "Downtown Dubai", "dld"],
  ["Downtown Dubai", "Downtown", "common"],
  ["Palm Jumeirah", "Palm Jumeirah", "dld"],
  ["Palm Jumeirah", "The Palm", "common"],
  ["Jumeirah Lake Towers", "Jumeirah Lake Towers", "dld"],
  ["Jumeirah Lake Towers", "JLT", "common"],
  ["Arabian Ranches", "Arabian Ranches", "dld"],
  ["Dubai Hills Estate", "Dubai Hills Estate", "dld"],
  ["Dubai Hills Estate", "Dubai Hills", "common"],
  ["Jumeirah Beach Residence", "Jumeirah Beach Residence", "dld"],
  ["Jumeirah Beach Residence", "JBR", "common"],
  ["Dubai Creek Harbour", "Dubai Creek Harbour", "dld"],
  ["Dubai Creek Harbour", "Creek Harbour", "common"],
  ["Al Barsha", "Al Barsha", "dld"],
  ["Damac Hills", "Damac Hills", "dld"],
  ["Meydan City", "Meydan City", "dld"],
  ["Meydan City", "Meydan", "common"],
  ["Dubai Sports City", "Dubai Sports City", "dld"],
  ["Dubai Sports City", "Sports City", "common"],
  ["International City", "International City", "dld"],
  ["Dubai Silicon Oasis", "Dubai Silicon Oasis", "dld"],
  ["Dubai Silicon Oasis", "DSO", "common"],
  ["Motor City", "Motor City", "dld"],
  ["Town Square", "Town Square", "dld"],
  ["Sobha Hartland", "Sobha Hartland", "dld"],
  ["Emaar Beachfront", "Emaar Beachfront", "dld"],
  ["Tilal Al Ghaf", "Tilal Al Ghaf", "dld"],
  ["Mohammed Bin Rashid City", "Mohammed Bin Rashid City", "dld"],
  ["Mohammed Bin Rashid City", "MBR City", "common"],
];

// ──────────────────────── Helpers ────────────────────────
function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randDate(startYear, endYear) {
  const year = randBetween(startYear, endYear);
  const month = String(randBetween(1, 12)).padStart(2, "0");
  const day = String(randBetween(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ──────────────────────── Config per area ────────────────────────
const AREAS = {
  "Dubai Marina": {
    buildings: ["Marina Gate", "Cayan Tower", "Princess Tower", "Damac Heights", "Marina Promenade", "The Address Marina", "Sparkle Towers", "Marina Diamond", "Sulafa Tower", "Elite Residence"],
    projects: ["Emaar Marina", "Select Group Marina", "Damac Marina"],
    avgPricePerSqm: { Unit: 18000, Villa: 22000 },
    unitTypes: ["Unit"],
    roomDist: { Studio: 0.15, "1 B/R": 0.35, "2 B/R": 0.30, "3 B/R": 0.15, "4 B/R": 0.05 },
    sizeSqm: { Studio: [35, 55], "1 B/R": [60, 90], "2 B/R": [95, 140], "3 B/R": [140, 200], "4 B/R": [200, 300] },
    landmarks: ["Marina Walk", "Marina Mall", "Ain Dubai"],
    metro: ["DMCC Metro", "JLT Metro"],
    malls: ["Marina Mall", "Ibn Battuta Mall"],
  },
  "Jumeirah Village Circle": {
    buildings: ["Hyati Residence", "Bloom Heights", "Belgravia Square", "Laya Mansion", "Sydney Tower", "Pantheon Elysee", "Park View Residences", "Sunrise Residences"],
    projects: ["Nakheel JVC", "Ellington JVC", "Sobha JVC"],
    avgPricePerSqm: { Unit: 11000, Villa: 9000 },
    unitTypes: ["Unit", "Villa"],
    roomDist: { Studio: 0.20, "1 B/R": 0.35, "2 B/R": 0.30, "3 B/R": 0.10, "4 B/R": 0.05 },
    sizeSqm: { Studio: [30, 45], "1 B/R": [50, 75], "2 B/R": [80, 120], "3 B/R": [130, 180], "4 B/R": [200, 350] },
    landmarks: ["JVC Community Centre", "Circle Mall"],
    metro: ["Discovery Gardens Metro"],
    malls: ["Circle Mall", "Ibn Battuta Mall"],
  },
  "Business Bay": {
    buildings: ["Executive Towers", "Bay Gate", "Ubora Tower", "Churchill Towers", "Merano Tower", "Marquise Square", "Damac Maison", "The Opus", "Claren Towers"],
    projects: ["Omniyat Business Bay", "Damac Business Bay"],
    avgPricePerSqm: { Unit: 17000 },
    unitTypes: ["Unit"],
    roomDist: { Studio: 0.20, "1 B/R": 0.35, "2 B/R": 0.30, "3 B/R": 0.12, "4 B/R": 0.03 },
    sizeSqm: { Studio: [35, 50], "1 B/R": [55, 85], "2 B/R": [90, 135], "3 B/R": [145, 210], "4 B/R": [220, 350] },
    landmarks: ["Dubai Canal", "Marasi Drive"],
    metro: ["Business Bay Metro"],
    malls: ["Bay Avenue Mall", "Dubai Mall"],
  },
  "Downtown Dubai": {
    buildings: ["Burj Khalifa", "The Address Downtown", "Boulevard Point", "Burj Views", "South Ridge", "The Lofts", "Opera Grand", "Act One Act Two", "Il Primo"],
    projects: ["Emaar Downtown", "Opera District"],
    avgPricePerSqm: { Unit: 24000 },
    unitTypes: ["Unit"],
    roomDist: { "1 B/R": 0.30, "2 B/R": 0.35, "3 B/R": 0.25, "4 B/R": 0.10 },
    sizeSqm: { "1 B/R": [65, 95], "2 B/R": [100, 160], "3 B/R": [160, 250], "4 B/R": [250, 400] },
    landmarks: ["Burj Khalifa", "Dubai Opera", "Dubai Fountain"],
    metro: ["Burj Khalifa/Dubai Mall Metro"],
    malls: ["Dubai Mall", "Souk Al Bahar"],
  },
  "Palm Jumeirah": {
    buildings: ["Atlantis The Royal", "One Palm", "Serenia Residences", "Tiara Residences", "Shoreline Apartments", "Golden Mile", "Azure Residences", "Balqis Residence"],
    projects: ["Nakheel Palm", "Omniyat Palm"],
    avgPricePerSqm: { Unit: 28000, Villa: 30000 },
    unitTypes: ["Unit", "Villa"],
    roomDist: { "1 B/R": 0.15, "2 B/R": 0.30, "3 B/R": 0.30, "4 B/R": 0.15, "5 B/R": 0.10 },
    sizeSqm: { "1 B/R": [80, 110], "2 B/R": [120, 180], "3 B/R": [180, 280], "4 B/R": [300, 500], "5 B/R": [500, 900] },
    landmarks: ["Atlantis Aquaventure", "The Pointe"],
    metro: ["Palm Jumeirah Monorail"],
    malls: ["Nakheel Mall", "Golden Mile Galleria"],
  },
  "Jumeirah Lake Towers": {
    buildings: ["Lake City Tower", "Saba Tower", "Goldcrest Views", "Global Lake View", "Green Lakes", "Icon Tower", "Jumeirah Bay"],
    projects: ["DMCC JLT"],
    avgPricePerSqm: { Unit: 12000 },
    unitTypes: ["Unit"],
    roomDist: { Studio: 0.20, "1 B/R": 0.35, "2 B/R": 0.30, "3 B/R": 0.15 },
    sizeSqm: { Studio: [35, 50], "1 B/R": [55, 80], "2 B/R": [85, 130], "3 B/R": [135, 200] },
    landmarks: ["JLT Park", "Almas Tower"],
    metro: ["DMCC Metro", "Sobha Realty Metro"],
    malls: ["Marina Mall", "Ibn Battuta Mall"],
  },
  "Arabian Ranches": {
    buildings: ["Al Reem", "Palmera", "Saheel", "Alma", "Mirador", "Rosa", "Savannah", "Terra Nova", "Alvorada"],
    projects: ["Emaar Arabian Ranches"],
    avgPricePerSqm: { Villa: 11000 },
    unitTypes: ["Villa"],
    roomDist: { "3 B/R": 0.25, "4 B/R": 0.40, "5 B/R": 0.25, "6 B/R": 0.10 },
    sizeSqm: { "3 B/R": [200, 280], "4 B/R": [280, 400], "5 B/R": [400, 550], "6 B/R": [550, 800] },
    landmarks: ["Arabian Ranches Golf Club", "Dubai Polo Club"],
    metro: [],
    malls: ["Arabian Ranches Retail Centre"],
  },
  "Dubai Hills Estate": {
    buildings: ["Park Heights", "Collective", "Golf Suites", "Acacia", "Maple", "Sidra", "Golf Place", "Fairway Vistas"],
    projects: ["Emaar Dubai Hills"],
    avgPricePerSqm: { Unit: 15000, Villa: 13000 },
    unitTypes: ["Unit", "Villa"],
    roomDist: { "1 B/R": 0.20, "2 B/R": 0.30, "3 B/R": 0.25, "4 B/R": 0.15, "5 B/R": 0.10 },
    sizeSqm: { "1 B/R": [55, 80], "2 B/R": [90, 130], "3 B/R": [150, 230], "4 B/R": [280, 420], "5 B/R": [420, 600] },
    landmarks: ["Dubai Hills Golf Club", "Dubai Hills Park"],
    metro: [],
    malls: ["Dubai Hills Mall"],
  },
  "Jumeirah Beach Residence": {
    buildings: ["Rimal", "Bahar", "Shams", "Amwaj", "Sadaf", "Murjan"],
    projects: ["Dubai Properties JBR"],
    avgPricePerSqm: { Unit: 19000 },
    unitTypes: ["Unit"],
    roomDist: { Studio: 0.10, "1 B/R": 0.30, "2 B/R": 0.35, "3 B/R": 0.20, "4 B/R": 0.05 },
    sizeSqm: { Studio: [40, 55], "1 B/R": [65, 95], "2 B/R": [100, 150], "3 B/R": [155, 230], "4 B/R": [240, 350] },
    landmarks: ["The Walk JBR", "Ain Dubai", "Bluewaters Island"],
    metro: ["DMCC Metro"],
    malls: ["The Beach JBR"],
  },
  "Dubai Creek Harbour": {
    buildings: ["Creek Rise", "Harbour Gate", "Creek Edge", "Island Park", "Palace Residences", "Vida Creek Harbour"],
    projects: ["Emaar Creek Harbour"],
    avgPricePerSqm: { Unit: 20000 },
    unitTypes: ["Unit"],
    roomDist: { "1 B/R": 0.30, "2 B/R": 0.35, "3 B/R": 0.25, "4 B/R": 0.10 },
    sizeSqm: { "1 B/R": [60, 85], "2 B/R": [95, 140], "3 B/R": [145, 220], "4 B/R": [230, 350] },
    landmarks: ["Dubai Creek Tower", "Ras Al Khor Wildlife Sanctuary"],
    metro: ["Creek Metro"],
    malls: ["Creek Harbour Retail"],
  },
};

// ──────────────────────── Seed functions ────────────────────────

function pickRoom(roomDist) {
  const r = Math.random();
  let cumulative = 0;
  for (const [room, prob] of Object.entries(roomDist)) {
    cumulative += prob;
    if (r <= cumulative) return room;
  }
  return Object.keys(roomDist)[0];
}

function seedAliases() {
  const stmt = db.prepare("INSERT OR IGNORE INTO area_aliases (canonical_name, alias, source) VALUES (?, ?, ?)");
  const insertMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(...r);
  });
  insertMany(AREA_ALIASES);
  console.log(`  area_aliases: ${AREA_ALIASES.length} rows`);
}

function seedTransactions() {
  const stmt = db.prepare(`
    INSERT INTO transactions
    (instance_date, trans_group, procedure_name, property_type, property_sub_type,
     area_name, building_name, project_name, actual_worth, meter_sale_price,
     property_size_sqm, rooms, nearest_landmark, nearest_metro, nearest_mall)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let total = 0;
  const insertMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(...r);
  });

  for (const [areaName, cfg] of Object.entries(AREAS)) {
    const rows = [];
    const count = randBetween(200, 500);

    for (let i = 0; i < count; i++) {
      const rooms = pickRoom(cfg.roomDist);
      const propType = pick(cfg.unitTypes);
      const sizeRange = cfg.sizeSqm[rooms] || [80, 150];
      const sizeSqm = randBetween(sizeRange[0], sizeRange[1]);
      const basePricePerSqm = cfg.avgPricePerSqm[propType] || 15000;
      // Add ±25% variance
      const pricePerSqm = basePricePerSqm * (0.75 + Math.random() * 0.50);
      const actualWorth = Math.round(sizeSqm * pricePerSqm);
      const meterSalePrice = Math.round(pricePerSqm);

      const transGroup = Math.random() < 0.85 ? "Sales" : (Math.random() < 0.5 ? "Mortgages" : "Gifts");
      const procedure = transGroup === "Sales" ? pick(["Sell", "Sell - Ready", "Sell - Off-Plan"]) : transGroup;
      const subType = propType === "Villa" ? pick(["Villa", "Townhouse"]) : pick(["Flat", "Apartment", "Duplex"]);

      rows.push([
        randDate(2021, 2025),
        transGroup,
        procedure,
        propType,
        subType,
        areaName,
        pick(cfg.buildings),
        pick(cfg.projects),
        actualWorth,
        meterSalePrice,
        sizeSqm,
        rooms,
        cfg.landmarks.length ? pick(cfg.landmarks) : null,
        cfg.metro.length ? pick(cfg.metro) : null,
        cfg.malls.length ? pick(cfg.malls) : null,
      ]);
    }

    insertMany(rows);
    total += rows.length;
  }

  console.log(`  transactions: ${total} rows`);
  return total;
}

function seedListings() {
  const stmt = db.prepare(`
    INSERT INTO listings
    (listing_id, title, price, property_type, bedrooms, bathrooms, size_sqft,
     area, building_name, furnishing, listing_url, agent_name, description,
     amenities, latitude, longitude, listed_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const agents = [
    "Dubai Sotheby's", "Allsopp & Allsopp", "Betterhomes", "Engel & Völkers",
    "Luxhabitat", "Fam Properties", "Haus & Haus", "Harbor Real Estate",
    "Core Savills", "Ellington Properties", "Metropolitan Premium",
  ];
  const furnishings = ["Furnished", "Unfurnished", "Partly Furnished"];
  const amenities = ["Pool,Gym,Parking", "Pool,Gym,Parking,Balcony", "Pool,Gym,Parking,Concierge,Sea View",
    "Pool,Gym,Parking,Garden", "Pool,Gym,Parking,Maid's Room"];

  let total = 0;
  const insertMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(...r);
  });

  for (const [areaName, cfg] of Object.entries(AREAS)) {
    const rows = [];
    const count = randBetween(40, 100);

    for (let i = 0; i < count; i++) {
      const rooms = pickRoom(cfg.roomDist);
      const bedrooms = rooms === "Studio" ? 0 : parseInt(rooms);
      const propType = pick(cfg.unitTypes);
      const sizeRange = cfg.sizeSqm[rooms] || [80, 150];
      const sizeSqm = randBetween(sizeRange[0], sizeRange[1]);
      const sizeSqft = Math.round(sizeSqm * 10.764);
      const basePricePerSqm = cfg.avgPricePerSqm[propType] || 15000;
      // Listings can be ±30% of average (wider variance)
      const pricePerSqm = basePricePerSqm * (0.70 + Math.random() * 0.60);
      const price = Math.round(sizeSqm * pricePerSqm);
      const bathrooms = Math.max(1, bedrooms);
      const building = pick(cfg.buildings);
      const listingType = propType === "Villa" ? "villa" : "apartment";

      const listingId = `PF-${areaName.replace(/\s/g, "").substring(0, 4).toUpperCase()}-${randBetween(10000, 99999)}`;
      const title = `${rooms === "Studio" ? "Studio" : rooms.replace(" B/R", " Bedroom")} ${listingType} in ${building}`;

      rows.push([
        listingId,
        title,
        price,
        listingType,
        bedrooms,
        bathrooms,
        sizeSqft,
        areaName,
        building,
        pick(furnishings),
        `https://www.propertyfinder.ae/property/${listingId.toLowerCase()}`,
        pick(agents),
        `Beautiful ${rooms === "Studio" ? "studio" : rooms.replace(" B/R", " bedroom")} ${listingType} in ${building}, ${areaName}. ${sizeSqft} sqft.`,
        pick(amenities),
        25.0 + Math.random() * 0.2,
        55.1 + Math.random() * 0.2,
        randDate(2025, 2025),
      ]);
    }

    insertMany(rows);
    total += rows.length;
  }

  console.log(`  listings: ${total} rows`);
  return total;
}

function computeAreaStats() {
  // Compute stats from the transactions we just inserted
  const periods = [
    { name: "last_1y", years: 1 },
    { name: "last_2y", years: 2 },
    { name: "last_3y", years: 3 },
    { name: "all_time", years: 10 },
  ];

  const stmt = db.prepare(`
    INSERT INTO area_stats
    (area_name, property_type, bedrooms, avg_price_sqft, median_price, avg_price,
     min_price, max_price, transaction_count, period, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let total = 0;
  const insertMany = db.transaction((rows) => {
    for (const r of rows) stmt.run(...r);
  });

  for (const period of periods) {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - period.years);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const stats = db.prepare(`
      SELECT area_name, property_type, rooms as bedrooms,
        ROUND(AVG(meter_sale_price * 0.0929), 0) as avg_price_sqft,
        ROUND(AVG(actual_worth), 0) as avg_price,
        MIN(actual_worth) as min_price,
        MAX(actual_worth) as max_price,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE trans_group = 'Sales' AND actual_worth > 0 AND instance_date >= ?
      GROUP BY area_name, property_type, rooms
      HAVING COUNT(*) >= 3
    `).all(cutoffStr);

    const rows = [];
    for (const s of stats) {
      rows.push([
        s.area_name,
        s.property_type,
        s.bedrooms,
        s.avg_price_sqft,
        s.avg_price, // using avg as median approximation
        s.avg_price,
        s.min_price,
        s.max_price,
        s.transaction_count,
        period.name,
        new Date().toISOString().split("T")[0],
      ]);
    }

    insertMany(rows);
    total += rows.length;
  }

  console.log(`  area_stats: ${total} rows`);
}

// ──────────────────────── Main ────────────────────────
console.log("Seeding Dubai real estate database...");
console.log(`DB: ${DB_PATH}\n`);

// Clear existing data
db.exec("DELETE FROM transactions");
db.exec("DELETE FROM listings");
db.exec("DELETE FROM area_aliases");
db.exec("DELETE FROM area_stats");
console.log("Cleared existing data.\n");

seedAliases();
seedTransactions();
seedListings();
computeAreaStats();

// Verify
const counts = {
  transactions: db.prepare("SELECT COUNT(*) as c FROM transactions").get().c,
  listings: db.prepare("SELECT COUNT(*) as c FROM listings").get().c,
  area_aliases: db.prepare("SELECT COUNT(*) as c FROM area_aliases").get().c,
  area_stats: db.prepare("SELECT COUNT(*) as c FROM area_stats").get().c,
};

console.log("\nFinal counts:");
for (const [table, count] of Object.entries(counts)) {
  console.log(`  ${table}: ${count}`);
}
console.log("\nDone!");

db.close();
