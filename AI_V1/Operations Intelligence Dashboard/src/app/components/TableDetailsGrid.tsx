import React from 'react';

export function TableDetailsGrid({ tables }: { tables: any[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">Chi tiết trạng thái bàn</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-4 py-3">Bàn</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Hoạt động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tables.map((table) => (
              <tr key={table.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{table.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${table.status === 'CO KHACH' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {table.status}
                  </span>
                </td>
                <td className="px-4 py-3">{table.dwellTime}</td>
                <td className="px-4 py-3">{table.activityLevel}</td>
              </tr>
            ))}
            {tables.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}