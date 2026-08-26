import { AlertTriangle, TrendingUp, Users } from 'lucide-react';

export function CrossModuleAnnotations() {
  return (
    <div className="space-y-6">
      {/* POS Reconciliation */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-slate-900 mb-1">Đối chiếu POS</h3>
            <p className="text-slate-600 text-sm">Phát hiện sai lệch dữ liệu</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <p className="text-sm text-orange-900">Bàn ảo (Ghost Table)</p>
            </div>
            <p className="text-xs text-orange-700 ml-4">AI CÓ KHÁCH / POS TRỐNG</p>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <p className="text-sm text-red-900">Bàn lỗi (Zombie Table)</p>
            </div>
            <p className="text-xs text-red-700 ml-4">AI TRỐNG / POS CÓ KHÁCH</p>
          </div>
        </div>
      </div>

      {/* HR Operations Support */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-slate-900 mb-1">Hỗ trợ vận hành</h3>
            <p className="text-slate-600 text-sm">Tối ưu hóa nhân sự</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700">
              Biểu đồ nhiệt giúp xác định khu vực cần thêm nhân viên
            </p>
          </div>

          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700">
              Phân bổ khách hàng giúp điều chỉnh ca làm việc
            </p>
          </div>

          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-700">
              Tỷ lệ lấp đầy hỗ trợ phân bổ nhân sự
            </p>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-4">
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Hệ thống:</span>
            <span className="text-slate-900">Computer Vision AI</span>
          </div>
          <div className="flex justify-between">
            <span>Tần suất cập nhật:</span>
            <span className="text-slate-900">5 giây</span>
          </div>
          <div className="flex justify-between">
            <span>Độ chính xác:</span>
            <span className="text-green-600">~95%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
