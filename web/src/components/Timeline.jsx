import React from 'react';

/** Timeline view: assembled clip sequence with durations, transitions and audio layers. */
export default function Timeline({ project }) {
  const timeline = project?.stages?.editing?.output?.timeline || [];
  const audio = project?.stages?.audioMix?.output;
  if (!timeline.length) return <div className="panel empty">The timeline appears here after editing.</div>;
  const total = timeline.reduce((s, c) => s + (c.durationSec || 0), 0);
  return (
    <div className="panel">
      <h2>Timeline <span className="meta">{Math.round(total)}s total</span></h2>
      <div className="track video-track">
        {timeline.map((c, i) => (
          <div key={i} className={`clip ${c.video ? 'is3d' : ''}`} style={{ flex: c.durationSec }}
            title={`${c.shotId} · ${c.durationSec}s · ${c.transition}`}>
            <span>{c.shotId}</span>
          </div>
        ))}
      </div>
      {audio && (
        <>
          <div className="track audio-track">
            <div className="clip music" style={{ flex: 1 }}><span>🎵 {audio.music?.[0]?.mood} {audio.music?.[0]?.genre}</span></div>
          </div>
          <div className="track audio-track">
            {(audio.sfxFiles || []).map((s, i) => (
              <div key={i} className="clip sfx" style={{ flex: 1 }}><span>🔊 {s.name}</span></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
