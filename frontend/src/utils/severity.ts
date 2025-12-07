export const severityBadgeClass = (score: number | null | undefined): string => {
  if (score == null) return "badge badge-neutral";
  if (score >= 4) return "badge badge-error";
  if (score >= 3) return "badge badge-warning";
  if (score === 2) return "badge badge-info";
  return "badge badge-success";
};

export const severityLabel = (score: number | null | undefined): string => {
  if (score == null) return "N/A";
  return score.toString();
};
