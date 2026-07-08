import { useMemo, useState } from "react";
import { createStore } from "./store";
import { MapViewModel } from "./vm/map-vm";
import { PlayerViewModel } from "./vm/player-vm";
import { MapScreen } from "./ui/MapScreen";
import { PlayerScreen } from "./ui/PlayerScreen";
import { LessonScreen } from "./ui/LessonScreen";
import { lessonFor } from "./content/lessons";

type Nav = { screen: "map" } | { screen: "play"; topic: number; rung: number };

export function App() {
  const store = useMemo(() => createStore(), []);
  const map = useMemo(() => new MapViewModel(store.bank, store.progress), [store]);
  const [nav, setNav] = useState<Nav>({ screen: "map" });
  const [lessonTopic, setLessonTopic] = useState<number | null>(null);

  const player = useMemo(
    () => (nav.screen === "play" ? new PlayerViewModel(store.bank, store.progress, nav.topic, nav.rung) : null),
    [store, nav],
  );

  // On the map, a Learn tap opens the concept lesson as a full-screen takeover
  // (same pattern as PlayerScreen). Dismissing marks it seen and returns to the map.
  const mapLesson = lessonTopic != null ? lessonFor(lessonTopic) : undefined;
  const dismissMapLesson = () => {
    if (lessonTopic != null) store.progress.markLessonSeen(lessonTopic);
    setLessonTopic(null);
  };

  return (
    <div className="app">
      <header className="topbar"><span className="brand">Two Eyes</span></header>
      {nav.screen === "map" && (
        mapLesson ? (
          <LessonScreen lesson={mapLesson} onDismiss={dismissMapLesson} />
        ) : (
          <MapScreen
            map={map}
            onOpen={(topic, rung) => setNav({ screen: "play", topic, rung })}
            onLearn={setLessonTopic}
          />
        )
      )}
      {nav.screen === "play" && player && (
        <PlayerScreen
          key={`${nav.topic}-${nav.rung}`}
          player={player}
          onExit={() => { map.refresh(); setNav({ screen: "map" }); }}
          lesson={lessonFor(nav.topic)}
          lessonSeen={store.progress.lessonSeen(nav.topic)}
          onLessonSeen={() => store.progress.markLessonSeen(nav.topic)}
        />
      )}
    </div>
  );
}
