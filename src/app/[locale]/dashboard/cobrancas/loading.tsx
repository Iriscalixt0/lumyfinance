export default function CobrancasLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-48 rounded-lg bg-secondary" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-secondary" />
        ))}
      </div>
    </div>
  );
}
