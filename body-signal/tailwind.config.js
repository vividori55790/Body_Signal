/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#f8fafc',       // Slate 50 (Clinical Background)
        surface: '#ffffff',  // White (Card Surface)
        primary: '#334155',  // Slate 700 (Primary Text/UI)
        secondary: '#64748b',// Slate 500 (Secondary Text)
        border: '#e2e8f0',   // Slate 200 (Borders)
        
        // Semantic Medical Colors
        improved: '#10b981', // Emerald 500 (Better)
        worsened: '#f43f5e', // Rose 500 (Worse)
        stable: '#cbd5e1',   // Slate 300 (No Change)
        
        pain: {
            low: '#fcd34d',   // Amber 300
            high: '#f43f5e',  // Rose 500
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}