import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_DIR = path.resolve(import.meta.dirname, 'assets');
const MEDIA_PREFIX = '/media/';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Serves the gitignored `assets/` folder at `/media/` in dev and copies it
 * into the build output, so downloaded images never end up in git.
 */
function localMedia(): Plugin {
  let outDir = 'dist';
  return {
    name: 'local-media',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(MEDIA_PREFIX)) return next();
        const rel = decodeURIComponent(req.url.slice(MEDIA_PREFIX.length).split('?')[0]);
        const file = path.resolve(MEDIA_DIR, rel);
        if (!file.startsWith(MEDIA_DIR) || !fs.existsSync(file)) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (fs.existsSync(MEDIA_DIR)) {
        fs.cpSync(MEDIA_DIR, path.join(outDir, 'media'), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), localMedia()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
