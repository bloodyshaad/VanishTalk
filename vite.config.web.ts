import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web-only Vite config (no Electron plugins)
// Used for Netlify deployment
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
})
