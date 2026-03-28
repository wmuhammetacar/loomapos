import type { ReactNode } from "react";

export function DataTable({
  headers,
  children
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-gray-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
