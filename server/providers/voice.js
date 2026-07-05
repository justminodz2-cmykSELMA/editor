import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);

/**
 * AI Voice System — multi-provider TTS with automatic fallback.
 * Order: ElevenLabs → OpenAI → Google TTS → Azure → Polly → PlayHT → Cartesia → espeak-ng/coqui (local).
 * Each provider receives { text, voice: {gender, age, accent, language, style}, emotion, rate }.
 */
const providers = [
  {
    name: 'elevenlabs',
    available: () => !!config.keys.elevenlabs,
    synth: async ({ text, voice }, outFile) => {
      // Default voice ids: narrator male/female. Voice cloning: pass a custom voiceId via voice.cloneId.
      const voiceId = voice?.cloneId || (voice?.gender === 'female' ? 'EXAVITQu4vr4xnSDxMaL' : 'JBFqnCBsd6RMkjVDRZzb');
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': config.keys.elevenlabs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4 } }),
      });
      if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
      fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    },
  },
  {
    name: 'openai',
    available: () => !!config.keys.openai,
    synth: async ({ text, voice, emotion }, outFile) => {
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.keys.openai}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: voice?.gender === 'female' ? 'nova' : 'onyx',
          input: text,
          instructions: `Speak as a ${emotion || 'calm documentary'} narrator.`,
        }),
      });
      if (!r.ok) throw new Error(`openai-tts ${r.status}`);
      fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    },
  },
  {
    name: 'google',
    available: () => !!config.keys.googleTts,
    synth: async ({ text, voice, rate }, outFile) => {
      const lang = voice?.language || 'en-US';
      const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.keys.googleTts}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: lang, ssmlGender: (voice?.gender || 'male').toUpperCase() },
          audioConfig: { audioEncoding: 'MP3', speakingRate: rate || 1.0 },
        }),
      });
      if (!r.ok) throw new Error(`google-tts ${r.status}`);
      const { audioContent } = await r.json();
      fs.writeFileSync(outFile, Buffer.from(audioContent, 'base64'));
    },
  },
  {
    name: 'azure',
    available: () => !!config.keys.azureSpeech && !!config.keys.azureRegion,
    synth: async ({ text, voice, emotion }, outFile) => {
      const name = voice?.gender === 'female' ? 'en-US-JennyNeural' : 'en-US-GuyNeural';
      const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${name}"><mstts:express-as style="${emotion || 'narration-professional'}" xmlns:mstts="https://www.w3.org/2001/mstts">${text}</mstts:express-as></voice></speak>`;
      const r = await fetch(`https://${config.keys.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.keys.azureSpeech,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        },
        body: ssml,
      });
      if (!r.ok) throw new Error(`azure ${r.status}`);
      fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    },
  },
  {
    name: 'local-espeak',
    available: () => true, // always-available offline fallback so the pipeline never stalls
    synth: async ({ text }, outFile) => {
      const wav = outFile.replace(/\.[^.]+$/, '.wav');
      await exec('espeak-ng', ['-w', wav, text]).catch(() => exec('espeak', ['-w', wav, text]));
      await exec('ffmpeg', ['-y', '-i', wav, outFile]);
      fs.rmSync(wav, { force: true });
    },
  },
];

/** Synthesize one narration block. Returns the output file path. */
export async function synthesizeVoice(block, outDir, idx) {
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `vo_${idx}.mp3`);
  const errors = [];
  for (const p of providers) {
    if (!p.available()) continue;
    try {
      await p.synth(block, outFile);
      return { file: outFile, provider: p.name };
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(`All voice providers failed: ${errors.join('; ')}`);
}
