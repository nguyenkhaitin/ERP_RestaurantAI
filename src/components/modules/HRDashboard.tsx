/**
 * =============================================
 * HR DASHBOARD - Tổng quan Quản lý Nhân sự
 * =============================================
 */

import React, { useState, useMemo } from 'react';
import {
  Users, TrendingUp, TrendingDown, Clock, AlertCircle, DollarSign,
  Calendar, MapPin, ChevronDown, Award, Target, Activity
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// =============================================
// MOCK DATA - Dữ liệu giả lập theo cấu trúc DB
// =============================================

interface ChiNhanh {
  id: number;
  ten_chi_nhanh: string;
}

interface NhanVien {
  id: number;
  ho_ten: string;
  chuc_vu: string;
  so_dien_thoai: string;
  trang_thai: 'Đang làm việc' | 'Đã nghỉ';
  chi_nhanh_id: number;
  avatar: string;
}

interface ChamCong {
  nhan_vien_id: number;
  ngay: string;
  gio_vao: string;
  gio_ra: string;
  trang_thai_checkin: 'Đúng giờ' | 'Trễ' | 'Vắng';
}

interface BangLuong {
  nhan_vien_id: number;
  thang_nam: string;
  tong_thuc_nhan: number;
  so_cong: number;
}

// Mock Chi nhánh (CỐ ĐỊNH 3 chi nhánh theo yêu cầu)
const MOCK_CHI_NHANH: ChiNhanh[] = [
  { id: 1, ten_chi_nhanh: 'Chi nhánh Quận 1' },
  { id: 2, ten_chi_nhanh: 'Chi nhánh Quận 3' },
  { id: 3, ten_chi_nhanh: 'Chi nhánh Thủ Đức' },
];

// Mock Nhân viên (40 người chia đều 3 chi nhánh)
const MOCK_NHAN_VIEN: NhanVien[] = [
  // Chi nhánh Quận 1 (14 người)
  { id: 1, ho_ten: 'Nguyễn Văn An', chuc_vu: 'Quản lý', so_dien_thoai: '0901234567', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: 2, ho_ten: 'Trần Thị Bình', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234568', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=2' },
  { id: 3, ho_ten: 'Lê Minh Cường', chuc_vu: 'Bếp', so_dien_thoai: '0901234569', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=3' },
  { id: 4, ho_ten: 'Phạm Thu Dung', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234570', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=4' },
  { id: 5, ho_ten: 'Hoàng Văn Em', chuc_vu: 'Bếp', so_dien_thoai: '0901234571', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=5' },
  { id: 6, ho_ten: 'Đặng Thị Phương', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234572', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=6' },
  { id: 7, ho_ten: 'Vũ Minh Giang', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234573', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=7' },
  { id: 8, ho_ten: 'Bùi Văn Hùng', chuc_vu: 'Bếp', so_dien_thoai: '0901234574', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=8' },
  { id: 9, ho_ten: 'Ngô Thị Lan', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234575', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=9' },
  { id: 10, ho_ten: 'Trịnh Văn Khoa', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234576', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=10' },
  { id: 11, ho_ten: 'Lý Thị Mai', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234577', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=11' },
  { id: 12, ho_ten: 'Phan Văn Nam', chuc_vu: 'Bếp', so_dien_thoai: '0901234578', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=12' },
  { id: 13, ho_ten: 'Võ Thị Oanh', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234579', trang_thai: 'Đã nghỉ', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=13' },
  { id: 14, ho_ten: 'Đinh Văn Phú', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234580', trang_thai: 'Đang làm việc', chi_nhanh_id: 1, avatar: 'https://i.pravatar.cc/150?img=14' },
  
  // Chi nhánh Quận 3 (13 người)
  { id: 15, ho_ten: 'Hồ Thị Quỳnh', chuc_vu: 'Quản lý', so_dien_thoai: '0901234581', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=15' },
  { id: 16, ho_ten: 'Mai Văn Sơn', chuc_vu: 'Bếp', so_dien_thoai: '0901234582', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=16' },
  { id: 17, ho_ten: 'Tô Thị Thảo', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234583', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=17' },
  { id: 18, ho_ten: 'Đỗ Văn Tùng', chuc_vu: 'Bếp', so_dien_thoai: '0901234584', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=18' },
  { id: 19, ho_ten: 'Cao Thị Uyên', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234585', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=19' },
  { id: 20, ho_ten: 'Lưu Văn Vinh', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234586', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=20' },
  { id: 21, ho_ten: 'Dương Thị Xuân', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234587', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=21' },
  { id: 22, ho_ten: 'Trương Văn Yên', chuc_vu: 'Bếp', so_dien_thoai: '0901234588', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=22' },
  { id: 23, ho_ten: 'Lâm Thị Ánh', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234589', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=23' },
  { id: 24, ho_ten: 'Huỳnh Văn Bảo', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234590', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=24' },
  { id: 25, ho_ten: 'Nguyễn Thị Chi', chuc_vu: 'Bếp', so_dien_thoai: '0901234591', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=25' },
  { id: 26, ho_ten: 'Phan Văn Đức', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234592', trang_thai: 'Đã nghỉ', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=26' },
  { id: 27, ho_ten: 'Lê Thị Hoa', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234593', trang_thai: 'Đang làm việc', chi_nhanh_id: 2, avatar: 'https://i.pravatar.cc/150?img=27' },
  
  // Chi nhánh Thủ Đức (13 người)
  { id: 28, ho_ten: 'Võ Văn Khánh', chuc_vu: 'Quản lý', so_dien_thoai: '0901234594', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=28' },
  { id: 29, ho_ten: 'Đặng Thị Linh', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234595', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=29' },
  { id: 30, ho_ten: 'Trần Văn Minh', chuc_vu: 'Bếp', so_dien_thoai: '0901234596', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=30' },
  { id: 31, ho_ten: 'Nguyễn Thị Ngọc', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234597', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=31' },
  { id: 32, ho_ten: 'Phạm Văn Oanh', chuc_vu: 'Bếp', so_dien_thoai: '0901234598', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=32' },
  { id: 33, ho_ten: 'Lê Thị Phương', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234599', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=33' },
  { id: 34, ho_ten: 'Hoàng Văn Quang', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234600', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=34' },
  { id: 35, ho_ten: 'Bùi Thị Rất', chuc_vu: 'Bếp', so_dien_thoai: '0901234601', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=35' },
  { id: 36, ho_ten: 'Vũ Văn Sáng', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234602', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=36' },
  { id: 37, ho_ten: 'Ngô Thị Tâm', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234603', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=37' },
  { id: 38, ho_ten: 'Trịnh Văn Út', chuc_vu: 'Bếp', so_dien_thoai: '0901234604', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=38' },
  { id: 39, ho_ten: 'Lý Thị Vân', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234605', trang_thai: 'Đã nghỉ', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=39' },
  { id: 40, ho_ten: 'Mai Văn Xuân', chuc_vu: 'Phục vụ', so_dien_thoai: '0901234606', trang_thai: 'Đang làm việc', chi_nhanh_id: 3, avatar: 'https://i.pravatar.cc/150?img=40' },
];

// Generate Mock Chấm công cho tháng hiện tại (Tỷ lệ trễ thấp ~10%)
const generateMockChamCong = (): ChamCong[] => {
  const data: ChamCong[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  MOCK_NHAN_VIEN.forEach(nv => {
    if (nv.trang_thai === 'Đã nghỉ') return;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (date > now) continue; // Chỉ tạo data cho các ngày đã qua
      
      const random = Math.random();
      let trang_thai: 'Đúng giờ' | 'Trễ' | 'Vắng';
      
      // Tỷ lệ: Đúng giờ 85%, Trễ 10%, Vắng 5%
      if (random < 0.05) trang_thai = 'Vắng';
      else if (random < 0.15) trang_thai = 'Trễ';
      else trang_thai = 'Đúng giờ';

      data.push({
        nhan_vien_id: nv.id,
        ngay: date.toISOString().split('T')[0],
        gio_vao: trang_thai === 'Vắng' ? '' : '08:00',
        gio_ra: trang_thai === 'Vắng' ? '' : '17:30',
        trang_thai_checkin: trang_thai,
      });
    }
  });

  return data;
};

// Generate Mock Bảng lương (Lương 6tr - 25tr VND)
const generateMockBangLuong = (): BangLuong[] => {
  const now = new Date();
  const thang_nam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  return MOCK_NHAN_VIEN.filter(nv => nv.trang_thai === 'Đang làm việc').map(nv => {
    const so_cong = Math.floor(Math.random() * 5) + 20; // 20-25 ngày công
    let base_salary = 7000000; // Default cho Phục vụ
    
    if (nv.chuc_vu === 'Quản lý') base_salary = 20000000;
    else if (nv.chuc_vu === 'Bếp') base_salary = 12000000;
    else if (nv.chuc_vu === 'Phục vụ') base_salary = 7000000;
    
    // Thêm biến động ±2tr
    const variation = Math.floor(Math.random() * 4000000) - 2000000;
    const tong_thuc_nhan = Math.max(6000000, Math.min(25000000, base_salary + variation));
    
    return {
      nhan_vien_id: nv.id,
      thang_nam,
      tong_thuc_nhan,
      so_cong,
    };
  });
};

const MOCK_CHAM_CONG = generateMockChamCong();
const MOCK_BANG_LUONG = generateMockBangLuong();

// =============================================
// HELPER FUNCTIONS
// =============================================

const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}tỷ`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}tr`;
  return value.toLocaleString('vi-VN');
};

// =============================================
// SUB-COMPONENTS
// =============================================

interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, color }) => {
  const isPositive = change >= 0;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {Math.abs(change)}%
        </div>
      </div>
      <h3 className="text-slate-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================

export function HRDashboard() {
  const [selectedBranch, setSelectedBranch] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Filter data based on selection
  const filteredNhanVien = useMemo(() => {
    return MOCK_NHAN_VIEN.filter(nv => 
      selectedBranch === 'all' || nv.chi_nhanh_id === selectedBranch
    );
  }, [selectedBranch]);

  const filteredChamCong = useMemo(() => {
    const nhanVienIds = filteredNhanVien.map(nv => nv.id);
    return MOCK_CHAM_CONG.filter(cc => nhanVienIds.includes(cc.nhan_vien_id));
  }, [filteredNhanVien]);

  const filteredBangLuong = useMemo(() => {
    const nhanVienIds = filteredNhanVien.map(nv => nv.id);
    return MOCK_BANG_LUONG.filter(bl => nhanVienIds.includes(bl.nhan_vien_id));
  }, [filteredNhanVien]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const activeStaff = filteredNhanVien.filter(nv => nv.trang_thai === 'Đang làm việc').length;
    
    // Tỷ lệ đi làm hôm nay
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = filteredChamCong.filter(cc => cc.ngay === today);
    const presentToday = todayRecords.filter(cc => cc.trang_thai_checkin !== 'Vắng').length;
    const attendanceRate = todayRecords.length > 0 ? Math.round((presentToday / todayRecords.length) * 100) : 0;

    // Nhân sự đi trễ (trong tháng)
    const lateRecords = filteredChamCong.filter(cc => cc.trang_thai_checkin === 'Trễ');
    const lateCount = lateRecords.length;

    // Quỹ lương
    const totalSalary = filteredBangLuong.reduce((sum, bl) => sum + bl.tong_thuc_nhan, 0);

    return {
      totalStaff: activeStaff,
      attendanceRate,
      lateCount,
      totalSalary,
    };
  }, [filteredNhanVien, filteredChamCong, filteredBangLuong]);

  // Chart data - Attendance trend (last 7 days)
  const attendanceTrendData = useMemo(() => {
    const data: any[] = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayRecords = filteredChamCong.filter(cc => cc.ngay === dateStr);
      const onTime = dayRecords.filter(cc => cc.trang_thai_checkin === 'Đúng giờ').length;
      const late = dayRecords.filter(cc => cc.trang_thai_checkin === 'Trễ').length;
      const absent = dayRecords.filter(cc => cc.trang_thai_checkin === 'Vắng').length;
      
      data.push({
        date: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        'Đúng giờ': onTime,
        'Trễ': late,
        'Vắng': absent,
      });
    }
    
    return data;
  }, [filteredChamCong]);

  // Chart data - Staff distribution by role OR by branch
  const distributionData = useMemo(() => {
    if (selectedBranch === 'all') {
      // Phân bổ ngân sách lương theo Chi nhánh
      const branchSalary: { [key: number]: number } = {};
      
      filteredBangLuong.forEach(bl => {
        const nv = MOCK_NHAN_VIEN.find(n => n.id === bl.nhan_vien_id);
        if (nv) {
          branchSalary[nv.chi_nhanh_id] = (branchSalary[nv.chi_nhanh_id] || 0) + bl.tong_thuc_nhan;
        }
      });
      
      return MOCK_CHI_NHANH.map(cn => ({
        name: cn.ten_chi_nhanh,
        value: branchSalary[cn.id] || 0,
      })).filter(item => item.value > 0);
    } else {
      // Phân bổ ngân sách lương theo Chức vụ (khi đã chọn chi nhánh)
      const roleCount: { [key: string]: number } = {};
      
      filteredBangLuong.forEach(bl => {
        const nv = filteredNhanVien.find(n => n.id === bl.nhan_vien_id);
        if (nv && nv.trang_thai === 'Đang làm việc') {
          roleCount[nv.chuc_vu] = (roleCount[nv.chuc_vu] || 0) + bl.tong_thuc_nhan;
        }
      });
      
      return Object.entries(roleCount).map(([name, value]) => ({ name, value }));
    }
  }, [filteredNhanVien, filteredBangLuong, selectedBranch]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

  // Top performers - Top 5 nhân viên có lương cao nhất
  const topPerformers = useMemo(() => {
    return filteredNhanVien
      .filter(nv => nv.trang_thai === 'Đang làm việc')
      .map(nv => {
        const bangLuong = filteredBangLuong.find(bl => bl.nhan_vien_id === nv.id);
        const chiNhanh = MOCK_CHI_NHANH.find(cn => cn.id === nv.chi_nhanh_id);
        
        return {
          ...nv,
          tong_thuc_nhan: bangLuong?.tong_thuc_nhan || 0,
          so_cong: bangLuong?.so_cong || 0,
          ten_chi_nhanh: chiNhanh?.ten_chi_nhanh || 'N/A',
        };
      })
      .sort((a, b) => b.tong_thuc_nhan - a.tong_thuc_nhan)
      .slice(0, 5);
  }, [filteredNhanVien, filteredBangLuong]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-full">
      {/* ==================== HEADER & FILTERS ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-indigo-600" />
            HR Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng quan quản lý nhân sự và chấm công
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Branch Filter */}
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <MapPin className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {selectedBranch === 'all' 
                  ? 'Tất cả chi nhánh' 
                  : MOCK_CHI_NHANH.find(cn => cn.id === selectedBranch)?.ten_chi_nhanh}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {showBranchDropdown && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[200px] z-10">
                <button
                  onClick={() => {
                    setSelectedBranch('all');
                    setShowBranchDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                >
                  Tất cả chi nhánh
                </button>
                {MOCK_CHI_NHANH.map(cn => (
                  <button
                    key={cn.id}
                    onClick={() => {
                      setSelectedBranch(cn.id);
                      setShowBranchDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                  >
                    {cn.ten_chi_nhanh}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Month/Year Filter */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">
              Tháng {selectedMonth}/{selectedYear}
            </span>
          </div>
        </div>
      </div>

      {/* ==================== KPI CARDS ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Tổng nhân sự"
          value={kpis.totalStaff}
          change={5.2}
          icon={<Users className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <KPICard
          title="Tỷ lệ đi làm hôm nay"
          value={`${kpis.attendanceRate}%`}
          change={2.8}
          icon={<Target className="w-6 h-6 text-green-600" />}
          color="bg-green-50"
        />
        <KPICard
          title="Số người đi trễ (tháng)"
          value={kpis.lateCount}
          change={-1.5}
          icon={<AlertCircle className="w-6 h-6 text-orange-600" />}
          color="bg-orange-50"
        />
        <KPICard
          title="Tổng quỹ lương"
          value={`${formatCurrency(kpis.totalSalary)}đ`}
          change={3.2}
          icon={<DollarSign className="w-6 h-6 text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      {/* ==================== CHARTS AREA ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart - Attendance Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Xu hướng chấm công (7 ngày gần nhất)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#64748B" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748B" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Đúng giờ" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Trễ" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Vắng" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Salary Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            {selectedBranch === 'all' ? 'Ngân sách lương theo Chi nhánh' : 'Ngân sách lương theo Chức vụ'}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}đ`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => `${formatCurrency(value)}đ`}
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ==================== STAFF TABLE ==================== */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Top 5 nhân viên lương cao nhất
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nhân viên
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Chức vụ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Chi nhánh
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tổng lương thực nhận
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {topPerformers.map((nv, index) => (
                <tr key={nv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img 
                        src={nv.avatar} 
                        alt={nv.ho_ten}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{nv.ho_ten}</div>
                        <div className="text-sm text-slate-500">{nv.so_dien_thoai}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {nv.chuc_vu}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {nv.ten_chi_nhanh}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="font-bold text-lg text-slate-900">
                      {formatCurrency(nv.tong_thuc_nhan)}đ
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      nv.trang_thai === 'Đang làm việc' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {nv.trang_thai}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HRDashboard;
