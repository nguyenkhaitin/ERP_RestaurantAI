import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface EfficiencyKPIsProps {
  seatUtilization: number;
  avgTurnover: number;
  targetTurnover: number;
  serviceVelocity: {
    eating: number;
    idle: number;
  };
}

export function EfficiencyKPIs({ seatUtilization, avgTurnover, targetTurnover, serviceVelocity }: EfficiencyKPIsProps) {
  // Data for radial gauge
  const gaugeData = [
    { name: 'utilized', value: seatUtilization },
    { name: 'unused', value: 100 - seatUtilization }
  ];

  const COLORS = ['#10b981', '#e2e8f0']; // Emerald green and light gray

  const turnoverDiff = avgTurnover - targetTurnover;
  const isAboveTarget = turnoverDiff >= 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="mb-5">
        <h2 className="text-slate-900 text-lg mb-1">Chỉ số Hiệu suất Vận hành</h2>
        <p className="text-slate-600 text-sm">Tổng hợp tuần/tháng - Tối ưu hóa dài hạn</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Seat Utilization Efficiency - Radial Gauge */}
        <div className="flex flex-col items-center">
          <p className="text-slate-600 text-sm mb-3">Hiệu suất Sử dụng Ghế</p>
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="50%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                >
                  {gaugeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center mt-8">
                <p className="text-3xl text-slate-900">{seatUtilization}%</p>
                <p className="text-xs text-slate-500">Lấp đầy</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">Không gian được sử dụng hiệu quả</p>
        </div>

        {/* Average Table Turnover */}
        <div className="border-l border-r border-slate-200 px-6 flex flex-col justify-center">
          <p className="text-slate-600 text-sm mb-3">Vòng quay Bàn Trung bình</p>
          <div className="mb-3">
            <p className="text-4xl text-slate-900 mb-1">{avgTurnover.toFixed(1)}</p>
            <p className="text-sm text-slate-500">lượt/ca</p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-slate-600">Mục tiêu: {targetTurnover.toFixed(1)}</p>
              <div className="flex items-center gap-1 mt-1">
                {isAboveTarget ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm ${isAboveTarget ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isAboveTarget ? '+' : ''}{turnoverDiff.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Service Velocity */}
        <div className="flex flex-col justify-center">
          <p className="text-slate-600 text-sm mb-3">Tốc độ Phục vụ</p>
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs text-emerald-700 mb-1">Thời gian ăn uống</p>
              <p className="text-2xl text-emerald-900">{serviceVelocity.eating} <span className="text-sm">phút</span></p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 mb-1">Thời gian trống/chờ</p>
              <p className="text-2xl text-amber-900">{serviceVelocity.idle} <span className="text-sm">phút</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
