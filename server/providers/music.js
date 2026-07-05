import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);

/**
 * Music & ambience: AI generation (MusicGen endpoint / Replicate) → Freesound royalty-free → procedural pad (ffmpeg).
 */
const providers = [
  {
    name: 'musicgen',
    available: () => !!config.keys.replicate,
    generate: async ({ mood, genre, durationSec }, outFile) => {
      const r = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.keys.replicate}`, 'Content-Type': 'application/json', Prefer: 'wait' },
        body: JSON.stringify({
          version: 'meta/musicgen',
          input: { prompt: `${mood} ${genre} music, cinematic, high quality`, duration: Math.min(durationSec || 30, 30) },
        }),
      });
      if (!r.ok) throw new Error(`replicate ${r.status}`);
      const out = (await r.json()).output;
      const audio = await fetch(Array.isArray(out) ? out[0] : out);
      fs.writeFileSync(outFile, Buffer.from(await audio.arrayBuffer()));
    },
  },
  {
    name: 'freesound',
    available: () => !!config.keys.freesound,
    generate: async ({ mood, genre }, outFile) => {
      const q = encodeURIComponent(`${mood} ${genre} music loop`);
      const r = await fetch(`https://freesound.org/apiv2/search/text/?query=${q}&filter=duration:[20 TO 120]&fields=id,previews&token=${config.keys.freesound}`);
      if (!r.ok) throw new Error(`freesound ${r.status}`);
      const { results } = await r.json();
      if (!results?.length) throw new Error('freesound: no results');
      const audio = await fetch(results[0].previews['preview-hq-mp3']);
      fs.writeFileSync(outFile, Buffer.from(await audio.arrayBuffer()));
    },
  },
  {
    name: 'procedural-pad',
    available: () => true, // offline fallback: generated ambient pad so the mix never comes back empty
    generate: async ({ durationSec = 30 }, outFile) => {
      await exec('ffmpeg', ['-y',
        '-f', 'lavfi', '-i', `sine=frequency=110:duration=${durationSec}`,
        '-f', 'lavfi', '-i', `sine=frequency=165:duration=${durationSec}`,
        '-filter_complex', '[0][1]amix=2,volume=0.15,afade=t=in:d=2,afade=t=out:st=' + Math.max(durationSec - 2, 0) + ':d=2',
        outFile]);
    },
  },
];

export async function generateMusic(cue, outDir, idx) {
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `music_${idx}.mp3`);
  const errors = [];
  for (const p of providers) {
    if (!p.available()) continue;
    try {
      await p.generate(cue, outFile);
      return { file: outFile, provider: p.name };
    } catch (e) { errors.push(`${p.name}: ${e.message}`); }
  }
  throw new Error(`All music providers failed: ${errors.join('; ')}`);
}

/** SFX & ambience via Freesound (royalty-free) with silent fallback. */
export async function fetchSfx(name, outDir, idx) {
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `sfx_${idx}.mp3`);
  if (config.keys.freesound) {
    try {
      const r = await fetch(`https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(name)}&fields=id,previews&token=${config.keys.freesound}`);
      const { results } = await r.json();
      if (results?.length) {
        const audio = await fetch(results[0].previews['preview-hq-mp3']);
        fs.writeFileSync(outFile, Buffer.from(await audio.arrayBuffer()));
        return { file: outFile, provider: 'freesound' };
      }
    } catch { /* fall through */ }
  }
  await exec('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=d=1', outFile]);
  return { file: outFile, provider: 'silent-placeholder' };
}
