export default function TransactionsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-8 w-48 rounded-lg bg-secondary" />
        <div className="h-10 w-32 rounded-lg bg-secondary" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
      </div>
      <div className="space-y-4">
        <div className="h-12 w-full rounded-lg bg-secondary" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 w-full rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
