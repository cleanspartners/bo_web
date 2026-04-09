import { useState, useEffect } from "react";
import client from "@/lib/directus";
import { readMe, login as sdkLogin } from "@directus/sdk"; // login renamed to sdkLogin to avoid conflict

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 앱 초기 로드 시 세션 복구 시도
        checkAuth();
    }, []);

    const logout = async () => {
        try {
            await client.logout();
            // 명시적으로 스토리지 정리 (SDK가 처리하나 확실히 하기 위함)
            localStorage.removeItem('directus_auth');
        } catch (e) {
            console.warn("Logout failed:", e);
        }
        setIsAuthenticated(false);
        setUser(null);
    };

    async function checkAuth() {
        try {
            // SDK의 세션 정보가 있는지 먼저 가볍게 확인
            const token = await client.getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            // 토큰이 있다면 사용자 정보 요청 (만료 시 autoRefresh 작동)
            const userData = await client.request(readMe({
                fields: ['id', 'email', 'first_name', 'last_name', 'title', 'role.*']
            }));

            if (userData) {
                // 📍 관리자 권한 체크
                const roleName = userData?.role?.name;
                if (roleName !== 'Administrator' && roleName !== '관리자') {
                    throw new Error("관리자 권한이 없습니다.");
                }

                setUser(userData);
                setIsAuthenticated(true);
            }
        } catch (e) {
            console.error("Auth check failed:", e);
            setIsAuthenticated(false);
            setUser(null);

            if (e.message === "관리자 권한이 없습니다.") {
                await logout();
            }
        } finally {
            setLoading(false);
        }
    }

    const login = async (email, password) => {
        // SDK 표준 로그인 사용 (객체 형태로 전달)
        await client.login({ email, password });
        
        // 로그인 후 상태 업데이트를 위해 checkAuth 실행
        await checkAuth();

        if (!user) {
            throw new Error("사용자 정보를 불러오는데 실패했습니다.");
        }
    };

    return { isAuthenticated, user, loading, login, logout };
}
