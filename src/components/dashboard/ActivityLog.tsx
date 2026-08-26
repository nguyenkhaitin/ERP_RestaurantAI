/**
 * ActivityLog - Nhật ký hoạt động Real-time
 * Migrated from AI_V1 Dashboard
 */

import React from 'react';
import { Activity, Clock, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

export interface LogEntry {
  id: number | string;
  time: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  message: string;
}

interface ActivityLogProps {
  logs: LogEntry[];
  isLoading?: boolean;
  maxHeight?: string;
}

export function ActivityLog({ logs, isLoading = false, maxHeight = '400px' }: ActivityLogProps) {
  const getTypeConfig = (type: LogEntry['type']) => {
    switch (type) {
      case 'INFO':
        return {
          icon: Info,
          bgClass: 'bg-blue-50',
          textClass: 'text-blue-600',
          borderClass: 'border-blue-100',
        };
      case 'WARNING':
        return {
          icon: AlertCircle,
          bgClass: 'bg-amber-50',
          textClass: 'text-amber-600',
          borderClass: 'border-amber-100',
        };
      case 'SUCCESS':
        return {
          icon: CheckCircle,
          bgClass: 'bg-emerald-50',
          textClass: 'text-emerald-600',
          borderClass: 'border-emerald-100',
        };
      case 'ERROR':
        return {
          icon: XCircle,
          bgClass: 'bg-red-50',
          textClass: 'text-red-600',
          borderClass: 'border-red-100',
        };
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight }}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Nhật ký Hoạt động
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </h3>
        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
          Live Stream
        </span>
      </div>
      
      {/* Body */}
      <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-16 h-4 bg-slate-200 rounded"></div>
                <div className="w-16 h-4 bg-slate-200 rounded"></div>
                <div className="flex-1 h-4 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">Đang chờ sự kiện từ Camera AI...</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => {
                const config = getTypeConfig(log.type);
                const Icon = config.icon;
                
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                    {/* Time */}
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs w-20 whitespace-nowrap border-l-4 border-transparent group-hover:border-indigo-500">
                      {log.time}
                    </td>
                    
                    {/* Type Badge */}
                    <td className="px-2 py-3 w-24">
                      <span className={`inline-flex items-center justify-center gap-1 w-full px-2 py-1 rounded-md text-[10px] font-bold border tracking-wider ${config.bgClass} ${config.textClass} ${config.borderClass}`}>
                        <Icon className="w-3 h-3" />
                        {log.type}
                      </span>
                    </td>
                    
                    {/* Message */}
                    <td className="px-4 py-3 text-slate-700 text-sm">
                      {log.message}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
