import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Baby as BabyIcon, Droplets, Milk, Moon, Sun, Sunrise, UserPlus, LogOut, Pencil, Trash2, Copy, Share2 } from "lucide-react";
import {
  type Baby, type BabyEvent, type Member, ago, babyAge, describeEvent, diaperLabels, formatDuration, formatTimer, timeHM, toLocalInput,
} from "@/lib/babysteps";
import { BottomSheet, ChoiceButton } from "./BottomSheet";

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(t); }, [interval]);
  return now;
}

function useNightMode() {
  const [night, setNight] = useState(false);
  useEffect(() => { setNight(localStorage.getItem("bs_night") === "1"); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("night", night);
    localStorage.setItem("bs_night", night ? "1" : "0");
  }, [night]);
  return [night, setNight] as const;
}

export function Dashboard({ babyId, userId }: { babyId: string; userId: string }) {
  const now = useNow();
  const [night, setNight] = useNightMode();
  const [baby, setBaby] = useState<Baby | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [sheet, setSheet] = useState<null | "diaper" | "feeding" | "invite">(null);
  const [editing, setEditing] = useState<BabyEvent | null>(null);

  const loadEvents = useCallback(async () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data } = await supabase.from("events").select("*").eq("baby_id", babyId)
      .gte("started_at", since).order("started_at", { ascending: false });
    setEvents((data ?? []) as BabyEvent[]);
  }, [babyId]);

  useEffect(() => {
    supabase.from("babies").select("*").eq("id", babyId).single().then(({ data }) => setBaby(data as Baby));
    supabase.from("family_members").select("user_id, role_label").eq("baby_id", babyId).then(({ data }) => setMembers(data ?? []));
    loadEvents();
    const channel = supabase
      .channel(`events-${babyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `baby_id=eq.${babyId}` }, (payload) => {
        setEvents((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== (payload.old as any).id);
          const row = payload.new as BabyEvent;
          const rest = prev.filter((e) => e.id !== row.id);
          return [row, ...rest].sort((a, b) => b.started_at.localeCompare(a.started_at));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [babyId, loadEvents]);

  const roleOf = (uid: string) => members.find((m) => m.user_id === uid)?.role_label ?? "הורה";

  const lastFeed = events.find((e) => e.type === "feeding");
  const lastDiaper = events.find((e) => e.type === "diaper");
  const activeSleep = events.find((e) => e.type === "sleep" && !e.ended_at);
  const lastSleepEnd = events.filter((e) => e.type === "sleep" && e.ended_at)
    .sort((a, b) => b.ended_at!.localeCompare(a.ended_at!))[0];

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return events.filter((e) => new Date(e.started_at) >= start || (e.ended_at && new Date(e.ended_at) >= start) || !e.ended_at && e.type === "sleep");
  }, [events]);

  async function addEvent(type: string, details: Record<string, any>) {
    const { error } = await supabase.from("events").insert({ baby_id: babyId, type, details, created_by: userId });
    if (error) { toast.error("השמירה נכשלה"); return; }
    setSheet(null);
    toast.success("נשמר ✓");
  }

  async function toggleSleep() {
    if (activeSleep) {
      const { error } = await supabase.from("events").update({ ended_at: new Date().toISOString() }).eq("id", activeSleep.id);
      if (error) { toast.error("השמירה נכשלה"); return; }
      toast.success("בוקר טוב ☀️");
    } else {
      await addEvent("sleep", {});
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md pb-72">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/90 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <BabyIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{baby?.name ?? "…"}</h1>
            <p className="text-sm text-muted-foreground">{baby ? babyAge(baby.birthdate, now) : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="הזמנת בן משפחה" onClick={() => setSheet("invite")}><UserPlus className="h-5 w-5" /></IconBtn>
          <IconBtn label={night ? "מצב יום" : "מצב לילה"} onClick={() => setNight(!night)}>
            {night ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </IconBtn>
        </div>
      </header>

      {/* Status cards */}
      <section className="space-y-3 px-5 pt-2">
        <StatusCard tone="feed" icon={<Milk className="h-6 w-6" />} title="האכלה אחרונה"
          main={lastFeed ? ago(lastFeed.started_at, now) : "עוד לא נרשמה"}
          sub={lastFeed ? (lastFeed.details.method === "bottle" ? `${lastFeed.details.ml} מ״ל` : `הנקה · ${lastFeed.details.side === "left" ? "שמאל" : "ימין"} · ${lastFeed.details.minutes} דק׳`) : undefined} />
        <StatusCard tone="diaper" icon={<Droplets className="h-6 w-6" />} title="חיתול אחרון"
          main={lastDiaper ? ago(lastDiaper.started_at, now) : "עוד לא נרשם"}
          sub={lastDiaper ? diaperLabels[lastDiaper.details.kind] : undefined} />
        <StatusCard tone="sleep" icon={activeSleep ? <Moon className="h-6 w-6" /> : <Sunrise className="h-6 w-6" />}
          title={activeSleep ? "ישן/ה עכשיו" : "ער/ה"}
          main={activeSleep
            ? formatTimer(now - new Date(activeSleep.started_at).getTime())
            : lastSleepEnd ? `ער/ה כבר ${formatDuration(now - new Date(lastSleepEnd.ended_at!).getTime())}` : "אין נתוני שינה"}
          sub={activeSleep ? `נרדם/ה ב-${timeHM(activeSleep.started_at)}` : undefined}
          mono={!!activeSleep} />
      </section>

      {/* Timeline */}
      <section className="px-5 pt-8">
        <h2 className="mb-3 text-lg font-semibold">היום</h2>
        {today.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">אין עדיין אירועים היום</p>
        ) : (
          <ol className="space-y-2">
            {today.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <TypeDot type={e.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{describeEvent(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeHM(e.started_at)}{e.ended_at && e.type === "sleep" ? ` – ${timeHM(e.ended_at)}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{roleOf(e.created_by)}</span>
                <button onClick={() => setEditing(e)} aria-label="עריכה" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <button onClick={() => supabase.auth.signOut()} className="mx-auto mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <LogOut className="h-4 w-4" /> יציאה
        </button>
      </section>

      {/* Quick actions — thumb zone */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-md grid-cols-3 gap-3 p-4">
          <ActionBtn tone="diaper" icon={<Droplets className="h-8 w-8" />} label="חיתול" onClick={() => setSheet("diaper")} />
          <ActionBtn tone="feed" icon={<Milk className="h-8 w-8" />} label="האכלה" onClick={() => setSheet("feeding")} />
          <ActionBtn tone="sleep" icon={activeSleep ? <Sun className="h-8 w-8" /> : <Moon className="h-8 w-8" />}
            label={activeSleep ? "התעורר/ה" : "שינה"} onClick={toggleSleep} active={!!activeSleep} />
        </div>
      </nav>

      <BottomSheet open={sheet === "diaper"} onClose={() => setSheet(null)} title="חיתול">
        <div className="grid grid-cols-3 gap-3">
          <ChoiceButton className="min-h-24 text-lg" onClick={() => addEvent("diaper", { kind: "wet" })}>💧<span>פיפי</span></ChoiceButton>
          <ChoiceButton className="min-h-24 text-lg" onClick={() => addEvent("diaper", { kind: "dirty" })}>💩<span>קקי</span></ChoiceButton>
          <ChoiceButton className="min-h-24 text-lg" onClick={() => addEvent("diaper", { kind: "both" })}>✨<span>שניהם</span></ChoiceButton>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "feeding"} onClose={() => setSheet(null)} title="האכלה">
        <FeedingForm onSave={(d) => addEvent("feeding", d)} />
      </BottomSheet>

      <BottomSheet open={sheet === "invite"} onClose={() => setSheet(null)} title="הזמנת בן/בת משפחה">
        {baby && <InvitePanel code={baby.invite_code} members={members} />}
      </BottomSheet>

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title="עריכת אירוע">
        {editing && <EditForm key={editing.id} event={editing} onDone={() => setEditing(null)} />}
      </BottomSheet>
    </div>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground">
      {children}
    </button>
  );
}

const toneCls = {
  feed: { soft: "bg-feed-soft", text: "text-feed", solid: "bg-feed" },
  diaper: { soft: "bg-diaper-soft", text: "text-diaper", solid: "bg-diaper" },
  sleep: { soft: "bg-sleep-soft", text: "text-sleep", solid: "bg-sleep" },
} as const;

function StatusCard({ tone, icon, title, main, sub, mono }: {
  tone: keyof typeof toneCls; icon: React.ReactNode; title: string; main: string; sub?: string | undefined; mono?: boolean;
}) {
  const t = toneCls[tone];
  return (
    <div className={`flex items-center gap-4 rounded-3xl ${t.soft} p-4`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card ${t.text}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className={`text-lg font-semibold ${mono ? "font-mono tabular-nums text-2xl" : ""}`} dir={mono ? "ltr" : undefined}>{main}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ActionBtn({ tone, icon, label, onClick, active }: {
  tone: keyof typeof toneCls; icon: React.ReactNode; label: string; onClick: () => void; active?: boolean;
}) {
  const t = toneCls[tone];
  return (
    <button onClick={onClick}
      className={`tap flex h-24 flex-col items-center justify-center gap-1.5 rounded-3xl font-semibold ${
        active ? `${t.solid} text-primary-foreground` : `${t.soft} ${t.text}`}`}>
      {icon}
      <span className="text-base">{label}</span>
    </button>
  );
}

function TypeDot({ type }: { type: string }) {
  const map: Record<string, [keyof typeof toneCls, React.ReactNode]> = {
    feeding: ["feed", <Milk key="m" className="h-4 w-4" />],
    diaper: ["diaper", <Droplets key="d" className="h-4 w-4" />],
    sleep: ["sleep", <Moon key="s" className="h-4 w-4" />],
  };
  const [tone, icon] = map[type] ?? map["feeding"]!;
  return <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneCls[tone].soft} ${toneCls[tone].text}`}>{icon}</div>;
}

function FeedingForm({ onSave, initial }: { onSave: (d: Record<string, any>) => void; initial?: any }) {
  const [method, setMethod] = useState<"bottle" | "breast">(initial?.method ?? "bottle");
  const [side, setSide] = useState<string>(initial?.side ?? "left");
  const [minutes, setMinutes] = useState<number>(initial?.minutes ?? 10);
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
      {method === "bottle" ? (
        <div className="grid grid-cols-2 gap-3">
          {[60, 90, 120, 150].map((ml) => (
            <ChoiceButton key={ml} active={initial?.ml === ml} className="min-h-20 text-xl" onClick={() => onSave({ method: "bottle", ml })}>
              {ml} <span className="text-xs">מ״ל</span>
            </ChoiceButton>
          ))}
        </div>
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
          <button onClick={() => onSave({ method: "breast", side, minutes })}
            className="tap h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">שמירה</button>
        </>
      )}
    </div>
  );
}

function InvitePanel({ code, members }: { code: string; members: Member[] }) {
  const link = typeof window !== "undefined" ? `${window.location.origin}/?code=${code}` : "";
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "BabySteps", text: `הצטרפו למעקב ב-BabySteps עם הקוד ${code}`, url: link }); } catch {}
    } else {
      await navigator.clipboard.writeText(link); toast.success("הקישור הועתק");
    }
  }
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">שתפו את הקוד או הקישור עם בן/בת הזוג</p>
      <button onClick={() => { navigator.clipboard.writeText(code); toast.success("הקוד הועתק"); }}
        className="tap mx-auto flex items-center gap-3 rounded-2xl bg-muted px-6 py-4" dir="ltr">
        <span className="font-mono text-3xl font-bold tracking-[0.3em]">{code}</span>
        <Copy className="h-5 w-5 text-muted-foreground" />
      </button>
      <button onClick={share} className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
        <Share2 className="h-5 w-5" /> שיתוף קישור
      </button>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {members.map((m) => (
          <span key={m.user_id} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{m.role_label}</span>
        ))}
      </div>
    </div>
  );
}

function EditForm({ event, onDone }: { event: BabyEvent; onDone: () => void }) {
  const [start, setStart] = useState(toLocalInput(event.started_at));
  const [end, setEnd] = useState(event.ended_at ? toLocalInput(event.ended_at) : "");
  const [details, setDetails] = useState<any>(event.details);

  async function save(d = details) {
    const { error } = await supabase.from("events").update({
      started_at: new Date(start).toISOString(),
      ended_at: event.type === "sleep" && end ? new Date(end).toISOString() : event.ended_at,
      details: d,
    }).eq("id", event.id);
    if (error) { toast.error("השמירה נכשלה"); return; }
    toast.success("עודכן"); onDone();
  }
  async function remove() {
    if (!confirm("למחוק את האירוע?")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) { toast.error("המחיקה נכשלה"); return; }
    toast.success("נמחק"); onDone();
  }
  const input = "h-12 w-full rounded-xl border border-input bg-background px-3 text-base";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted-foreground">{event.type === "sleep" ? "התחלה" : "שעה"}</label>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
      </div>
      {event.type === "sleep" && (
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">סיום</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
        </div>
      )}
      {event.type === "diaper" && (
        <div className="grid grid-cols-3 gap-2">
          {(["wet", "dirty", "both"] as const).map((k) => (
            <ChoiceButton key={k} active={details.kind === k} onClick={() => setDetails({ kind: k })}>{diaperLabels[k]}</ChoiceButton>
          ))}
        </div>
      )}
      {event.type === "feeding" && (
        <FeedingForm initial={details} onSave={(d) => { setDetails(d); save(d); }} />
      )}
      <div className="flex gap-3">
        {!(event.type === "feeding") && (
          <button onClick={() => save()} className="tap h-12 flex-1 rounded-2xl bg-primary font-semibold text-primary-foreground">שמירה</button>
        )}
        <button onClick={remove} className="tap flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive/15 font-semibold text-destructive">
          <Trash2 className="h-4 w-4" /> מחיקה
        </button>
      </div>
    </div>
  );
}
