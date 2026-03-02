export default function RecurringLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-40 rounded-lg bg-secondary" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-secondary" />
        ))}
      </div>
    </div>
  );
}
