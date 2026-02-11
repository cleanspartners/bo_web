import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [react()],
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
