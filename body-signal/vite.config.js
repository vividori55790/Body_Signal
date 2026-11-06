import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Body Signal',
        short_name: 'Body Signal',
        description: 'Track your body signals and pain levels efficiently.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ],
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        shortcuts: [
          {
            name: "1초 급성 통증 기록",
            short_name: "긴급 통증",
            description: "아플 때 1초 만에 바로 기록합니다",
            url: "/?mode=acute",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          },
          {
            name: "의료진 진료 브리핑",
            short_name: "진료 브리핑",
            description: "의사·간호사용 30초 진료 요약 및 EMR 복사",
            url: "/briefing",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          },
          {
            name: "빠른 복약 기록",
            short_name: "복약 기록",
            description: "약 복용 여부 및 효과 기록",
            url: "/entry",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          }
        ]
      }
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          dates: ['date-fns'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
