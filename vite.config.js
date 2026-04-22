import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import fs from "fs"

// 📍 빌드 시점 타임스탬프 (번들 + version.json에 동일 값 사용)
const buildVersion = Date.now();

// 📍 version.json 자동 생성 플러그인
// 빌드 완료 후 dist/version.json에 빌드 버전을 기록
// → 다음 배포 시 구 클라이언트가 버전 차이를 감지하여 자동 새로고침
function versionJsonPlugin() {
  return {
    name: 'version-json-plugin',
    closeBundle() {
      const distPath = path.resolve(__dirname, 'dist/version.json');
      fs.writeFileSync(distPath, JSON.stringify({ version: buildVersion }));
      console.log(`✅ version.json 자동 생성 완료: ${buildVersion}`);
    }
  };
}

export default defineConfig({
    plugins: [react(), versionJsonPlugin()],
    define: {
        // 빌드 시점의 타임스탬프를 상수로 주입 (개발 모드에서는 'dev' 고정)
        __APP_VERSION__: JSON.stringify(process.env.NODE_ENV === 'production' ? buildVersion : 'dev'),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 3001, // Different port from po_web
        proxy: {
            '/api': {
                target: 'https://api.cleanspartners.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            '/utils': {
                target: 'https://api.cleanspartners.com/utils',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/utils/, ''),
            },
        },
    },
})
