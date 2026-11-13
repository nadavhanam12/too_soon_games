// Entry for `npm run build` / `npm run serve`. Bundles build.ts with esbuild (so TypeScript runs on
// plain Node) and executes it. Flags are passed through: --games <file> --out <dir> --serve [--port N]
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, '.cache', 'build.mjs');
mkdirSync(dirname(outfile), { recursive: true });
await build({
  entryPoints: [join(here, 'build.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile,
  packages: 'external',
  logLevel: 'warning',
});
process.env.FRONTEND_DIR = here;
const mod = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
await mod.main(process.argv.slice(2));
