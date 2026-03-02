export default function SettingsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-32 rounded-lg bg-secondary" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-secondary" />
        ))}
      </div>
    </div>
  );
}
