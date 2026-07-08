import { useRef } from "react";
import { useViewModel } from "../useViewModel";
import type { MapViewModel } from "../vm/map-vm";

export const TOPIC_TITLES: Record<number, string> = {
  1: "Liberties", 2: "Capture a stone", 3: "Capture a group",
  4: "Escape atari", 5: "Don't self-atari", 6: "Double atari",
  7: "Connect & cut", 10: "Net", 11: "Snapback",
};

const TAP_WINDOW_MS = 700;

export function MapScreen({ map, onOpen }: { map: MapViewModel; onOpen: (topic: number, rung: number) => void }) {
  const s = useViewModel(map);
  // Count taps ourselves rather than relying on MouseEvent.detail, which touch
  // devices don't increment (every tap reports detail:1). Three quick taps on the
  // same locked topic within the window jumps in (a skip-ahead shortcut).
  const taps = useRef<{ topic: number; count: number; at: number }>({ topic: -1, count: 0, at: 0 });

  const handleTap = (topic: number, rung: number, unlocked: boolean): void => {
    if (unlocked) { onOpen(topic, rung); return; }
    const now = Date.now();
    const t = taps.current;
    if (t.topic === topic && now - t.at < TAP_WINDOW_MS) t.count += 1;
    else { t.topic = topic; t.count = 1; }
    t.at = now;
    if (t.count >= 3) { t.count = 0; onOpen(topic, rung); }
  };

  return (
    <div className="screen map">
      <div className="map-head">
        <div className="eyebrow">Stage A · Capturing basics</div>
        <h2>Your path</h2>
      </div>
      <ul className="topics">
        {s.rows.map((r) => (
          <li key={r.topic}>
            <button
              className={`tcard ${r.cleared ? "done" : r.unlocked ? "cur" : "lock"}`}
              onClick={() => handleTap(r.topic, r.openRung, r.unlocked)}
              title={r.unlocked ? undefined : "Locked — tap 3× to jump in"}
            >
              <span className="idx">{r.cleared ? "✓" : r.topic}</span>
              <span className="tmeta">
                <b>{TOPIC_TITLES[r.topic] ?? `Topic ${r.topic}`}</b>
                <span>{r.rungsCleared}/{r.rungsTotal} rungs</span>
              </span>
              <span className="tstate">{r.cleared ? "✓" : r.unlocked ? "Start" : "🔒"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
