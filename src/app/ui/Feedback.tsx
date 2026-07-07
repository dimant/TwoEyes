export function Feedback({
  phase, prompt, onNext, onRetry,
}: { phase: "correct" | "wrong" | "revealed"; prompt: string; onNext: () => void; onRetry: () => void }) {
  const ok = phase === "correct";
  const title = phase === "correct" ? "Correct!" : phase === "revealed" ? "Here's the move" : "Try again";
  return (
    <div className={`feedback ${ok ? "ok" : "no"}`}>
      <div className="fb-row">
        <span className="fb-ic">{ok ? "✓" : phase === "revealed" ? "◉" : "↺"}</span>
        <span className="fb-tx"><b>{title}</b>{prompt ? ` ${prompt}` : ""}</span>
      </div>
      {phase === "wrong"
        ? <button className="btn ghost" onClick={onRetry}>Try again</button>
        : <button className="btn" onClick={onNext}>Next →</button>}
    </div>
  );
}
