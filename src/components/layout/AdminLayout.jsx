import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, Settings, LogOut, Menu, ChevronsLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Close sidebar on route change (mobile)
    const handleNavClick = () => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const handleLogout = async () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            await logout();
            navigate('/login');
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
                    md:static md:translate-x-0
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:overflow-hidden'}
                `}
            >
                <div className="p-6 border-b border-gray-100 whitespace-nowrap flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-blue-600">Cleans Partners</h1>
                        <p className="text-xs text-gray-400 mt-1">Back Office System</p>
                    </div>
                    {/* Desktop Toggle (only if needed inside, but usually outside is better) - Keeping for consistency if it was there */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-gray-600 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <ChevronsLeft className="h-5 w-5" />
                    </Button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <NavLink
                        to="/"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                        대시보드
                    </NavLink>

                    <NavLink
                        to="/orders"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                        주문 관리
                    </NavLink>
                    <NavLink
                        to="/users"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        <Users className="w-5 h-5 flex-shrink-0" />
                        사용자 관리
                    </NavLink>
                    <NavLink
                        to="/channels"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        <MessageSquare className="w-5 h-5 flex-shrink-0" />
                        채널 관리
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-gray-100 whitespace-nowrap">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        로그아웃
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
                <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="text-gray-500 hover:bg-gray-100"
                        >
                            <Menu className="w-6 h-6" />
                        </Button>
                        <h2 className="text-lg font-semibold text-gray-800">관리자 페이지</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold">
                            A
                        </div>
                        <span className="text-sm font-medium text-gray-700">관리자님</span>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
