import { useMemo } from 'react';

// Định nghĩa các Role trong hệ thống
export type UserRole = 'QuanLy' | 'NhanVien' | string;

// Định nghĩa các trang có trong hệ thống
export type PageName = 
  | 'floor'           // Vận hành sàn
  | 'analytics'       // Quản trị & Phân tích
  | 'hr'              // Tổ chức (Nhân sự)
  | 'ai'              // Hạ tầng & Cấu hình
  | 'menu'            // Thực đơn
  | 'reports'         // Báo cáo
  | 'settings'        // Cài đặt
  | string;

// Các trang mà NhanVien có toàn quyền (giống Admin)
const STAFF_FULL_ACCESS_PAGES: PageName[] = ['floor'];

// Các trang chỉ Admin mới có quyền chỉnh sửa
const ADMIN_ONLY_PAGES: PageName[] = ['hr', 'analytics', 'ai', 'menu', 'reports', 'settings'];

interface RBACResult {
  // Có quyền chỉnh sửa (Add/Edit/Delete) không?
  canEdit: boolean;
  // Trang này có phải Read-only với user hiện tại không?
  isReadOnly: boolean;
  // Có phải Admin không?
  isAdmin: boolean;
  // Role của user
  role: UserRole;
}

/**
 * Custom Hook để kiểm tra quyền hạn người dùng (RBAC)
 * 
 * @param currentPage - Tên trang hiện tại (vd: 'floor', 'hr', 'analytics')
 * @returns Object chứa các flags phân quyền
 * 
 * @example
 * const { canEdit, isReadOnly } = useRBAC('hr');
 * 
 * // Trong component:
 * {canEdit && <button>Thêm nhân viên</button>}
 * <button disabled={isReadOnly}>Chỉnh sửa</button>
 */
export function useRBAC(currentPage?: PageName): RBACResult {
  const result = useMemo(() => {
    // Lấy thông tin user từ localStorage
    const userStr = localStorage.getItem('user');
    
    if (!userStr) {
      // Chưa đăng nhập -> Không có quyền gì
      return {
        canEdit: false,
        isReadOnly: true,
        isAdmin: false,
        role: '' as UserRole,
      };
    }

    try {
      const user = JSON.parse(userStr);
      const role = (user.chuc_vu || '').trim() as UserRole;
      
      // Kiểm tra có phải Admin (QuanLy) không
      const isAdmin = role === 'QuanLy';
      
      // Logic phân quyền:
      // 1. Admin -> Toàn quyền trên mọi trang
      // 2. NhanVien + Trang 'floor' -> Toàn quyền
      // 3. NhanVien + Trang khác -> Chỉ xem (Read-only)
      
      let canEdit = false;
      
      if (isAdmin) {
        // Admin có toàn quyền
        canEdit = true;
      } else if (role === 'NhanVien') {
        // NhanVien chỉ có toàn quyền trên các trang cho phép
        canEdit = currentPage ? STAFF_FULL_ACCESS_PAGES.includes(currentPage) : false;
      }
      
      return {
        canEdit,
        isReadOnly: !canEdit,
        isAdmin,
        role,
      };
    } catch (e) {
      console.error('Error parsing user data:', e);
      return {
        canEdit: false,
        isReadOnly: true,
        isAdmin: false,
        role: '' as UserRole,
      };
    }
  }, [currentPage]);

  return result;
}

/**
 * Helper function để kiểm tra quyền nhanh (không dùng hook)
 * Dùng khi cần kiểm tra quyền ngoài React component
 */
export function checkPermission(currentPage?: PageName): RBACResult {
  const userStr = localStorage.getItem('user');
  
  if (!userStr) {
    return {
      canEdit: false,
      isReadOnly: true,
      isAdmin: false,
      role: '' as UserRole,
    };
  }

  try {
    const user = JSON.parse(userStr);
    const role = (user.chuc_vu || '').trim() as UserRole;
    const isAdmin = role === 'QuanLy';
    
    let canEdit = false;
    
    if (isAdmin) {
      canEdit = true;
    } else if (role === 'NhanVien') {
      canEdit = currentPage ? STAFF_FULL_ACCESS_PAGES.includes(currentPage) : false;
    }
    
    return {
      canEdit,
      isReadOnly: !canEdit,
      isAdmin,
      role,
    };
  } catch (e) {
    return {
      canEdit: false,
      isReadOnly: true,
      isAdmin: false,
      role: '' as UserRole,
    };
  }
}

/**
 * Component wrapper để ẩn/hiện dựa trên quyền
 */
interface PermissionGateProps {
  children: React.ReactNode;
  page?: PageName;
  fallback?: React.ReactNode;
  /** Nếu true, hiển thị children nhưng disabled */
  showDisabled?: boolean;
}

export function PermissionGate({ 
  children, 
  page, 
  fallback = null,
  showDisabled = false 
}: PermissionGateProps) {
  const { canEdit } = useRBAC(page);
  
  if (canEdit) {
    return <>{children}</>;
  }
  
  if (showDisabled) {
    // Wrap children với disabled state
    return (
      <div className="opacity-50 pointer-events-none cursor-not-allowed">
        {children}
      </div>
    );
  }
  
  return <>{fallback}</>;
}
