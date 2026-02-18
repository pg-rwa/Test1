"use client";

interface PropertyCardProps {
  listing: {
    title?: string;
    price?: number;
    property_type?: string;
    bedrooms?: number;
    bathrooms?: number;
    size_sqft?: number;
    area?: string;
    building_name?: string;
    furnishing?: string;
    listing_url?: string;
    market_avg?: number;
    difference_pct?: number;
  };
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `AED ${(price / 1_000_000).toFixed(2)}M`;
  }
  return `AED ${price.toLocaleString()}`;
}

export default function PropertyCard({ listing }: PropertyCardProps) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-zinc-100 text-sm leading-tight flex-1 mr-2">
          {listing.title || `${listing.property_type} in ${listing.area}`}
        </h3>
        <span className="text-orange-400 font-bold text-sm whitespace-nowrap">
          {listing.price ? formatPrice(listing.price) : "Price N/A"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {listing.bedrooms !== undefined && (
          <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {listing.bedrooms} bed
          </span>
        )}
        {listing.bathrooms !== undefined && (
          <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {listing.bathrooms} bath
          </span>
        )}
        {listing.size_sqft && (
          <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {listing.size_sqft.toLocaleString()} sqft
          </span>
        )}
        {listing.furnishing && (
          <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {listing.furnishing}
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-400 mb-2">
        {listing.area}
        {listing.building_name ? ` — ${listing.building_name}` : ""}
      </p>

      {listing.market_avg && listing.difference_pct !== undefined && (
        <div
          className={`text-xs rounded-md px-2 py-1 mb-2 ${
            listing.difference_pct < -5
              ? "bg-green-900/40 text-green-400"
              : listing.difference_pct > 5
                ? "bg-red-900/40 text-red-400"
                : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {listing.difference_pct < 0
            ? `${Math.abs(listing.difference_pct)}% below`
            : `${listing.difference_pct}% above`}{" "}
          market avg ({formatPrice(listing.market_avg)})
        </div>
      )}

      {listing.listing_url && (
        <a
          href={listing.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-500 hover:text-orange-400 underline"
        >
          View on PropertyFinder
        </a>
      )}
    </div>
  );
}
