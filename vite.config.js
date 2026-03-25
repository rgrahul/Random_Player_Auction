import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/Random_Player_Auction/',
  plugins: [react(), tailwindcss()],
})
