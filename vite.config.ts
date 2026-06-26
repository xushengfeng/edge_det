import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src_ts/index.ts',
      formats: ['es'],
    },
  },
})
