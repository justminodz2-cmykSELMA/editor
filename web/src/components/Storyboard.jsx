import React from 'react';

/** Storyboard view: every scene/shot with its generated visual, camera notes and transition. */
export default function Storyboard({ project }) {
  const sb = project?.stages?.storyboard?.output;
  const assets = project?.stages?.assets?.output?.images || [];
  if (!sb) return <div className="panel empty">The storyboard appears here once planned.</div>;
  return (
    <div className="panel">
      <h2>Storyboard</h2>
      {(sb.scenes || []).map((scene) => (
        <div key={scene.id} className="scene">
          <h3>Scene {scene.id}</h3>
          <div className="shots">
            {(scene.shots || []).map((shot) => {
              const img = assets.find(a => a.shotId === shot.id && a.sceneId === scene.id);
              return (
                <div key={shot.id} className="shot">
                  {img && <img src={`/output/${project.id}/assets/${img.file.split('/').pop()}`} alt="" />}
                  <p className="desc">{shot.description}</p>
                  <p className="meta">
                    {shot.framing} · {shot.angle} · {shot.movement} · {shot.durationSec}s → {shot.transition}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
