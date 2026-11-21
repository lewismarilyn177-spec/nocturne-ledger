// Nocturne Ledger - the hand-in program.
//
// The game lives in ./game as plain static files (one ES-module tree, no build
// step, no network). This program stages what the scorer reads: it copies game/
// and the maker's screenshots/ into the output directory and writes
// dossier.json through the kit's buildDossier so the summary matches the files
// exactly. Outside the grader container, MAKEFUN_OUTPUT_DIR replaces /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Mirror the scorer's caps so a bad layout fails here, loudly, instead of at the
// gate: screenshot count and size, game/ file count and weight, path length.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);