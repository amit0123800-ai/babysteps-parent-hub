import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Baby as BabyIcon, Moon, Sun, UserPlus, LogOut, Copy, Share2 } from "lucide-react";
import {
  type Baby, type BabyEvent, type EventType, type Member, ago, babyAge, describeEvent, diaperLabels, formatDuration, formatTimer, timeHM,
} from "@/lib/babysteps";
import { BottomSheet } from "./BottomSheet";
import { useNightMode, useNow } from "./hooks";
import { EmojiBadge, eventMeta, toneCls } from "./tones";
import { DiaperForm, FeedingForm, MedicineForm, TemperatureForm } from "./LogForms";
import { EditForm, Timeline } from "./Timeline";
import { Inventory } from "./Inventory";

type Sheet = null | "diaper" | "feeding" | "medicine" | "temperature" | "invite";

export function Dashboard({ babyId, userId }: { babyId: string; userId: string }) {
  const now = useNow();
  const [night, setNight] = useNightMode();
  const [tab, setTab] = useState<"today" | "inventory">("today");
  const [baby, setBaby] = useState<Baby | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
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
    return events.filter((e) => new Date(e.started_at) >= start || (e.ended_at && new Date(e.ended_at) >= start) || (!e.ended_at && e.type === "sleep"));
  }, [events]);

  async function addEvent(type: EventType, details: Record<string, any>, startedAt?: string) {
    const row: any = { baby_id: babyId, type, details, created_by: userId };
    if (startedAt) row.started_at = startedAt;
    const { error } = await supabase.from("events").insert(row);
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
    <div className="mx-auto min-h-screen max-w-md pb-80">
      <header className="sticky top-0 z-30 bg-background/90 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center justify-between">
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
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist">
          {([["today", "היום"], ["inventory", "מלאי הבית"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`h-10 rounded-xl text-sm font-semibold ${tab === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "today" ? (
        <>
          <section className="space-y-3 px-5 pt-2">
            <StatusCard type="feeding" title="האכלה אחרונה"
              main={lastFeed ? ago(lastFeed.started_at, now) : "עוד לא נרשמה"}
              sub={lastFeed ? describeEvent(lastFeed).replace(/^.*?· /, lastFeed.details.method === "bottle" ? "" : "הנקה · ") : undefined} />
            <StatusCard type="diaper" title="חיתול אחרון"
              main={lastDiaper ? ago(lastDiaper.started_at, now) : "עוד לא נרשם"}
              sub={lastDiaper ? diaperLabels[lastDiaper.details.kind] : undefined} />
            <StatusCard type="sleep" title={activeSleep ? "ישן/ה עכשיו" : "ער/ה"}
              main={activeSleep
                ? formatTimer(now - new Date(activeSleep.started_at).getTime())
                : lastSleepEnd ? `ער/ה כבר ${formatDuration(now - new Date(lastSleepEnd.ended_at!).getTime())}` : "אין נתוני שינה"}
              sub={activeSleep ? `נרדם/ה ב-${timeHM(activeSleep.started_at)}` : undefined}
              mono={!!activeSleep} />
          </section>

          <section className="px-5 pt-8">
            <h2 className="mb-3 text-lg font-semibold">ציר הזמן של היום</h2>
            <Timeline events={today} roleOf={roleOf} onEdit={setEditing} />
            <button onClick={() => supabase.auth.signOut()} className="mx-auto mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <LogOut className="h-4 w-4" /> יציאה
            </button>
          </section>
        </>
      ) : (
        <section className="px-5 pt-2">
          <Inventory babyId={babyId} now={now} />
        </section>
      )}

      {/* Quick actions — thumb zone */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-md grid-cols-5 gap-2 p-3">
          <ActionBtn type="feeding" onClick={() => setSheet("feeding")} />
          <ActionBtn type="diaper" onClick={() => setSheet("diaper")} />
          <ActionBtn type="sleep" label={activeSleep ? "התעורר/ה" : "שינה"} emoji={activeSleep ? "☀️" : undefined}
            onClick={toggleSleep} active={!!activeSleep} />
          <ActionBtn type="medicine" label="תרופות" onClick={() => setSheet("medicine")} />
          <ActionBtn type="temperature" label="חום" onClick={() => setSheet("temperature")} />
        </div>
      </nav>

      <BottomSheet open={sheet === "diaper"} onClose={() => setSheet(null)} title="🧷 חיתול">
        <DiaperForm onSave={(d) => addEvent("diaper", d)} />
      </BottomSheet>
      <BottomSheet open={sheet === "feeding"} onClose={() => setSheet(null)} title="🍼 האכלה">
        <FeedingForm onSave={(d) => addEvent("feeding", d)} />
      </BottomSheet>
      <BottomSheet open={sheet === "medicine"} onClose={() => setSheet(null)} title="💊 תרופות וויטמינים">
        <MedicineForm onSave={(d, t) => addEvent("medicine", d, t)} />
      </BottomSheet>
      <BottomSheet open={sheet === "temperature"} onClose={() => setSheet(null)} title="🌡️ חום גוף">
        <TemperatureForm onSave={(d) => addEvent("temperature", d)} />
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

function StatusCard({ type, title, main, sub, mono }: {
  type: EventType; title: string; main: string; sub?: string | undefined; mono?: boolean;
}) {
  const t = toneCls[eventMeta[type].tone];
  return (
    <div className={`flex items-center gap-4 rounded-3xl ${t.soft} p-4`}>
      <EmojiBadge type={type} size="lg" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className={`text-lg font-semibold ${mono ? "font-mono text-2xl tabular-nums" : ""}`} dir={mono ? "ltr" : undefined}>{main}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ActionBtn({ type, onClick, active, label, emoji }: {
  type: EventType; onClick: () => void; active?: boolean; label?: string | undefined; emoji?: string | undefined;
}) {
  const m = eventMeta[type];
  const t = toneCls[m.tone];
  return (
    <button onClick={onClick} aria-label={m.label}
      className={`tap flex h-20 flex-col items-center justify-center gap-1 rounded-2xl font-semibold ${
        active ? `${t.solid} text-primary-foreground` : `${t.soft} ${t.text}`}`}>
      <span className="text-3xl leading-none" aria-hidden>{emoji ?? m.emoji}</span>
      <span className="text-xs">{label ?? m.label}</span>
    </button>
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
