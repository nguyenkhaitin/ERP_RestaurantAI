/**
 * LiveTableGrid - Hiển thị Grid trạng thái các bàn Real-time
 * UPGRADED: Better visuals & real-time feedback from AI
 */

import React from 'react';
import { Users, Clock, AlertTriangle, Utensils, CheckCircle } from 'lucide-react';

export interface TableData {
  id: number;
  name: string;
  zone?: string;
  capacity?: number;
  currentGuests?: number;
  status: 'empty' | 'occupied' | 'reserved' | 'alert' | 'TRONG' | 'CO KHACH' | 'DAT TRUOC';
  guests?: number;
  dwellTime?: string;
  alert?: string;
  totalToday?: number;
  lastUpdate?: string;
}

interface LiveTableGridProps {
  tables: TableData[];
  activeTableIds?: number[];  // List of IDs with guests (from AI)
  isLoading?: boolean;
}

export function LiveTableGrid({ tables, activeTableIds = [], isLoading = false }: LiveTableGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-200 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-16 mb-3"></div>
            <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
            <div className="h-4 bg-slate-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  // Generate default 8 tables if none provided
  const displayTables: TableData[] = tables.length > 0 ? tables : Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `Bàn ${i + 1}`,
    status: 'empty' as const,
    guests: 0,
    dwellTime: '0p',
    currentGuests: 0,
    capacity: 4,
    zone: i < 4 ? 'Khu A' : 'Khu B'
  }));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {displayTables.map((table) => {
        // Check if this table is active (from AI detection or status)
        const isOccupied = 
          activeTableIds.includes(table.id) || 
          table.status === 'CO KHACH' || 
          table.status === 'occupied' ||
          (table.currentGuests && table.currentGuests > 0) ||
          (table.guests && table.guests > 0);
        
        const guestCount = table.currentGuests ?? table.guests ?? 0;
        const hasAlert = table.alert && table.alert !== 'NONE';
        const dwellTime = table.dwellTime || '0p';
        
        return (
          <div 
            key={table.id} 
            className={`relative p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-lg ${
              hasAlert 
                ? 'bg-red-50 border-red-400 ring-2 ring-red-200' 
                : isOccupied 
                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            {/* Live Indicator for occupied tables */}
            {isOccupied && !hasAlert && (
              <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
            )}

            {/* Alert Badge */}
            {hasAlert && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {table.alert}
              </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className={`font-bold text-lg ${
                  hasAlert ? 'text-red-700' : isOccupied ? 'text-emerald-700' : 'text-slate-700'
                }`}>
                  {table.name}
                </span>
                {table.zone && (
                  <p className="text-xs text-slate-400">{table.zone}</p>
                )}
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                hasAlert
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : isOccupied 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                {hasAlert ? 'CẢNH BÁO' : isOccupied ? 'ĐANG PHỤC VỤ' : 'TRỐNG'}
              </span>
            </div>

            {/* Stats */}
            <div className="space-y-2.5">
              {/* Guest Count */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Users className={`w-3.5 h-3.5 ${isOccupied ? 'text-emerald-500' : 'text-slate-400'}`} />
                  Số khách:
                </span>
                <span className={`font-bold text-base ${
                  isOccupied ? 'text-emerald-700' : 'text-slate-400'
                }`}>
                  {isOccupied ? `${guestCount} người` : '-'}
                </span>
              </div>
              
              {/* Dwell Time */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${table.alert === 'NGOI LAU' ? 'text-red-500' : 'text-slate-400'}`} />
                  Thời gian:
                </span>
                <span className={`font-bold ${
                  table.alert === 'NGOI LAU' ? 'text-red-600 animate-pulse' : isOccupied ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  {isOccupied ? dwellTime : '-'}
                </span>
              </div>

              {/* Capacity */}
              {table.capacity && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-slate-400" />
                    Sức chứa:
                  </span>
                  <span className="font-medium text-slate-600">{table.capacity} chỗ</span>
                </div>
              )}
            </div>

            {/* Status Bar at bottom */}
            <div className={`mt-3 pt-2 border-t ${
              isOccupied ? 'border-emerald-100' : 'border-slate-100'
            }`}>
              <div className={`flex items-center justify-center gap-1.5 text-[10px] font-medium ${
                isOccupied ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                {isOccupied ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Đang hoạt động
                  </>
                ) : (
                  'Sẵn sàng phục vụ'
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

