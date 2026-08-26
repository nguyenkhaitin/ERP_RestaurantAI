/**
 * KPICards Component - Hiển thị các chỉ số KPI chính
 * HYBRID: Real AI Data + Mock Analytics
 */

import React from 'react';
import { Users, Camera, AlertTriangle, Clock, TrendingUp, Activity, DollarSign, Percent } from 'lucide-react';

export interface KPIData {
  totalGuests: number;        // Tổng khách AI đếm được
  currentGuests: number;      // Số khách hiện tại (live)
  occupancyRate: number;      // Tỷ lệ lấp đầy (%)
  avgDwellTime: number;       // Thời gian ngồi trung bình (phút)
  cameraStatus: 'active' | 'inactive' | 'error';
  alertCount: number;         // Số cảnh báo
  // Optional analytics fields (Mock data)
  efficiencyScore?: number;   // Hiệu suất (%)
  revenueToday?: number;      // Doanh thu hôm nay (VND)
}

interface KPICardsProps {
  data: KPIData;
  isLoading?: boolean;
}

// Helper to safely display number (prevent NaN)
const safeNumber = (value: number | undefined | null, fallback: number = 0): number | string => {
  if (value === undefined || value === null || isNaN(value)) return fallback;
  return value;
};

// Format VND currency
const formatVND = (value: number): string => {
  if (isNaN(value) || value === 0) return '0đ';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}tr`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return `${value}đ`;
};

interface KPICardsProps {
  data: KPIData;
  isLoading?: boolean;
}

export function KPICards({ data, isLoading = false }: KPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-24 mb-4"></div>
            <div className="h-10 bg-slate-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Khách Thực Tế (AI)',
      value: safeNumber(data.currentGuests),
      suffix: 'người',
      icon: Users,
      color: 'emerald',
      bgClass: 'bg-emerald-50 border-emerald-200',
      textClass: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
      hasLiveIndicator: true,
    },
    {
      title: 'Bàn Đang Phục Vụ',
      value: `${safeNumber(Math.round(data.occupancyRate / 12.5))}`, // ~8 tables max
      suffix: '/ 8 bàn',
      icon: TrendingUp,
      color: 'blue',
      bgClass: 'bg-white border-slate-200',
      textClass: 'text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'Camera Status',
      value: data.cameraStatus === 'active' ? 'LIVE' : data.cameraStatus.toUpperCase(),
      suffix: '',
      icon: Camera,
      color: data.cameraStatus === 'active' ? 'green' : 'red',
      bgClass: data.cameraStatus === 'active' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200',
      textClass: data.cameraStatus === 'active' ? 'text-green-700' : 'text-red-700',
      iconBg: data.cameraStatus === 'active' ? 'bg-green-100' : 'bg-red-100',
      hasLiveIndicator: data.cameraStatus === 'active',
    },
    {
      title: 'Hiệu Suất',
      value: `${safeNumber(data.efficiencyScore, 88)}%`,
      suffix: '',
      icon: Percent,
      color: 'purple',
      bgClass: 'bg-purple-50 border-purple-200',
      textClass: 'text-purple-700',
      iconBg: 'bg-purple-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div 
          key={index} 
          className={`relative p-6 rounded-xl shadow-sm border transition-all hover:shadow-md ${card.bgClass}`}
        >
          {/* Live Indicator */}
          {card.hasLiveIndicator && (
            <div className="absolute top-4 right-4 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600"></span>
            </div>
          )}

          {/* Icon */}
          <div className={`inline-flex p-3 rounded-lg ${card.iconBg} mb-4`}>
            <card.icon className={`w-5 h-5 ${card.textClass}`} />
          </div>

          {/* Title */}
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            {card.title}
          </p>

          {/* Value */}
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-extrabold ${card.textClass}`}>
              {card.value}
            </span>
            {card.suffix && (
              <span className="text-sm text-slate-400 mb-1">{card.suffix}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
