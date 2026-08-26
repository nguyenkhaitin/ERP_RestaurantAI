import { useState } from 'react';
import { Phone, Lock, LogIn, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: UserInfo) => void;
}

export interface UserInfo {
  id: number;
  ten_nhan_vien: string;
  chuc_vu: string;
  so_dien_thoai: string;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      });

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error('Không thể kết nối với server. Vui lòng kiểm tra backend đang chạy.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng nhập thất bại');
      }

      if (data.success && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden flex items-center justify-center font-sans select-none">
      
      {/* 🌟 ẢNH NỀN LẤY TỪ THƯ MỤC PUBLIC */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center filter brightness-90 scale-105"
        style={{ backgroundImage: "url('/restaurant-background.png')" }}
      ></div>

      {/* Lớp phủ mờ tối giúp làm nổi bật khung đăng nhập ở giữa */}
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"></div>

      {/* 🌟 KHUNG ĐĂNG NHẬP CHÍNH */}
      <div className="relative z-10 w-full max-w-md p-4">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100">
          
          {/* Header - Màu xanh #1c2a46 */}
          <div className="px-6 py-10 text-center" style={{ backgroundColor: '#1c2a46' }}>
            <div>
              <div className="text-4xl font-bold text-white mb-1">ROS</div>
              <div className="text-lg text-white font-semibold">RestaurantOS</div>
              <div className="text-xs text-white mt-1 opacity-90">Hệ thống quản lý nhà hàng</div>
            </div>
          </div>

          {/* Form - Nền trắng */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {error && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                <span className="text-xs">{error}</span>
              </div>
            )}

            {/* Phone Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Số điện thoại
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <Phone size={18} />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all text-slate-900 text-sm"
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all text-slate-900 text-sm"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full disabled:bg-slate-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-sm mt-2"
              style={{ backgroundColor: loading ? undefined : '#1c2a46' }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Footer (Đã chuyển thành màu trắng tinh) */}
        <div className="text-center mt-4 text-white text-xs font-medium drop-shadow-md">
          © 2026 RestaurantOS - Hệ thống quản lý nhà hàng thông minh
        </div>
      </div>

    </div>
  );
}