import { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Login, UserInfo } from "./components/Login";
import { FloorOperations } from "./components/modules/FloorOperations";
import { Analytics } from "./components/modules/Analytics";
import { HRManagement } from "./components/modules/HRManagement";
import { AIConfiguration } from "./components/modules/AIConfiguration";
import AIChatDrawer from "./components/modules/AIChatDrawer";

export default function App() {
  const [currentModule, setCurrentModule] = useState("hr");
  const [currentSubModule, setCurrentSubModule] = useState("dashboard");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Kiểm tra trạng thái đăng nhập khi khởi động
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (userInfo: UserInfo) => {
    setUser(userInfo);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const renderModule = () => {
    switch (currentModule) {
      case "floor":
        return <FloorOperations activeSubModule={currentSubModule} />;
      case "analytics":
        return <Analytics />;
      case "hr":
        return <HRManagement activeSubModule={currentSubModule} />;
      case "ai":
        return <AIConfiguration />;
      default:
        return <FloorOperations activeSubModule={currentSubModule} />;
    }
  };

  // Hiển thị loading khi kiểm tra trạng thái đăng nhập
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Nếu chưa đăng nhập -> Hiển thị trang Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Đã đăng nhập -> Hiển thị giao diện chính
  return (
    <>
      <Layout
        currentModule={currentModule}
        onModuleChange={setCurrentModule}
        currentSubModule={currentSubModule}
        onSubModuleChange={setCurrentSubModule}
        user={user}
        onLogout={handleLogout}
      >
        {renderModule()}
      </Layout>
      
      {/* AI Chat Assistant - Floating Button + Drawer */}
      <AIChatDrawer />
    </>
  );
}