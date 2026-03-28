import { DataTable } from "@/components/data-table";
import { getAuditLog, toUiError } from "@/lib/api";

export default async function AuditPage() {
  try {
    const source = await getAuditLog();

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Audit Log</h2>
          <p className="text-sm text-gray-600">Actor-level trace for internal operations</p>
        </div>

        {source.connection !== "connected" ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            {source.message ?? "Audit feed is not fully connected."}
          </div>
        ) : null}

        <DataTable headers={["Time", "Action", "Actor", "Target"]}>
          {source.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-600">
                No audit record returned.
              </td>
            </tr>
          ) : (
            source.items.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3 text-gray-600">{record.time}</td>
                <td className="px-4 py-3 font-medium">{record.action}</td>
                <td className="px-4 py-3">{record.actor}</td>
                <td className="px-4 py-3">{record.target}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Audit Log</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load audit log: {toUiError(error)}
        </div>
      </div>
    );
  }
}
