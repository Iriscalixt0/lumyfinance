export default function InvestmentsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-8 w-48 rounded-lg bg-secondary" />
        <div className="h-10 w-36 rounded-lg bg-secondary" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
      </div>
      <div className="space-y-4">
        <div className="h-10 w-64 rounded bg-secondary" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 w-full rounded-xl bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
