import { useState, useEffect } from 'react';
import { KPICards } from './components/KPICards';
import { LiveTableGrid } from './components/LiveTableGrid';
import { ActivityLog } from './components/ActivityLog'; // <--- ĐÃ SỬA IMPORT
import { TimeAnalytics } from './components/TimeAnalytics';
import { AIActionableInsights } from './components/AIActionableInsights';

// --- Icon Components ---
const CalendarIcon = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const DownloadIcon = () => (
  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);

type KPIStruct = { totalGuests: number; occupancy: number; avgDwell: number; };
type DashboardResponse = {
  kpi: KPIStruct; tables: any[]; heatmap: any[]; weekComparison: any[]; logs: any[];
};

export default function App() {
  const [data, setData] = useState<DashboardResponse>({
    kpi: { totalGuests: 0, occupancy: 0, avgDwell: 0 },
    tables: [], heatmap: [], weekComparison: [], logs: [],
  });
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('Hôm nay');

  const fetchData = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dashboard');
      if (!res.ok) throw new Error('Mất kết nối Backend');
      const jsonData = await res.json();
      setData(jsonData);
      setLoading(false);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    alert("Đang xuất báo cáo PDF chi tiết cho ngày: " + new Date().toLocaleDateString());
  };

  if (loading) return <div className="p-10 text-center text-blue-600 font-bold">Đang tải hệ thống...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div className="max-w-[1920px] mx-auto">
        
        {/* --- HEADER --- */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Quản Trị Hiệu Suất</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Dữ liệu thời gian thực từ Camera AI • Chi nhánh Trung tâm
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <CalendarIcon />
              </div>
              <select 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Hôm nay</option>
                <option>Hôm qua</option>
                <option>Tuần này</option>
                <option>Tháng này</option>
              </select>
            </div>
            <button 
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
            >
              <DownloadIcon /> Xuất Báo Cáo
            </button>
          </div>
        </div>

        {/* --- NỘI DUNG CHÍNH --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-6">
            {/* compute live current guests from table data to show accurate 'Đang phục vụ' */}
            <KPICards 
              occupancy={data.kpi.occupancy} 
              totalGuests={data.kpi.totalGuests}
              currentGuests={data.tables.reduce((sum, t) => sum + (t.guests || 0), 0)}
              avgDwell={data.kpi.avgDwell}
            /> 
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Sơ đồ Bàn Trực tiếp</h3>
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-medium">
                    Cảnh báo: &gt;15 phút
                  </span>
               </div>
               <LiveTableGrid tables={data.tables} />
            </div>

            {/* --- ĐÃ THAY THẾ Ở ĐÂY --- */}
            <ActivityLog logs={data.logs} />
            {/* ------------------------ */}

          </div>

          <div className="xl:col-span-4 space-y-6">
             <TimeAnalytics 
                heatmapData={data.heatmap}
                comparisonData={data.weekComparison}
             />
          </div>
        </div>
      </div>
    </div>
  );
}