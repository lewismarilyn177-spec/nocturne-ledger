import { mkdirSync, cpSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, DossierError } from './vendor/makefun-game.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCREENSHOT_MAX_BYTES = 262_144;
const SCREENSHOT_MIN_COUNT = 3;
const SCREENSHOT_MAX_COUNT = 4;
const DEFAULT_OUTPUT = '/output';

function resolveOutputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT;
}

function copyTree(src: string, dest: string): void {
  cpSync(src, dest, { recursive: true });
}

function verifyIndexHtml(gameDir: string): void {
  const indexPath = join(gameDir, 'index.html');
  try {
    statSync(indexPath);
  } catch {
    throw new Error('game/index.html missing: the game page must be at the root of game/');
  }
}

function verifyScreenshots(ssDir: string): { count: number; totalBytes: number; names: string[] } {
  let entries: string[];
  try {
    entries = readdirSync(ssDir);
  } catch {
    throw new Error('screenshots/ missing: a hand-in must include 3–4 screenshots');
  }
  const valid = entries.filter((e) => !e.startsWith('.')).sort();
  if (valid.length < SCREENSHOT_MIN_COUNT || valid.length > SCREENSHOT_MAX_COUNT) {
    throw new Error(`screenshots/: expected ${SCREENSHOT_MIN_COUNT}–${SCREENSHOT_MAX_COUNT} images, found ${valid.length}`);
  }
  let total = 0;
  for (const name of valid) {
    const path = join(ssDir, name);
    const st = statSync(path);
    if (!st.isFile()) throw new Error(`screenshots/${name}: not a file`);
    if (st.size > SCREENSHOT_MAX_BYTES) throw new Error(`screenshots/${name}: ${st.size} bytes exceeds ${SCREENSHOT_MAX_BYTES} limit`);
    total += st.size;
  }
  return { count: valid.length, totalBytes: total, names: valid };
}

function printReport(out: string, shots: { count: number; totalBytes: number; names: string[] }): void {
  console.log('staging report');
  console.log(`  output:   ${out}`);
  console.log(`  screenshots: ${shots.count} files, ${shots.totalBytes} bytes`);
  for (const n of shots.names) console.log(`    ${n}`);
}

async function main(): Promise<void> {
  const out = resolveOutputDir();

  mkdirSync(out, { recursive: true });

  copyTree(join(__dirname, 'game'), join(out, 'game'));
  copyTree(join(__dirname, 'screenshots'), join(out, 'screenshots'));

  verifyIndexHtml(join(out, 'game'));
  const ss = verifyScreenshots(join(out, 'screenshots'));

  printReport(out, ss);

  try {
    const dossier = buildDossier(out, {
      text_max_bytes: 163_840,
      screenshots: { max: 4, max_bytes: 262_144 },
      game_max_files: 993,
      game_max_bytes: 50_331_648,
      game_path_max_bytes: 1000,
    });
    writeFileSync(join(out, 'dossier.json'), dossier);
  } catch (err) {
    if (err instanceof DossierError) {
      throw new Error(`dossier build failed: ${err.message}${err.limit ? ` (limit: ${err.limit})` : ''}`);
    }
    throw err;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});