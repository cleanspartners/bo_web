import { useState, useEffect } from "react";
import client from "@/lib/directus";
import { readMe, login as sdkLogin } from "@directus/sdk"; // login renamed to sdkLogin to avoid conflict

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("directus_storage_token"); // Or however sdk handles it? 
        // Actually Directus SDK handles storage automatically if configured.
        // We just check if we can get a token or readMe.
        checkAuth();
    }, []);

    const logout = async () => {
        try {
            await client.logout();
        } catch (e) {
            // console.warn("Logout failed (likely no refresh token):", e);
            // 서버 로그아웃 실패해도 클라이언트 상태는 초기화
        }
        setIsAuthenticated(false);
        setUser(null);
    };

    async function checkAuth() {
        try {
            const token = await client.getToken();
            if (token) {
                const userData = await client.request(readMe({
                    fields: ['id', 'email', 'first_name', 'last_name', 'title', 'role.*']
                }));

                // 📍 관리자 권한 체크 (bo_web 전용)
                // 'Administrator' 또는 '관리자' (한글) 허용
                const roleName = userData?.role?.name;
                if (roleName !== 'Administrator' && roleName !== '관리자') {
                    throw new Error("관리자 권한이 없습니다.");
                }

                setUser(userData);
                setIsAuthenticated(true);
            }
        } catch (e) {
            // console.warn("Not authenticated or token invalid", e);
            setIsAuthenticated(false);
            setUser(null);

            // 관리자 권한 없음 에러는 로그아웃 처리하여 토큰 등 정리
            if (e.message === "관리자 권한이 없습니다.") {
                await logout();
            }
        } finally {
            setLoading(false);
        }
    }

    const login = async (email, password) => {
        // mode: 'json'을 빼고 기본값(localStorage)을 사용해야 SDK의 autoRefresh가 정상 작동함 [cite: 2026-03-08]
        const result = await client.request(sdkLogin(email, password));

        // 로그인 후 권한 체크를 포함한 사용자 정보 로드
        await checkAuth();

        // checkAuth에서 실패하여 isAuthenticated가 false라면 에러 던짐
        const token = await client.getToken();
        if (!token) {
            throw new Error("관리자 권한이 없어 로그인이 거부되었습니다.");
        }
    };

    return { isAuthenticated, user, loading, login, logout };
}
