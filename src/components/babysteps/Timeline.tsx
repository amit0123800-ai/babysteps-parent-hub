import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { type BabyEvent, describeEvent, timeHM, toLocalInput } from "@/lib/babysteps";
import { EmojiBadge } from "./tones";
import { DiaperForm, FeedingForm, MedicineForm, SleepNoteForm, TemperatureForm, fieldCls, type SaveFn } from "./LogForms";

export function Timeline({ events, roleOf, onEdit }: {
  events: BabyEvent[]; roleOf: (uid: string) => string; onEdit: (e: BabyEvent) => void;
}) {
  if (events.length === 0)
    return <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">אין עדיין אירועים היום</p>;
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
          <EmojiBadge type={e.type} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{describeEvent(e)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {timeHM(e.started_at)}{e.ended_at && e.type === "sleep" ? ` – ${timeHM(e.ended_at)}` : ""}
              {e.details?.note ? ` · ${e.details.note}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{roleOf(e.created_by)}</span>
          <button onClick={() => onEdit(e)} aria-label="עריכה" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <Pencil className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function EditForm({ event, onDone }: { event: BabyEvent; onDone: () => void }) {
  const [start, setStart] = useState(toLocalInput(event.started_at));
  const [end, setEnd] = useState(event.ended_at ? toLocalInput(event.ended_at) : "");

  const save: SaveFn = async (details) => {
    const { error } = await supabase.from("events").update({
      started_at: new Date(start).toISOString(),
      ended_at: event.type === "sleep" && end ? new Date(end).toISOString() : event.ended_at,
      details,
    }).eq("id", event.id);
    if (error) { toast.error("השמירה נכשלה"); return; }
    toast.success("עודכן"); onDone();
  };
  async function remove() {
    if (!confirm("למחוק את האירוע?")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) { toast.error("המחיקה נכשלה"); return; }
    toast.success("נמחק"); onDone();
  }

  const d = event.details;
  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto">
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">{event.type === "sleep" ? "התחלה" : "שעה"}</label>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={fieldCls} />
      </div>
      {event.type === "sleep" && (
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">סיום</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={fieldCls} />
        </div>
      )}
      {event.type === "diaper" && <DiaperForm initial={d} onSave={save} />}
      {event.type === "feeding" && <FeedingForm initial={d} onSave={save} />}
      {event.type === "medicine" && <MedicineForm initial={d} onSave={save} showTime={false} />}
      {event.type === "temperature" && <TemperatureForm initial={d} onSave={save} />}
      {event.type === "sleep" && <SleepNoteForm initial={d} onSave={save} />}
      <button onClick={remove} className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-destructive/15 font-semibold text-destructive">
        <Trash2 className="h-4 w-4" /> מחיקה
      </button>
    </div>
  );
}
