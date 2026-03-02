export default function BudgetsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-40 rounded-lg bg-secondary" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 h-64 rounded-xl bg-secondary" />
        <div className="lg:col-span-8 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
