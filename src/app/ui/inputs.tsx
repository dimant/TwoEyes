export interface ChoiceOption { id: string; label: string; }

export function NumberPad({ onPick }: { onPick: (n: number) => void }) {
  return (
    <div className="numpad">
      {[1, 2, 3, 4].map((n) => (
        <button key={n} className="num" onClick={() => onPick(n)}>{n}</button>
      ))}
    </div>
  );
}

export function YesNo({ options, onPick }: { options: [ChoiceOption, ChoiceOption]; onPick: (id: string) => void }) {
  return (
    <div className="yesno">
      {options.map((o) => (
        <button key={o.id} className="num" onClick={() => onPick(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}
