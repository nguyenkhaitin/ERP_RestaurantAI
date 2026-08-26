/**
 * AICameraWidget - Widget Camera AI Surveillance với Style chuyên nghiệp
 * Stream video từ Backend + Overlay thông tin real-time
 */

import React, { useState, useEffect } from 'react';
import { Camera, Video, VideoOff, Eye, RefreshCw, Maximize2, Users, Activity } from 'lucide-react';

interface AICameraStatus {
  total_guests: number;
  camera_status: string;
  last_updated: string | null;
  fps: number;
  frame_count: number;
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
  }>;
}

interface AICameraWidgetProps {
  backendUrl?: string;
  className?: string;
  onGuestCountChange?: (count: number) => void;
}

export function AICameraWidget({ 
  backendUrl = 'http://127.0.0.1:8000',
  className = '',
  onGuestCountChange
}: AICameraWidgetProps) {
  const [status, setStatus] = useState<AICameraStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/ai-camera/status`, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setStatus(data.data);
          setError(null);
          if (onGuestCountChange && data.data?.total_guests !== undefined) {
            onGuestCountChange(data.data.total_guests);
          }
        } else {
          setError('Camera không khả dụng');
        }
      } catch (err) {
        setError('Không thể kết nối Backend');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    // HIGH-FREQUENCY POLLING: 5 times per second for real-time updates
    const interval = setInterval(fetchStatus, 200);
    return () => clearInterval(interval);
  }, [backendUrl, onGuestCountChange]);

  const handleToggleCamera = async () => {
    try {
      await fetch(`${backendUrl}/api/ai-camera/toggle`, { 
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
    } catch (err) {
      console.error('Toggle camera failed:', err);
    }
  };

  const isActive = status?.camera_status === 'active';

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {/* Header with Gradient */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Camera AI Giám Sát</h3>
              <p className="text-white/70 text-xs">YOLO v8 Detection</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Live Badge */}
            {isActive && (
              <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                LIVE REC
              </div>
            )}
            
            {/* Status Dot */}
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className={`relative bg-slate-900 ${isExpanded ? 'aspect-video' : 'h-56'}`}>
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
            <p className="text-slate-400 text-sm">Đang kết nối camera...</p>
          </div>
        ) : error || imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800">
            <VideoOff className="w-12 h-12 text-slate-500" />
            <p className="text-slate-400 text-sm text-center px-4">
              {error || 'Không thể tải video stream'}
            </p>
            <p className="text-slate-500 text-xs">Kiểm tra Backend đang chạy tại {backendUrl}</p>
          </div>
        ) : isActive ? (
          <>
            <img 
              ref={imgRef}
              src={`${backendUrl}/video_feed?ngrok-skip-browser-warning=true&t=${Date.now()}`}
              alt="AI Camera Feed"
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
            
            {/* Video Overlays */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top Gradient */}
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
              
              {/* Bottom Stats Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    {/* Guest Count */}
                    <div className="flex items-center gap-2 bg-emerald-500/90 text-white px-3 py-1.5 rounded-lg">
                      <Users className="w-4 h-4" />
                      <span className="font-bold">{status?.total_guests ?? 0}</span>
                      <span className="text-white/80 text-xs">khách</span>
                    </div>
                    
                    {/* Detections */}
                    <div className="flex items-center gap-2 bg-white/20 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      <Activity className="w-4 h-4" />
                      <span className="text-sm">{status?.detections?.length ?? 0} detections</span>
                    </div>
                  </div>
                  
                  {/* FPS */}
                  <div className="text-white/70 text-xs font-mono">
                    {status?.fps ?? 0} FPS
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Video className="w-12 h-12 text-slate-500" />
            <p className="text-slate-400 text-sm">Camera đã tắt</p>
          </div>
        )}

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Panel */}
      <div className="p-4 bg-slate-50 border-t border-slate-100">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{status?.total_guests ?? '-'}</p>
            <p className="text-xs text-slate-500">Khách AI</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{status?.fps ?? '-'}</p>
            <p className="text-xs text-slate-500">FPS</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{status?.frame_count ?? '-'}</p>
            <p className="text-xs text-slate-500">Frames</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleToggleCamera}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              isActive 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {isActive ? (
              <>
                <VideoOff className="w-4 h-4" />
                Tắt Camera
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                Bật Camera
              </>
            )}
          </button>
          
          <button 
            onClick={() => window.open(`${backendUrl}/video_feed`, '_blank')}
            className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            title="Mở video trong tab mới"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        {/* Last Updated */}
        {status?.last_updated && (
          <p className="text-xs text-slate-400 text-center mt-3">
            Cập nhật lần cuối: {new Date(status.last_updated).toLocaleTimeString('vi-VN')}
          </p>
        )}
      </div>
    </div>
  );
}
