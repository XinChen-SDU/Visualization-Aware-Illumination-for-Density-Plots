import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'

const pathSrc = fileURLToPath(new URL('./src', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Visualization-Aware-Illumination-for-Density-Plots/',
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue'],
      resolvers: [
        ElementPlusResolver(),

        // Auto import icon components
        IconsResolver({
          prefix: 'Icon',
        }),
      ],
      dts: path.resolve(pathSrc, 'auto-imports.d.ts'),
    }),
    Components({
      resolvers: [
        ElementPlusResolver(),

        // Auto register icon components
        IconsResolver({
          enabledCollections: ['ep'],
        }),
      ],
      dts: path.resolve(pathSrc, 'components.d.ts'),
    }),
    Icons({
      autoInstall: true,
    }),
  ],
  resolve: {
    alias: {
      '@': pathSrc,
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8081
  },
  preview: {
    port: 8711,
  },
  build: {
    rollupOptions: {
      external: ['mathjs'],
      output: {
        globals: {
          'mathjs': 'math'
        }
      }
    }
  }
})
