import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/features/auth/pages/LoginPage';
import AdminLayout from '@/components/layout/AdminLayout';
import OrderListPage from '@/features/orders/pages/OrderListPage';
import UserListPage from '@/features/users/pages/UserListPage';
import ChannelListPage from '@/features/channels/pages/ChannelListPage';
import StatisticsPage from '@/features/statistics/pages/StatisticsPage';
import { useAuth } from '@/hooks/useAuth';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">로딩중...</div>;
  // TODO: Add admin role check loop here
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<div className="p-8 text-gray-500">대시보드 준비중...</div>} />
          <Route path="users" element={<UserListPage />} />
          <Route path="orders" element={<OrderListPage />} />
          <Route path="channels" element={<ChannelListPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;