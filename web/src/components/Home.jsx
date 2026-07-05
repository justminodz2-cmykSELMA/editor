import React, { useState } from 'react';

const CHIPS = [
  { icon: '🎬', label: 'Netflix Style Intro', prompt: 'Create a Netflix style intro' },
  { icon: '🏛️', label: 'Documentary', prompt: 'Create a high quality documentary about Ancient Egypt' },
  { icon: '✨', label: 'Pixar Animation', prompt: 'Create a Pixar style animation' },
  { icon: '📦', label: '3D Product Ad', prompt: 'Create a realistic 3D product advertisement' },
  { icon: '🚀', label: 'Sci-Fi Trailer', prompt: 'Create a sci-fi trailer' },
  { icon: '🧠', label: 'Kurzgesagt Style', prompt: 'Create a Kurzgesagt style educational animation' },
];

/**
 * Landing hero — the front door of the studio.
 * One prompt here starts a full autonomous production.
 */
export default function Home({ onStart }) {
  const [input, setInput] = useState('');
  const [modelOpen, setModelOpen] = useState(false);

  function go(prompt) {
    const p = (prompt ?? input).trim();
    if (p) onStart(p);
  }

  return (
    <div className="home">
      <header className="home-top">
        <div className="model-select" onClick={() => setModelOpen(!modelOpen)}>
          <span className="model-dot" />
          <strong>Editor&nbsp;1.0</strong>
          <span className="chev">⌄</span>
          {modelOpen && (
            <div className="model-menu">
              <div className="model-item active">
                <strong>Editor 1.0</strong>
                <small>Multi-agent studio · 14 AI specialists · full production pipeline</small>
              </div>
              <div className="model-item disabled">
                <strong>Editor Turbo</strong>
                <small>Coming soon</small>
              </div>
            </div>
          )}
        </div>
        <div className="home-actions">
          <a href="https://github.com/justminodz2-cmykSELMA/editor" target="_blank" rel="noreferrer">API ↗</a>
          <button className="dark-btn">Studio</button>
        </div>
      </header>

      <main className="hero">
        <div className="hero-ghost" aria-hidden>🎬</div>
        <h1>What can I create for you?</h1>
        <p className="hero-sub">Talk to Editor — one prompt becomes a complete professional video</p>

        <form className="hero-input" onSubmit={(e) => { e.preventDefault(); go(); }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the video you want to produce…"
          />
          <div className="hero-input-row">
            <div className="hero-tools">
              <span title="Attach">＋</span>
              <span title="Research">🌐</span>
              <span className="tool-active" title="Multi-agent pipeline">🎛️</span>
            </div>
            <button className="send" disabled={!input.trim()} aria-label="Produce">↑</button>
          </div>
        </form>

        <div className="hero-chips">
          {CHIPS.map((c) => (
            <button key={c.label} onClick={() => go(c.prompt)}>
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      </main>

      <footer className="home-foot">
        Script · Voices · 3D · Music · Editing · Color · Subtitles · Export — fully autonomous
      </footer>
    </div>
  );
}
