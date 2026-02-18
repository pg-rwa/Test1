"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from "recharts";

interface PriceChartProps {
  data: Array<{
    period: string;
    avg_price: number;
    avg_price_sqft?: number;
    transaction_count: number;
  }>;
  title?: string;
}

function formatAED(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

export default function PriceChart({ data, title }: PriceChartProps) {
  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 my-2">
      {title && (
        <h3 className="text-sm font-medium text-zinc-200 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="period"
            tick={{ fill: "#888", fontSize: 10 }}
            tickFormatter={(v) => {
              const parts = v.split("-");
              return parts.length === 2
                ? `${parts[1]}/${parts[0].slice(2)}`
                : v;
            }}
          />
          <YAxis
            yAxisId="price"
            tick={{ fill: "#888", fontSize: 10 }}
            tickFormatter={formatAED}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            tick={{ fill: "#888", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #333",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any, name: any) => {
              const v = Number(value) || 0;
              const n = String(name ?? "");
              if (n === "avg_price") return [`AED ${v.toLocaleString()}`, "Avg Price"];
              if (n === "transaction_count") return [v, "Transactions"];
              return [v, n];
            }) as never}
          />
          <Bar
            yAxisId="volume"
            dataKey="transaction_count"
            fill="#FF6D4933"
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="avg_price"
            stroke="#FF6D49"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
