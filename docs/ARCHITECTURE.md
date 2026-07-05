# Architecture

## Overview

```
┌───────────────────────────── Dashboard (web/) ─────────────────────────────┐
│  Chat Command Center │ Pipeline View │ Storyboard │ Timeline │ Export      │
└───────────────▲──────────────────────────────────────────▲─────────────────┘
                │ REST + Server-Sent Events                │ /output static
┌───────────────┴──────────── Server (server/) ────────────┴─────────────────┐
│  Orchestrator ── runs 17 stages sequentially, streams progress             │
│      │                                                                      │
│      ├── Agents (14 LLM personas, strict JSON contracts)                    │
│      ├── Providers (fallback chains)                                        │
│      │     ├── llm.js      OpenAI → Anthropic → Gemini                      │
│      │     ├── voice.js    ElevenLabs → OpenAI → Google → Azure → local     │
│      │     ├── image.js    Stability → OpenAI Images → placeholder          │
│      │     ├── music.js    MusicGen/Replicate → Freesound → procedural      │
│      │     └── assets3d.js Poly Haven · Sketchfab · Blender headless        │
│      └── Render (ffmpeg): Ken Burns clips → concat → duck-mix → grade      │
│                            → burn subtitles → H.264 export + thumbnail      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Design principles

1. **Single prompt in, finished video out.** The orchestrator never requires user input mid-run; every stage has a graceful fallback so a render is always produced.
2. **Everything editable.** Each stage's output is stored on the project and can be patched via `PATCH /api/projects/:id/stages/:stage` before re-running downstream stages.
3. **Provider independence.** Every external capability is a fallback chain. Missing API keys degrade quality, never break the pipeline.
4. **Agents are data.** New agents are added by appending to `agents/definitions.js` — a name, a role and a JSON contract.

## Pipeline stages

| # | Stage | Agent | Output |
|---|-------|-------|--------|
| 1 | direction | Director AI | format, tone, style, palette, duration |
| 2 | research | Research AI | facts, dates, terminology |
| 3 | script | Screenwriter AI | narration per scene, dialogue, titles, credits |
| 4 | storyboard | Storyboard AI | shot list w/ framing, angle, movement, transitions |
| 5 | voice | Voice AI | voice casting + synthesized narration files |
| 6 | assets | — | AI images per shot |
| 7 | scenes3d | 3D Artist AI | Blender scene specs + headless renders |
| 8 | animations | Animation AI | character/library animation plan |
| 9 | motionGraphics | Motion Graphics AI | titles, lower thirds, charts, HUDs |
| 10 | vfx | VFX AI | particles, glows, grain, compositing |
| 11 | editing | Editor AI | assembled timeline |
| 12 | audioMix | Audio Engineer AI | music + SFX + ambience with levels |
| 13 | colorGrading | Color Grading AI | look + ffmpeg-compatible grade |
| 14 | subtitles | Subtitle AI | .srt file |
| 15 | thumbnail | Thumbnail AI | 1280×720 PNG with overlay text |
| 16 | youtube | YouTube Optimization AI | title, description, tags, chapters |
| 17 | render | — | final.mp4 (H.264 + AAC) |

## Extending

- **New provider**: add an object `{ name, available(), call/generate/synth }` to the relevant chain.
- **New stage**: append `{ id, agent, run(ctx) }` to `PIPELINE_STAGES`; use `ctx.get(stage)`, `ctx.dir(sub)`, `ctx.emit(msg)`.
- **Educational mode, trailer mode, etc.** are emergent: the Director AI selects format/pacing from the prompt, and downstream agents adapt (e.g. animated diagrams and documentary pacing for educational prompts).
