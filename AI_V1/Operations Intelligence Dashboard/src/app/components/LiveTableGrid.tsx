import React from 'react';

export function LiveTableGrid({ tables }: { tables: any[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tables.map((table) => {
        const isOccupied = table.status === 'CO KHACH'; 
        return (
          <div key={table.id} className={`p-4 rounded-xl border shadow-sm transition-all ${isOccupied ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`font-bold text-lg ${isOccupied ? 'text-orange-700' : 'text-slate-700'}`}>{table.name}</span>
              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${isOccupied ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                {isOccupied ? 'ĐANG DÙNG' : 'TRỐNG'}
              </span>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Thời gian ngồi:</span>
                <span className={`font-bold ${table.alert === 'NGOI LAU' ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>{table.dwellTime}</span>
              </div>
              
              <div className="flex justify-between text-xs text-slate-500">
                <span>Khách hiện tại:</span>
                <span className="font-bold text-slate-900">{isOccupied ? `${table.guests} người` : '-'}</span>
              </div>

              {/* --- DÒNG MỚI THÊM VÀO --- */}
              <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between text-xs">
                <span className="text-slate-400">Tổng hôm nay:</span>
                <span className="font-bold text-blue-600">{table.totalToday || 0} người</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}