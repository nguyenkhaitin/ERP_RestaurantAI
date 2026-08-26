/**
 * =====================================================
 * CAMERA MANAGEMENT - USAGE GUIDE (LEGACY REFERENCE)
 * =====================================================
 * 
 * NOTE: CameraManager and CameraAdvancedSettings components
 * have been MERGED into AIConfiguration.tsx
 * 
 * This file is kept as a reference for the old component structure.
 * Do NOT use the example code below - it is for documentation only.
 * 
 * =====================================================
 * HOW TO USE CAMERA MANAGEMENT
 * =====================================================
 * 
 * Instead of using separate CameraManager and CameraAdvancedSettings,
 * simply use the AIConfiguration component which includes both:
 * 
 * CORRECT USAGE:
 * ──────────────
 * import { AIConfiguration } from './AIConfiguration';
 * 
 * export function MyComponent() {
 *   return <AIConfiguration />;
 * }
 * 
 * The AIConfiguration component includes:
 * - Branch selection (Quận 1, Quận 3, Quận 7, Cầu Giấy)
 * - Camera grid view with status indicators
 * - Camera Manager modal (CRUD operations)
 * - Advanced Settings modal (14+ configuration options)
 * 
 * =====================================================
 * OLD STRUCTURE (NO LONGER USED)
 * =====================================================
 * 
 * Previously the components were separate:
 * - CameraManager.tsx (389 lines) - Camera CRUD and management
 * - CameraAdvancedSettings.tsx (267 lines) - Advanced configuration
 * 
 * These have now been inlined into AIConfiguration.tsx
 * 
 * =====================================================
 * FEATURE MAPPING
 * =====================================================
 * 
 * CameraManager Features (now in AIConfiguration):
 * ✓ Add camera (with RTSP URL validation)
 * ✓ Edit camera properties (resolution, FPS, bitrate)
 * ✓ Delete camera with confirmation
 * ✓ Test RTSP connection
 * ✓ Expandable camera details view
 * ✓ Branch-based filtering
 * 
 * CameraAdvancedSettings Features (now in AIConfiguration):
 * ✓ Image quality adjustments (brightness, contrast, saturation, zoom)
 * ✓ Camera settings (ISO, white balance, night vision)
 * ✓ Motion detection configuration
 * ✓ Motion sensitivity control
 * ✓ Reset to default settings
 * 
 * =====================================================
 * DATA STRUCTURE
 * =====================================================
 * 
 * Camera Interface:
 * {
 *   id: string;
 *   name: string;
 *   zone: string;
 *   rtspUrl: string;
 *   status: 'online' | 'offline' | 'weak';
 *   branch: string;
 *   resolution?: string;      // e.g., "1920x1080"
 *   frameRate?: number;       // e.g., 30
 *   bitrate?: string;         // e.g., "5Mbps"
 * }
 * 
 * =====================================================
 * EXAMPLE MOCK DATA
 * =====================================================
 */

interface CameraData {
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

export const mockCameras: CameraData[] = [
  {
    id: '1',
    name: 'Sảnh chính - Phía trước',
    zone: 'Sảnh chính',
    rtspUrl: 'rtsp://192.168.1.100:554/stream1',
    status: 'online',
    branch: 'd1',
    resolution: '1920x1080',
    frameRate: 30,
    bitrate: '5Mbps',
  },
  {
    id: '2',
    name: 'Sảnh chính - Phía sau',
    zone: 'Sảnh chính',
    rtspUrl: 'rtsp://192.168.1.101:554/stream2',
    status: 'online',
    branch: 'd1',
    resolution: '1920x1080',
    frameRate: 30,
    bitrate: '5Mbps',
  },
  {
    id: '3',
    name: 'Khu VIP',
    zone: 'Khu VIP',
    rtspUrl: 'rtsp://192.168.1.102:554/stream3',
    status: 'weak',
    branch: 'd1',
    resolution: '1280x720',
    frameRate: 15,
    bitrate: '2Mbps',
  },
  {
    id: '4',
    name: 'Cửa vào chính',
    zone: 'Lối vào',
    rtspUrl: 'rtsp://192.168.1.103:554/stream4',
    status: 'offline',
    branch: 'd1',
  },
];

/**
 * =====================================================
 * CORRECT USAGE (NEW APPROACH)
 * =====================================================
 * 
 * Simply use AIConfiguration component:
 */
import { AIConfiguration } from './AIConfiguration';

export function BasicUsageExample() {
  return <AIConfiguration />;
}

/**
 * =====================================================
 * RTSP URL TEST CASES
 * =====================================================
 * 
 * Use these URLs for testing camera connections:
 */
export const RTSP_TEST_URLS = {
  hikvision: 'rtsp://admin:admin@192.168.1.100:554/Streaming/Channels/1',
  dahua: 'rtsp://admin:admin@192.168.1.100:554/stream/sub',
  reolink: 'rtsp://admin:admin@192.168.1.100:554/h264Preview_01_main',
  generic: 'rtsp://192.168.1.100:554/stream',
  withAuth: 'rtsp://username:password@192.168.1.100:554/stream',
};

/**
 * =====================================================
 * FEATURES AVAILABLE IN AICONFIGURATION
 * =====================================================
 * 
 * Camera Management:
 * • Add new cameras (with RTSP URL validation)
 * • Edit camera properties (resolution, FPS, bitrate)
 * • Delete cameras (with confirmation)
 * • Test RTSP connection
 * 
 * Advanced Settings:
 * • Image quality: brightness, contrast, saturation, zoom
 * • Camera settings: ISO, white balance, night vision
 * • Motion detection: enable/disable, sensitivity control
 * 
 * UI Features:
 * • Multi-branch support (4 locations)
 * • Expandable camera details
 * • Real-time status indicators
 * • Responsive grid layout
 */
