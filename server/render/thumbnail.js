import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateImage } from '../providers/image.js';

const exec = promisify(execFile);

/** Generate the thumbnail image and overlay the Thumbnail AI's text with ImageMagick. */
export async function createThumbnail(design, outDir) {
  const base = await generateImage(design.imagePrompt, outDir, 'thumbnail_base', { width: 1280, height: 720 });
  const out = path.join(outDir, 'thumbnail.png');
  const text = (design.overlayText || '').toUpperCase().replace(/[\\'"%]/g, '');
  try {
    await exec('magick', [base.file, '-resize', '1280x720^', '-gravity', 'center', '-extent', '1280x720',
      '-gravity', 'southwest', '-pointsize', '110', '-font', 'DejaVu-Sans-Bold',
      '-stroke', 'black', '-strokewidth', '8', '-fill', 'white', '-annotate', '+60+60', text, out]);
  } catch {
    await exec('cp', [base.file, out]);
  }
  return out;
}
