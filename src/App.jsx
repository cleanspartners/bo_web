import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/features/auth/pages/LoginPage';
import AdminLayout from '@/components/layout/AdminLayout';
import OrderListPage from '@/features/orders/pages/OrderListPage';
import UserListPage from '@/features/users/pages/UserListPage';
import ChannelListPage from '@/features/channels/pages/ChannelListPage';
import StatisticsPage from '@/features/statistics/pages/StatisticsPage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import RequestListPage from '@/features/requests/pages/RequestListPage';
import { useAuth } from '@/hooks/useAuth';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">로딩중...</div>;
  // TODO: Add admin role check loop here
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

function App() {
  // 📍 자동 새로고침(캐시 버스팅) 로직 (개선: 외부 version.json 체크 방식)
  useEffect(() => {
    const checkVersion = async () => {
      try {
        // 캐시를 방지하기 위해 타임스탬프를 쿼리 파라미터로 붙임
        const response = await fetch(`/version.json?t=${Date.now()}`);
        
        // 서버에서 JSON이 아닌 HTML(404 fallback 등)을 반환하는 경우 구성하지 않음
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) return;

        const data = await response.json();
        const latestVersion = String(data.version);
        const savedVersion = localStorage.getItem("__app_version__");

        if (savedVersion && savedVersion !== latestVersion) {
          localStorage.setItem("__app_version__", latestVersion);
          window.location.reload(true);
        } else if (!savedVersion) {
          localStorage.setItem("__app_version__", latestVersion);
        }
      } catch (error) {
        console.warn("Version check failed:", error);
      }
    };

    checkVersion();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UserListPage />} />
          <Route path="orders" element={<OrderListPage />} />
          <Route path="channels" element={<ChannelListPage />} />
          <Route path="requests" element={<RequestListPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;