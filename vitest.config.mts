import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Polyfill Map.groupBy for Node versions < 21 so Vitest error reporter formats failures cleanly
if (!('groupBy' in Map)) {
  // @ts-expect-error - Polyfill for Node.js < 21
  Map.groupBy = function (items: Iterable<any>, callback: (item: any) => any) {
    const map = new Map();
    for (const item of items) {
      const key = callback(item);
      const collection = map.get(key);
      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    }
    return map;
  };
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    server: {
      deps: {
        inline: ['next-intl'],
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next/server': require.resolve('next/server.js'),
    },
  },
});
