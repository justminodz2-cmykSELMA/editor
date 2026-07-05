import { config } from '../config.js';

/**
 * LLM provider chain with automatic fallback: OpenAI → Anthropic → Gemini.
 * All agents route through this. Returns parsed JSON (agents use strict JSON contracts).
 */
const providers = [
  {
    name: 'openai',
    available: () => !!config.keys.openai,
    call: async (system, user) => {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.keys.openai}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      });
      if (!r.ok) throw new Error(`openai ${r.status}`);
      return (await r.json()).choices[0].message.content;
    },
  },
  {
    name: 'anthropic',
    available: () => !!config.keys.anthropic,
    call: async (system, user) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.keys.anthropic,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: system + '\nReply with JSON only, no markdown fences.',
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!r.ok) throw new Error(`anthropic ${r.status}`);
      return (await r.json()).content[0].text;
    },
  },
  {
    name: 'gemini',
    available: () => !!config.keys.gemini,
    call: async (system, user) => {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.keys.gemini}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: user }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      );
      if (!r.ok) throw new Error(`gemini ${r.status}`);
      return (await r.json()).candidates[0].content.parts[0].text;
    },
  },
];

function extractJson(text) {
  const cleaned = text.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

/** Run an agent (from agents/definitions.js) against the provider chain. */
export async function runAgent(agent, userPrompt) {
  const errors = [];
  for (const p of providers) {
    if (!p.available()) continue;
    try {
      return extractJson(await p.call(agent.system, userPrompt));
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  throw new Error(
    `No LLM provider succeeded for ${agent.name}. ` +
    (errors.length ? `Errors: ${errors.join('; ')}` : 'Add OPENAI_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY to .env'),
  );
}
