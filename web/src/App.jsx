import React, { useState } from 'react';
import StudioChat from './components/StudioChat.jsx';
import PipelineView from './components/PipelineView.jsx';
import Storyboard from './components/Storyboard.jsx';
import Timeline from './components/Timeline.jsx';

/**
 * Main dashboard with the built-in AI Creative Studio (chat command center).
 * One prompt in the chat → full production. Every stage is inspectable and editable.
 */
export default function App() {
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('pipeline');

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">🎬 AI Creative Studio</div>
        <nav>
          {['pipeline', 'storyboard', 'timeline', 'export'].map(t => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      <main className="layout">
        <section className="left">
          <StudioChat project={project} onProject={setProject} />
        </section>
        <section className="right">
          {tab === 'pipeline' && <PipelineView project={project} />}
          {tab === 'storyboard' && <Storyboard project={project} />}
          {tab === 'timeline' && <Timeline project={project} />}
          {tab === 'export' && <ExportPanel project={project} />}
        </section>
      </main>
    </div>
  );
}

function ExportPanel({ project }) {
  const render = project?.stages?.render?.output;
  const thumb = project?.stages?.thumbnail?.output;
  const yt = project?.stages?.youtube?.output;
  if (!render?.url) return <div className="panel empty">The export appears here when the render completes.</div>;
  return (
    <div className="panel">
      <h2>Export</h2>
      <video src={render.url} controls className="preview" />
      {thumb?.file && <p>✅ Thumbnail generated</p>}
      {yt && (
        <div className="yt">
          <h3>{yt.title}</h3>
          <pre>{yt.description}</pre>
          <p className="tags">{(yt.tags || []).map(t => `#${t}`).join(' ')}</p>
        </div>
      )}
      <a className="btn" href={render.url} download>Download MP4</a>
    </div>
  );
}
