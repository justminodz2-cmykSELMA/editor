import path from 'node:path';
import { config } from '../config.js';
import { AGENTS } from '../agents/definitions.js';
import { runAgent } from '../providers/llm.js';
import { synthesizeVoice } from '../providers/voice.js';
import { generateImage } from '../providers/image.js';
import { generateMusic, fetchSfx } from '../providers/music.js';
import { renderBlenderShot } from '../providers/assets3d.js';
import { renderProject } from '../render/renderer.js';
import { writeSrt } from '../render/subtitles.js';
import { createThumbnail } from '../render/thumbnail.js';

/**
 * The Autonomous Production Pipeline.
 * Prompt → Research → Script → Storyboard → Voice → Assets → 3D → Animations
 * → Motion Graphics → VFX → Editing → Audio Mix → Color Grading → Subtitles
 * → Thumbnail → Render → Export.
 *
 * Each stage stores its output on project.stages[stage] so the dashboard can
 * display and manually edit every intermediate artifact.
 */
export const PIPELINE_STAGES = [
  { id: 'direction', agent: 'director', run: async (ctx) => runAgent(AGENTS.director, ctx.brief()) },
  { id: 'research', agent: 'researcher', run: async (ctx) => runAgent(AGENTS.researcher, ctx.brief()) },
  { id: 'script', agent: 'screenwriter', run: async (ctx) =>
      runAgent(AGENTS.screenwriter, ctx.brief(['direction', 'research'])) },
  { id: 'storyboard', agent: 'storyboard', run: async (ctx) =>
      runAgent(AGENTS.storyboard, ctx.brief(['direction', 'script'])) },
  {
    id: 'voice', agent: 'voice',
    run: async (ctx) => {
      const plan = await runAgent(AGENTS.voice, ctx.brief(['direction', 'script']));
      const files = [];
      const script = ctx.get('script');
      for (let i = 0; i < (script.scenes || []).length; i++) {
        const scene = script.scenes[i];
        if (!scene.narration) continue;
        const block = plan.blocks?.find(b => b.sceneId === scene.id) || {};
        const { file, provider } = await synthesizeVoice({ text: scene.narration, ...block }, ctx.dir('voice'), i);
        files.push(file);
        ctx.emit(`Voice for scene ${scene.id} via ${provider}`);
      }
      return { ...plan, files };
    },
  },
  {
    id: 'assets', agent: 'storyboard',
    run: async (ctx) => {
      // Generate a visual for every shot from its storyboard description.
      const sb = ctx.get('storyboard');
      const style = ctx.get('direction')?.style || 'cinematic';
      const images = [];
      for (const scene of sb.scenes || []) {
        for (const shot of scene.shots || []) {
          const { file, provider } = await generateImage(
            `${shot.description}. Style: ${style}. ${shot.framing || ''} ${shot.angle || ''}. High quality, 16:9.`,
            ctx.dir('assets'), `shot_${scene.id}_${shot.id}`.replace(/[^\w-]/g, '_'),
          );
          images.push({ sceneId: scene.id, shotId: shot.id, file, provider });
          ctx.emit(`Asset for shot ${shot.id} via ${provider}`);
        }
      }
      return { images };
    },
  },
  {
    id: 'scenes3d', agent: 'artist3d',
    run: async (ctx) => {
      const plan = await runAgent(AGENTS.artist3d, ctx.brief(['direction', 'storyboard']));
      const renders = [];
      for (const shot of (plan.shots || []).slice(0, 3)) { // cap headless renders per production
        const video = await renderBlenderShot({ ...shot, durationSec: 5 }, ctx.dir('3d'), shot.shotId);
        if (video) { renders.push({ shotId: shot.shotId, video }); ctx.emit(`Blender render: ${shot.shotId}`); }
      }
      return { ...plan, renders, note: renders.length ? undefined : 'Blender unavailable — using 2D assets' };
    },
  },
  { id: 'animations', agent: 'animation', run: async (ctx) => runAgent(AGENTS.animation, ctx.brief(['storyboard'])) },
  { id: 'motionGraphics', agent: 'motionGraphics', run: async (ctx) =>
      runAgent(AGENTS.motionGraphics, ctx.brief(['direction', 'script', 'storyboard'])) },
  { id: 'vfx', agent: 'vfx', run: async (ctx) => runAgent(AGENTS.vfx, ctx.brief(['direction', 'storyboard'])) },
  {
    id: 'editing', agent: 'editor',
    run: async (ctx) => {
      // Assemble the timeline: pair each shot with its asset (3D render wins over still).
      const sb = ctx.get('storyboard');
      const assets = ctx.get('assets')?.images || [];
      const renders = ctx.get('scenes3d')?.renders || [];
      const timeline = [];
      for (const scene of sb.scenes || []) {
        for (const shot of scene.shots || []) {
          const r3d = renders.find(r => r.shotId === shot.id);
          const img = assets.find(a => a.shotId === shot.id && a.sceneId === scene.id);
          timeline.push({
            sceneId: scene.id, shotId: shot.id,
            durationSec: Math.min(Math.max(shot.durationSec || 5, 2), 15),
            transition: shot.transition || 'cut',
            video: r3d?.video, image: img?.file,
          });
        }
      }
      return { timeline };
    },
  },
  {
    id: 'audioMix', agent: 'audio',
    run: async (ctx) => {
      const plan = await runAgent(AGENTS.audio, ctx.brief(['direction', 'script']));
      const cue = plan.music?.[0] || { mood: 'cinematic', genre: 'ambient', durationSec: 60 };
      const { file, provider } = await generateMusic(cue, ctx.dir('audio'), 0);
      ctx.emit(`Music via ${provider}`);
      const sfxFiles = [];
      for (let i = 0; i < (plan.sfx || []).slice(0, 8).length; i++) {
        sfxFiles.push({ ...plan.sfx[i], ...(await fetchSfx(plan.sfx[i].name, ctx.dir('audio'), i)) });
      }
      return { ...plan, musicFile: file, sfxFiles };
    },
  },
  { id: 'colorGrading', agent: 'colorist', run: async (ctx) => runAgent(AGENTS.colorist, ctx.brief(['direction'])) },
  {
    id: 'subtitles', agent: 'subtitles',
    run: async (ctx) => {
      const plan = await runAgent(AGENTS.subtitles, ctx.brief(['script', 'editing']));
      const file = writeSrt(plan.cues || [], ctx.dir('subs'));
      return { ...plan, file };
    },
  },
  {
    id: 'thumbnail', agent: 'thumbnail',
    run: async (ctx) => {
      const design = await runAgent(AGENTS.thumbnail, ctx.brief(['direction', 'script']));
      const file = await createThumbnail(design, ctx.dir('thumb'));
      return { ...design, file };
    },
  },
  { id: 'youtube', agent: 'youtube', run: async (ctx) => runAgent(AGENTS.youtube, ctx.brief(['script', 'direction'])) },
  {
    id: 'render', agent: 'editor',
    run: async (ctx) => {
      const file = await renderProject(ctx.project, ctx.dir('export'));
      return { file, url: `/output/${ctx.project.id}/export/final.mp4` };
    },
  },
];

export async function runPipeline(project, emit) {
  const ctx = {
    project,
    get: (stage) => project.stages[stage]?.output,
    dir: (sub) => path.join(config.outputDir, project.id, sub),
    emit: (msg) => emit({ type: 'log', msg, at: Date.now() }),
    brief: (deps = []) => JSON.stringify({
      prompt: project.prompt,
      options: project.options,
      ...Object.fromEntries(deps.map(d => [d, project.stages[d]?.output])),
    }),
  };

  for (const stage of PIPELINE_STAGES) {
    emit({ type: 'stage', stage: stage.id, status: 'running', agent: AGENTS[stage.agent]?.name, at: Date.now() });
    try {
      const output = await stage.run(ctx);
      project.stages[stage.id] = { status: 'complete', agent: stage.agent, output };
      emit({ type: 'stage', stage: stage.id, status: 'complete', at: Date.now() });
    } catch (err) {
      project.stages[stage.id] = { status: 'failed', agent: stage.agent, error: String(err.message || err) };
      emit({ type: 'stage', stage: stage.id, status: 'failed', error: String(err.message || err), at: Date.now() });
      // Non-critical stages don't stop the production.
      const critical = ['script', 'storyboard', 'editing', 'render'];
      if (critical.includes(stage.id)) throw err;
    }
  }
}
