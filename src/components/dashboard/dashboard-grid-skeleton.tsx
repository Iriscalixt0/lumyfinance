export function DashboardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl shadow-card p-4 h-32 animate-pulse"
        />
      ))}
    </div>
  );
}
