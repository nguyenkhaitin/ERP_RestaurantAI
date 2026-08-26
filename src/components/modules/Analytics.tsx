/**
 * =============================================
 * MAIN SYSTEM DASHBOARD - Bảng Điều Khiển Trung Tâm
 * Tổng hợp dữ liệu từ POS + HR
 * SỬ DỤNG MOCK DATA HOÀN TOÀN - KHÔNG KẾT NỐI DATABASE
 * =============================================
 */

import React, { useState, useMemo } from 'react';
import {
  DollarSign, ShoppingCart, Users, Bell, TrendingUp, TrendingDown,
  Clock, AlertTriangle, Utensils, ChefHat, MapPin, Activity,
  Package, Wallet, UserCheck, UserX, Calendar, BarChart3,
  CircleDollarSign, Receipt, AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

// =============================================
// MOCK DATA - Dữ liệu giả lập hoàn toàn
// =============================================

// Doanh thu theo giờ (giờ trưa & tối cao hơn)
const HOURLY_REVENUE_DATA = [
  { hour: '09:00', revenue: 2500000, orders: 8 },
  { hour: '10:00', revenue: 3800000, orders: 12 },
  { hour: '11:00', revenue: 8500000, orders: 28 },
  { hour: '12:00', revenue: 18500000, orders: 62 },
  { hour: '13:00', revenue: 12200000, orders: 41 },
  { hour: '14:00', revenue: 4800000, orders: 16 },
  { hour: '15:00', revenue: 2200000, orders: 7 },
  { hour: '16:00', revenue: 3100000, orders: 10 },
  { hour: '17:00', revenue: 6800000, orders: 23 },
  { hour: '18:00', revenue: 15200000, orders: 51 },
  { hour: '19:00', revenue: 22500000, orders: 75 },
  { hour: '20:00', revenue: 19800000, orders: 66 },
  { hour: '21:00', revenue: 11500000, orders: 38 },
  { hour: '22:00', revenue: 4200000, orders: 14 },
];

// Doanh thu 7 ngày gần nhất
const WEEKLY_REVENUE_DATA = [
  { day: 'T2', revenue: 85200000, target: 80000000, orders: 312 },
  { day: 'T3', revenue: 72500000, target: 75000000, orders: 268 },
  { day: 'T4', revenue: 88600000, target: 82000000, orders: 328 },
  { day: 'T5', revenue: 95800000, target: 90000000, orders: 356 },
  { day: 'T6', revenue: 125400000, target: 110000000, orders: 465 },
  { day: 'T7', revenue: 168500000, target: 150000000, orders: 624 },
  { day: 'CN', revenue: 145200000, target: 140000000, orders: 538 },
];

// Top món bán chạy hôm nay
const TOP_SELLING_ITEMS = [
  { name: 'Lẩu Thái Hải Sản', quantity: 48, revenue: 9600000, trend: 'up' as const },
  { name: 'Bò Wagyu Nướng', quantity: 35, revenue: 12250000, trend: 'up' as const },
  { name: 'Set Sashimi Premium', quantity: 28, revenue: 8400000, trend: 'down' as const },
  { name: 'Phở Bò Tái Lăn', quantity: 62, revenue: 4960000, trend: 'up' as const },
  { name: 'Cơm Chiên Dương Châu', quantity: 45, revenue: 2700000, trend: 'stable' as const },
];

// Doanh thu theo danh mục
const CATEGORY_REVENUE = [
  { name: 'Món chính', value: 45200000, color: '#3B82F6' },
  { name: 'Đồ uống', value: 18500000, color: '#10B981' },
  { name: 'Tráng miệng', value: 8200000, color: '#F59E0B' },
  { name: 'Khai vị', value: 12800000, color: '#8B5CF6' },
  { name: 'Khác', value: 3500000, color: '#6B7280' },
];

// Dữ liệu nhân sự
const HR_DATA = {
  totalStaff: 45,
  workingNow: 32,
  onLeave: 8,
  late: 2,
  absent: 3,
  
  // Chi tiết theo ca
  shifts: {
    morning: { total: 18, present: 16, late: 1, absent: 1 },
    afternoon: { total: 15, present: 14, late: 1, absent: 0 },
    evening: { total: 12, present: 12, late: 0, absent: 0 },
  },
  
  // Theo chi nhánh
  branches: [
    { name: 'Quận 1', total: 16, working: 12 },
    { name: 'Quận 3', total: 15, working: 10 },
    { name: 'Thủ Đức', total: 14, working: 10 },
  ],
  
  // Chấm công 7 ngày
  weeklyAttendance: [
    { day: 'T2', onTime: 38, late: 4, absent: 3 },
    { day: 'T3', onTime: 40, late: 3, absent: 2 },
    { day: 'T4', onTime: 39, late: 4, absent: 2 },
    { day: 'T5', onTime: 41, late: 2, absent: 2 },
    { day: 'T6', onTime: 42, late: 2, absent: 1 },
    { day: 'T7', onTime: 43, late: 1, absent: 1 },
    { day: 'CN', onTime: 40, late: 3, absent: 2 },
  ],
};

// Cảnh báo hệ thống
const SYSTEM_ALERTS = [
  { id: 1, type: 'inventory' as const, message: 'Thịt bò Wagyu sắp hết (còn 2kg)', severity: 'high' as const, time: '5 phút trước' },
  { id: 2, type: 'hr' as const, message: 'Nguyễn Văn A đi trễ 15 phút', severity: 'medium' as const, time: '10 phút trước' },
  { id: 3, type: 'hr' as const, message: 'Trần Thị B chưa check-in', severity: 'medium' as const, time: '30 phút trước' },
  { id: 4, type: 'inventory' as const, message: 'Bia Tiger sắp hết (còn 12 lon)', severity: 'low' as const, time: '1 giờ trước' },
  { id: 5, type: 'pos' as const, message: 'Bàn 12 chờ thanh toán quá 10 phút', severity: 'medium' as const, time: '2 phút trước' },
];

// KPI so với hôm qua
const KPI_COMPARISON = {
  revenue: { today: 135800000, yesterday: 125400000 },
  orders: { today: 451, yesterday: 412 },
  avgOrderValue: { today: 301000, yesterday: 304000 },
};

// =============================================
// HELPER FUNCTIONS
// =============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}tỷ`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}tr`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toLocaleString('vi-VN');
};

const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
};

// =============================================
// SUB-COMPONENTS
// =============================================

interface QuickStatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: number;
  icon: React.ReactNode;
  iconBgColor: string;
}

const QuickStatCard: React.FC<QuickStatCardProps> = ({
  title, value, subValue, change, icon, iconBgColor
}) => {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${iconBgColor}`}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full ${
            isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {subValue && (
          <p className="text-slate-400 text-xs mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
};

// Custom Tooltip cho biểu đồ
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-sm">
        <p className="font-bold text-slate-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-xs">
            {entry.name}: {typeof entry.value === 'number' && entry.value > 10000 
              ? formatCurrency(entry.value) + 'đ' 
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// =============================================
// MAIN COMPONENT
// =============================================
export function Analytics() {
  const [currentTime] = useState(new Date());

  // Calculate KPIs
  const revenueChange = calculatePercentChange(
    KPI_COMPARISON.revenue.today, 
    KPI_COMPARISON.revenue.yesterday
  );
  const ordersChange = calculatePercentChange(
    KPI_COMPARISON.orders.today,
    KPI_COMPARISON.orders.yesterday
  );

  // Tổng cảnh báo theo loại
  const alertCounts = useMemo(() => {
    return {
      total: SYSTEM_ALERTS.length,
      high: SYSTEM_ALERTS.filter(a => a.severity === 'high').length,
      medium: SYSTEM_ALERTS.filter(a => a.severity === 'medium').length,
      low: SYSTEM_ALERTS.filter(a => a.severity === 'low').length,
    };
  }, []);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-full">
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            Main System Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng quan hệ thống • Cập nhật lúc {currentTime.toLocaleTimeString('vi-VN')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">
              {currentTime.toLocaleDateString('vi-VN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== KHU VỰC 1: QUICK STATS ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <QuickStatCard
          title="Doanh thu hôm nay"
          value={`${formatCurrency(KPI_COMPARISON.revenue.today)}đ`}
          subValue={`Hôm qua: ${formatCurrency(KPI_COMPARISON.revenue.yesterday)}đ`}
          change={revenueChange}
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          iconBgColor="bg-emerald-50"
        />
        <QuickStatCard
          title="Đơn hàng hôm nay"
          value={KPI_COMPARISON.orders.today}
          subValue={`Trung bình: ${formatCurrency(KPI_COMPARISON.avgOrderValue.today)}đ/đơn`}
          change={ordersChange}
          icon={<ShoppingCart className="w-6 h-6 text-blue-600" />}
          iconBgColor="bg-blue-50"
        />
        <QuickStatCard
          title="Nhân sự đang làm việc"
          value={`${HR_DATA.workingNow}/${HR_DATA.totalStaff}`}
          subValue={`${HR_DATA.late} trễ • ${HR_DATA.absent} vắng • ${HR_DATA.onLeave} nghỉ phép`}
          icon={<Users className="w-6 h-6 text-purple-600" />}
          iconBgColor="bg-purple-50"
        />
        <QuickStatCard
          title="Cảnh báo hệ thống"
          value={alertCounts.total}
          subValue={`${alertCounts.high} nghiêm trọng • ${alertCounts.medium} trung bình`}
          icon={<Bell className="w-6 h-6 text-orange-600" />}
          iconBgColor="bg-orange-50"
        />
      </div>

      {/* ==================== KHU VỰC 2 + 3: MAIN GRID ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ========== CỘT TRÁI: POS ANALYTICS (2/3) ========== */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Biểu đồ Doanh thu theo giờ */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Doanh thu theo giờ hôm nay
                </h3>
                <p className="text-slate-500 text-sm">Phân tích xu hướng doanh số trong ngày</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(HOURLY_REVENUE_DATA.reduce((sum, d) => sum + d.revenue, 0))}đ
                </p>
                <p className="text-slate-500 text-xs">Tổng doanh thu</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={HOURLY_REVENUE_DATA}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="hour" stroke="#64748B" fontSize={11} />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={11}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Doanh thu"
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Biểu đồ Doanh thu tuần + Bảng Top món */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Weekly Revenue vs Target */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Doanh thu 7 ngày
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={WEEKLY_REVENUE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                  <YAxis 
                    stroke="#64748B" 
                    fontSize={10}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="revenue" name="Thực tế" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Mục tiêu" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Selling Items */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-indigo-600" />
                Top 5 món bán chạy
              </h3>
              <div className="space-y-3">
                {TOP_SELLING_ITEMS.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                        <p className="text-slate-500 text-xs">{item.quantity} phần</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 text-sm">{formatCurrency(item.revenue)}đ</p>
                      {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500 inline ml-1" />}
                      {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500 inline ml-1" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Doanh thu theo danh mục (Pie Chart) */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600" />
              Doanh thu theo danh mục
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={CATEGORY_REVENUE}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {CATEGORY_REVENUE.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `${formatCurrency(value)}đ`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col justify-center space-y-2">
                {CATEGORY_REVENUE.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-semibold text-sm text-slate-900">
                      {formatCurrency(item.value)}đ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========== CỘT PHẢI: HR + ALERTS (1/3) ========== */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* HR Overview Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Nhân sự hôm nay
            </h3>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <UserCheck className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-700">{HR_DATA.workingNow}</p>
                <p className="text-xs text-green-600">Đang làm việc</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <Clock className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{HR_DATA.late}</p>
                <p className="text-xs text-amber-600">Đi trễ</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <UserX className="w-6 h-6 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">{HR_DATA.absent}</p>
                <p className="text-xs text-red-600">Vắng mặt</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{HR_DATA.onLeave}</p>
                <p className="text-xs text-blue-600">Nghỉ phép</p>
              </div>
            </div>

            {/* Attendance by shift */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600 mb-2">Theo ca làm việc</p>
              {Object.entries(HR_DATA.shifts).map(([shift, data]) => (
                <div key={shift} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700 capitalize">
                    {shift === 'morning' ? '🌅 Ca sáng' : shift === 'afternoon' ? '☀️ Ca chiều' : '🌙 Ca tối'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-600">{data.present}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-sm text-slate-600">{data.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Attendance Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Chấm công 7 ngày
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={HR_DATA.weeklyAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="onTime" name="Đúng giờ" stackId="a" fill="#10B981" />
                <Bar dataKey="late" name="Trễ" stackId="a" fill="#F59E0B" />
                <Bar dataKey="absent" name="Vắng" stackId="a" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* System Alerts */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Cảnh báo hệ thống
              <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                {alertCounts.total}
              </span>
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {SYSTEM_ALERTS.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.severity === 'high' 
                      ? 'bg-red-50 border-red-500' 
                      : alert.severity === 'medium'
                      ? 'bg-amber-50 border-amber-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {alert.type === 'inventory' && <Package className="w-4 h-4 text-slate-600 mt-0.5" />}
                    {alert.type === 'hr' && <Users className="w-4 h-4 text-slate-600 mt-0.5" />}
                    {alert.type === 'pos' && <Receipt className="w-4 h-4 text-slate-600 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Branch Overview */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Nhân sự theo chi nhánh
            </h3>
            <div className="space-y-3">
              {HR_DATA.branches.map((branch, index) => {
                const percentage = Math.round((branch.working / branch.total) * 100);
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">{branch.name}</span>
                      <span className="font-semibold text-slate-900">{branch.working}/{branch.total}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Analytics;
