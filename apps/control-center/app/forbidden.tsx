export default function ForbiddenPage() {
  return (
    <div className="mx-auto mt-20 max-w-xl rounded-lg border border-danger/30 bg-surface p-8 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wide text-danger">403 Forbidden</p>
      <h2 className="mt-2 text-2xl font-semibold text-text">Internal Admin Header Required</h2>
      <p className="mt-3 text-sm text-gray-600">
        This control panel is internal-only. Send header <code>x-internal-admin: true</code> to access.
      </p>
    </div>
  );
}
