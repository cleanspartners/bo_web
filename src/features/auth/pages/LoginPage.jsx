import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '@/lib/directus';
import { login, readMe } from '@directus/sdk'; // 📍 누락되었던 login 추가
import { Button } from '@/components/ui/button';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberEmail, setRememberEmail] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const savedEmail = localStorage.getItem('saved_admin_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberEmail(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // po_web에서 검증된 방식 사용
            const result = await client.request(login({
                email,
                password,
                mode: 'json'
            }));

            console.log("Login Result:", result); // 디버깅용 로그

            // 액세스 토큰 수동 설정
            if (result.access_token) {
                await client.setToken(result.access_token);
            } else {
                console.error("Access token not found in result:", result);
                throw new Error("Login failed: No access token received");
            }

            // 관리자 권한 체크
            const userData = await client.request(readMe({
                fields: ['role.name']
            }));

            console.log("User Data:", userData); // 디버깅용 로그

            // Role 이름 확인 (DB의 Administrator 역할 이름과 일치해야 함)
            // 'Administrator' 또는 '관리자' (한글) 허용
            const roleName = userData?.role?.name;
            if (roleName !== 'Administrator' && roleName !== '관리자') {
                // 로그아웃 시도 (Refresh Token이 없어 실패할 수 있으므로 try-catch로 감쌈)
                try {
                    await client.logout();
                } catch (e) {
                    console.warn("Logout failed (likely no refresh token), continuing:", e);
                }
                throw new Error("관리자 권한이 없습니다.");
            }

            if (rememberEmail) {
                localStorage.setItem('saved_admin_email', email);
            } else {
                localStorage.removeItem('saved_admin_email');
            }

            navigate('/');

        } catch (err) {
            console.error("Login Error Details:", err);

            if (err.message === "관리자 권한이 없습니다.") {
                setError("관리자 권한이 없는 계정입니다.");
            } else {
                setError('이메일 또는 비밀번호를 확인해주세요.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">
                <div className="text-center mb-10">
                    <img src="/cleans2.jpg" alt="Cleans Partners BO" className="mx-auto h-16 w-auto mb-4" />
                    <p className="text-sm text-gray-400 mt-1">클린즈 파트너스 관리자 전용</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">이메일</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2 ml-1">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between py-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={rememberEmail}
                                onChange={(e) => setRememberEmail(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">이메일 기억하기</span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm text-center font-medium">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full py-7 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98]"
                    >
                        {loading ? '인증 진행 중...' : '관리자 로그인'}
                    </Button>
                </form>
            </div>
        </div>
    );
}