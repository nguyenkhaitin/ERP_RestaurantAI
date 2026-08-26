import { useState } from 'react';
import { Menu, Search, Bell, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, BarChart3, Users, Camera, 
  LayoutDashboard, MapPin, CalendarDays, ClipboardCheck, DollarSign, TrendingUp, Grid3X3, Settings, LogOut } from 'lucide-react';

interface UserInfo {
  id: number;
  ten_nhan_vien: string;
  chuc_vu: string;
  so_dien_thoai: string;
}

interface LayoutProps {
  children: React.ReactNode;
  currentModule: string;
  onModuleChange: (module: string) => void;
  currentSubModule?: string;
  onSubModuleChange?: (subModule: string) => void;
  user?: UserInfo;
  onLogout?: () => void;
}

export function Layout({ children, currentModule, onModuleChange, currentSubModule, onSubModuleChange, user, onLogout }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>('floor'); // Mặc định mở Floor
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Lấy initials từ tên nhân viên
  const getUserInitials = () => {
    if (!user?.ten_nhan_vien) return 'U';
    const names = user.ten_nhan_vien.split(' ');
    if (names.length >= 2) {
      return names[names.length - 2][0] + names[names.length - 1][0];
    }
    return names[0].substring(0, 2).toUpperCase();
  };

  const menuItems = [
    { 
      id: 'floor', 
      icon: LayoutGrid, 
      label: 'Vận hành Sàn', 
      color: 'text-secondary',
      subItems: [
        { id: 'dashboard', icon: TrendingUp, label: 'Tổng quan' },
        { id: 'pos', icon: Grid3X3, label: 'Vận hành' },
        { id: 'configuration', icon: Settings, label: 'Thiết lập' },
      ]
    },
    { id: 'analytics', icon: BarChart3, label: 'Quản trị & Phân tích', color: 'text-accent' },
    { 
      id: 'hr', 
      icon: Users, 
      label: 'Tổ chức', 
      color: 'text-secondary',
      subItems: [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'locations', icon: MapPin, label: 'Chi nhánh' },
        { id: 'staff', icon: Users, label: 'Hồ sơ nhân viên' },
        { id: 'roster', icon: CalendarDays, label: 'Xếp lịch làm việc' },
        { id: 'attendance', icon: ClipboardCheck, label: 'Chấm công' },
        { id: 'payroll', icon: DollarSign, label: 'Lương' },
      ]
    },
    { id: 'ai', icon: Camera, label: 'Hạ tầng & Cấu hình', color: 'text-primary' },
  ];

  const handleMenuClick = (menuId: string) => {
    const menuItem = menuItems.find(item => item.id === menuId);
    
    if (menuItem && 'subItems' in menuItem && menuItem.subItems) {
      // Nếu có sub-items, toggle accordion
      setExpandedMenu(expandedMenu === menuId ? null : menuId);
      // Nếu đang đóng, chuyển về module chính
      if (expandedMenu === menuId) {
        onModuleChange(menuId);
      } else {
        // Khi mở, tự động chọn sub-item đầu tiên
        onModuleChange(menuId);
        if (onSubModuleChange && menuItem.subItems[0]) {
          onSubModuleChange(menuItem.subItems[0].id);
        }
      }
    } else {
      // Module không có sub-items
      onModuleChange(menuId);
      setExpandedMenu(null);
    }
  };

  const handleSubMenuClick = (parentId: string, subId: string) => {
    onModuleChange(parentId);
    if (onSubModuleChange) {
      onSubModuleChange(subId);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`bg-primary text-white transition-all duration-300 flex flex-col ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          {!sidebarCollapsed && (
            <div>
              <div className="text-white">RestaurantOS</div>
              <div className="text-white/60 text-xs">Hệ thống quản lý</div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-white/10 rounded transition-colors"
          >
            {sidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            const hasSubItems = 'subItems' in item && item.subItems;
            const isExpanded = expandedMenu === item.id;

            return (
              <div key={item.id} className="mb-2">
                {/* Menu chính */}
                <button
                  onClick={() => handleMenuClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {hasSubItems && (
                        <ChevronRight
                          size={16}
                          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      )}
                    </>
                  )}
                </button>

                {/* Sub-menu (Accordion) - PHẦN ĐÃ SỬA */}
                {hasSubItems && isExpanded && !sidebarCollapsed && (
                  <div className="mt-1 space-y-1 ml-6 border-l border-white/20">
                    {item.subItems!.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = currentSubModule === subItem.id;

                      return (
                        <button
                          key={subItem.id}
                          onClick={() => handleSubMenuClick(item.id, subItem.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-r-lg text-sm transition-all ${
                            isSubActive
                              ? 'bg-white/20 text-white font-medium'
                              : 'text-white/60 hover:bg-white/10 hover:text-white/90'
                          }`}
                        >
                          <SubIcon size={16} />
                          <span>{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        
        {/* Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <span>{getUserInitials()}</span>
              </div>
              <div className="flex-1">
                <div className="text-sm">{user?.ten_nhan_vien || 'Người dùng'}</div>
                <div className="text-xs text-white/60">{user?.chuc_vu || 'Nhân viên'}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          {/* Empty space for layout balance */}
          <div className="flex-1"></div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-alert rounded-full"></span>
              </button>
              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-elevated border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b">
                    <div className="font-medium">Thông báo</div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b">
                      <div className="text-sm">Bàn B3: Vượt thời gian 90 phút</div>
                      <div className="text-xs text-text-secondary">5 phút trước</div>
                    </div>
                    <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                      <div className="text-sm">Bàn C2: Phát hiện bàn ma</div>
                      <div className="text-xs text-text-secondary">10 phút trước</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-sm">
                  {getUserInitials()}
                </div>
                <ChevronDown size={16} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-elevated border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b">
                    <div className="font-medium">{user?.ten_nhan_vien}</div>
                    <div className="text-sm text-gray-500">{user?.chuc_vu}</div>
                    <div className="text-xs text-gray-400 mt-1">{user?.so_dien_thoai}</div>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}