"use client";

interface TransactionRow {
  instance_date?: string;
  area_name?: string;
  property_type?: string;
  property_sub_type?: string;
  rooms?: string;
  actual_worth?: number;
  meter_sale_price?: number;
  building_name?: string;
}

interface TransactionTableProps {
  transactions: TransactionRow[];
  title?: string;
}

export default function TransactionTable({
  transactions,
  title,
}: TransactionTableProps) {
  if (!transactions.length) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden my-2">
      {title && (
        <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-800/50 text-zinc-400">
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Area</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Rooms</th>
              <th className="text-right px-3 py-2">Price (AED)</th>
              <th className="text-right px-3 py-2">AED/sqm</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => (
              <tr
                key={i}
                className="border-t border-zinc-800 hover:bg-zinc-800/30"
              >
                <td className="px-3 py-2 text-zinc-300">
                  {txn.instance_date?.slice(0, 10) || "-"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {txn.area_name || "-"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {txn.property_sub_type || txn.property_type || "-"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {txn.rooms || "-"}
                </td>
                <td className="px-3 py-2 text-right text-orange-400 font-medium">
                  {txn.actual_worth
                    ? txn.actual_worth.toLocaleString()
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right text-zinc-400">
                  {txn.meter_sale_price
                    ? Math.round(txn.meter_sale_price).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
