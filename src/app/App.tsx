import { useMemo, useState } from "react";
import { createStore } from "./store";
import { MapViewModel } from "./vm/map-vm";
import { PlayerViewModel } from "./vm/player-vm";
import { MapScreen } from "./ui/MapScreen";
import { PlayerScreen } from "./ui/PlayerScreen";

type Nav = { screen: "map" } | { screen: "play"; topic: number; rung: number };

export function App() {
  const store = useMemo(() => createStore(), []);
  const map = useMemo(() => new MapViewModel(store.bank, store.progress), [store]);
  const [nav, setNav] = useState<Nav>({ screen: "map" });

  const player = useMemo(
    () => (nav.screen === "play" ? new PlayerViewModel(store.bank, store.progress, nav.topic, nav.rung) : null),
    [store, nav],
  );

  return (
    <div className="app">
      <header className="topbar"><span className="brand">Two Eyes</span></header>
      {nav.screen === "map" && (
        <MapScreen map={map} onOpen={(topic, rung) => setNav({ screen: "play", topic, rung })} />
      )}
      {nav.screen === "play" && player && (
        <PlayerScreen player={player} onExit={() => { map.refresh(); setNav({ screen: "map" }); }} />
      )}
    </div>
  );
}
