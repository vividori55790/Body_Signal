import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // Disable automatic SW registration script so Capacitor Android APK updates never serve stale cached chunks
      injectRegister: false,
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
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        shortcuts: [
          {
            name: "1-Sec Acute Pain Log",
            short_name: "Acute Pain",
            description: "Capture severe pain in 1 second when discomfort strikes",
            url: "./?mode=acute",
            icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          },
          // In Development (scheduled for v4.0.0): Clinical Briefing shortcut paused
          // {
          //   name: "Doctor Clinical Briefing",
          //   short_name: "Clinical View",
          //   description: "30-second consultation summary and EMR copy",
          //   url: "./briefing",
          //   icons: [{ src: "pwa-icon.svg", sizes: "192x192" }]
          // },
          {
            name: "Quick Medication Log",
            short_name: "Log Meds",
            description: "Record medication intake and effectiveness",
            url: "./entry",
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
