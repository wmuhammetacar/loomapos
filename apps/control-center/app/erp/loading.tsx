export default function ErpLoading() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-64 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-lg border border-line bg-surface" />
      <div className="h-72 animate-pulse rounded-lg border border-line bg-surface" />
    </div>
  );
}
