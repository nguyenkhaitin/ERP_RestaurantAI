import React from 'react';

export function AIActionableInsights() {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
      <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-3">
        ✨ Đề xuất từ AI
      </h3>
      <div className="space-y-3">
        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-50">
          <div className="text-xs font-bold text-amber-600 mb-1">⚠️ CẢNH BÁO PHỤC VỤ</div>
          <p className="text-sm text-slate-700">Bàn 01 ngồi lâu (hơn 60p). Kiểm tra nhu cầu thanh toán.</p>
        </div>
        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-50">
          <div className="text-xs font-bold text-blue-600 mb-1">👥 ĐIỀU PHỐI</div>
          <p className="text-sm text-slate-700">Khu vực 2 đang vắng. Cân nhắc giảm nhân sự.</p>
        </div>
      </div>
    </div>
  );
}