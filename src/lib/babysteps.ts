export type EventType = "feeding" | "diaper" | "sleep" | "medicine" | "temperature";

export interface BabyEvent {
  id: string;
  baby_id: string;
  type: EventType;
  started_at: string;
  ended_at: string | null;
  details: any;
  created_by: string;
}

export interface Baby {
  id: string;
  name: string;
  birthdate: string;
  gender: string;
  invite_code: string;
}

export interface Member {
  user_id: string;
  role_label: string;
}

export interface InventoryItem {
  id: string;
  baby_id: string;
  kind: string;
  name: string;
  unit: string;
  quantity: number;
  restock_amount: number;
  restock_label: string;
  low_threshold: number;
  critical_threshold: number;
}

export interface ShoppingItem {
  id: string;
  baby_id: string;
  name: string;
  done: boolean;
  created_at: string;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return h === 1 ? "שעה" : `${h} שעות`;
  return `${h === 1 ? "שעה" : `${h} שעות`} ו-${m} דק׳`;
}

export function formatTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ago(iso: string, now: number) {
  return `לפני ${formatDuration(now - new Date(iso).getTime())}`;
}

export function babyAge(birthdate: string, now: number): string {
  const b = new Date(birthdate);
  const days = Math.floor((now - b.getTime()) / 86400000);
  if (days < 0) return "";
  if (days < 7) return `${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (weeks < 13) return `${weeks} שבועות`;
  const d = new Date(now);
  let months = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  if (d.getDate() < b.getDate()) months--;
  if (months < 24) return `${months} חודשים`;
  return `${Math.floor(months / 12)} שנים`;
}

export const diaperLabels: Record<string, string> = { wet: "פיפי", dirty: "קקי", both: "פיפי + קקי" };
export const sideLabels: Record<string, string> = { left: "שמאל", right: "ימין" };

export type TempStatus = "normal" | "elevated" | "fever";
export const tempStatusLabels: Record<TempStatus, string> = { normal: "תקין", elevated: "מוגבר", fever: "חום" };
export function tempStatus(c: number): TempStatus {
  if (c >= 38) return "fever";
  if (c >= 37.5) return "elevated";
  return "normal";
}

export function describeEvent(e: BabyEvent): string {
  const d = e.details ?? {};
  switch (e.type) {
    case "diaper":
      return `חיתול · ${diaperLabels[d.kind] ?? ""}`;
    case "feeding":
      return d.method === "bottle"
        ? `בקבוק · ${d.ml} מ״ל`
        : `הנקה · ${sideLabels[d.side] ?? ""} · ${d.minutes} דק׳`;
    case "sleep":
      return e.ended_at
        ? `שינה · ${formatDuration(new Date(e.ended_at).getTime() - new Date(e.started_at).getTime())}`
        : "שינה · ישן/ה עכשיו";
    case "medicine":
      return `${d.name ?? "תרופה"}${d.dosage ? ` · ${d.dosage}` : ""}`;
    case "temperature":
      return `חום · ${Number(d.celsius).toFixed(1)}°C · ${tempStatusLabels[tempStatus(Number(d.celsius))]}`;
    default:
      return "";
  }
}

export function timeHM(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** Stock level for an inventory item. */
export type StockLevel = "good" | "low" | "critical";
export function stockLevel(item: InventoryItem): StockLevel {
  if (item.quantity < item.critical_threshold) return "critical";
  if (item.quantity < item.low_threshold) return "low";
  return "good";
}

/** Average daily usage over the last 7 days from negative log deltas. */
export function dailyUsage(logs: { delta: number; created_at: string }[], now: number): number {
  const used = logs.filter((l) => l.delta < 0);
  if (used.length === 0) return 0;
  const total = used.reduce((s, l) => s + -l.delta, 0);
  const first = Math.min(...used.map((l) => new Date(l.created_at).getTime()));
  const days = Math.min(7, Math.max(1, (now - first) / 86400000));
  return total / days;
}
