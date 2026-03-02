export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6 sm:space-y-8">
      <div className="h-6 sm:h-8 w-40 sm:w-48 rounded-lg bg-secondary" />
      <div className="h-4 w-56 sm:w-64 rounded bg-secondary" />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg sm:rounded-xl shadow-card p-3 sm:p-4 h-20 sm:h-24 min-w-0"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 sm:gap-4">
        <div className="h-10 w-28 rounded-xl bg-secondary" />
        <div className="h-10 w-28 rounded-xl bg-secondary" />
        <div className="h-10 w-28 rounded-xl bg-secondary" />
      </div>
    </div>
  );
}
