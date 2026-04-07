import { createDirectus, rest, authentication } from '@directus/sdk';

// 📍 로컬이면 프록시(http://localhost:3001/api), 서버면 실제 도메인 사용
const API_URL = import.meta.env.DEV
    ? 'http://localhost:3001/api' // Directus SDK는 절대 경로 URL을 필요로 함
    : 'https://api.cleanspartners.com';

// 📍 로컬 스토리지 어댑터 구현 (세션 유지용)
const authStorage = {
    get: async () => {
        const data = localStorage.getItem('directus_auth');
        return data ? JSON.parse(data) : null;
    },
    set: async (value) => {
        if (value === null) {
            localStorage.removeItem('directus_auth');
        } else {
            localStorage.setItem('directus_auth', JSON.stringify(value));
        }
    },
};

const client = createDirectus(API_URL)
    .with(rest())
    .with(authentication('json', { 
        storage: authStorage,
        autoRefresh: true 
    }));

export default client;