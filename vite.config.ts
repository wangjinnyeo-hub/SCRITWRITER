import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vercel: commonjs 플러그인이 /vercel/path0/node_modules를 보지 못하므로,
// core-js/* 를 현재 작업 디렉터리(script-writer-web)의 node_modules로 강제 해석하는 플러그인
function coreJsResolver() {
  return {
    name: 'core-js-resolver',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === 'core-js' || id.startsWith('core-js/')) {
        const resolved = path.resolve(process.cwd(), 'node_modules', id)
        return resolved
      }
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [coreJsResolver(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/core'),
      'core-js': path.resolve(process.cwd(), 'node_modules/core-js'),
    },
    preserveSymlinks: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['canvg', 'core-js'],
  },
})
