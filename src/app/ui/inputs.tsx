export function NumberPad({ onPick }: { onPick: (n: number) => void }) {
  return (
    <div className="numpad">
      {[1, 2, 3, 4].map((n) => (
        <button key={n} className="num" onClick={() => onPick(n)}>{n}</button>
      ))}
    </div>
  );
}

export function YesNo({ onPick }: { onPick: (id: "self-atari" | "safe") => void }) {
  return (
    <div className="yesno">
      <button className="num" onClick={() => onPick("self-atari")}>Self-atari</button>
      <button className="num" onClick={() => onPick("safe")}>Safe</button>
    </div>
  );
}
