import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,
  outputDir: process.env.OUTPUT_DIR || './output',
  blenderPath: process.env.BLENDER_PATH || 'blender',
  keys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    googleTts: process.env.GOOGLE_TTS_API_KEY,
    azureSpeech: process.env.AZURE_SPEECH_KEY,
    azureRegion: process.env.AZURE_SPEECH_REGION,
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    playht: process.env.PLAYHT_API_KEY,
    playhtUser: process.env.PLAYHT_USER_ID,
    cartesia: process.env.CARTESIA_API_KEY,
    stability: process.env.STABILITY_API_KEY,
    replicate: process.env.REPLICATE_API_TOKEN,
    freesound: process.env.FREESOUND_API_KEY,
    sketchfab: process.env.SKETCHFAB_API_TOKEN,
  },
};
