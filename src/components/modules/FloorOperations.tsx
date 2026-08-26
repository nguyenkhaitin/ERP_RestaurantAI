/**
 * =============================================
 * FLOOR OPERATIONS - Vận hành Sàn 
 * MERGED: Includes FloorPOS sub-components inline
 * Layout giống HRManagement.tsx
 * =============================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  Clock, Users, DollarSign, X, QrCode, AlertTriangle, AlertCircle, 
  BarChart3, Store, Wrench, Percent, MapPin, 
  Edit2, Trash2, Plus, Utensils, CreditCard, RefreshCw, Search, Filter, Loader2,
  TrendingUp, Grid3X3, Settings, Camera, Video, VideoOff, Eye, Activity
} from 'lucide-react';

// Import Dashboard Components
import { KPICards, AICameraWidget, LiveTableGrid, ActivityLog } from '../dashboard';
import type { KPIData, TableData, LogEntry } from '../dashboard';

// ==========================================
// TYPESCRIPT INTERFACES
// ==========================================

interface Zone {
  id: number;
  ten_khu_vuc: string;
  table_count: number;
}

interface Table {
  id: number;
  ten_ban: string;
  so_ban: number;
  khu_vuc_id: number;
  ten_khu_vuc: string;
  so_cho_ngoi: number;
  trang_thai: string;
  so_khach_hien_tai?: number;
  thoi_gian_bat_dau?: string;
  hoa_don_hien_tai?: number;
}

interface MenuCategory {
  id: number;
  ten_loai: string;
  thu_tu_hien_thi: number;
  kich_hoat: boolean;
}

interface MenuItem {
  id: number;
  ten_mon: string;
  gia: number;
  mo_ta: string;
  loai_thuc_don_id: number;
  ten_loai_thuc_don: string;
  hinh_anh: string;
  kich_hoat: boolean;
}

// Interface for selected items with quantity
interface SelectedItem {
  id: number;
  ten_mon: string;
  gia: number;
  quantity: number;
}

interface BookingFormData {
  ten_khach_hang: string;
  sdt_khach_hang: string;
  ngay_dat: string;
  gio_dat: string;
  so_khach: number;
  ghi_chu: string;
}

interface ServiceFormData {
  loai_dich_vu: string;
  so_khach: number;
  bat_dau_tinh_gio: boolean;
  selectedItems: SelectedItem[];
  ghi_chu: string;
}

interface PaymentFormData {
  phuong_thuc_thanh_toan: string;
}

interface Alert {
  id: number;
  table: string;
  message: string;
}

interface FloorOperationsProps {
  activeSubModule?: string;
}

const API_BASE = 'http://127.0.0.1:8000/api';

// ==========================================
// SUB-MODULE 1: DASHBOARD - Tổng quan (PROFESSIONAL VERSION)
// Uses imported dashboard components
// ==========================================

const AI_BACKEND_URL = 'http://localhost:8000';

// Ngrok headers - Required for ngrok free tier
const NGROK_HEADERS = {
  'ngrok-skip-browser-warning': 'true'
};

const FloorDashboard = ({ 
  zones, 
  tables 
}: { 
  zones: Zone[];
  tables: Table[];
}) => {
  // AI Camera state
  const [aiGuestCount, setAiGuestCount] = useState(0);
  const [activeTableCount, setActiveTableCount] = useState(0);
  const [activeTableIds, setActiveTableIds] = useState<number[]>([]);
  const [cameraStatus, setCameraStatus] = useState<'active' | 'inactive' | 'error'>('inactive');
  const [aiTables, setAiTables] = useState<TableData[]>([]);
  const [aiLogs, setAiLogs] = useState<LogEntry[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  
  // Analytics data (MOCK từ backend)
  const [analyticsData, setAnalyticsData] = useState<{
    revenue_week: Array<{day: string; value: number; orders?: number}>;
    peak_hours: Array<{hour: string; guests: number}>;
    efficiency_score: number;
    revenue_today: number;
    total_orders_today: number;
  }>({
    revenue_week: [],
    peak_hours: [],
    efficiency_score: 88,
    revenue_today: 0,
    total_orders_today: 0
  });

  // Fetch AI dashboard data - HYBRID: realtime (real) + analytics (mock)
  const fetchAIDashboard = useCallback(async () => {
    try {
      setDashboardError(null);
      console.log('[FloorDashboard] Fetching from:', `${AI_BACKEND_URL}/api/dashboard`);
      
      const dashRes = await fetch(`${AI_BACKEND_URL}/api/dashboard`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      console.log('[FloorDashboard] Response status:', dashRes.status);
      
      if (!dashRes.ok) {
        throw new Error(`HTTP ${dashRes.status}`);
      }
      
      const dashData = await dashRes.json();
      console.log('[FloorDashboard] Data received:', dashData);
      
      if (dashData.success) {
        // ============ REALTIME DATA (THẬT từ AI) ============
        const realtime = dashData.realtime || {};
        console.log('[FloorDashboard] Realtime:', realtime);
        
        // Số khách THẬT từ AI
        const guestCount = realtime.total_guests ?? realtime.guest_count ?? 0;
        setAiGuestCount(typeof guestCount === 'number' && !isNaN(guestCount) ? guestCount : 0);
        
        // Số bàn có khách THẬT từ AI
        const tableCount = realtime.active_tables_count ?? realtime.active_tables ?? 0;
        setActiveTableCount(typeof tableCount === 'number' && !isNaN(tableCount) ? tableCount : 0);
        
        // Danh sách ID bàn có khách
        setActiveTableIds(realtime.active_table_ids || []);
        
        // Camera status
        setCameraStatus(realtime.camera_status === 'active' ? 'active' : 'inactive');
        
        // Convert table_details to TableData format
        if (realtime.table_details && Array.isArray(realtime.table_details) && realtime.table_details.length > 0) {
          const convertedTables: TableData[] = realtime.table_details.map((t: any) => {
            // Backend đã trả về id là 1-indexed (1, 2, 3... 8)
            const tableId = t.id ?? t.table_id ?? 1;
            const headcount = t.headcount ?? t.guest_count ?? t.currentGuests ?? 0;
            const isOccupied = t.status === 'CO KHACH' || t.occupied === true || headcount > 0;
            const dwellTime = t.dwellTime ?? t.dwell_time ?? '0p';
            
            return {
              id: tableId,
              name: t.name ?? `Bàn ${tableId}`,  // ID đã là 1-indexed
              zone: tableId <= 4 ? 'Khu A' : 'Khu B',
              capacity: t.capacity ?? t.max_capacity ?? 4,
              currentGuests: typeof headcount === 'number' && !isNaN(headcount) ? headcount : 0,
              status: isOccupied ? 'occupied' : 'empty' as 'empty' | 'occupied' | 'reserved' | 'alert',
              lastUpdate: realtime.last_updated || new Date().toISOString(),
              dwellTime: dwellTime
            };
          });
          setAiTables(convertedTables);
        }
        
        // Convert activity_logs to LogEntry format
        const logs = realtime.activity_logs || realtime.logs || [];
        if (Array.isArray(logs) && logs.length > 0) {
          const convertedLogs: LogEntry[] = logs.map((log: any, idx: number) => ({
            id: log.id ?? idx,
            time: log.time || new Date().toLocaleTimeString('vi-VN'),
            message: log.message || log.event || log.action || 'Sự kiện',
            type: (log.type?.toUpperCase() || 'INFO') as 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
          }));
          setAiLogs(convertedLogs);
        }
        
        // ============ ANALYTICS DATA (MOCK từ backend) ============
        const analytics = dashData.analytics || {};
        setAnalyticsData({
          revenue_week: analytics.revenue_week || [],
          peak_hours: analytics.peak_hours || [],
          efficiency_score: analytics.efficiency_score ?? 88,
          revenue_today: analytics.revenue_today ?? 0,
          total_orders_today: analytics.total_orders_today ?? 0
        });
      } else {
        throw new Error(dashData.error || 'Unknown error');
      }

      setIsLoadingAI(false);
    } catch (err) {
      console.error('[FloorDashboard] Error:', err);
      
      // Check if backend is responding at all
      try {
        const healthRes = await fetch(`${AI_BACKEND_URL}/health`, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });
        if (!healthRes.ok) {
          setDashboardError('Backend không phản hồi (HTTP ' + healthRes.status + ')');
        } else {
          setDashboardError('Lỗi lấy dữ liệu: ' + (err instanceof Error ? err.message : String(err)));
        }
      } catch {
        setDashboardError('Backend không chạy! Hãy khởi động: uvicorn backend.main:app --reload --port 8000');
      }
      
      setCameraStatus('error');
      setIsLoadingAI(false);
    }
  }, []);

  useEffect(() => {
    fetchAIDashboard();
    // HIGH-FREQUENCY POLLING: 5 times per second for real-time AI updates
    const interval = setInterval(fetchAIDashboard, 200);
    return () => clearInterval(interval);
  }, [fetchAIDashboard]);

  // Calculate stats from tables prop (with NaN protection)
  const totalTables = tables.length || 8;
  const occupiedCount = tables.filter(t => t.trang_thai === 'occupied' || t.trang_thai === 'alert').length;
  const alertCount = tables.filter(t => t.trang_thai === 'alert').length;
  
  // Use AI active table count if available, else calculate from DB
  const effectiveActiveCount = activeTableCount > 0 ? activeTableCount : occupiedCount;
  const occupancyRate = totalTables > 0 ? Math.round((effectiveActiveCount / totalTables) * 100) : 0;

  // KPI Data for cards (with NaN protection)
  const kpiData: KPIData = {
    totalGuests: isNaN(aiGuestCount) ? 0 : aiGuestCount,
    currentGuests: isNaN(aiGuestCount) ? 0 : aiGuestCount,
    occupancyRate: isNaN(occupancyRate) ? 0 : occupancyRate,
    avgDwellTime: 0,
    cameraStatus: cameraStatus,
    alertCount: isNaN(alertCount) ? 0 : alertCount,
    // Additional analytics from mock data
    efficiencyScore: analyticsData.efficiency_score,
    revenueToday: analyticsData.revenue_today,
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations Intelligence Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Giám sát vận hành thời gian thực bằng AI Computer Vision</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm text-slate-600">Hệ thống đang hoạt động</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards data={kpiData} isLoading={isLoadingAI} />

      {/* Error Alert */}
      {dashboardError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Lỗi Kết Nối Dashboard</h3>
              <p className="text-red-700 text-sm mt-1">{dashboardError}</p>
              <p className="text-red-600 text-xs mt-2">
                ⚠️ Hãy kiểm tra: Backend chạy ở http://127.0.0.1:8000 chưa?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid: Camera + Tables + Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: AI Camera */}
        <div className="xl:col-span-1">
          <AICameraWidget 
            backendUrl={AI_BACKEND_URL}
            onGuestCountChange={setAiGuestCount}
          />
        </div>

        {/* Right Column: Tables Grid + Activity Log */}
        <div className="xl:col-span-2 space-y-6">
          {/* Live Table Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-slate-900 text-lg font-semibold">Trạng thái Bàn Real-time</h2>
                <p className="text-slate-500 text-sm">Cập nhật từ AI Detection</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                  Đang dùng
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                  Đang phục vụ
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-slate-200"></span>
                  Trống
                </span>
              </div>
            </div>
            
            {aiTables.length > 0 ? (
              <LiveTableGrid 
                tables={aiTables} 
                activeTableIds={activeTableIds}
                isLoading={isLoadingAI} 
              />
            ) : (
              // Fallback to zone overview if no AI table data
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {zones.map(zone => {
                  const zoneTables = tables.filter(t => t.khu_vuc_id === zone.id);
                  const zoneOccupied = zoneTables.filter(t => t.trang_thai === 'occupied').length;
                  const zoneTotal = zoneTables.length;
                  const zoneRate = zoneTotal > 0 ? (zoneOccupied / zoneTotal * 100).toFixed(0) : '0';

                  return (
                    <div key={zone.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <h4 className="font-semibold text-slate-800 mb-2">{zone.ten_khu_vuc}</h4>
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-slate-500">Lấp đầy:</span>
                        <span className="font-bold text-slate-900">{zoneOccupied}/{zoneTotal}</span>
                      </div>
                      <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${zoneRate}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{zoneRate}% sử dụng</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <ActivityLog logs={aiLogs} isLoading={isLoadingAI} maxHeight="350px" />
        </div>
      </div>

      {/* Analytics Dashboard - DISABLED for testing */}
      {/* <div className="border-t border-slate-200 pt-6">
        <AnalyticsDashboard />
      </div> */}
    </div>
  );
};

// ==========================================
// SUB-MODULE 2: POS - Sơ đồ bàn
// ==========================================

// --- SUB COMPONENT: StatusBar ---
const StatusBar = ({
  totalGuests,
  occupiedCount,
  reservedCount,
  emptyCount
}: {
  totalGuests: number;
  occupiedCount: number;
  reservedCount: number;
  emptyCount: number;
}) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <span>Tổng khách: <strong>{totalGuests}</strong></span>
          </div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>Đang phục vụ: <strong className="text-green-600">{occupiedCount} bàn</strong></div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>Đã đặt: <strong className="text-blue-600">{reservedCount} bàn</strong></div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>Bàn trống: <strong className="text-gray-600">{emptyCount} bàn</strong></div>
        </div>
        <div className="text-sm text-gray-500">
          Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
        </div>
      </div>
    </div>
  );
};

// --- SUB COMPONENT: AlertsPanel ---
const AlertsPanel = ({ alerts }: { alerts: Alert[] }) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle size={20} className="text-red-600" />
        <h3 className="font-semibold">Cảnh báo</h3>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">Bàn {alert.table}</div>
                <div className="text-xs text-gray-600">{alert.message}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- SUB COMPONENT: StatsPanel ---
const StatsPanel = ({
  totalTables,
  occupiedCount,
  emptyCount,
  reservedCount
}: {
  totalTables: number;
  occupiedCount: number;
  emptyCount: number;
  reservedCount: number;
}) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h3 className="font-semibold mb-4">Thống kê sàn</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm">Tổng số bàn</span>
          <span className="font-semibold">{totalTables}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm">Đang phục vụ</span>
          <span className="font-semibold text-green-600">{occupiedCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm">Bàn trống</span>
          <span className="font-semibold text-gray-600">{emptyCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm">Đã đặt trước</span>
          <span className="font-semibold text-blue-600">{reservedCount}</span>
        </div>
      </div>
    </div>
  );
};

// --- SUB COMPONENT: BookingFormTab ---
const BookingFormTab = ({
  bookingForm,
  setBookingForm,
  maxGuests,
  onSubmit,
  isSubmitting
}: {
  bookingForm: BookingFormData;
  setBookingForm: React.Dispatch<React.SetStateAction<BookingFormData>>;
  maxGuests: number;
  onSubmit: () => void;
  isSubmitting: boolean;
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Tên khách hàng *</label>
        <input
          type="text"
          value={bookingForm.ten_khach_hang}
          onChange={(e) => setBookingForm({ ...bookingForm, ten_khach_hang: e.target.value })}
          placeholder="Nhập tên khách hàng"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
        />
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Số điện thoại *</label>
        <input
          type="tel"
          value={bookingForm.sdt_khach_hang}
          onChange={(e) => setBookingForm({ ...bookingForm, sdt_khach_hang: e.target.value })}
          placeholder="0901234567"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Ngày đến *</label>
          <input
            type="date"
            value={bookingForm.ngay_dat}
            onChange={(e) => setBookingForm({ ...bookingForm, ngay_dat: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">Giờ đến *</label>
          <input
            type="time"
            value={bookingForm.gio_dat}
            onChange={(e) => setBookingForm({ ...bookingForm, gio_dat: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Số lượng khách *</label>
        <input
          type="number"
          min="1"
          max={maxGuests}
          value={bookingForm.so_khach}
          onChange={(e) => setBookingForm({ ...bookingForm, so_khach: parseInt(e.target.value) || 0 })}
          placeholder="4"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        <p className="text-xs text-gray-500 mt-1">Tối đa: {maxGuests} chỗ ngồi</p>
      </div>
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Ghi chú</label>
        <textarea
          rows={3}
          value={bookingForm.ghi_chu}
          onChange={(e) => setBookingForm({ ...bookingForm, ghi_chu: e.target.value })}
          placeholder="Yêu cầu đặc biệt..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-none transition-colors"
        ></textarea>
      </div>
      <button 
        onClick={onSubmit}
        disabled={isSubmitting || !bookingForm.ten_khach_hang || !bookingForm.sdt_khach_hang || !bookingForm.ngay_dat || !bookingForm.gio_dat || !bookingForm.so_khach}
        style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
        className="w-full py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đặt bàn'}
      </button>
    </div>
  );
};

// --- SUB COMPONENT: ServiceFormTab ---
const ServiceFormTab = ({
  serviceForm,
  setServiceForm,
  maxGuests,
  startTime,
  onSubmit,
  isSubmitting,
  onOpenMenuSelector
}: {
  serviceForm: ServiceFormData;
  setServiceForm: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  maxGuests: number;
  startTime?: string;
  onSubmit: () => void;
  isSubmitting: boolean;
  onOpenMenuSelector: () => void;
}) => {
  const totalAmount = serviceForm.selectedItems.reduce(
    (sum, item) => sum + (item.gia * item.quantity), 0
  );
  const totalItems = serviceForm.selectedItems.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  return (
    <div className="space-y-4">
      {/* Guest Count */}
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Số lượng khách *</label>
        <input
          type="number"
          min="1"
          max={maxGuests}
          value={serviceForm.so_khach}
          onChange={(e) => setServiceForm({ ...serviceForm, so_khach: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        <p className="text-xs text-gray-500 mt-1">Tối đa: {maxGuests} chỗ ngồi</p>
      </div>

      {/* Menu Selection Button */}
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Chọn món / Gói dịch vụ</label>
        <button
          type="button"
          onClick={onOpenMenuSelector}
          className="w-full px-4 py-3 border-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-500 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          {totalItems > 0 ? `Đã chọn ${totalItems} món • Thêm/Sửa` : 'Chọn món / Gói dịch vụ'}
        </button>
      </div>

      {/* Selected Items Display */}
      {serviceForm.selectedItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">Danh sách đã chọn:</div>
          <div className="space-y-2 max-h-40 overflow-auto">
            {serviceForm.selectedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm bg-white rounded p-2">
                <span className="font-medium">{item.ten_mon}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">x{item.quantity}</span>
                  <span className="font-semibold text-blue-600">
                    {(item.gia * item.quantity).toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium text-gray-700">Tổng tạm tính:</span>
            <span className="text-xl font-bold text-green-600">
              {totalAmount.toLocaleString('vi-VN')} ₫
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Ghi chú</label>
        <textarea
          rows={2}
          value={serviceForm.ghi_chu}
          onChange={(e) => setServiceForm({ ...serviceForm, ghi_chu: e.target.value })}
          placeholder="Yêu cầu đặc biệt (nếu có)..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-none transition-colors text-sm"
        ></textarea>
      </div>

      {/* Timer Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <div className="font-medium">Đồng hồ tính giờ</div>
          <div className="text-sm text-gray-600">Theo dõi thời gian dùng bữa</div>
        </div>
        <label className="relative inline-block w-12 h-6">
          <input 
            type="checkbox" 
            checked={serviceForm.bat_dau_tinh_gio}
            onChange={(e) => setServiceForm({ ...serviceForm, bat_dau_tinh_gio: e.target.checked })}
            className="peer sr-only" 
          />
          <div className="w-12 h-6 bg-gray-300 peer-checked:bg-green-500 rounded-full transition-colors"></div>
          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
        </label>
      </div>

      {startTime && (
        <div className="flex items-center gap-2 text-gray-600">
          <Clock size={18} />
          <span>Thời gian hiện tại: {Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)} phút</span>
        </div>
      )}

      {/* Submit Button */}
      <button 
        onClick={onSubmit}
        disabled={isSubmitting || !serviceForm.so_khach}
        style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
        className="w-full py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isSubmitting ? 'Đang xử lý...' : 'Mở bàn & Phục vụ'}
      </button>
    </div>
  );
};

// --- SUB COMPONENT: PaymentFormTab ---
const PaymentFormTab = ({
  paymentForm,
  setPaymentForm,
  guestCount,
  startTime,
  showQR,
  setShowQR,
  onSubmit,
  isSubmitting,
  invoiceId
}: {
  paymentForm: PaymentFormData;
  setPaymentForm: React.Dispatch<React.SetStateAction<PaymentFormData>>;
  guestCount?: number;
  startTime?: string;
  showQR: boolean;
  setShowQR: (show: boolean) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  invoiceId?: number;
}) => {
  const [billData, setBillData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  // Fetch invoice data when tab is opened
  React.useEffect(() => {
    if (invoiceId) {
      setLoading(true);
      fetch(`${API_BASE}/invoices/${invoiceId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setBillData(result.data);
          }
        })
        .catch(err => console.error('Error fetching invoice:', err))
        .finally(() => setLoading(false));
    }
  }, [invoiceId]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('vi-VN') + ' ₫';
  };

  // Calculate display total (fallback if API returns 0)
  const displayTamTinh = React.useMemo(() => {
    if (!billData || !billData.items) return 0;
    // If tam_tinh is 0 but we have items, calculate from items
    if (billData.tam_tinh === 0 && billData.items.length > 0) {
      return billData.items.reduce((sum: number, item: any) => sum + (item.thanh_tien || 0), 0);
    }
    return billData.tam_tinh || 0;
  }, [billData]);

  const displayTienVat = React.useMemo(() => {
    if (!billData) return 0;
    // If tien_vat is 0 but we have tam_tinh, calculate VAT
    if (billData.tien_vat === 0 && displayTamTinh > 0) {
      return displayTamTinh * ((billData.phan_tram_vat || 8) / 100);
    }
    return billData.tien_vat || 0;
  }, [billData, displayTamTinh]);

  const displayTongTien = React.useMemo(() => {
    if (!billData) return 0;
    // If tong_tien is 0 but we have tam_tinh, calculate total
    if (billData.tong_tien === 0 && displayTamTinh > 0) {
      return displayTamTinh + displayTienVat;
    }
    return billData.tong_tien || 0;
  }, [billData, displayTamTinh, displayTienVat]);

  return (
    <div className="space-y-4">
      {/* Invoice Items */}
      {loading ? (
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <div className="text-gray-600">Đang tải hóa đơn...</div>
        </div>
      ) : billData ? (
        <>
          {/* Invoice Header */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-gray-600">Mã hóa đơn</div>
              <div className="font-semibold text-blue-700">{billData.ma_hoa_don}</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">Số khách</div>
              <div className="font-medium">{billData.so_khach} người</div>
            </div>
          </div>

          {/* Items List */}
          {billData.items && billData.items.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-medium text-sm text-gray-700 grid grid-cols-12 gap-2">
                <div className="col-span-5">Món ăn</div>
                <div className="col-span-2 text-center">SL</div>
                <div className="col-span-3 text-right">Đơn giá</div>
                <div className="col-span-2 text-right">Thành tiền</div>
              </div>
              <div className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
                {billData.items.map((item: any) => (
                  <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-2 text-sm hover:bg-gray-50">
                    <div className="col-span-5 font-medium text-gray-800">{item.ten_mon}</div>
                    <div className="col-span-2 text-center text-gray-600">×{item.so_luong}</div>
                    <div className="col-span-3 text-right text-gray-700">{formatCurrency(item.don_gia)}</div>
                    <div className="col-span-2 text-right font-semibold text-gray-900">{formatCurrency(item.thanh_tien)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bill Summary */}
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tạm tính</span>
                <span className="font-medium">{formatCurrency(displayTamTinh)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT ({billData.phan_tram_vat || 8}%)</span>
                <span className="font-medium">{formatCurrency(displayTienVat)}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 mt-2"></div>
              <div className="flex justify-between">
                <span className="text-gray-700 font-semibold">Tổng cộng</span>
                <span className="text-2xl text-green-600 font-bold">{formatCurrency(displayTongTien)}</span>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              {startTime && (
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)} phút</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="p-6 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Tổng hóa đơn tạm tính</div>
          <div className="text-3xl text-green-600 font-bold mb-4">0 ₫</div>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-600" />
              <span>Số khách: <strong>{guestCount || 0} người</strong></span>
            </div>
            {startTime && (
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-600" />
                <span>Thời gian: <strong>{Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)} phút</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div>
        <label className="block mb-2 text-sm font-medium text-gray-700">Phương thức thanh toán</label>
        <select 
          value={paymentForm.phuong_thuc_thanh_toan}
          onChange={(e) => setPaymentForm({ ...paymentForm, phuong_thuc_thanh_toan: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <option value="tien_mat">Tiền mặt</option>
          <option value="chuyen_khoan">Chuyển khoản</option>
          <option value="the">Thẻ tín dụng/ghi nợ</option>
          <option value="vi_dien_tu">Ví điện tử</option>
        </select>
      </div>

      {/* QR Code */}
      {showQR && billData && (
        <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg">
          <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center mb-3">
            <QrCode size={120} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">Quét mã để thanh toán qua mobile banking</p>
          <p className="text-xs text-gray-500 mt-1">{formatCurrency(displayTongTien)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowQR(!showQR)}
          disabled={!billData || displayTongTien === 0}
          className="flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <QrCode size={18} />
          {showQR ? 'Ẩn' : 'Tạo'} mã QR
        </button>
        <button 
          onClick={() => {
            console.log('[PAYMENT BUTTON] Clicked! billData:', billData);
            console.log('[PAYMENT BUTTON] displayTongTien:', displayTongTien);
            console.log('[PAYMENT BUTTON] Calling onSubmit...');
            onSubmit();
          }}
          disabled={isSubmitting || !billData || displayTongTien === 0}
          style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
          className="py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isSubmitting ? 'Đang xử lý...' : 'Thanh toán'}
        </button>
      </div>
    </div>
  );
};

// --- SUB COMPONENT: MenuSelectorModal ---
const MenuSelectorModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialItems = []
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (items: SelectedItem[]) => void;
  initialItems?: SelectedItem[];
}) => {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(initialItems);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchMenuData();
      setSelectedItems(initialItems);
    }
  }, [isOpen]);

  const fetchMenuData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        fetch(`${API_BASE}/menu-categories`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }),
        fetch(`${API_BASE}/menu-items`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        })
      ]);
      
      const categoriesData = await categoriesRes.json();
      const itemsData = await itemsRes.json();
      
      setCategories(categoriesData);
      setMenuItems(itemsData);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.ten_mon?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory 
      ? (item.category_id === selectedCategory || item.loai_thuc_don_id === selectedCategory)
      : true;
    return matchesSearch && matchesCategory;
  });

  const getItemQuantity = (itemId: number) => {
    return selectedItems.find(i => i.id === itemId)?.quantity || 0;
  };

  const addItem = (item: any) => {
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i => 
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems([...selectedItems, {
        id: item.id,
        ten_mon: item.name || item.ten_mon,
        gia: item.price || item.gia,
        quantity: 1
      }]);
    }
  };

  const removeItem = (itemId: number) => {
    const existing = selectedItems.find(i => i.id === itemId);
    if (existing && existing.quantity > 1) {
      setSelectedItems(selectedItems.map(i => 
        i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
      ));
    } else {
      setSelectedItems(selectedItems.filter(i => i.id !== itemId));
    }
  };

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.gia * item.quantity), 0);
  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ 
          zIndex: 100000,
          maxHeight: '75vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* 1. Header: Tìm kiếm & Lọc - Fixed */}
        <div className="p-3 border-b bg-gray-50 rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Chọn món thêm</h3>
              <p className="text-xs text-gray-500">Đã chọn {totalItems} món • {totalAmount.toLocaleString('vi-VN')} ₫</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === null 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name || cat.ten_loai}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Body: Danh sách món (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50/50 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Utensils className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Không tìm thấy món ăn</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
              {filteredItems.map(item => {
                const quantity = getItemQuantity(item.id);
                const itemName = item.name || item.ten_mon;
                const itemPrice = item.price || item.gia;
                
                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md bg-white ${
                      quantity > 0 ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => addItem(item)}
                  >
                    <div className="flex flex-col h-full">
                      <div className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
                        {itemName}
                      </div>
                      <div className="text-blue-600 font-semibold text-sm mt-auto">
                        {itemPrice.toLocaleString('vi-VN')} ₫
                      </div>
                      
                      {quantity > 0 && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                            className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-600 rounded-full hover:bg-red-200 font-bold transition-colors"
                          >
                            -
                          </button>
                          <span className="font-bold text-blue-600">{quantity}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); addItem(item); }}
                            className="w-7 h-7 flex items-center justify-center bg-green-100 text-green-600 rounded-full hover:bg-green-200 font-bold transition-colors"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Items Summary - Fixed Above Footer */}
        {selectedItems.length > 0 && (
          <div className="border-t px-3 py-1.5 bg-blue-50 flex-shrink-0">
            <div className="text-xs font-medium text-gray-700 mb-1">Đã chọn:</div>
            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto scrollbar-thin">
              {selectedItems.map(item => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {item.ten_mon} x{item.quantity}
                  <button
                    onClick={() => setSelectedItems(selectedItems.filter(i => i.id !== item.id))}
                    className="ml-0.5 hover:text-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 3. Footer: Action Buttons - Fixed */}
        <div className="p-3 border-t bg-white rounded-b-xl flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 flex-shrink-0">
          <div>
            <div className="text-xs text-gray-600">Tổng tạm tính:</div>
            <div className="text-lg font-bold text-green-600">
              {totalAmount.toLocaleString('vi-VN')} ₫
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
            >
              Hủy
            </button>
            <button
              onClick={() => onConfirm(selectedItems)}
              style={{ backgroundColor: '#1c2a46', color: 'white' }}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg hover:opacity-90 font-semibold transition-all text-sm"
            >
              Xác nhận ({totalItems})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- SUB COMPONENT: TableModal ---
const TableModal = ({
  table,
  onClose,
  onBooking,
  onStartService,
  onPayment,
  isSubmitting
}: {
  table: Table;
  onClose: () => void;
  onBooking: (data: BookingFormData) => void;
  onStartService: (data: ServiceFormData) => void;
  onPayment: (data: PaymentFormData) => void;
  isSubmitting: boolean;
}) => {
  // Determine initial tab based on table status
  const getInitialTab = (): 'booking' | 'service' | 'payment' => {
    if (table.trang_thai === 'occupied') return 'payment';
    if (table.trang_thai === 'reserved') return 'service'; // Reserved tables go to check-in
    return 'booking'; // Empty tables show booking first
  };

  const [activeTab, setActiveTab] = useState<'booking' | 'service' | 'payment'>(getInitialTab());
  const [showQR, setShowQR] = useState(false);
  const [showMenuSelector, setShowMenuSelector] = useState(false);

  const [bookingForm, setBookingForm] = useState<BookingFormData>({
    ten_khach_hang: '',
    sdt_khach_hang: '',
    ngay_dat: new Date().toISOString().split('T')[0],
    gio_dat: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    so_khach: 2,
    ghi_chu: ''
  });

  const [serviceForm, setServiceForm] = useState<ServiceFormData>({
    loai_dich_vu: 'alacarte',
    so_khach: 2,
    bat_dau_tinh_gio: true,
    selectedItems: [],
    ghi_chu: ''
  });

  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    phuong_thuc_thanh_toan: 'tien_mat'
  });

  const handleMenuConfirm = (items: SelectedItem[]) => {
    setServiceForm({ ...serviceForm, selectedItems: items });
    setShowMenuSelector(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'empty': return 'Trống';
      case 'occupied': return 'Đang phục vụ';
      case 'reserved': return 'Đã đặt';
      case 'alert': return 'Cảnh báo';
      default: return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'empty': return { bg: 'bg-gray-100', text: 'text-gray-700' };
      case 'occupied': return { bg: 'bg-blue-100', text: 'text-blue-700' };
      case 'reserved': return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
      case 'alert': return { bg: 'bg-red-100', text: 'text-red-700' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700' };
    }
  };

  const statusBadge = getStatusBadge(table.trang_thai);

  // Render tabs based on table status
  const renderTabs = () => {
    // If table is occupied -> ONLY show Payment tab
    if (table.trang_thai === 'occupied') {
      return (
        <div className="flex border-b sticky top-[89px] bg-white z-10">
          <button
            onClick={() => setActiveTab('payment')}
            className="flex-1 py-3 px-4 text-sm font-medium border-b-2 border-blue-600 text-blue-600"
          >
            <div className="flex items-center justify-center gap-2">
              <CreditCard size={16} />
              Thanh toán / Tiện ích
            </div>
          </button>
        </div>
      );
    }

    // If table is reserved -> Show Service (check-in) only
    if (table.trang_thai === 'reserved') {
      return (
        <div className="flex border-b sticky top-[89px] bg-white z-10">
          <button
            onClick={() => setActiveTab('service')}
            className="flex-1 py-3 px-4 text-sm font-medium border-b-2 border-blue-600 text-blue-600"
          >
            <div className="flex items-center justify-center gap-2">
              <Users size={16} />
              Bắt đầu phục vụ (Check-in)
            </div>
          </button>
        </div>
      );
    }

    // If table is empty -> Show Booking and Service tabs
    return (
      <div className="flex border-b sticky top-[89px] bg-white z-10">
        <button
          onClick={() => setActiveTab('booking')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'booking'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock size={16} />
            Đặt bàn trước
          </div>
        </button>
        <button
          onClick={() => setActiveTab('service')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'service'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users size={16} />
            Mở bàn ngay
          </div>
        </button>
      </div>
    );
  };

  // Render content based on table status
  const renderContent = () => {
    // If table is occupied -> Show payment/info content
    if (table.trang_thai === 'occupied') {
      return (
        <div className="space-y-4">
          {/* Service Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Thông tin phục vụ</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Số khách:</span>
                <span className="ml-2 font-semibold">{table.so_khach_hien_tai || 0} người</span>
              </div>
              <div>
                <span className="text-gray-600">Giờ vào:</span>
                <span className="ml-2 font-semibold">
                  {table.thoi_gian_bat_dau 
                    ? new Date(table.thoi_gian_bat_dau).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>
              {table.thoi_gian_bat_dau && (
                <div className="col-span-2">
                  <span className="text-gray-600">Thời gian phục vụ:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {Math.floor((Date.now() - new Date(table.thoi_gian_bat_dau).getTime()) / 60000)} phút
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Form */}
          <PaymentFormTab
            paymentForm={paymentForm}
            setPaymentForm={setPaymentForm}
            guestCount={table.so_khach_hien_tai}
            startTime={table.thoi_gian_bat_dau}
            showQR={showQR}
            setShowQR={setShowQR}
            onSubmit={() => onPayment(paymentForm)}
            isSubmitting={isSubmitting}
            invoiceId={table.hoa_don_hien_tai}
          />
        </div>
      );
    }

    // If table is reserved -> Show check-in form only
    if (table.trang_thai === 'reserved') {
      return (
        <div className="space-y-4">
          {/* Reservation Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Thông tin đặt bàn</h4>
            <p className="text-sm text-yellow-700">
              Bàn đã được đặt trước. Nhập số khách và chọn món để bắt đầu phục vụ.
            </p>
          </div>

          {/* Service Form */}
          <ServiceFormTab
            serviceForm={serviceForm}
            setServiceForm={setServiceForm}
            maxGuests={table.so_cho_ngoi}
            startTime={table.thoi_gian_bat_dau}
            onSubmit={() => onStartService(serviceForm)}
            isSubmitting={isSubmitting}
            onOpenMenuSelector={() => setShowMenuSelector(true)}
          />
        </div>
      );
    }

    // Empty table -> Show Booking or Service based on activeTab
    return (
      <>
        {activeTab === 'booking' && (
          <BookingFormTab
            bookingForm={bookingForm}
            setBookingForm={setBookingForm}
            maxGuests={table.so_cho_ngoi}
            onSubmit={() => onBooking(bookingForm)}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'service' && (
          <ServiceFormTab
            serviceForm={serviceForm}
            setServiceForm={setServiceForm}
            maxGuests={table.so_cho_ngoi}
            startTime={table.thoi_gian_bat_dau}
            onSubmit={() => onStartService(serviceForm)}
            isSubmitting={isSubmitting}
            onOpenMenuSelector={() => setShowMenuSelector(true)}
          />
        )}
      </>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b bg-white shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Bàn {table.ten_ban}</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                  {getStatusLabel(table.trang_thai)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{table.ten_khu_vuc} • {table.so_cho_ngoi} chỗ ngồi</p>
            </div>
            <button
              onClick={() => {
                onClose();
                setShowQR(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
              title="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          {renderTabs()}

          {/* Tab Content - Scrollable */}
          <div className="p-6 overflow-auto flex-1">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Menu Selector Modal - Rendered outside main modal */}
      <MenuSelectorModal
        isOpen={showMenuSelector}
        onClose={() => setShowMenuSelector(false)}
        onConfirm={handleMenuConfirm}
        initialItems={serviceForm.selectedItems}
      />
    </>
  );
};

const FloorPOS = ({
  tables,
  onRefresh
}: {
  tables: Table[];
  onRefresh: () => void;
}) => {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [apiTables, setApiTables] = useState<Table[]>([]);
  const [aiAlerts, setAiAlerts] = useState<any[]>([]);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [enableAiMonitoring, setEnableAiMonitoring] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Add table modal states
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [newTableSeats, setNewTableSeats] = useState(4);

  // Fetch zones and tables from API
  useEffect(() => {
    fetchData();
    fetchAiAlerts();
    const interval = setInterval(fetchAiAlerts, 30000); // Refresh alerts every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch zones
      const zonesResponse = await fetch(`${API_BASE}/zones`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const zonesData = await zonesResponse.json();
      console.log('[FloorPOS] Zones fetched:', zonesData);
      setZones(zonesData.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)));

      // Fetch tables
      const tablesResponse = await fetch(`${API_BASE}/tables`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const tablesData = await tablesResponse.json();
      console.log('[FloorPOS] Tables fetched:', tablesData.length, 'tables');
      console.log('[FloorPOS] Sample table:', tablesData[0]);
      setApiTables(tablesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to props if API fails
      setZones([]);
      setApiTables(tables);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE}/ai/alerts`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (response.ok) {
        const data = await response.json();
        setAiAlerts(data);
      } else {
        setAiAlerts([]);
      }
    } catch (error) {
      console.error('Error fetching AI alerts (API not available yet):', error);
      setAiAlerts([]);
    }
  };

  // Map database status to UI status (from trang_thai_ban table)
  const mapTableStatus = (dbStatus: string): string => {
    const statusMap: Record<string, string> = {
      'empty': 'empty',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'co_khach': 'occupied',
      'dat_truoc': 'reserved',
      'trong': 'empty'
    };
    return statusMap[dbStatus] || dbStatus;
  };

  // Get table status from API (not from props)
  const displayTables = apiTables.length > 0 ? apiTables : tables;
  
  // Log for debugging
  console.log('[FloorPOS] Rendering with', zones.length, 'zones and', displayTables.length, 'tables');
  
  const mappedTables = displayTables.map((t: any) => ({ 
    ...t,
    // Ensure field compatibility (API now returns Vietnamese field names)
    trang_thai: mapTableStatus((t.trang_thai || 'empty') as string),
    so_khach_hien_tai: t.so_khach_hien_tai || t.so_khach_pos || 0
  }));
  
  const totalGuests = mappedTables.filter(t => t.trang_thai === 'occupied').reduce((sum, t) => sum + (t.so_khach_pos || t.so_khach_hien_tai || 0), 0);
  const occupiedCount = mappedTables.filter(t => t.trang_thai === 'occupied').length;
  const reservedCount = mappedTables.filter(t => t.trang_thai === 'reserved').length;
  const emptyCount = mappedTables.filter(t => t.trang_thai === 'empty').length;

  // Check if table has alert
  const getTableAlert = (tableId: number) => {
    return aiAlerts.find(alert => alert.table_id === tableId);
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
  };


  const handleBooking = async (bookingData: any) => {
    if (!selectedTable) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          ban_id: selectedTable.id,
          ten_khach_hang: bookingData.ten_khach_hang,
          sdt_khach_hang: bookingData.sdt_khach_hang,
          ngay_dat: bookingData.ngay_dat,
          gio_dat: bookingData.gio_dat,
          so_khach: bookingData.so_khach,
          ghi_chu: bookingData.ghi_chu || null
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Đặt bàn thất bại');
      }
      
      const result = await response.json();
      alert(`✓ Đặt bàn thành công!\nBàn: ${selectedTable.ten_ban}\nKhách: ${bookingData.ten_khach_hang}\nNgày: ${bookingData.ngay_dat} ${bookingData.gio_dat}`);
      
      setSelectedTable(null);
      await fetchData(); // Refresh to show updated table status
    } catch (error: any) {
      console.error('Booking error:', error);
      alert(error.message || 'Lỗi khi đặt bàn');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartService = async (serviceData: ServiceFormData) => {
    if (!selectedTable) return;
    setIsSubmitting(true);
    try {
      // Prepare items for API với đúng format: { id, gia, so_luong, ten_mon }
      const items = serviceData.selectedItems.map(item => ({
        id: item.id,           // mon_id
        gia: item.gia,         // đơn giá
        so_luong: item.quantity, // số lượng
        ten_mon: item.ten_mon  // tên món (optional)
      }));

      // Call the new check-in API
      const response = await fetch(`${API_BASE}/tables/${selectedTable.id}/check-in`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          so_khach: serviceData.so_khach,
          items: items,
          ghi_chu: serviceData.ghi_chu || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Mở bàn thất bại');
      }

      const result = await response.json();
      
      // Calculate total for display
      const totalAmount = serviceData.selectedItems.reduce(
        (sum, item) => sum + (item.gia * item.quantity), 0
      );

      alert(`✓ Mở bàn thành công!\n` +
            `Bàn: ${selectedTable.ten_ban}\n` +
            `Số khách: ${serviceData.so_khach}\n` +
            `Số món: ${serviceData.selectedItems.length}\n` +
            `Tổng tạm tính: ${totalAmount.toLocaleString('vi-VN')} ₫\n` +
            `Mã hóa đơn: ${result.data?.orderCode || 'N/A'}`);

      setSelectedTable(null);
      await fetchData(); // Refresh to show updated table status
    } catch (error: any) {
      console.error('Check-in error:', error);
      alert(error.message || 'Lỗi khi mở bàn');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (tableId: number) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa bàn này?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/tables/${tableId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete table');
      }
      await fetchData(); // Refresh table list
    } catch (error: any) {
      console.error('Delete table error:', error);
      alert(error.message || 'Lỗi khi xóa bàn');
    }
  };

  const handleAddTable = async () => {
    if (!selectedZoneId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/tables`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          khu_vuc_id: selectedZoneId,
          so_cho_ngoi: newTableSeats
        })
      });
      
      if (!response.ok) throw new Error('Failed to create table');
      
      const result = await response.json();
      alert(`Đã thêm bàn ${result.ten_ban} thành công!`);
      
      // Reset form and close modal
      setNewTableSeats(4);
      setShowAddTableModal(false);
      setSelectedZoneId(null);
      
      await fetchData(); // Refresh table list
    } catch (error) {
      console.error('Add table error:', error);
      alert('Lỗi khi thêm bàn');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddTableModal = (zoneId: number) => {
    setSelectedZoneId(zoneId);
    setNewTableSeats(4);
    setShowAddTableModal(true);
  };

  const handlePayment = async (paymentData: any) => {
    console.log('[HANDLE PAYMENT] Function called with:', paymentData);
    console.log('[HANDLE PAYMENT] selectedTable:', selectedTable);
    
    if (!selectedTable || !selectedTable.hoa_don_hien_tai) {
      console.error('[HANDLE PAYMENT] Missing invoice ID!');
      alert('Không tìm thấy hóa đơn cần thanh toán');
      return;
    }
    
    console.log('[HANDLE PAYMENT] Invoking API with invoice ID:', selectedTable.hoa_don_hien_tai);
    setIsSubmitting(true);
    
    try {
      const url = `${API_BASE}/invoices/${selectedTable.hoa_don_hien_tai}/pay`;
      console.log('[HANDLE PAYMENT] Calling:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phuong_thuc: paymentData.phuong_thuc_thanh_toan
        })
      });
      
      console.log('[HANDLE PAYMENT] Response status:', response.status);
      const result = await response.json();
      console.log('[HANDLE PAYMENT] Response data:', result);
      
      if (!response.ok) {
        throw new Error(result.detail || 'Payment failed');
      }
      
      // Success
      console.log('[HANDLE PAYMENT] ✓ Payment successful!');
      alert(result.message || 'Thanh toán thành công');
      setSelectedTable(null);
      onRefresh();
    } catch (error: any) {
      console.error('[HANDLE PAYMENT] ✗ Error:', error);
      alert(error.message || 'Lỗi khi thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, table: Table) => {
    setDraggedTable(table);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetTable: Table) => {
    e.preventDefault();
    if (!draggedTable || draggedTable.id === targetTable.id) {
      setDraggedTable(null);
      return;
    }

    try {
      await fetch(`${API_BASE}/tables/${draggedTable.id}/position`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          vi_tri_x: (targetTable as any).vi_tri_x || 0,
          vi_tri_y: (targetTable as any).vi_tri_y || 0
        })
      });
      onRefresh();
    } catch (error) {
      console.error('Error updating table position:', error);
    }
    setDraggedTable(null);
  };

  // Get table style based on status and alerts
  const getTableStyle = (table: Table) => {
    const alert = getTableAlert(table.id);
    const mappedStatus = mapTableStatus(table.trang_thai);
    
    if (alert) {
      return {
        bg: alert.severity === 'error' ? 'bg-red-100' : 'bg-yellow-100',
        border: alert.severity === 'error' ? 'border-red-500' : 'border-yellow-500',
        text: 'text-gray-900',
        animation: 'animate-pulse'
      };
    }

    switch (mappedStatus) {
      case 'empty':
        return { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-700', animation: '' };
      case 'occupied':
        return { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900', animation: '' };
      case 'reserved':
        return { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-900', animation: '' };
      default:
        return { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-700', animation: '' };
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Status Bar - Sticky */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        <StatusBar
          totalGuests={totalGuests}
          occupiedCount={occupiedCount}
          reservedCount={reservedCount}
          emptyCount={emptyCount}
        />
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500">Đang tải dữ liệu bàn ăn...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
        {/* Main Canvas - Zone-based Layout */}
        <div className="flex-1 overflow-auto">
          <div className="space-y-8 pb-6 px-6">
            {zones.map((zone) => {
              const zoneTables = mappedTables
                .filter(t => t.khu_vuc_id === zone.id)
                .sort((a: any, b: any) => (a.table_number || a.so_ban || 0) - (b.table_number || b.so_ban || 0));

              console.log(`[FloorPOS] Zone "${zone.ten_khu_vuc}" (ID: ${zone.id}) has ${zoneTables.length} tables`);

              const occupiedCount = zoneTables.filter(t => t.trang_thai === 'occupied').length;

              return (
                <div key={zone.id}>
                  {/* Zone Header - New Style */}
                  <div className="border-b-2 border-gray-300 pb-2 mb-4">
                    <h2 className="text-lg font-bold text-gray-900 uppercase">
                      {zone.ten_khu_vuc} <span className="text-sm font-normal text-gray-600">- {occupiedCount}/{zoneTables.length} bàn đang phục vụ</span>
                    </h2>
                  </div>

                  {/* Table Grid - Improved */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                    {zoneTables.map((table) => {
                      const style = getTableStyle(table);
                      const alert = getTableAlert(table.id);
                      
                      return (
                        <div
                          key={table.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, table)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, table)}
                          className="group relative"
                        >
                          <button
                            onClick={() => handleTableClick(table)}
                            className={`w-full aspect-square rounded-lg border-2 ${style.bg} ${style.border} ${style.text} ${style.animation} flex flex-col items-center justify-center transition-all hover:shadow-md relative
                              ${alert && alert.severity === 'error' ? 'ring-2 ring-red-500 border-red-500' : ''}`}
                          >
                            {/* Delete Button - Top Right */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTable(table.id);
                              }}
                              className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Xóa bàn"
                            >
                              <Trash2 size={16} />
                            </button>

                            {/* Guest Badge - Top Left */}
                            {table.so_khach_hien_tai > 0 && (
                              <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {table.so_khach_hien_tai}
                              </div>
                            )}
                            
                            {/* Table Name - Bold, Centered */}
                            <span className="font-bold text-sm text-center">{table.ten_ban}</span>
                            
                            {/* Seat Count */}
                            <span className="text-xs text-gray-600 mt-1">{table.so_cho_ngoi} chỗ</span>
                          </button>

                          {/* Hover Tooltip */}
                          <div className="absolute hidden group-hover:block z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none">
                            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                              <div className="font-bold">Bàn {table.ten_ban}</div>
                              <div>{table.so_khach_hien_tai || 0} Khách • {table.so_cho_ngoi} chỗ</div>
                              {table.thoi_gian_bat_dau && (
                                <div className="text-yellow-300">⏱ {Math.floor((Date.now() - new Date(table.thoi_gian_bat_dau).getTime()) / 60000)} phút</div>
                              )}
                              {alert && (
                                <div className="text-red-400 mt-1">⚠ {alert.message}</div>
                              )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Quick Add Button */}
                    <button
                      onClick={() => openAddTableModal(zone.id)}
                      className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center justify-center transition-all text-gray-400 hover:text-blue-600 relative"
                      title="Thêm bàn mới"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-xs mt-1 font-medium">Thêm</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Alerts & Stats */}
        <div className="w-80 flex flex-col gap-4 overflow-auto">
          <AlertsPanel alerts={aiAlerts.map(a => ({ id: a.id, table: a.table_name, message: a.message }))} />
          <StatsPanel
            totalTables={mappedTables.length}
            occupiedCount={occupiedCount}
            emptyCount={emptyCount}
            reservedCount={reservedCount}
          />
        </div>
        </div>
      )}

      {/* Table Action Modal */}
      {selectedTable && (
        <TableModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onBooking={handleBooking}
          onStartService={handleStartService}
          onPayment={handlePayment}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Add Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Thêm Bàn Mới</h3>
              <button
                onClick={() => setShowAddTableModal(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1 transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Auto-generated name info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Tên bàn</strong> sẽ được tự động sinh theo khu vực (VD: VIP-05, SC-12)
                </p>
              </div>

              {/* Seat Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số ghế <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newTableSeats}
                  onChange={(e) => setNewTableSeats(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddTableModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTable}
                disabled={isSubmitting || !selectedZoneId}
                style={{ backgroundColor: isSubmitting || !selectedZoneId ? '#CCCCCC' : '#1c2a46', color: '#FFFFFF' }}
                className="flex-1 px-4 py-2 rounded-lg transition-opacity font-semibold disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting ? 'Đang thêm...' : 'Thêm bàn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// SUB-MODULE 3: CONFIGURATION - Thiết lập
// ==========================================

const FloorConfiguration = () => {
  const [configView, setConfigView] = useState<'zones' | 'tables' | 'menu'>('zones');
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Modal states
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);

  useEffect(() => {
    if (configView === 'zones') fetchZones();
    if (configView === 'tables') fetchTables();
    if (configView === 'menu') {
      fetchMenuCategories();
      fetchMenuItems();
    }
  }, [configView]);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/zones`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tables`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      setTables(data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/menu-categories`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      setMenuCategories(data);
    } catch (error) {
      console.error('Error fetching menu categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const url = selectedCategory 
        ? `${API_BASE}/menu-items?categoryId=${selectedCategory}`
        : `${API_BASE}/menu-items`;
      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      setMenuItems(data);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredTables = tables.filter(table => {
    const matchesSearch = table.ten_ban.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = selectedZone ? table.khu_vuc_id === selectedZone : true;
    return matchesSearch && matchesZone;
  });

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.ten_mon.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? item.loai_thuc_don_id === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Thiết lập hệ thống</h2>
          
          {/* Sub-navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setConfigView('zones')}
              className={`px-4 py-2 rounded-lg ${
                configView === 'zones' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Khu vực
            </button>
            <button
              onClick={() => setConfigView('tables')}
              className={`px-4 py-2 rounded-lg ${
                configView === 'tables' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bàn ăn
            </button>
            <button
              onClick={() => setConfigView('menu')}
              className={`px-4 py-2 rounded-lg ${
                configView === 'menu' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Thực đơn
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-auto">
        {/* ZONES VIEW */}
        {configView === 'zones' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Danh sách khu vực</h3>
                <button 
                  onClick={() => setIsZoneModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium"
                >
                  <Plus size={18} />
                  Thêm khu vực
                </button>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  {zones.map(zone => (
                    <div key={zone.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{zone.ten_khu_vuc}</h4>
                        <div className="flex gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        {zone.table_count} bàn
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TABLES VIEW */}
        {configView === 'tables' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Danh sách bàn ăn</h3>
                <button 
                  onClick={() => setIsTableModalOpen(true)}
                  style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Thêm bàn
                </button>
              </div>
              
              {/* Search & Filter */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bàn..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
                    showFilter ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Lọc
                </button>
              </div>

              {showFilter && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium mb-2">Khu vực</label>
                  <select
                    value={selectedZone || ''}
                    onChange={(e) => setSelectedZone(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Tất cả khu vực</option>
                    {zones.map(zone => (
                      <option key={zone.id} value={zone.id}>{zone.ten_khu_vuc}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Tên bàn</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Khu vực</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Sức chứa</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Trạng thái</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTables.map(table => (
                      <tr key={table.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{table.ten_ban}</td>
                        <td className="px-4 py-3">{table.ten_khu_vuc}</td>
                        <td className="px-4 py-3">{table.so_cho_ngoi} chỗ</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            table.trang_thai === 'empty' ? 'bg-gray-100 text-gray-700' :
                            table.trang_thai === 'occupied' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {table.trang_thai}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="p-1 hover:bg-gray-100 rounded mr-2">
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MENU VIEW */}
        {configView === 'menu' && (
          <div className="space-y-6">
            {/* Categories Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Danh mục thực đơn</h3>
                <button 
                  onClick={() => setIsCategoryModalOpen(true)}
                  style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Thêm danh mục
                </button>
              </div>
              <div className="p-4">
                <div className="flex gap-3 flex-wrap">
                  {menuCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                      className={`px-4 py-2 rounded-lg border-2 ${
                        selectedCategory === cat.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {cat.ten_loai}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Menu Items Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Món ăn</h3>
                  <button 
                    onClick={() => setIsMenuItemModalOpen(true)}
                    style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm món
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm món ăn..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                </div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4">
                    {filteredMenuItems.map(item => (
                      <div key={item.id} className="border rounded-lg overflow-hidden hover:shadow-md transition">
                        <div className="h-32 bg-gray-200 flex items-center justify-center">
                          {item.hinh_anh ? (
                            <img src={item.hinh_anh} alt={item.ten_mon} className="w-full h-full object-cover" />
                          ) : (
                            <Utensils className="w-12 h-12 text-gray-400" />
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-semibold mb-1">{item.ten_mon}</h4>
                          <p className="text-xs text-gray-500 mb-2">{item.ten_loai_thuc_don}</p>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.mo_ta}</p>
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-green-600">
                              {item.gia.toLocaleString('vi-VN')} ₫
                            </span>
                            <div className="flex gap-1">
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <Edit2 className="w-3 h-3 text-blue-600" />
                              </button>
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// SUB COMPONENT: FLOOR SETTINGS
// ==========================================

const FloorSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'zones' | 'menu' | 'bank'>('zones');
  
  // Zones State
  const [zones, setZones] = useState<any[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [draggedZoneIndex, setDraggedZoneIndex] = useState<number | null>(null);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    key_prefix: '',
    description: '',
    floor_number: 1
  });

  // Menu State
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);

  // Bank State (placeholder)
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);

  // Fetch data when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'zones':
        fetchZones();
        break;
      case 'menu':
        fetchMenuData();
        break;
      case 'bank':
        fetchBankAccounts();
        break;
    }
  }, [activeTab]);

  // ==========================================
  // ZONES FUNCTIONS
  // ==========================================
  const fetchZones = async () => {
    setZonesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/zones`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      setZones(data.sort((a: any, b: any) => a.display_order - b.display_order));
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setZonesLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim() || !zoneForm.key_prefix.trim()) {
      alert('Vui lòng điền đầy đủ tên và mã tiền tố');
      return;
    }

    try {
      const method = editingZone ? 'PUT' : 'POST';
      const url = editingZone 
        ? `${API_BASE}/zones/${editingZone.id}` 
        : `${API_BASE}/zones`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneForm)
      });

      const result = await response.json();
      
      if (response.ok) {
        setShowZoneModal(false);
        setEditingZone(null);
        setZoneForm({ name: '', key_prefix: '', description: '', floor_number: 1 });
        fetchZones();
      } else {
        alert(result.detail || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error saving zone:', error);
      alert('Không thể kết nối đến server');
    }
  };

  const handleEditZone = (zone: any) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      key_prefix: zone.key_prefix,
      description: zone.description || '',
      floor_number: zone.floor_number
    });
    setShowZoneModal(true);
  };

  const handleDeleteZone = async (zone: any) => {
    if (!confirm(`Bạn có chắc muốn xóa khu vực "${zone.name}"?`)) return;
    
    try {
      const response = await fetch(`${API_BASE}/zones/${zone.id}`, { 
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        fetchZones();
      } else {
        alert(result.detail || 'Không thể xóa khu vực');
      }
    } catch (error) {
      console.error('Error deleting zone:', error);
      alert('Không thể kết nối đến server');
    }
  };

  // Drag & Drop Functions
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedZoneIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedZoneIndex === null || draggedZoneIndex === dropIndex) {
      setDraggedZoneIndex(null);
      return;
    }

    // Reorder zones array
    const newZones = [...zones];
    const [draggedZone] = newZones.splice(draggedZoneIndex, 1);
    newZones.splice(dropIndex, 0, draggedZone);

    // Update display_order
    const reorderedZones = newZones.map((zone, index) => ({
      id: zone.id,
      display_order: index
    }));

    setZones(newZones);
    setDraggedZoneIndex(null);

    // Call API to save new order
    try {
      await fetch(`${API_BASE}/zones/reorder`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ zones: reorderedZones })
      });
    } catch (error) {
      console.error('Error reordering zones:', error);
      fetchZones(); // Revert on error
    }
  };

  // ==========================================
  // MENU FUNCTIONS
  // ==========================================
  const fetchMenuData = async () => {
    setMenuLoading(true);
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        fetch(`${API_BASE}/menu-categories`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }),
        fetch(`${API_BASE}/menu-items`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        })
      ]);
      
      const categoriesData = await categoriesRes.json();
      const itemsData = await itemsRes.json();
      
      setMenuCategories(categoriesData);
      setMenuItems(itemsData);
    } catch (error) {
      console.error('Error fetching menu data:', error);
    } finally {
      setMenuLoading(false);
    }
  };

  const filteredMenuItems = selectedCategory
    ? menuItems.filter(item => item.category_id === selectedCategory)
    : menuItems;

  // ==========================================
  // BANK FUNCTIONS
  // ==========================================
  const fetchBankAccounts = async () => {
    setBankLoading(true);
    try {
      // Placeholder - API chưa có
      await new Promise(resolve => setTimeout(resolve, 500));
      setBankAccounts([
        { id: 1, bank_name: 'Vietcombank', account_number: '0123456789', account_holder: 'NGUYEN VAN A' },
        { id: 2, bank_name: 'Techcombank', account_number: '9876543210', account_holder: 'TRAN THI B' }
      ]);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setBankLoading(false);
    }
  };

  return (
    <div className="h-full bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-blue-600" />
          Thiết lập hệ thống
        </h1>
        <p className="text-gray-600 mt-1">Quản lý cấu hình khu vực, thực đơn và tài khoản ngân hàng</p>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('zones')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'zones'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Khu vực
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'menu'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Utensils className="w-4 h-4" />
            Thực đơn
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'bank'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Tài khoản ngân hàng
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* TAB 1: ZONES */}
        {activeTab === 'zones' && (
          <div>
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quản lý Khu vực</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Kéo thả để sắp xếp thứ tự hiển thị • {zones.length} khu vực
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingZone(null);
                  setZoneForm({ name: '', key_prefix: '', description: '', floor_number: 1 });
                  setShowZoneModal(true);
                }}
                style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Thêm khu vực
              </button>
            </div>

            {/* Zones Grid with Drag & Drop */}
            {zonesLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-16">
                <MapPin className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Chưa có khu vực nào</h3>
                <p className="text-gray-500 mb-4">Nhấn "Thêm khu vực" để bắt đầu</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map((zone, index) => (
                  <div
                    key={zone.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`bg-white border-2 rounded-lg p-4 cursor-move hover:shadow-lg transition-all ${
                      draggedZoneIndex === index 
                        ? 'border-blue-500 opacity-50' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                          <span className="text-xs text-gray-500">#{zone.id}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditZone(zone);
                          }}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone);
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Zone Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Mã:</span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          {zone.key_prefix}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tầng:</span>
                        <span className="text-sm font-medium text-gray-900">Tầng {zone.floor_number}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Số bàn:</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                          {zone.table_count} bàn
                        </span>
                      </div>
                      {zone.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{zone.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MENU */}
        {activeTab === 'menu' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quản lý Thực đơn</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {menuItems.length} món ăn • {menuCategories.length} danh mục
                </p>
              </div>
            </div>

            {menuLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div>
                {/* Category Filter */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === null
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Tất cả ({menuItems.length})
                  </button>
                  {menuCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.name} ({menuItems.filter(i => i.category_id === cat.id).length})
                    </button>
                  ))}
                </div>

                {/* Menu Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredMenuItems.map(item => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {/* Image */}
                      <div className="aspect-video bg-gray-100 relative">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Utensils className="w-12 h-12 text-gray-300" />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="p-3">
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{item.name}</h3>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description || 'Chưa có mô tả'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-green-600">
                            {item.price?.toLocaleString('vi-VN')} ₫
                          </span>
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                            {item.category_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredMenuItems.length === 0 && (
                  <div className="text-center py-16">
                    <Utensils className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Không có món ăn nào</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BANK */}
        {activeTab === 'bank' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tài khoản Ngân hàng</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Quản lý thông tin tài khoản nhận thanh toán
                </p>
              </div>
              <button 
                style={{ backgroundColor: '#1c2a46', color: '#FFFFFF' }}
                className="px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Thêm tài khoản
              </button>
            </div>

            {bankLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map(account => (
                  <div key={account.id} className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <CreditCard className="w-10 h-10" />
                      <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm opacity-80">{account.bank_name}</p>
                      <p className="text-2xl font-bold tracking-wider">{account.account_number}</p>
                      <p className="text-sm font-medium">{account.account_holder}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingZone ? 'Chỉnh sửa khu vực' : 'Thêm khu vực mới'}
              </h3>
              <button
                onClick={() => {
                  setShowZoneModal(false);
                  setEditingZone(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên khu vực <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  placeholder="Ví dụ: Sảnh chính, Khu VIP..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mã tiền tố <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={zoneForm.key_prefix}
                  onChange={(e) => setZoneForm({ ...zoneForm, key_prefix: e.target.value.toUpperCase() })}
                  placeholder="VD: SC, VIP, TER..."
                  maxLength={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase text-gray-900 placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">Mã dùng để đặt tên bàn (VD: SC-01, VIP-02)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tầng
                </label>
                <input
                  type="number"
                  value={zoneForm.floor_number}
                  onChange={(e) => setZoneForm({ ...zoneForm, floor_number: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="10"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={zoneForm.description}
                  onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                  placeholder="Mô tả chi tiết về khu vực..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setShowZoneModal(false);
                  setEditingZone(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveZone}
                disabled={!zoneForm.name || !zoneForm.key_prefix}
                style={{ backgroundColor: !zoneForm.name || !zoneForm.key_prefix ? '#CCCCCC' : '#1c2a46', color: '#FFFFFF' }}
                className="flex-1 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium cursor-pointer"
              >
                {editingZone ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT - Container với Tab Navigation
// ==========================================

export function FloorOperations({ activeSubModule = 'dashboard' }: FloorOperationsProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesRes, tablesRes] = await Promise.all([
        fetch(`${API_BASE}/zones`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        }),
        fetch(`${API_BASE}/tables`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        })
      ]);
      
      const zonesData = await zonesRes.json();
      const tablesData = await tablesRes.json();
      
      setZones(zonesData);
      setTables(tablesData);
    } catch (error) {
      console.error('Error fetching floor data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // Render component dựa trên activeSubModule từ Layout
  switch (activeSubModule) {
    case 'dashboard':
      return <FloorDashboard zones={zones} tables={tables} />;
    case 'pos':
      return <FloorPOS tables={tables} onRefresh={fetchData} />;
    case 'configuration':
      return <FloorSettings />;
    default:
      return <FloorDashboard zones={zones} tables={tables} />;
  }
}
