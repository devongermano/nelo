import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig(async () => {
  const UnpluginTypia = (await import('@ryoppippi/unplugin-typia/vite')).default;
  
  return {
    plugins: [
      UnpluginTypia({
        tsconfig: './tsconfig.json'
      }),
    ],
    test: {
      globals: true,
      environment: 'node',
      setupFiles: ['./test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };
});