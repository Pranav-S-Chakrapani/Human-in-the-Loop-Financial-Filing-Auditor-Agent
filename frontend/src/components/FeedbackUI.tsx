import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-slate-800/60 ${className}`} />
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  icon?: React.ReactNode;
}> = ({ title, description, icon }) => (
  <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
    {icon && <div className="inline-flex p-3 rounded-xl bg-slate-900 text-slate-400 mb-3">{icon}</div>}
    <h4 className="text-sm font-bold text-slate-200 mb-1">{title}</h4>
    <p className="text-xs text-slate-500 max-w-sm mx-auto">{description}</p>
  </div>
);
