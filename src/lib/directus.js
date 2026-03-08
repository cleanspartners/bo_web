import { createDirectus, rest, authentication } from '@directus/sdk';

// 📍 로컬이면 프록시(http://localhost:3001/api), 서버면 실제 도메인 사용
const API_URL = import.meta.env.DEV
    ? 'http://localhost:3001/api' // Directus SDK는 절대 경로 URL을 필요로 함
    : 'https://api.cleanspartners.com';

const client = createDirectus(API_URL)
    .with(rest())
    .with(authentication('localStorage', { autoRefresh: true }));

export default client;