import fs from 'node:fs';
import path from 'node:path';

const ts = (sec) => {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  const ms = String(Math.round((sec % 1) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
};

/** Write cues (from Subtitle AI) to an .srt file, laying them out sequentially per scene timing. */
export function writeSrt(cues, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'subtitles.srt');
  let t = 0;
  const blocks = cues.map((c, i) => {
    const start = c.approxStartSec ?? t;
    const dur = Math.max(c.approxDurSec ?? Math.min(Math.max(c.text.length / 15, 1.5), 7), 1);
    t = start + dur;
    return `${i + 1}\n${ts(start)} --> ${ts(start + dur)}\n${c.text}\n`;
  });
  fs.writeFileSync(file, blocks.join('\n'));
  return file;
}
