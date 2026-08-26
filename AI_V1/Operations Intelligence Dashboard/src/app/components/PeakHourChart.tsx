import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PeakHourData {
  time: string;
  actual: number;
  capacity: number;
}

interface PeakHourChartProps {
  peakHourData: PeakHourData[];
}

export function PeakHourChart({ peakHourData }: PeakHourChartProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="mb-5">
        <h2 className="text-slate-900 text-lg mb-1">Hiệu suất Giờ Cao điểm</h2>
        <p className="text-slate-600 text-sm">So sánh khách thực tế vs. công suất bàn (7 ngày qua)</p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={peakHourData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: '#64748b' }}
            stroke="#cbd5e1"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#64748b' }}
            stroke="#cbd5e1"
            label={{ value: 'Số khách', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#64748b' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value) => {
              if (value === 'actual') return 'Khách thực tế';
              if (value === 'capacity') return 'Công suất bàn';
              return value;
            }}
          />
          <Line 
            type="monotone" 
            dataKey="actual" 
            stroke="#64748b" 
            strokeWidth={3}
            dot={{ fill: '#64748b', r: 4 }}
            name="actual"
          />
          <Line 
            type="monotone" 
            dataKey="capacity" 
            stroke="#10b981" 
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ fill: '#10b981', r: 4 }}
            name="capacity"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-slate-600"></div>
            <p className="text-sm text-slate-700">Khách thực tế</p>
          </div>
          <p className="text-xs text-slate-600">
            Số lượng khách hàng thực tế được phát hiện qua hệ thống AI Computer Vision trong 7 ngày qua.
          </p>
        </div>
        
        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
            <p className="text-sm text-emerald-700">Công suất bàn</p>
          </div>
          <p className="text-xs text-emerald-700">
            <strong>Insight:</strong> Khi đường xám vượt đường xanh lá = Nhu cầu vượt công suất → Cần tối ưu vòng quay bàn hoặc tăng số lượng bàn.
          </p>
        </div>
      </div>
    </div>
  );
}
