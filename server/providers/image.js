import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);

/**
 * AI image/asset generation with fallback:
 * Stability AI → OpenAI Images → Replicate (Flux) → procedural placeholder (ImageMagick/ffmpeg).
 * Used for backgrounds, environments, characters, textures, icons, logos, infographic bases, thumbnails.
 */
const providers = [
  {
    name: 'stability',
    available: () => !!config.keys.stability,
    generate: async (prompt, outFile, { width = 1920, height = 1080 } = {}) => {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'png');
      form.append('aspect_ratio', width >= height ? '16:9' : '9:16');
      const r = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.keys.stability}`, Accept: 'image/*' },
        body: form,
      });
      if (!r.ok) throw new Error(`stability ${r.status}`);
      fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    },
  },
  {
    name: 'openai-images',
    available: () => !!config.keys.openai,
    generate: async (prompt, outFile) => {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.keys.openai}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024' }),
      });
      if (!r.ok) throw new Error(`openai-images ${r.status}`);
      const { data } = await r.json();
      fs.writeFileSync(outFile, Buffer.from(data[0].b64_json, 'base64'));
    },
  },
  {
    name: 'placeholder',
    available: () => true, // offline fallback: cinematic gradient card with the shot description
    generate: async (prompt, outFile, { width = 1920, height = 1080 } = {}) => {
      const label = prompt.slice(0, 120).replace(/[\\'"%]/g, ' ');
      await exec('magick', [
        '-size', `${width}x${height}`, 'gradient:#0f1226-#2b1c44',
        '-gravity', 'center', '-fill', '#e8e6f5', '-pointsize', '42',
        'caption:' + label, '-composite', outFile,
      ]).catch(async () => {
        await exec('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=0x1a1a2e:s=${width}x${height}:d=1`, '-frames:v', '1', outFile]);
      });
    },
  },
];

export async function generateImage(prompt, outDir, name, opts = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${name}.png`);
  const errors = [];
  for (const p of providers) {
    if (!p.available()) continue;
    try {
      await p.generate(prompt, outFile, opts);
      return { file: outFile, provider: p.name };
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(`All image providers failed: ${errors.join('; ')}`);
}
