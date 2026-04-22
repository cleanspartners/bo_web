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
  // 📍 자동 새로고침(캐시 버스팅) 로직
  // __APP_VERSION__: 빌드 시점에 자동 생성되는 타임스탬프 (vite.config.js에서 define)
  // version.json: 빌드 시 dist에 같은 값으로 자동 생성
  // → 다음 배포 시 구 클라이언트의 __APP_VERSION__ ≠ 새 version.json → reload 발동
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) return;

        const data = await response.json();
        const serverVersion = String(data.version);
        const clientVersion = String(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');

        // dev 모드에서는 체크하지 않음
        if (clientVersion === 'dev') return;

        if (serverVersion !== clientVersion) {
          // 무한 루프 방지: 현재 세션에서 최대 3번까지만 시도
          const reloadCount = Number(sessionStorage.getItem("__reload_count__") || 0);
          if (reloadCount < 3) {
            sessionStorage.setItem("__reload_count__", String(reloadCount + 1));
            window.location.reload();
          }
        } else {
          // 버전이 일치하면 카운트 초기화
          sessionStorage.removeItem("__reload_count__");
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