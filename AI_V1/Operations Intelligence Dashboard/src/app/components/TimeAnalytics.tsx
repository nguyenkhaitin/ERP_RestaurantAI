import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, Legend, Area, ComposedChart 
} from 'recharts';

interface TimeAnalyticsProps {
  heatmapData: any[];
  comparisonData: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-100 shadow-lg rounded-lg text-xs">
        <p className="font-bold text-slate-700 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ color: entry.color }} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span>{entry.name}: <strong>{entry.value}</strong></span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function TimeAnalytics({ heatmapData, comparisonData }: TimeAnalyticsProps) {
  return (
    <div className="space-y-6">
      
      {/* Biểu đồ 1: Xu hướng khách (Line Chart đẹp hơn) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[320px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Xu hướng tuần này</h3>
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">+12% vs tuần trước</span>
        </div>
        <div className="flex-1 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData}>
                    <defs>
                      <linearGradient id="colorThisWeek" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    
                    <Line name="Tuần trước" type="monotone" dataKey="lastWeek" stroke="#cbd5e1" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    <Line name="Tuần này" type="monotone" dataKey="thisWeek" stroke="#4F46E5" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Biểu đồ 2: Phân bổ giờ (Bar Chart chuyên nghiệp) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[320px] flex flex-col">
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4">Cao điểm trong ngày</h3>
        <div className="flex-1 w-full text-xs">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                    <Bar name="Lượng khách TB" dataKey="value" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}