import React from "react";

const TrustBadge: React.FC<{ trustScore: number }> = ({ trustScore }) => {
  let label = "New Reporter";
  let classes = "badge badge-sm bg-slate-700 text-slate-200";
  if (trustScore >= 10) {
    label = "Trusted Reporter";
    classes = "badge badge-sm bg-green-600/30 text-green-200 border border-green-400/50";
  } else if (trustScore >= 4) {
    label = "Reliable Reporter";
    classes = "badge badge-sm bg-blue-600/30 text-blue-200 border border-blue-400/50";
  } else if (trustScore <= -4) {
    label = "High Risk Reporter";
    classes = "badge badge-sm bg-red-600/30 text-red-200 border border-red-400/50 animate-pulse";
  } else if (trustScore < 0) {
    label = "Low Trust";
    classes = "badge badge-sm bg-orange-600/30 text-orange-200 border border-orange-400/50";
  }
  return <span className={classes}>{label} (score: {trustScore})</span>;
};

export default TrustBadge;
