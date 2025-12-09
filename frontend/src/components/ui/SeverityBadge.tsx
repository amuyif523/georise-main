interface Props {
  score?: number | null;
}

export default function SeverityBadge({ score }: Props) {
  if (score == null) return <span className="badge badge-ghost badge-xs">N/A</span>;

  let cls = "badge-severity-low";
  let label = "Low";

  if (score >= 4) {
    cls = "badge-severity-high";
    label = "Critical";
  } else if (score >= 2.5) {
    cls = "badge-severity-medium";
    label = "Medium";
  }

  return <span className={cls}>{label} ({score})</span>;
}
