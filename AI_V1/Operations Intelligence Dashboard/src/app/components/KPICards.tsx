import React from 'react';

interface KPICardsProps {
  occupancy: number;
  totalGuests: number;
  currentGuests?: number; // optional, App may not provide this
  avgDwell: number;
}

export function KPICards({ occupancy, totalGuests, currentGuests = 0, avgDwell }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      
      {/* 1. Tỷ lệ lấp đầy */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Hiệu suất</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-extrabold text-slate-900">{occupancy}%</span>
          <span className="text-sm text-slate-400 mb-1">lấp đầy</span>
        </div>
      </div>

      {/* 2. Tổng khách ngày (Số này sẽ khoảng 12-20) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Tổng lượt khách</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-extrabold text-blue-600">{totalGuests}</span>
          <span className="text-sm text-slate-400 mb-1">hôm nay</span>
        </div>
      </div>

      {/* 3. Khách hiện tại (CARD QUAN TRỌNG) */}
      <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-200 relative overflow-hidden">
        <div className="absolute top-4 right-4 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600"></span>
        </div>
        <p className="text-green-800 text-xs font-bold uppercase tracking-wider mb-2">Đang phục vụ</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-extrabold text-green-700">{currentGuests}</span>
          <span className="text-sm text-green-600 mb-1">khách</span>
        </div>
      </div>

      {/* 4. Thời gian */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Thời gian ngồi</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-extrabold text-slate-900">{avgDwell}</span>
          <span className="text-sm text-slate-400 mb-1">phút/bàn</span>
        </div>
      </div>

    </div>
  );
}