import { spawn } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = { ...process.env, CF_PAGES: '1', NEXT_PUBLIC_STORAGE_TYPE: 'd1' };
const entrypoint = 'src/worker/pages-dispatcher.mjs';

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(npx, args, { cwd: process.cwd(), env, shell: process.platform === 'win32', stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${npx} ${args.join(' ')} exited with ${code}`))));
  });
}

await run([
  '--yes',
  '@cloudflare/next-on-pages@1.13.16',
  '--custom-entrypoint',
  entrypoint,
]);

// Wrangler must not publish the generated server worker as a static asset.
// Keep the executable in its own ignored build directory and explicitly
// exclude the source `_worker.js` directory from the static asset upload.
await mkdir('.worker', { recursive: true });
await copyFile('.vercel/output/static/_worker.js/index.js', '.worker/index.js');
await writeFile('.vercel/output/static/.assetsignore', '_worker.js\n');
