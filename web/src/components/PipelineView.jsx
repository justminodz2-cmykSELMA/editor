import React from 'react';

const STAGES = [
  'direction', 'research', 'script', 'storyboard', 'voice', 'assets', 'scenes3d',
  'animations', 'motionGraphics', 'vfx', 'editing', 'audioMix', 'colorGrading',
  'subtitles', 'thumbnail', 'youtube', 'render',
];

/** Live view of the autonomous production pipeline with per-stage output inspection. */
export default function PipelineView({ project }) {
  if (!project) return <div className="panel empty">Start a production in the chat to see the pipeline.</div>;
  return (
    <div className="panel">
      <h2>Production Pipeline</h2>
      <div className="pipeline">
        {STAGES.map((s) => {
          const st = project.stages?.[s];
          const cls = st?.status || 'pending';
          return (
            <details key={s} className={`stage ${cls}`}>
              <summary>
                <span className="dot" /> {s}
                <span className="status">{st?.edited ? 'edited' : cls}</span>
              </summary>
              {st?.output && <pre>{JSON.stringify(st.output, null, 2).slice(0, 4000)}</pre>}
              {st?.error && <p className="error">{st.error}</p>}
            </details>
          );
        })}
      </div>
    </div>
  );
}
