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
    
    // Validation
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
      // API được proxy qua Vite dev server
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      });

      let data;
      const contentType = response.headers.get('content-type');
      
      // Check if response is JSON
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, try to read as text and show error
        const text = await response.text();
        throw new Error('Không thể kết nối với server. Vui lòng kiểm tra backend đang chạy.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng nhập thất bại');
      }

      if (data.success && data.user) {
        // Lưu thông tin user vào localStorage
        localStorage.setItem('user', JSON.stringify(data.user));
        // Gọi callback để chuyển sang giao diện chính
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Header - Màu xanh #1c2a46 */}
          <div className="px-8 py-12 text-center" style={{ backgroundColor: '#1c2a46' }}>
            <div className="mb-4">
              <div className="text-5xl font-bold text-white mb-2">ROS</div>
              <div className="text-xl text-white font-semibold">RestaurantOS</div>
              <div className="text-sm text-white mt-2">Hệ thống quản lý nhà hàng</div>
            </div>
          </div>

          {/* Form - Nền trắng */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Phone Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Số điện thoại
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Phone size={20} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              style={{ backgroundColor: loading ? undefined : '#1c2a46' }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#243555')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1c2a46')}
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>
        </div>
        {/* Footer */}
        <div className="text-center mt-6 text-slate-600 text-sm">
          © 2026 RestaurantOS - Hệ thống quản lý nhà hàng thông minh
        </div>
      </div>
    </div>
  );
}
