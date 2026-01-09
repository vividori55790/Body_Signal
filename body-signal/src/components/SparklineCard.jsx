import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SparklineCard = ({ title, data, color = "#22d3ee" }) => {
  // data expected: [{ value: 3 }, { value: 5 }, ...]

  // Calculate stats
  const currentValue = data[data.length - 1]?.value || 0;
  const previousValue = data[data.length - 2]?.value || 0;
  const avg = (data.reduce((a, b) => a + b.value, 0) / data.length).toFixed(1);
  
  // Determine Trend
  let TrendIcon = Minus;
  let trendColor = "text-slate-500";
  let trendText = "Stable";

  if (currentValue > previousValue) {
    TrendIcon = TrendingUp; // Ascending implies Worsening pain usually, or just Higher intensity
    trendColor = "text-pain-high";
    trendText = "Rising";
  } else if (currentValue < previousValue) {
    TrendIcon = TrendingDown;
    trendColor = "text-relief";
    trendText = "Falling";
  }

  return (
    <div className="bg-surface p-4 rounded-xl border border-white/5 space-y-3">
      <div className="flex justify-between items-start">
        <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">{title}</div>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <span>{trendText}</span>
            <TrendIcon size={14} />
        </div>
      </div>
      
      <div className="flex items-end gap-2">
        <div className="text-2xl font-bold text-white">{currentValue}</div>
        <div className="text-sm text-slate-500 mb-1">Avg {avg}</div>
      </div>

      <div className="h-10 w-full -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <YAxis domain={[0, 10]} hide />
            <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SparklineCard;
