/**
 * =============================================
 * ANALYTICS DASHBOARD - Phân tích Nghiệp vụ
 * Full Mock Data cho Demo & Charts
 * =============================================
 */

import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, DollarSign, Users, Clock, Calendar, 
  MapPin, Filter, ChevronDown, Download, RefreshCw,
  Utensils, Star, Award, Target
} from 'lucide-react';

// =============================================
// MOCK DATA - Dữ liệu giả lập chi tiết
// =============================================

const REVENUE_HOURLY_DATA = [
  { time: '09:00', revenue: 800000, cost: 450000, orders: 8 },
  { time: '10:00', revenue: 1200000, cost: 680000, orders: 12 },
  { time: '11:00', revenue: 2800000, cost: 1500000, orders: 28 },
  { time: '12:00', revenue: 6500000, cost: 3200000, orders: 65 },
  { time: '13:00', revenue: 4200000, cost: 2100000, orders: 42 },
  { time: '14:00', revenue: 1800000, cost: 980000, orders: 18 },
  { time: '15:00', revenue: 900000, cost: 520000, orders: 9 },
  { time: '16:00', revenue: 1100000, cost: 620000, orders: 11 },
  { time: '17:00', revenue: 2400000, cost: 1350000, orders: 24 },
  { time: '18:00', revenue: 4800000, cost: 2500000, orders: 48 },
  { time: '19:00', revenue: 7200000, cost: 3800000, orders: 72 },
  { time: '20:00', revenue: 8500000, cost: 4200000, orders: 85 },
  { time: '21:00', revenue: 5600000, cost: 2900000, orders: 56 },
  { time: '22:00', revenue: 2200000, cost: 1200000, orders: 22 },
];

const REVENUE_WEEKLY_DATA = [
  { day: 'T2', revenue: 42500000, cost: 22000000, orders: 145 },
  { day: 'T3', revenue: 38200000, cost: 19500000, orders: 128 },
  { day: 'T4', revenue: 45800000, cost: 23200000, orders: 162 },
  { day: 'T5', revenue: 52100000, cost: 26800000, orders: 178 },
  { day: 'T6', revenue: 68500000, cost: 34200000, orders: 235 },
  { day: 'T7', revenue: 85200000, cost: 42500000, orders: 312 },
  { day: 'CN', revenue: 78600000, cost: 39200000, orders: 285 },
];

const OCCUPANCY_HEATMAP = [
  { hour: '09:00', rate: 15, tables: 1 },
  { hour: '10:00', rate: 25, tables: 2 },
  { hour: '11:00', rate: 50, tables: 4 },
  { hour: '12:00', rate: 95, tables: 8 },
  { hour: '13:00', rate: 75, tables: 6 },
  { hour: '14:00', rate: 35, tables: 3 },
  { hour: '15:00', rate: 20, tables: 2 },
  { hour: '16:00', rate: 25, tables: 2 },
  { hour: '17:00', rate: 45, tables: 4 },
  { hour: '18:00', rate: 85, tables: 7 },
  { hour: '19:00', rate: 100, tables: 8 },
  { hour: '20:00', rate: 100, tables: 8 },
  { hour: '21:00', rate: 70, tables: 6 },
  { hour: '22:00', rate: 35, tables: 3 },
];

const TOP_MENU_ITEMS = [
  { name: 'Lẩu Riêu Cua Bắp Bò', quantity: 156, revenue: 24960000 },
  { name: 'Bò Sốt Vang', quantity: 128, revenue: 16640000 },
  { name: 'Gà Ủ Muối Hoa Tiêu', quantity: 112, revenue: 11200000 },
  { name: 'Cá Chép Om Dưa', quantity: 98, revenue: 9800000 },
  { name: 'Lẩu Thái Hải Sản', quantity: 89, revenue: 15130000 },
  { name: 'Nem Rán Hà Nội', quantity: 234, revenue: 4680000 },
  { name: 'Phở Bò Tái Nạm', quantity: 145, revenue: 7250000 },
  { name: 'Bún Chả Hà Nội', quantity: 132, revenue: 6600000 },
];

const CUSTOMER_SEGMENTS = [
  { name: 'Khách Vãng Lai', value: 45, color: '#3B82F6' },
  { name: 'Thành Viên VIP', value: 28, color: '#10B981' },
  { name: 'Đặt Bàn Trước', value: 18, color: '#F59E0B' },
  { name: 'Đoàn/Sự Kiện', value: 9, color: '#8B5CF6' },
];

const PAYMENT_METHODS = [
  { name: 'Tiền Mặt', value: 35, color: '#22C55E' },
  { name: 'Thẻ Ngân Hàng', value: 40, color: '#3B82F6' },
  { name: 'Ví Điện Tử', value: 20, color: '#F97316' },
  { name: 'Chuyển Khoản', value: 5, color: '#8B5CF6' },
];

const BRANCHES = ['Hà Nội - Láng Hạ', 'TP.HCM - Quận 1', 'Đà Nẵng - Hải Châu'];
const TIME_RANGES = ['Hôm nay', 'Tuần này', 'Tháng này', 'Quý này'];

// =============================================
// HELPER FUNCTIONS
// =============================================

const formatVND = (value: number): string => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}tỷ`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}tr`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toLocaleString('vi-VN');
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
        <p className="font-bold text-slate-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatVND(entry.value)}đ
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

export function AnalyticsDashboard() {
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [selectedTimeRange, setSelectedTimeRange] = useState(TIME_RANGES[0]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  // Calculate totals from mock data
  const totalRevenue = REVENUE_HOURLY_DATA.reduce((sum, d) => sum + d.revenue, 0);
  const totalCost = REVENUE_HOURLY_DATA.reduce((sum, d) => sum + d.cost, 0);
  const totalOrders = REVENUE_HOURLY_DATA.reduce((sum, d) => sum + d.orders, 0);
  const profit = totalRevenue - totalCost;
  const avgOrderValue = totalRevenue / totalOrders;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-full">
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Phân tích dữ liệu kinh doanh theo thời gian thực
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowBranchDropdown(!showBranchDropdown);
                setShowTimeDropdown(false);
                console.log('[Analytics] Branch dropdown toggled');
              }}
              className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 shadow-sm transition-all"
            >
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">{selectedBranch}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {showBranchDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                {BRANCHES.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => {
                      setSelectedBranch(branch);
                      setShowBranchDropdown(false);
                      console.log('[Analytics] Selected branch:', branch);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 ${
                      selectedBranch === branch ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
                    }`}
                  >
                    {branch}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTimeDropdown(!showTimeDropdown);
                setShowBranchDropdown(false);
                console.log('[Analytics] Time dropdown toggled');
              }}
              className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 shadow-sm transition-all"
            >
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">{selectedTimeRange}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {showTimeDropdown && (
              <div className="absolute top-full left-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setSelectedTimeRange(range);
                      setShowTimeDropdown(false);
                      console.log('[Analytics] Selected time range:', range);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 ${
                      selectedTimeRange === range ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button 
            onClick={() => console.log('[Analytics] Refreshing data...')}
            className="p-2.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>

          {/* Export Button */}
          <button 
            onClick={() => console.log('[Analytics] Exporting report...')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Xuất Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* ==================== KPI SUMMARY CARDS ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-emerald-100 text-xs font-medium px-2 py-1 bg-white/10 rounded-full">
              +12.5% vs hôm qua
            </span>
          </div>
          <p className="text-emerald-100 text-sm mb-1">Doanh Thu</p>
          <p className="text-3xl font-bold">{formatVND(totalRevenue)}đ</p>
        </div>

        {/* Profit */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-blue-100 text-xs font-medium px-2 py-1 bg-white/10 rounded-full">
              Margin: {((profit / totalRevenue) * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-blue-100 text-sm mb-1">Lợi Nhuận</p>
          <p className="text-3xl font-bold">{formatVND(profit)}đ</p>
        </div>

        {/* Total Orders */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Utensils className="w-6 h-6" />
            </div>
            <span className="text-purple-100 text-xs font-medium px-2 py-1 bg-white/10 rounded-full">
              Avg: {formatVND(avgOrderValue)}đ
            </span>
          </div>
          <p className="text-purple-100 text-sm mb-1">Tổng Đơn Hàng</p>
          <p className="text-3xl font-bold">{totalOrders}</p>
        </div>

        {/* Customer Satisfaction */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Star className="w-6 h-6" />
            </div>
            <span className="text-amber-100 text-xs font-medium px-2 py-1 bg-white/10 rounded-full">
              285 đánh giá
            </span>
          </div>
          <p className="text-amber-100 text-sm mb-1">Hài Lòng KH</p>
          <p className="text-3xl font-bold">4.8 <span className="text-lg">/ 5</span></p>
        </div>
      </div>

      {/* ==================== CHARTS ROW 1 ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Cost Area Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Doanh Thu & Chi Phí</h3>
              <p className="text-slate-500 text-sm">Theo giờ trong ngày</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">Doanh thu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="text-slate-600">Chi phí</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={REVENUE_HOURLY_DATA}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tickFormatter={(v) => formatVND(v)} tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                name="Doanh thu"
                stroke="#10B981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
              <Area 
                type="monotone" 
                dataKey="cost" 
                name="Chi phí"
                stroke="#EF4444" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCost)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy Heatmap/Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Tỷ Lệ Lấp Đầy</h3>
              <p className="text-slate-500 text-sm">Peak hours trong ngày</p>
            </div>
            <div className="text-xs text-slate-500 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              🔥 Peak: 19:00 - 20:00
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={OCCUPANCY_HEATMAP}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <Tooltip 
                formatter={(value: any) => [`${value}%`, 'Tỷ lệ']}
                labelFormatter={(label) => `Giờ: ${label}`}
              />
              <Bar 
                dataKey="rate" 
                name="Tỷ lệ lấp đầy"
                fill="#6366F1"
                radius={[4, 4, 0, 0]}
              >
                {OCCUPANCY_HEATMAP.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.rate >= 90 ? '#EF4444' : entry.rate >= 70 ? '#F59E0B' : '#6366F1'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ==================== CHARTS ROW 2 ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Menu Items */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Top Món Bán Chạy</h3>
              <p className="text-slate-500 text-sm">Xếp hạng theo số lượng đã bán</p>
            </div>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={TOP_MENU_ITEMS} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 11 }} 
                stroke="#94A3B8" 
                width={140}
              />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'quantity') return [value, 'Số lượng'];
                  return [formatVND(value) + 'đ', 'Doanh thu'];
                }}
              />
              <Bar dataKey="quantity" name="quantity" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Segments Pie */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Phân Loại Khách</h3>
              <p className="text-slate-500 text-sm">Cơ cấu khách hàng</p>
            </div>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={CUSTOMER_SEGMENTS}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${value}%`}
                labelLine={false}
              >
                {CUSTOMER_SEGMENTS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [`${value}%`, 'Tỷ lệ']} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {CUSTOMER_SEGMENTS.map((segment) => (
              <div key={segment.name} className="flex items-center gap-2 text-xs">
                <span 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: segment.color }}
                ></span>
                <span className="text-slate-600 truncate">{segment.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== CHARTS ROW 3 ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Revenue Trend */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Xu Hướng Doanh Thu Tuần</h3>
              <p className="text-slate-500 text-sm">So sánh các ngày trong tuần</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={REVENUE_WEEKLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94A3B8" />
              <YAxis tickFormatter={(v) => formatVND(v)} tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="revenue" name="Doanh thu" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cost" name="Chi phí" fill="#F87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Phương Thức Thanh Toán</h3>
              <p className="text-slate-500 text-sm">Tỷ lệ sử dụng các hình thức</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={PAYMENT_METHODS}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {PAYMENT_METHODS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [`${value}%`, 'Tỷ lệ']} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((method) => (
              <div key={method.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: method.color }}
                  ></span>
                  <span className="text-xs text-slate-600">{method.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900">{method.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-slate-400 py-4">
        Dữ liệu cập nhật lúc: {new Date().toLocaleString('vi-VN')} • 
        <span className="text-indigo-500"> Chi nhánh: {selectedBranch}</span> • 
        <span className="text-amber-500"> {selectedTimeRange}</span>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
