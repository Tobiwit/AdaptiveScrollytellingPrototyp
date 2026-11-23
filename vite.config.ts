import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const MEDIA_DIR = path.resolve(import.meta.dirname, 'assets');
const MEDIA_PREFIX = '/media/';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// assets/ is gitignored: serve it at /media/ in dev and copy it into the build
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

function buildId() {
  const { version } = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'));
  let sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  try {
    sha ??= execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    sha = 'unknown';
  }
  return `${version}+${sha}`;
}

export default defineConfig({
  plugins: [react(), localMedia()],
  define: { __BUILD__: JSON.stringify(buildId()) },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
