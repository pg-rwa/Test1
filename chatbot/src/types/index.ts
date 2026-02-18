export interface Transaction {
  id: number;
  instance_date: string;
  trans_group: string;
  procedure_name: string;
  property_type: string;
  property_sub_type: string;
  area_name: string;
  building_name: string;
  project_name: string;
  actual_worth: number;
  meter_sale_price: number;
  property_size_sqm: number;
  rooms: string;
  nearest_landmark: string;
  nearest_metro: string;
  nearest_mall: string;
}

export interface Listing {
  id: number;
  listing_id: string;
  title: string;
  price: number;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  area: string;
  building_name: string;
  furnishing: string;
  listing_url: string;
  agent_name: string;
  description: string;
  amenities: string;
  latitude: number;
  longitude: number;
  listed_date: string;
}

export interface AreaStats {
  area_name: string;
  property_type: string;
  bedrooms: string;
  avg_price_sqft: number;
  median_price: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  transaction_count: number;
  period: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: ToolResultData | null;
}

export interface ToolResultData {
  type: "transactions" | "listings" | "stats" | "comparison" | "trend";
  results: unknown;
}

export interface PriceTrendPoint {
  period: string;
  avg_price: number;
  avg_price_sqft: number;
  transaction_count: number;
}

export interface MarketComparison {
  listing_price: number;
  market_avg: number;
  difference_pct: number;
  verdict: string;
  recent_transactions: number;
}
