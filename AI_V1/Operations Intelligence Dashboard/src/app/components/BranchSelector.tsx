import { MapPin, Building2, Filter } from 'lucide-react';
import { Branch } from '../utils/mockData';

interface BranchSelectorProps {
  branches: Branch[];
  selectedBranch: string;
  onBranchChange: (branchId: string) => void;
}

export function BranchSelector({ branches, selectedBranch, onBranchChange }: BranchSelectorProps) {
  const currentBranch = branches.find(b => b.id === selectedBranch);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left side - Branch info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Đang xem chi nhánh</p>
            <h2 className="text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-600" />
              {currentBranch?.name || 'Tất cả chi nhánh'}
            </h2>
          </div>
        </div>

        {/* Right side - Branch selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="w-4 h-4" />
            <span>Bộ lọc chi nhánh:</span>
          </div>
          
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => onBranchChange(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-900 font-medium hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all cursor-pointer min-w-[200px]"
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            
            {/* Custom dropdown arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Details */}
      {currentBranch && selectedBranch !== 'all' && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Địa chỉ</p>
              <p className="text-slate-900">{currentBranch.address}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Số bàn</p>
              <p className="text-slate-900">{currentBranch.totalTables} bàn</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Sức chứa</p>
              <p className="text-slate-900">{currentBranch.capacity} chỗ</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Trạng thái</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${currentBranch.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <span className={currentBranch.status === 'active' ? 'text-green-600' : 'text-slate-500'}>
                  {currentBranch.status === 'active' ? 'Đang hoạt động' : 'Đóng cửa'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Branches Summary */}
      {selectedBranch === 'all' && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-900">
                Đang hiển thị dữ liệu tổng hợp từ <strong>{branches.length} chi nhánh</strong> đang hoạt động
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Tổng {branches.reduce((sum, b) => sum + b.totalTables, 0)} bàn | 
                Sức chứa {branches.reduce((sum, b) => sum + b.capacity, 0)} chỗ
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
