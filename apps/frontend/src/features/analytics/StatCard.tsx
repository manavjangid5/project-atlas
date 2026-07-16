export default function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-md p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}