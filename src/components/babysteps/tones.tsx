import type { EventType } from "@/lib/babysteps";

export const toneCls = {
  feed: { soft: "bg-feed-soft", text: "text-feed", solid: "bg-feed" },
  diaper: { soft: "bg-diaper-soft", text: "text-diaper", solid: "bg-diaper" },
  sleep: { soft: "bg-sleep-soft", text: "text-sleep", solid: "bg-sleep" },
  med: { soft: "bg-med-soft", text: "text-med", solid: "bg-med" },
  temp: { soft: "bg-temp-soft", text: "text-temp", solid: "bg-temp" },
} as const;
export type Tone = keyof typeof toneCls;

export const eventMeta: Record<EventType, { tone: Tone; emoji: string; label: string }> = {
  feeding: { tone: "feed", emoji: "🍼", label: "האכלה" },
  diaper: { tone: "diaper", emoji: "🧷", label: "חיתול" },
  sleep: { tone: "sleep", emoji: "😴", label: "שינה" },
  medicine: { tone: "med", emoji: "💊", label: "תרופות וויטמינים" },
  temperature: { tone: "temp", emoji: "🌡️", label: "חום גוף" },
};

/** High-contrast emoji badge on a tinted tile. */
export function EmojiBadge({ type, size = "md" }: { type: EventType; size?: "sm" | "md" | "lg" }) {
  const m = eventMeta[type] ?? eventMeta.feeding;
  const t = toneCls[m.tone];
  const s = size === "sm" ? "h-9 w-9 text-lg rounded-xl" : size === "lg" ? "h-12 w-12 text-3xl rounded-2xl" : "h-12 w-12 text-2xl rounded-2xl";
  return (
    <div className={`flex shrink-0 items-center justify-center ${s} ${t.soft} ring-2 ring-inset ring-card`} aria-hidden>
      <span className="drop-shadow-sm">{m.emoji}</span>
    </div>
  );
}
