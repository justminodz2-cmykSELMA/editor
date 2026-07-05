import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../config.js';

/**
 * 3D content: Poly Haven (free HDRIs/models/textures), Sketchfab (GLTF downloads),
 * Mixamo/Ready Player Me (character & mocap references), and Blender Python API rendering.
 * Formats supported downstream: GLTF, FBX, OBJ, USD/USDZ.
 */

/** Search Poly Haven for HDRIs/models/textures — no API key required. */
export async function searchPolyHaven(query, type = 'hdris') {
  const r = await fetch(`https://api.polyhaven.com/assets?t=${type}`);
  if (!r.ok) throw new Error(`polyhaven ${r.status}`);
  const all = await r.json();
  const q = query.toLowerCase().split(/\s+/);
  return Object.entries(all)
    .filter(([id, a]) => q.some(w => id.includes(w) || (a.tags || []).some(t => t.includes(w))))
    .slice(0, 5)
    .map(([id, a]) => ({ id, name: a.name, tags: a.tags }));
}

/** Search Sketchfab for downloadable GLTF models. */
export async function searchSketchfab(query) {
  if (!config.keys.sketchfab) return [];
  const r = await fetch(
    `https://api.sketchfab.com/v3/search?type=models&downloadable=true&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Token ${config.keys.sketchfab}` } },
  );
  if (!r.ok) return [];
  const { results } = await r.json();
  return results.slice(0, 5).map(m => ({ uid: m.uid, name: m.name, url: m.viewerUrl }));
}

/**
 * Render a 3D shot with Blender in headless mode using the Python API.
 * scene = { environment, models, lighting, cameraPath, simulations, durationSec }
 * Falls back gracefully (returns null) when Blender is not installed.
 */
export function renderBlenderShot(scene, outDir, shotId) {
  return new Promise((resolve) => {
    fs.mkdirSync(outDir, { recursive: true });
    const sceneFile = path.join(outDir, `${shotId}_scene.json`);
    const outFile = path.join(outDir, `${shotId}.mp4`);
    fs.writeFileSync(sceneFile, JSON.stringify({ ...scene, output: outFile }));
    const proc = spawn(config.blenderPath, [
      '--background', '--python', path.resolve('../blender/generate_scene.py'), '--', sceneFile,
    ]);
    proc.on('error', () => resolve(null)); // Blender not installed → 2D fallback
    proc.on('exit', (code) => resolve(code === 0 && fs.existsSync(outFile) ? outFile : null));
  });
}
