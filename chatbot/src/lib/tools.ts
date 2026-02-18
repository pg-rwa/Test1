import type Anthropic from "@anthropic-ai/sdk";
import {
  queryTransactions,
  queryListings,
  getAreaStats,
  getPriceTrend,
  compareListingToMarket,
  searchUndervalued,
} from "./db";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "query_transactions",
    description:
      "Search DLD (Dubai Land Department) historical transaction records. Use this to find actual sold prices, transaction volumes, and historical data for any area, property type, or time period in Dubai.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description:
            "Area/community name (e.g., 'Dubai Marina', 'JVC', 'Business Bay')",
        },
        property_type: {
          type: "string",
          description:
            "Property type (e.g., 'Unit', 'Villa', 'Land', 'Building')",
        },
        bedrooms: {
          type: "string",
          description:
            "Number of bedrooms (e.g., '1 B/R', '2 B/R', 'Studio')",
        },
        date_from: {
          type: "string",
          description: "Start date filter (YYYY-MM-DD)",
        },
        date_to: {
          type: "string",
          description: "End date filter (YYYY-MM-DD)",
        },
        trans_group: {
          type: "string",
          description: "Transaction group: 'Sales', 'Mortgages', or 'Gifts'",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 50)",
        },
      },
    },
  },
  {
    name: "query_listings",
    description:
      "Search current PropertyFinder listings (active properties for sale). Use this to find what is currently available on the market with asking prices.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description: "Area/community name",
        },
        property_type: {
          type: "string",
          description:
            "Property type (e.g., 'apartment', 'villa', 'townhouse', 'penthouse')",
        },
        bedrooms: {
          type: "number",
          description: "Number of bedrooms",
        },
        price_min: {
          type: "number",
          description: "Minimum price (AED)",
        },
        price_max: {
          type: "number",
          description: "Maximum price (AED)",
        },
        furnishing: {
          type: "string",
          description: "Furnishing status: 'furnished' or 'unfurnished'",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
    },
  },
  {
    name: "get_area_stats",
    description:
      "Get precomputed statistics for an area: average price, price per sqft, transaction count, etc. Useful for quick market overviews.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description: "Area name (required)",
        },
        property_type: {
          type: "string",
          description: "Property type filter",
        },
        bedrooms: {
          type: "string",
          description: "Bedroom filter",
        },
        period: {
          type: "string",
          description:
            "Time period: 'last_1y', 'last_2y', 'last_3y', or 'all_time'",
        },
      },
      required: ["area"],
    },
  },
  {
    name: "get_price_trend",
    description:
      "Get monthly price trend data for an area. Returns avg price and transaction count per month. Use this for trend analysis and charts.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description: "Area name (required)",
        },
        property_type: {
          type: "string",
          description: "Property type filter",
        },
        bedrooms: {
          type: "string",
          description: "Bedroom filter",
        },
        period_years: {
          type: "number",
          description: "Number of years to look back (default 3)",
        },
      },
      required: ["area"],
    },
  },
  {
    name: "compare_listing_to_market",
    description:
      "Compare a specific listing price to the market average from recent DLD transactions. Tells you if a listing is above or below market rate.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description: "Area name (required)",
        },
        property_type: {
          type: "string",
          description: "Property type",
        },
        bedrooms: {
          type: "number",
          description: "Number of bedrooms",
        },
        price: {
          type: "number",
          description: "The asking price to compare (AED, required)",
        },
      },
      required: ["area", "price"],
    },
  },
  {
    name: "search_undervalued",
    description:
      "Find current listings that are priced below the market average based on recent DLD transaction data. Great for finding potential investment opportunities.",
    input_schema: {
      type: "object" as const,
      properties: {
        area: {
          type: "string",
          description: "Area filter (optional)",
        },
        property_type: {
          type: "string",
          description: "Property type filter",
        },
        threshold_pct: {
          type: "number",
          description:
            "Max percentage below market to include (default -10, meaning 10% below)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
    },
  },
];

export function executeTool(
  name: string,
  input: Record<string, unknown>
): unknown {
  switch (name) {
    case "query_transactions":
      return queryTransactions(
        input as Parameters<typeof queryTransactions>[0]
      );
    case "query_listings":
      return queryListings(input as Parameters<typeof queryListings>[0]);
    case "get_area_stats":
      return getAreaStats(input as Parameters<typeof getAreaStats>[0]);
    case "get_price_trend":
      return getPriceTrend(input as Parameters<typeof getPriceTrend>[0]);
    case "compare_listing_to_market":
      return compareListingToMarket(
        input as Parameters<typeof compareListingToMarket>[0]
      );
    case "search_undervalued":
      return searchUndervalued(
        input as Parameters<typeof searchUndervalued>[0]
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
