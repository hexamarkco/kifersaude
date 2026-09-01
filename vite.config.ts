import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import path from 'node:path';
import { indexablePublicRoutes } from './scripts/seo-routes.mjs';

const deploymentEnvironment = process.env.VERCEL_ENV ?? 'development';
const FALLBACK_SITE_URL = 'https://www.kifersaude.com.br';

function normalizeSiteUrl(value: string | undefined) {
  try {
    return new URL(value || FALLBACK_SITE_URL).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

function seoDiscoveryAssets(siteUrl: string, indexable: boolean): Plugin {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable ? indexablePublicRoutes.map((route) => `  <url>\n    <loc>${new URL(route, `${siteUrl}/`).toString()}</loc>\n  </url>`).join('\n') : ''}\n</urlset>\n`;
  const robots = indexable
    ? `User-agent: *\nAllow: /\nDisallow: /painel/\nDisallow: /login\nDisallow: /chat\nDisallow: /design-system\nDisallow: /forms/\nDisallow: /links\nDisallow: /api-docs.html\n\nSitemap: ${siteUrl}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';

  return {
    name: 'kifer-seo-discovery-assets',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

function getPackageName(id: string): string | null {
  const normalizedId = id.replace(/\\/g, '/');
  const nodeModulesPath = normalizedId.split('/node_modules/')[1];

  if (!nodeModulesPath) {
    return null;
  }

  const parts = nodeModulesPath.split('/');
  if (parts[0].startsWith('@') && parts.length > 1) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL);
  const indexable =
    env.VITE_SITE_INDEXABLE !== 'false' &&
    (deploymentEnvironment === 'production' || env.VITE_SITE_INDEXABLE === 'true');

  return {
  define: {
    __KIFER_DEPLOYMENT_ENV__: JSON.stringify(deploymentEnvironment),
  },
  plugins: [react(), seoDiscoveryAssets(siteUrl, indexable)],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkg = getPackageName(id);

          if (!pkg) {
            return undefined;
          }

          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router-dom' || pkg === 'react-helmet') {
            return 'vendor';
          }

          if (pkg === 'lucide-react') {
            return 'icons';
          }

          if (pkg === '@supabase/supabase-js') {
            return 'supabase';
          }

          if (pkg === 'react-quill' || pkg === 'quill') {
            return 'vendor';
          }

          if (pkg === 'reactflow' || pkg.startsWith('d3-')) {
            return 'flow';
          }

          if (pkg === 'jspdf' || pkg === 'html-to-image') {
            return 'export';
          }

          if (pkg === 'gsap') {
            return 'animation';
          }

          if (pkg === 'dompurify' || pkg === 'date-fns') {
            return 'utils';
          }

          return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      '@testing-library/react': path.resolve(__dirname, 'src/testing-library/react.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
};
});
