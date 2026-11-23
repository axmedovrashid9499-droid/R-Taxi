import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build as viteBuild, defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLatestSourceMtime(rootDir: string): number {
  let latest = 0;
  const targets = [
    path.join(rootDir, 'index.html'),
    path.join(rootDir, 'firebase-applet-config.json'),
    path.join(rootDir, 'src'),
  ];

  const walk = (target: string) => {
    try {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(target)) {
          walk(path.join(target, entry));
        }
      } else if (stat.mtimeMs > latest) {
        latest = stat.mtimeMs;
      }
    } catch {
      // Ignore missing optional paths
    }
  };

  targets.forEach(walk);
  return latest;
}

function createSingleFilePlugin(options: { emitCopy: boolean; enableDevRoute: boolean }): Plugin {
  let cachedMtime = 0;
  let cachedHtml: string | null = null;
  let inflightBuild: Promise<string> | null = null;

  const buildSingleHtmlInMemory = async (): Promise<string> => {
    const result = await viteBuild({
      configFile: false,
      root: __dirname,
      logLevel: 'silent',
      plugins: [
        react(),
        tailwindcss(),
        createSingleFilePlugin({ emitCopy: false, enableDevRoute: false }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
      build: {
        write: false,
        emptyOutDir: false,
      },
    });

    const outputs = Array.isArray(result) ? result : [result];
    for (const out of outputs) {
      if ('output' in out) {
        const htmlAsset = out.output.find(
          (item) => item.type === 'asset' && item.fileName === 'index.html'
        );
        if (htmlAsset && htmlAsset.type === 'asset') {
          return String(htmlAsset.source);
        }
      }
    }
    throw new Error('Single-file HTML build produced no index.html asset');
  };

  return {
    name: 'r-taxi-singlefile-html',
    enforce: 'post',

    configureServer(server) {
      if (!options.enableDevRoute) return;

      server.middlewares.use('/r-taxi-uz.html', async (_req, res, next) => {
        try {
          const latestMtime = getLatestSourceMtime(__dirname);
          if (!cachedHtml || latestMtime > cachedMtime) {
            if (!inflightBuild) {
              inflightBuild = buildSingleHtmlInMemory()
                .then((html) => {
                  cachedHtml = html;
                  cachedMtime = latestMtime;
                  return html;
                })
                .finally(() => {
                  inflightBuild = null;
                });
            }
            cachedHtml = await inflightBuild;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="r-taxi-uz.html"');
          res.setHeader('Cache-Control', 'no-store');
          res.end(cachedHtml);
        } catch (err) {
          next(err);
        }
      });
    },

    generateBundle(_outputOptions, bundle) {
      const htmlEntry = bundle['index.html'];
      if (!htmlEntry || htmlEntry.type !== 'asset') return;

      let singleHtml = String(htmlEntry.source);
      const inlineScripts: string[] = [];

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && fileName.endsWith('.css')) {
          const cssPattern = new RegExp(
            `<link\\s+[^>]*href=["']/?${escapeRegExp(fileName)}["'][^>]*>`,
            'gi'
          );
          if (cssPattern.test(singleHtml)) {
            const safeCss = String(asset.source).replace(/<\/style/gi, '<\\/style');
            singleHtml = singleHtml.replace(cssPattern, () => `<style>\n${safeCss}\n</style>`);
            if (!options.emitCopy) {
              delete bundle[fileName];
            }
          }
        } else if (asset.type === 'chunk' && fileName.endsWith('.js') && asset.isEntry) {
          const jsPattern = new RegExp(
            `<script\\s+[^>]*src=["']/?${escapeRegExp(fileName)}["'][^>]*>\\s*</script>`,
            'gi'
          );
          if (jsPattern.test(singleHtml)) {
            const safeJs = asset.code.replace(/<\/script/gi, '<\\/script');
            singleHtml = singleHtml.replace(jsPattern, () => '');
            inlineScripts.push(`<script type="module">\n${safeJs}\n</script>`);
            if (!options.emitCopy) {
              delete bundle[fileName];
            }
          }
        }
      }

      if (inlineScripts.length > 0) {
        const scriptsBlock = inlineScripts.join('\n');
        if (singleHtml.includes('</body>')) {
          singleHtml = singleHtml.replace('</body>', () => `${scriptsBlock}\n  </body>`);
        } else {
          singleHtml += `\n${scriptsBlock}`;
        }
      }

      if (options.emitCopy) {
        this.emitFile({
          type: 'asset',
          fileName: 'r-taxi-uz.html',
          source: singleHtml,
        });
      } else {
        htmlEntry.source = singleHtml;
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      createSingleFilePlugin({ emitCopy: true, enableDevRoute: true }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

