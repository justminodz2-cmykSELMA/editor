# AI Creative Studio — Editor

A complete AI production assistant that creates full professional videos from a **single prompt**.

> "Create a high quality documentary about Ancient Egypt." → export-ready video.

This is **not** a simple chatbot. It is an autonomous, multi-agent production studio with a chat command center built into the main dashboard.

## ✨ What it does

From one prompt, the studio automatically produces:

- Full storyboard, scene planning, timeline & shot list
- Camera angles & camera movement plans
- Voice-over script & character dialogue
- Transitions, animations, visual effects & motion graphics
- Music, sound effects & background ambience
- Subtitles, titles & credits
- Thumbnail
- Export-ready final render (MP4)

No manual editing required — but every stage can be edited manually.

## 🧠 Multi-Agent AI System

14 specialized agents collaborate on every production (see `server/agents/definitions.js`):

| Agent | Role |
|---|---|
| Director AI | Creative vision, pacing, style |
| Screenwriter AI | Script & dialogue |
| Storyboard AI | Scenes, shots, camera angles & movement |
| Editor AI | Timeline, cuts, transitions |
| Voice AI | Narration casting & emotion control |
| Animation AI | 2D/3D animation planning |
| 3D Artist AI | Blender scenes, environments, characters |
| Motion Graphics AI | Titles, lower thirds, infographics, HUDs |
| VFX AI | Particles, effects, compositing |
| Audio Engineer AI | Music, SFX, ambience, mixing |
| Color Grading AI | LUTs & look development |
| Subtitle AI | Timed captions in multiple languages |
| Thumbnail AI | Click-worthy thumbnail design |
| YouTube Optimization AI | Title, description, tags, chapters |

## 🏭 Autonomous Production Pipeline

```
Prompt → Research → Script → Storyboard → Voice → Assets → 3D Scenes
      → Animations → Motion Graphics → VFX → Editing → Audio Mix
      → Color Grading → Subtitles → Thumbnail → Render → Export
```

The orchestrator (`server/pipeline/orchestrator.js`) runs every stage automatically and streams progress to the dashboard. Any stage's output can be reviewed and edited before continuing.

## 🗣️ AI Voice System (multi-provider, automatic fallback)

ElevenLabs → OpenAI → Google Cloud TTS → Azure Speech → Amazon Polly → PlayHT → Cartesia → Coqui (local, free fallback).

Supports narrator/documentary/trailer voices, emotions (whisper, excited, calm), male/female/child/old, accents, many languages, automatic pauses & pronunciation optimization, optional voice cloning.

## 🎨 Asset Generation

Images, illustrations, icons, backgrounds, textures, environments, characters, logos, infographics, diagrams, maps, charts, overlays & particles — via image AI providers with fallback, plus royalty-free libraries.

## 🎵 Music & SFX

AI music generation + royalty-free libraries (cinematic, epic, ambient, corporate…), whooshes, hits, impacts, UI sounds, nature ambience (rain, ocean, wind, fire).

## 🧊 3D Content

- Blender integration via the Blender Python API (`blender/generate_scene.py`)
- Formats: GLTF, FBX, OBJ, USD/USDZ/OpenUSD
- Asset libraries: Poly Haven, Sketchfab, Mixamo, Ready Player Me, BlenderKit
- Procedural geometry, physics/cloth/fluid simulation hooks, rigged characters & mocap animations

## 🚀 Quick start

```bash
# 1. Backend
cd server && npm install && cp ../.env.example .env  # add your API keys
npm start          # http://localhost:4000

# 2. Dashboard
cd ../web && npm install
npm run dev        # http://localhost:5173
```

Only the keys you have are needed — every provider chain falls back automatically, and the pipeline degrades gracefully (e.g., local Coqui TTS, placeholder assets) so it always produces a render.

Requires: Node 18+, ffmpeg. Optional: Blender 4.x for 3D stages.

## 📁 Structure

```
server/            Express API + production pipeline
  agents/          14 specialized AI agents
  pipeline/        Orchestrator + stages
  providers/       LLM / voice / image / music / sfx / 3D (with fallback)
  render/          ffmpeg assembly, subtitles, thumbnail
web/               React dashboard (Creative Studio chat, storyboard, timeline)
blender/           Blender Python API scene generation
docs/              Architecture notes
```

## License

MIT
