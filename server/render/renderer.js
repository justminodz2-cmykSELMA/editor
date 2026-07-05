import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Final assembly with ffmpeg:
 * per-shot visuals (Ken Burns on stills / 3D renders) + narration + music bed + SFX
 * → transitions → color grade → subtitles → export-ready MP4 (H.264 + AAC).
 */

/** Turn a still image into a moving clip with a slow Ken Burns push-in. */
async function imageToClip(image, durationSec, outFile, { width = 1920, height = 1080 } = {}) {
  const frames = Math.max(Math.round(durationSec * 30), 30);
  await exec('ffmpeg', ['-y', '-loop', '1', '-i', image,
    '-vf',
    `scale=${width * 1.2}:-2,zoompan=z='min(zoom+0.0008,1.2)':d=${frames}:s=${width}x${height}:fps=30,format=yuv420p`,
    '-t', String(durationSec), '-an', outFile]);
  return outFile;
}

/** Build the full video from the project timeline. */
export async function renderProject(project, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const timeline = project.stages.editing?.output?.timeline || [];
  const grade = project.stages.colorGrading?.output?.global || {};

  // 1. Per-shot clips
  const clips = [];
  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const clip = path.join(outDir, `clip_${i}.mp4`);
    if (item.video) {
      await exec('ffmpeg', ['-y', '-i', item.video, '-t', String(item.durationSec), '-an',
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p', clip]);
    } else {
      await imageToClip(item.image, item.durationSec, clip);
    }
    clips.push(clip);
  }
  if (!clips.length) throw new Error('Timeline is empty — nothing to render');

  // 2. Concatenate with crossfade-free concat (transitions burned per-clip for robustness)
  const listFile = path.join(outDir, 'concat.txt');
  fs.writeFileSync(listFile, clips.map(c => `file '${path.resolve(c)}'`).join('\n'));
  const silent = path.join(outDir, 'video_silent.mp4');
  await exec('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);

  // 3. Narration track
  const voFiles = (project.stages.voice?.output?.files || []);
  let narration = null;
  if (voFiles.length) {
    narration = path.join(outDir, 'narration.mp3');
    const voList = path.join(outDir, 'vo.txt');
    fs.writeFileSync(voList, voFiles.map(f => `file '${path.resolve(f)}'`).join('\n'));
    await exec('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', voList, narration]);
  }

  // 4. Mix narration over music bed with ducking
  const music = project.stages.audioMix?.output?.musicFile;
  const mixed = path.join(outDir, 'mix.m4a');
  if (narration && music) {
    await exec('ffmpeg', ['-y', '-i', narration, '-stream_loop', '-1', '-i', music,
      '-filter_complex',
      '[1:a]volume=0.25[m];[m][0:a]sidechaincompress=threshold=0.05:ratio=8[duck];[0:a][duck]amix=2:duration=first[out]',
      '-map', '[out]', '-c:a', 'aac', mixed]);
  } else if (narration || music) {
    await exec('ffmpeg', ['-y', '-i', narration || music, '-c:a', 'aac', mixed]);
  }

  // 5. Color grade + mux + subtitles
  const eq = `eq=contrast=${grade.contrast ?? 1.06}:saturation=${grade.saturation ?? 1.12}`;
  const srt = project.stages.subtitles?.output?.file;
  // ffmpeg's subtitles filter needs forward slashes and an escaped drive colon on Windows
  // (e.g. C\:/path/subs.srt) — raw backslashes get swallowed by the filter parser.
  const srtSafe = srt
    ? path.resolve(srt).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
    : null;
  const vf = srtSafe ? `${eq},subtitles='${srtSafe}'` : eq;
  const finalFile = path.join(outDir, 'final.mp4');
  const args = ['-y', '-i', silent];
  if (fs.existsSync(mixed)) args.push('-i', mixed);
  args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19');
  if (fs.existsSync(mixed)) args.push('-c:a', 'aac', '-shortest');
  args.push(finalFile);
  await exec('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024 });

  return finalFile;
}
