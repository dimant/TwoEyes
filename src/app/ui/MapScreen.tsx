import { useViewModel } from "../useViewModel";
import type { MapViewModel } from "../vm/map-vm";

export const TOPIC_TITLES: Record<number, string> = {
  1: "Liberties", 2: "Capture a stone", 3: "Capture a group",
  4: "Escape atari", 5: "Don't self-atari", 6: "Double atari",
};

export function MapScreen({ map, onOpen }: { map: MapViewModel; onOpen: (topic: number, rung: number) => void }) {
  const s = useViewModel(map);
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
              disabled={!r.unlocked}
              onClick={() => onOpen(r.topic, r.openRung)}
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
