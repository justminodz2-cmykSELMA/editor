import { config } from '../config.js';

/**
 * LLM provider chain with automatic fallback: OpenAI → Anthropic → Gemini.
 * All agents route through this. Returns parsed JSON (agents use strict JSON contracts).
 *
 * Rate-limit hardened:
 * - Global pacing: consecutive calls to the same provider are spaced out
 *   (free tiers like Gemini allow only a handful of requests per minute).
 * - Automatic retry with exponential backoff on 429/5xx, honoring
 *   Retry-After headers and Gemini's retryDelay hints.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimum gap between calls per provider (ms). Override with LLM_MIN_INTERVAL_MS.
const DEFAULT_INTERVALS = { openai: 500, anthropic: 1000, gemini: 6500 };
const envInterval = Number(process.env.LLM_MIN_INTERVAL_MS) || 0;
const lastCallAt = {};

async function pace(name) {
  const gap = Math.max(envInterval, DEFAULT_INTERVALS[name] || 500);
  const wait = (lastCallAt[name] || 0) + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt[name] = Date.now();
}

/** Extract a retry hint (ms) from a 429 response, if present. */
function retryHintMs(res, bodyText) {
  const h = res?.headers?.get?.('retry-after');
  if (h && !Number.isNaN(Number(h))) return Number(h) * 1000;
  const m = /retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/.exec(bodyText || '');
  if (m) return Math.ceil(Number(m[1]) * 1000);
  return null;
}

class HttpError extends Error {
  constructor(provider, res, bodyText) {
    super(`${provider} ${res.status}`);
    this.status = res.status;
    this.retryMs = retryHintMs(res, bodyText);
  }
}

async function checked(provider, res) {
  if (res.ok) return res.json();
  throw new HttpError(provider, res, await res.text().catch(() => ''));
}

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
      return (await checked('openai', r)).choices[0].message.content;
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
      return (await checked('anthropic', r)).content[0].text;
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
      return (await checked('gemini', r)).candidates[0].content.parts[0].text;
    },
  },
];

function extractJson(text) {
  const cleaned = text.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

const MAX_ATTEMPTS = 4;

/** Call one provider with pacing + exponential backoff on 429/5xx. */
async function callWithRetry(p, system, user) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await pace(p.name);
    try {
      return await p.call(system, user);
    } catch (e) {
      lastErr = e;
      const retryable = e.status === 429 || (e.status >= 500 && e.status < 600);
      if (!retryable || attempt === MAX_ATTEMPTS) throw e;
      const backoff = e.retryMs ?? Math.min(60000, 5000 * 2 ** (attempt - 1));
      console.warn(`[llm] ${p.name} ${e.status} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(backoff / 1000)}s`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/** Run an agent (from agents/definitions.js) against the provider chain. */
export async function runAgent(agent, userPrompt) {
  const errors = [];
  for (const p of providers) {
    if (!p.available()) continue;
    try {
      return extractJson(await callWithRetry(p, agent.system, userPrompt));
    } catch (e) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }
  const hint = errors.some((x) => x.includes('429'))
    ? ' (429 = rate limit — the studio already retried with backoff; your API quota may be exhausted for today, or add a second provider key for automatic fallback)'
    : '';
  throw new Error(
    `No LLM provider succeeded for ${agent.name}. ` +
    (errors.length ? `Errors: ${errors.join('; ')}${hint}` : 'Add OPENAI_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY to .env'),
  );
}
