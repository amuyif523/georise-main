export default function SkeletonCard() {
  return (
    <div className="animate-pulse cyber-card">
      <div className="h-4 w-24 bg-slate-700/60 rounded mb-2" />
      <div className="h-6 w-36 bg-slate-700/60 rounded mb-3" />
      <div className="h-3 w-full bg-slate-800/80 rounded mb-1" />
      <div className="h-3 w-3/4 bg-slate-800/80 rounded" />
    </div>
  );
}
