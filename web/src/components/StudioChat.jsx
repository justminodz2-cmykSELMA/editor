import React, { useEffect, useRef, useState } from 'react';

const EXAMPLES = [
  'Create a high quality documentary about Ancient Egypt',
  'Create a cinematic 1988 technology explainer',
  'Create a Pixar style animation',
  'Create a realistic 3D product advertisement',
  'Create a luxury commercial',
  'Create a Netflix style intro',
  'Create a sci-fi trailer',
  'Create a Kurzgesagt style animation',
  'Create a MrBeast style YouTube video',
  'Create a TED-Ed explainer',
];

/**
 * The Chat Command Center. Not a chatbot — a production console:
 * type one prompt and the multi-agent pipeline produces a complete video,
 * streaming live progress into the conversation.
 */
export default function StudioChat({ project, onProject, initialPrompt }) {
  const [messages, setMessages] = useState([
    { role: 'studio', text: 'Welcome to Editor. Describe the video you want — I will handle script, voices, assets, 3D, music, editing and export.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);
  const started = useRef(false);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  useEffect(() => {
    if (initialPrompt && !started.current) {
      started.current = true;
      submit(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const push = (m) => setMessages(prev => [...prev, m]);

  async function submit(prompt) {
    if (!prompt.trim() || busy) return;
    push({ role: 'user', text: prompt });
    setInput('');
    setBusy(true);
    try {
      const r = await fetch('/api/studio/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const { projectId, error } = await r.json();
      if (error) throw new Error(error);
      push({ role: 'studio', text: '🎬 Production started. The agents are on set…' });

      const es = new EventSource(`/api/projects/${projectId}/events`);
      es.onmessage = async (ev) => {
        const e = JSON.parse(ev.data);
        if (e.type === 'stage') {
          push({ role: 'studio', text: `${e.status === 'running' ? '▶' : e.status === 'complete' ? '✅' : '⚠️'} ${e.stage}${e.agent ? ` — ${e.agent}` : ''}${e.error ? `: ${e.error}` : ''}` });
        } else if (e.type === 'log') {
          push({ role: 'studio', text: `· ${e.msg}` });
        } else if (e.type === 'done') {
          push({ role: 'studio', text: e.status === 'complete' ? '🏁 Export ready! Open the Export tab.' : '❌ Production failed — check the pipeline view.' });
          es.close();
          setBusy(false);
        }
        const pr = await fetch(`/api/projects/${projectId}`).then(x => x.json());
        onProject(pr);
      };
      es.onerror = () => { es.close(); setBusy(false); };
    } catch (err) {
      push({ role: 'studio', text: `Error: ${err.message}` });
      setBusy(false);
    }
  }

  return (
    <div className="chat panel">
      <div className="chat-header">Chat Command Center {busy && <span className="pulse">● producing</span>}</div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        <div ref={bottom} />
      </div>
      {messages.length <= 1 && (
        <div className="examples">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => submit(e)}>{e}</button>
          ))}
        </div>
      )}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "Create a high quality documentary about Ancient Egypt"'
          disabled={busy}
        />
        <button disabled={busy}>Produce</button>
      </form>
    </div>
  );
}
