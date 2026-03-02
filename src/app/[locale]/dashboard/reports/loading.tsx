export default function ReportsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 rounded-lg bg-secondary" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 rounded-2xl bg-secondary" />
        <div className="h-80 rounded-2xl bg-secondary" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-64 rounded-2xl bg-secondary" />
        <div className="h-64 rounded-2xl bg-secondary" />
        <div className="h-64 rounded-2xl bg-secondary" />
      </div>
    </div>
  );
}
