import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),          // React plugin is essential!
    tailwindcss(),    // Your Tailwind plugin
  ],
})