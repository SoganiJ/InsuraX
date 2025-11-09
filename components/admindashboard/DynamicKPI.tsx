'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface DynamicKPIProps {
  title: string;
  value: string;
  trend: number;
  trendPeriod: string;
}

const DynamicKPI: React.FC<DynamicKPIProps> = ({ title, value, trend, trendPeriod }) => {
  const isPositive = trend > 0;
  const isNegative = trend < 0;

  const TrendIcon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;
  const trendColor = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700">
      <p className="text-slate-400 mb-2">{title}</p>
      <p className="text-3xl font-bold text-white mb-3">{value}</p>
      {trend !== 0 && (
        <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
          <TrendIcon size={16} />
          <span>
            {isPositive ? '+' : ''}{trend} {trendPeriod}
          </span>
        </div>
      )}
    </div>
  );
};

export default DynamicKPI;
