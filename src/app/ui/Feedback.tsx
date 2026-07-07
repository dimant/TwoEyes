export function Feedback({
  phase, onNext, onRetry,
}: { phase: "correct" | "wrong" | "revealed"; onNext: () => void; onRetry: () => void }) {
  const ok = phase === "correct";
  const title = phase === "correct" ? "Correct!" : phase === "revealed" ? "Here's the move" : "Try again";
  return (
    <div className={`feedback ${ok ? "ok" : "no"}`}>
      <div className="fb-row">
        <span className="fb-ic">{ok ? "✓" : phase === "revealed" ? "◉" : "↺"}</span>
        <span className="fb-tx"><b>{title}</b></span>
      </div>
      {phase === "wrong"
        ? <button className="btn ghost" onClick={onRetry}>Try again</button>
        : <button className="btn" onClick={onNext}>Next →</button>}
    </div>
  );
}
