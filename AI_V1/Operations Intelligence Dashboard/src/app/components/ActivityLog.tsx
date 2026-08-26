import React from 'react';

// Định nghĩa kiểu dữ liệu khớp 100% với những gì Backend gửi lên
export interface LogEntry {
  id: number;
  time: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  message: string;
}

interface ActivityLogProps {
  logs: LogEntry[];
}

export function ActivityLog({ logs }: ActivityLogProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px]">
      {/* HEADER: Có hiệu ứng đèn xanh nhấp nháy báo hiệu Real-time */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          📜 Nhật ký Hoạt động
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </h3>
        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
          Live Stream
        </span>
      </div>
      
      {/* BODY: Danh sách cuộn */}
      <div className="overflow-y-auto flex-1 p-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <table className="w-full text-sm text-left border-collapse">
          <tbody className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              // Trạng thái khi chưa có log nào
              <tr>
                <td colSpan={3} className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-sm">Đang chờ sự kiện từ Camera AI...</span>
                  </div>
                </td>
              </tr>
            ) : (
              // Render danh sách Log
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors animate-fade-in group">
                  {/* Cột 1: Thời gian */}
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs w-24 whitespace-nowrap border-l-4 border-transparent group-hover:border-indigo-500">
                    {log.time}
                  </td>
                  
                  {/* Cột 2: Loại (Badge màu) */}
                  <td className="px-2 py-3 w-24">
                    <span className={`inline-flex items-center justify-center w-full px-2 py-1 rounded-md text-[10px] font-bold border tracking-wider ${
                      log.type === 'INFO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      log.type === 'WARNING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      log.type === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {log.type}
                    </span>
                  </td>
                  
                  {/* Cột 3: Nội dung */}
                  <td className="px-4 py-3 text-slate-700 font-medium text-sm leading-relaxed">
                    {log.message}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}