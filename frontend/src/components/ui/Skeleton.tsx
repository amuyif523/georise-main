import React from 'react';

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-slate-800/70 rounded ${className}`} />
);

export default Skeleton;
