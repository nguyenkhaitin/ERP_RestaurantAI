/**
 * =============================================
 * AI CONFIGURATION - Cấu Hình Hệ Thống AI
 * MERGED: Includes CameraManager and CameraAdvancedSettings inline
 * =============================================
 */

import { useState } from 'react';
import { Plus, Video, Wifi, WifiOff, Trash2, Edit2, Save, X, Settings, ChevronDown } from 'lucide-react';

// ==========================================
// INTERFACES
// ==========================================

interface Camera {
  id: string;
  name: string;
  zone: string;
  rtspUrl: string;
  status: 'online' | 'offline' | 'weak';
  branch: string;
  resolution?: string;
  frameRate?: number;
  bitrate?: string;
}

interface CameraAdvancedSettingsState {
  brightness: number;
  contrast: number;
  saturation: number;
  zoom: number;
  focusMode: 'auto' | 'manual';
  isoLevel: 'auto' | '100' | '400' | '800' | '1600';
  whiteBalance: 'auto' | 'daylight' | 'cloudy' | 'tungsten' | 'fluorescent';
  exposureMode: 'auto' | 'manual';
  noiseReduction: 'low' | 'medium' | 'high' | 'off';
  recordingQuality: 'low' | 'medium' | 'high' | 'ultra';
  streamingMode: 'constant' | 'adaptive' | 'variable';
  motionDetection: boolean;
  motionSensitivity: number;
  nightVisionMode: 'auto' | 'on' | 'off';
}

// ==========================================
// SUB-COMPONENT: CameraAdvancedSettings
// ==========================================

const CameraAdvancedSettings = ({
  camera,
  onUpdate,
  onClose
}: {
  camera: Camera;
  onUpdate: (camera: Camera) => void;
  onClose: () => void;
}) => {
  const [settings, setSettings] = useState<CameraAdvancedSettingsState>({
    brightness: 50,
    contrast: 50,
    saturation: 50,
    zoom: 1,
    focusMode: 'auto',
    isoLevel: 'auto',
    whiteBalance: 'auto',
    exposureMode: 'auto',
    noiseReduction: 'medium',
    recordingQuality: 'high',
    streamingMode: 'adaptive',
    motionDetection: true,
    motionSensitivity: 50,
    nightVisionMode: 'auto',
  });

  const handleSave = () => {
    console.log('Camera advanced settings saved:', settings);
    onClose();
  };

  const resetToDefault = () => {
    setSettings({
      brightness: 50,
      contrast: 50,
      saturation: 50,
      zoom: 1,
      focusMode: 'auto',
      isoLevel: 'auto',
      whiteBalance: 'auto',
      exposureMode: 'auto',
      noiseReduction: 'medium',
      recordingQuality: 'high',
      streamingMode: 'adaptive',
      motionDetection: true,
      motionSensitivity: 50,
      nightVisionMode: 'auto',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col" style={{ boxShadow: 'var(--shadow-elevated)' }}>
        {/* Header */}
        <div className="sticky top-0 p-3 border-b bg-white flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold text-sm">Cấu Hình Nâng Cao</h3>
            <p className="text-xs text-text-secondary">{camera.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Image Quality Section */}
          <div className="border border-gray-200 rounded p-2">
            <h4 className="font-medium text-xs mb-2">Chất Lượng Hình Ảnh</h4>
            <div className="space-y-2">
              {/* Brightness */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Độ sáng</label>
                  <span className="text-xs text-text-secondary">{settings.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.brightness}
                  onChange={(e) => setSettings({ ...settings, brightness: parseInt(e.target.value) })}
                  className="w-full h-1"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Tương phản</label>
                  <span className="text-xs text-text-secondary">{settings.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.contrast}
                  onChange={(e) => setSettings({ ...settings, contrast: parseInt(e.target.value) })}
                  className="w-full h-1"
                />
              </div>

              {/* Saturation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Bão hòa</label>
                  <span className="text-xs text-text-secondary">{settings.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.saturation}
                  onChange={(e) => setSettings({ ...settings, saturation: parseInt(e.target.value) })}
                  className="w-full h-1"
                />
              </div>

              {/* Zoom */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Zoom</label>
                  <span className="text-xs text-text-secondary">{settings.zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.1"
                  value={settings.zoom}
                  onChange={(e) => setSettings({ ...settings, zoom: parseFloat(e.target.value) })}
                  className="w-full h-1"
                />
              </div>
            </div>
          </div>

          {/* Camera Settings Section */}
          <div className="border border-gray-200 rounded p-2">
            <h4 className="font-medium text-xs mb-2">Cài Đặt Camera</h4>
            <div className="space-y-2">
              {/* ISO Level */}
              <div>
                <label className="text-xs font-medium block mb-1">Mức ISO</label>
                <select
                  value={settings.isoLevel}
                  onChange={(e) => setSettings({ ...settings, isoLevel: e.target.value as any })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="auto">Tự động</option>
                  <option value="100">ISO 100</option>
                  <option value="400">ISO 400</option>
                  <option value="800">ISO 800</option>
                  <option value="1600">ISO 1600</option>
                </select>
              </div>

              {/* White Balance */}
              <div>
                <label className="text-xs font-medium block mb-1">Cân bằng trắng</label>
                <select
                  value={settings.whiteBalance}
                  onChange={(e) => setSettings({ ...settings, whiteBalance: e.target.value as any })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="auto">Tự động</option>
                  <option value="daylight">Ánh sáng</option>
                  <option value="cloudy">Mây</option>
                  <option value="tungsten">Tungsten</option>
                  <option value="fluorescent">Fluor</option>
                </select>
              </div>

              {/* Night Vision */}
              <div>
                <label className="text-xs font-medium block mb-1">Chế độ ban đêm</label>
                <select
                  value={settings.nightVisionMode}
                  onChange={(e) => setSettings({ ...settings, nightVisionMode: e.target.value as any })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="auto">Tự động</option>
                  <option value="on">Bật</option>
                  <option value="off">Tắt</option>
                </select>
              </div>

              {/* Motion Detection */}
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-medium">Phát hiện chuyển động</label>
                <button
                  onClick={() => setSettings({ ...settings, motionDetection: !settings.motionDetection })}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    settings.motionDetection
                      ? 'bg-secondary text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {settings.motionDetection ? 'Bật' : 'Tắt'}
                </button>
              </div>

              {/* Motion Sensitivity */}
              {settings.motionDetection && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium">Độ nhạy</label>
                    <span className="text-xs text-text-secondary">{settings.motionSensitivity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.motionSensitivity}
                    onChange={(e) => setSettings({ ...settings, motionSensitivity: parseInt(e.target.value) })}
                    className="w-full h-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-3 border-t bg-white flex gap-2">
          <button
            onClick={resetToDefault}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-xs font-medium"
          >
            Đặt Lại
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-xs font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-xs font-medium"
          >
            <Save size={14} />
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: CameraManager
// ==========================================

const CameraManager = ({
  branch,
  cameras,
  onCamerasChange,
  onClose
}: {
  branch: string;
  cameras: Camera[];
  onCamerasChange: (cameras: Camera[]) => void;
  onClose: () => void;
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Camera>>({
    name: '',
    zone: '',
    rtspUrl: '',
    resolution: '1920x1080',
    frameRate: 30,
    bitrate: '5Mbps',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingUrl, setTestingUrl] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [selectedCameraForSettings, setSelectedCameraForSettings] = useState<Camera | null>(null);

  const filteredCameras = cameras.filter(c => c.branch === branch);

  const resetForm = () => {
    setFormData({
      name: '',
      zone: '',
      rtspUrl: '',
      resolution: '1920x1080',
      frameRate: 30,
      bitrate: '5Mbps',
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleAddCamera = () => {
    if (!formData.name || !formData.rtspUrl) {
      alert('Vui lòng điền đầy đủ thông tin camera');
      return;
    }

    const newCamera: Camera = {
      id: Date.now().toString(),
      name: formData.name,
      zone: formData.zone || 'Chưa phân loại',
      rtspUrl: formData.rtspUrl,
      status: 'offline',
      branch: branch,
      resolution: formData.resolution,
      frameRate: formData.frameRate,
      bitrate: formData.bitrate,
    };

    onCamerasChange([...cameras, newCamera]);
    resetForm();
  };

  const handleUpdateCamera = () => {
    if (!formData.name || !formData.rtspUrl) {
      alert('Vui lòng điền đầy đủ thông tin camera');
      return;
    }

    onCamerasChange(
      cameras.map(c =>
        c.id === editingId
          ? {
              ...c,
              name: formData.name || c.name,
              zone: formData.zone || c.zone,
              rtspUrl: formData.rtspUrl || c.rtspUrl,
              resolution: formData.resolution || c.resolution,
              frameRate: formData.frameRate || c.frameRate,
              bitrate: formData.bitrate || c.bitrate,
            }
          : c
      )
    );
    resetForm();
  };

  const handleDeleteCamera = (id: string) => {
    if (confirm('Bạn chắc chắn muốn xóa camera này?')) {
      onCamerasChange(cameras.filter(c => c.id !== id));
    }
  };

  const startEditCamera = (camera: Camera) => {
    setFormData(camera);
    setEditingId(camera.id);
    setShowAddForm(true);
  };

  const handleTestConnection = async (rtspUrl: string) => {
    setTestingUrl(rtspUrl);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTestResult(Math.random() > 0.3 ? 'success' : 'error');
    setTimeout(() => {
      setTestingUrl(null);
      setTestResult(null);
    }, 2000);
  };

  const getStatusIcon = (status: Camera['status']) => {
    if (status === 'online') return <Wifi size={16} className="text-secondary" />;
    if (status === 'weak') return <Wifi size={16} className="text-accent" />;
    return <WifiOff size={16} className="text-alert" />;
  };

  const getStatusColor = (status: Camera['status']) => {
    if (status === 'online') return 'bg-secondary text-white';
    if (status === 'weak') return 'bg-accent text-white';
    return 'bg-alert text-white';
  };

  const getStatusLabel = (status: Camera['status']) => {
    if (status === 'online') return 'Trực tuyến';
    if (status === 'weak') return 'Yếu';
    return 'Ngoại tuyến';
  };

  const zones = ['Sảnh chính', 'Khu VIP', 'Tầng 1', 'Lối vào', 'Khu ăn ngoài', 'Khu bếp'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col" style={{ boxShadow: 'var(--shadow-elevated)' }}>
        {/* Header - Compact */}
        <div className="sticky top-0 p-3 border-b bg-white flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold text-sm">Quản Lý Camera</h3>
            <p className="text-xs text-text-secondary">{filteredCameras.length} camera</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Add Camera Button */}
          {!showAddForm && (
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-xs font-medium"
            >
              <Plus size={12} />
              Thêm Camera
            </button>
          )}

          {/* Add/Edit Form - Compact */}
          {showAddForm && (
            <div className="p-2 bg-blue-50 rounded border border-blue-200 space-y-1">
              <h4 className="text-xs font-medium">
                {editingId ? 'Chỉnh sửa' : 'Thêm camera'}
              </h4>
              
              <div className="space-y-1">
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Tên camera *"
                  className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />

                <select
                  value={formData.zone || ''}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="">Khu vực</option>
                  {zones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>

                <div className="flex gap-0.5">
                  <input
                    type="text"
                    value={formData.rtspUrl || ''}
                    onChange={(e) => setFormData({ ...formData, rtspUrl: e.target.value })}
                    placeholder="RTSP URL *"
                    className="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => handleTestConnection(formData.rtspUrl || '')}
                    disabled={!formData.rtspUrl || testingUrl === formData.rtspUrl}
                    className="px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-40 text-xs"
                  >
                    {testingUrl === formData.rtspUrl ? '...' : 'Test'}
                  </button>
                </div>
                {testingUrl === formData.rtspUrl && testResult && (
                  <p className={`text-xs ${testResult === 'success' ? 'text-secondary' : 'text-alert'}`}>
                    {testResult === 'success' ? '✓ OK' : '✗ Lỗi'}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-0.5">
                  <select
                    value={formData.resolution || '1920x1080'}
                    onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                    className="px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="1280x720">720p</option>
                    <option value="1920x1080">1080p</option>
                    <option value="2560x1440">1440p</option>
                    <option value="3840x2160">4K</option>
                  </select>
                  <input
                    type="number"
                    value={formData.frameRate || 30}
                    onChange={(e) => setFormData({ ...formData, frameRate: parseInt(e.target.value) })}
                    min="15"
                    max="60"
                    placeholder="FPS"
                    className="px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <select
                    value={formData.bitrate || '5Mbps'}
                    onChange={(e) => setFormData({ ...formData, bitrate: e.target.value })}
                    className="px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="2Mbps">2 Mbps</option>
                    <option value="5Mbps">5 Mbps</option>
                    <option value="10Mbps">10 Mbps</option>
                    <option value="15Mbps">15 Mbps</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={editingId ? handleUpdateCamera : handleAddCamera}
                  className="flex-1 flex items-center justify-center gap-0.5 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-xs font-medium"
                >
                  <Save size={12} />
                  {editingId ? 'Cập nhật' : 'Thêm'}
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-xs"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {/* Camera List */}
          <div className="space-y-1.5">
            {filteredCameras.length === 0 ? (
              <div className="text-center py-4 text-text-secondary">
                <p className="text-xs">Chưa có camera nào được thêm</p>
              </div>
            ) : (
              filteredCameras.map((camera) => (
                <div
                  key={camera.id}
                  className="border border-gray-200 rounded overflow-hidden hover:border-gray-300 transition-colors"
                >
                  {/* Camera Item Header */}
                  <button
                    onClick={() => setExpandedCamera(expandedCamera === camera.id ? null : camera.id)}
                    className="w-full p-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusIcon(camera.status)}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-xs font-medium truncate">{camera.name}</p>
                        <p className="text-xs text-text-secondary truncate">{camera.zone}</p>
                      </div>
                      <span className={`text-xs px-1 py-0.5 rounded-full flex-shrink-0 ${getStatusColor(camera.status)}`}>
                        {getStatusLabel(camera.status)}
                      </span>
                    </div>
                    <ChevronDown size={12} className={`flex-shrink-0 ml-1 transition-transform ${expandedCamera === camera.id ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded Details */}
                  {expandedCamera === camera.id && (
                    <div className="border-t border-gray-200 bg-gray-50 p-2 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div className="bg-white p-1 rounded border border-gray-100">
                          <p className="text-text-secondary/70 text-xs">Phân giải</p>
                          <p className="font-medium text-xs">{camera.resolution || '1920x1080'}</p>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-100">
                          <p className="text-text-secondary/70 text-xs">FPS</p>
                          <p className="font-medium text-xs">{camera.frameRate || 30}</p>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-100">
                          <p className="text-text-secondary/70 text-xs">Bitrate</p>
                          <p className="font-medium text-xs">{camera.bitrate || '5Mbps'}</p>
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-100">
                          <p className="text-text-secondary/70 text-xs">RTSP</p>
                          <p className="font-medium text-xs truncate">{camera.rtspUrl}</p>
                        </div>
                      </div>

                      <div className="flex gap-0.5">
                        <button
                          onClick={() => startEditCamera(camera)}
                          className="flex-1 flex items-center justify-center gap-0.5 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-xs font-medium"
                        >
                          <Edit2 size={11} />
                          Sửa
                        </button>
                        <button
                          onClick={() => setSelectedCameraForSettings(camera)}
                          className="flex-1 flex items-center justify-center gap-0.5 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors text-xs font-medium"
                        >
                          <Settings size={11} />
                          Cài
                        </button>
                        <button
                          onClick={() => handleDeleteCamera(camera.id)}
                          className="flex-1 flex items-center justify-center gap-0.5 py-1 bg-white border border-alert text-alert rounded hover:bg-alert/5 transition-colors text-xs font-medium"
                        >
                          <Trash2 size={11} />
                          Xóa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-2 border-t bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-xs font-medium"
          >
            Đóng
          </button>
        </div>

        {/* Advanced Settings Modal */}
        {selectedCameraForSettings && (
          <CameraAdvancedSettings
            camera={selectedCameraForSettings}
            onUpdate={(camera) => {
              onCamerasChange(
                cameras.map(c =>
                  c.id === camera.id ? camera : c
                )
              );
              setSelectedCameraForSettings(null);
            }}
            onClose={() => setSelectedCameraForSettings(null)}
          />
        )}
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT - AIConfiguration
// ==========================================

export function AIConfiguration() {
  const [selectedBranch, setSelectedBranch] = useState('d1');
  const [showCameraManager, setShowCameraManager] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([
    { id: '1', name: 'Sảnh chính - Phía trước', zone: 'Sảnh chính', rtspUrl: 'rtsp://camera1.local', status: 'online', branch: 'd1' },
    { id: '2', name: 'Sảnh chính - Phía sau', zone: 'Sảnh chính', rtspUrl: 'rtsp://camera2.local', status: 'online', branch: 'd1' },
    { id: '3', name: 'Khu VIP', zone: 'Khu VIP', rtspUrl: 'rtsp://camera3.local', status: 'weak', branch: 'd1' },
    { id: '4', name: 'Cửa vào chính', zone: 'Lối vào', rtspUrl: 'rtsp://camera4.local', status: 'offline', branch: 'd1' },
  ]);

  const branches = [
    { id: 'd1', name: 'CN Quận 1' },
    { id: 'd3', name: 'CN Quận 3' },
    { id: 'd7', name: 'CN Quận 7' },
    { id: 'cg', name: 'CN Cầu Giấy' },
  ];

  const getStatusIcon = (status: Camera['status']) => {
    if (status === 'online') return <Wifi size={16} className="text-secondary" />;
    if (status === 'weak') return <Wifi size={16} className="text-accent" />;
    return <WifiOff size={16} className="text-alert" />;
  };

  const getStatusColor = (status: Camera['status']) => {
    if (status === 'online') return 'bg-secondary';
    if (status === 'weak') return 'bg-accent';
    return 'bg-alert';
  };

  const getStatusLabel = (status: Camera['status']) => {
    if (status === 'online') return 'Trực tuyến';
    if (status === 'weak') return 'Yếu';
    return 'Ngoài tuyến';
  };

  const filteredCameras = cameras.filter(c => c.branch === selectedBranch);

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header with Branch Tabs */}
      <div className="bg-white rounded-lg" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="border-b px-6 flex items-center justify-between">
          <div className="flex gap-4">
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranch(branch.id)}
                className={`py-4 border-b-2 transition-colors ${
                  selectedBranch === branch.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {branch.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCameraManager(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            Quản Lý Camera
          </button>
        </div>

        {/* Camera Grid View */}
        <div className="p-6">
          <h3 className="mb-4">Camera đã kết nối</h3>
          <div className="grid grid-cols-4 gap-4">
            {filteredCameras.map((camera) => (
              <div
                key={camera.id}
                className="p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
              >
                <div className="aspect-video bg-gray-900 rounded mb-3 flex items-center justify-center">
                  <Video size={32} className="text-white/50" />
                </div>
                <div className="text-left">
                  <div className="text-sm mb-1">{camera.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">{camera.zone}</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(camera.status)}`}></div>
                      {getStatusIcon(camera.status)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Camera Manager Modal */}
      {showCameraManager && (
        <CameraManager
          branch={selectedBranch}
          cameras={cameras}
          onCamerasChange={setCameras}
          onClose={() => setShowCameraManager(false)}
        />
      )}
    </div>
  );
}
