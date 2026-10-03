import { useState } from "react";
import { ChoiceButton } from "./BottomSheet";
import { tempStatus, tempStatusLabels, toLocalInput, type TempStatus } from "@/lib/babysteps";

/** onSave receives the event details and an optional ISO start time. */
export type SaveFn = (details: Record<string, any>, startedAt?: string) => void;

export const fieldCls =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring";

function withNote(d: Record<string, any>, note: string) {
  const n = note.trim();
  return n ? { ...d, note: n } : d;
}

export function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={140}
      placeholder="הערה קצרה (אופציונלי)"
      className={fieldCls}
    />
  );
}

function SaveButton({ onClick, disabled, children = "שמירה" }: { onClick: () => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="tap h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-50">
      {children}
    </button>
  );
}

export function DiaperForm({ onSave, initial }: { onSave: SaveFn; initial?: any }) {
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const opts = [
    { kind: "wet", emoji: "💧", label: "פיפי" },
    { kind: "dirty", emoji: "💩", label: "קקי" },
    { kind: "both", emoji: "✨", label: "שניהם" },
  ];
  return (
    <div className="space-y-4">
      <NoteField value={note} onChange={setNote} />
      <div className="grid grid-cols-3 gap-3">
        {opts.map((o) => (
          <ChoiceButton key={o.kind} active={initial?.kind === o.kind} className="min-h-24 text-lg"
            onClick={() => onSave(withNote({ kind: o.kind }, note))}>
            <span className="text-2xl">{o.emoji}</span><span>{o.label}</span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export function FeedingForm({ onSave, initial }: { onSave: SaveFn; initial?: any }) {
  const [method, setMethod] = useState<"bottle" | "breast">(initial?.method ?? "bottle");
  const [side, setSide] = useState<string>(initial?.side ?? "left");
  const [minutes, setMinutes] = useState<number>(initial?.minutes ?? 10);
  const [custom, setCustom] = useState<string>("");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const customMl = Number(custom);
  const customValid = Number.isFinite(customMl) && customMl > 0 && customMl <= 500;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {(["bottle", "breast"] as const).map((m) => (
          <button key={m} onClick={() => setMethod(m)}
            className={`h-11 rounded-xl text-sm font-medium ${method === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            {m === "bottle" ? "🍼 בקבוק" : "🤱 הנקה"}
          </button>
        ))}
      </div>
      <NoteField value={note} onChange={setNote} />
      {method === "bottle" ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[60, 90, 120, 150].map((ml) => (
              <ChoiceButton key={ml} active={initial?.ml === ml} className="min-h-16 text-lg"
                onClick={() => onSave(withNote({ method: "bottle", ml }, note))}>
                {ml}<span className="text-xs">מ״ל</span>
              </ChoiceButton>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="number" inputMode="numeric" min={1} max={500} value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="כמות מותאמת אישית (מ״ל)" className={fieldCls} />
            <button disabled={!customValid}
              onClick={() => onSave(withNote({ method: "bottle", ml: Math.round(customMl) }, note))}
              className="tap h-12 shrink-0 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">
              שמירה
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ChoiceButton active={side === "right"} onClick={() => setSide("right")}>ימין</ChoiceButton>
            <ChoiceButton active={side === "left"} onClick={() => setSide("left")}>שמאל</ChoiceButton>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">משך (דקות)</p>
            <div className="grid grid-cols-5 gap-2">
              {[5, 10, 15, 20, 30].map((m) => (
                <ChoiceButton key={m} active={minutes === m} className="min-h-12" onClick={() => setMinutes(m)}>{m}</ChoiceButton>
              ))}
            </div>
          </div>
          <SaveButton onClick={() => onSave(withNote({ method: "breast", side, minutes }, note))} />
        </>
      )}
    </div>
  );
}

const commonMeds = ["ויטמין D", "ברזל", "אקמול", "נורופן"];

export function MedicineForm({ onSave, initial, showTime = true }: { onSave: SaveFn; initial?: any; showTime?: boolean }) {
  const [name, setName] = useState<string>(initial?.name ?? "");
  const [dosage, setDosage] = useState<string>(initial?.dosage ?? "");
  const [time, setTime] = useState<string>(toLocalInput(new Date().toISOString()));
  const [note, setNote] = useState<string>(initial?.note ?? "");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {commonMeds.map((m) => (
          <button key={m} onClick={() => setName(m)}
            className={`tap h-10 rounded-full border px-4 text-sm ${name === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {m}
          </button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם התרופה / ויטמין" className={fieldCls} />
      <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="מינון (למשל 5 מ״ל, 1 טיפה)" className={fieldCls} />
      {showTime && (
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">שעה (אופציונלי)</label>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className={fieldCls} />
        </div>
      )}
      <NoteField value={note} onChange={setNote} />
      <SaveButton disabled={!name.trim()}
        onClick={() => onSave(withNote({ name: name.trim(), dosage: dosage.trim() }, note),
          showTime && time ? new Date(time).toISOString() : undefined)} />
    </div>
  );
}

const statusCls: Record<TempStatus, string> = {
  normal: "bg-ok-soft text-ok",
  elevated: "bg-warn-soft text-warn",
  fever: "bg-danger-soft text-danger",
};

export function TemperatureForm({ onSave, initial }: { onSave: SaveFn; initial?: any }) {
  const [value, setValue] = useState<string>(initial?.celsius ? String(initial.celsius) : "36.8");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const c = Number(value);
  const valid = Number.isFinite(c) && c >= 34 && c <= 43;
  const status = valid ? tempStatus(c) : null;
  const step = (d: number) => setValue((Math.round(((valid ? c : 36.8) + d) * 10) / 10).toFixed(1));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3" dir="ltr">
        <button onClick={() => step(-0.1)} className="tap h-14 w-14 rounded-2xl bg-muted text-2xl font-bold">−</button>
        <div className="flex items-baseline gap-1">
          <input type="number" inputMode="decimal" step={0.1} value={value} onChange={(e) => setValue(e.target.value)}
            className="h-16 w-28 rounded-2xl border border-input bg-background text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring" />
          <span className="text-xl text-muted-foreground">°C</span>
        </div>
        <button onClick={() => step(0.1)} className="tap h-14 w-14 rounded-2xl bg-muted text-2xl font-bold">+</button>
      </div>
      <div className="flex justify-center">
        {status && <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${statusCls[status]}`}>{tempStatusLabels[status]}</span>}
      </div>
      <NoteField value={note} onChange={setNote} />
      <SaveButton disabled={!valid}
        onClick={() => onSave(withNote({ celsius: Math.round(c * 10) / 10, status }, note))} />
    </div>
  );
}

export function SleepNoteForm({ onSave, initial }: { onSave: SaveFn; initial?: any }) {
  const [note, setNote] = useState<string>(initial?.note ?? "");
  return (
    <div className="space-y-3">
      <NoteField value={note} onChange={setNote} />
      <SaveButton onClick={() => onSave(withNote({}, note))} />
    </div>
  );
}
