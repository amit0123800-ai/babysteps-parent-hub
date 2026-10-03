import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { type InventoryItem, type ShoppingItem, dailyUsage, stockLevel, type StockLevel } from "@/lib/babysteps";
import { fieldCls } from "./LogForms";

const itemEmoji: Record<string, string> = { diapers: "🧷", wipes: "🧻", formula: "🥛" };

const levelUi: Record<StockLevel, { card: string; badge: string; label: string }> = {
  good: { card: "bg-ok-soft", badge: "bg-ok text-primary-foreground", label: "מלאי תקין" },
  low: { card: "bg-warn-soft", badge: "bg-warn text-primary-foreground", label: "מלאי נמוך" },
  critical: { card: "bg-danger-soft", badge: "bg-danger text-primary-foreground", label: "מלאי עומד להסתיים!" },
};

type Log = { item_id: string; delta: number; created_at: string };

export function Inventory({ babyId, now }: { babyId: string; now: number }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [list, setList] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from("inventory_items").select("*").eq("baby_id", babyId).order("kind");
    const order = ["diapers", "wipes", "formula"];
    setItems(((data ?? []) as InventoryItem[]).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)));
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: l } = await supabase.from("inventory_log").select("item_id, delta, created_at")
      .eq("baby_id", babyId).gte("created_at", since);
    setLogs((l ?? []) as Log[]);
  }, [babyId]);

  const loadList = useCallback(async () => {
    const { data } = await supabase.from("shopping_list").select("*").eq("baby_id", babyId).order("created_at");
    setList((data ?? []) as ShoppingItem[]);
  }, [babyId]);

  useEffect(() => {
    loadItems(); loadList();
    const ch = supabase.channel(`inventory-${babyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter: `baby_id=eq.${babyId}` }, () => loadItems())
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_list", filter: `baby_id=eq.${babyId}` }, () => loadList())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [babyId, loadItems, loadList]);

  async function adjust(item: InventoryItem, delta: number) {
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)));
    const { error } = await supabase.rpc("adjust_inventory", { _item_id: item.id, _delta: delta });
    if (error) { toast.error("העדכון נכשל"); loadItems(); }
  }

  async function addToList(name: string) {
    const n = name.trim();
    if (!n) return;
    if (list.some((l) => !l.done && l.name === n)) { toast("כבר ברשימת הקניות"); return; }
    const { error } = await supabase.from("shopping_list").insert({ baby_id: babyId, name: n });
    if (error) { toast.error("ההוספה נכשלה"); return; }
    toast.success(`${n} נוסף לרשימת הקניות`);
  }

  async function toggle(item: ShoppingItem) {
    setList((p) => p.map((l) => (l.id === item.id ? { ...l, done: !l.done } : l)));
    await supabase.from("shopping_list").update({ done: !item.done }).eq("id", item.id);
  }
  async function removeItem(id: string) {
    setList((p) => p.filter((l) => l.id !== id));
    await supabase.from("shopping_list").delete().eq("id", id);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        {items.map((item) => {
          const level = stockLevel(item);
          const ui = levelUi[level];
          const rate = dailyUsage(logs.filter((l) => l.item_id === item.id), now);
          const daysLeft = rate > 0 ? Math.floor(item.quantity / rate) : null;
          return (
            <div key={item.id} className={`rounded-3xl p-4 ${ui.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-2xl" aria-hidden>{itemEmoji[item.kind] ?? "📦"}</div>
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-2xl font-bold tabular-nums">{item.quantity} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span></p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ui.badge}`}>{ui.label}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {daysLeft === null ? "אין עדיין מספיק נתוני שימוש להערכה" :
                  `קצב: ${rate.toFixed(rate < 10 ? 1 : 0)} ליום · מספיק לעוד כ-${daysLeft} ימים`}
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => adjust(item, -1)} aria-label="הפחתה"
                  className="tap flex h-12 w-12 items-center justify-center rounded-2xl bg-card"><Minus className="h-5 w-5" /></button>
                <button onClick={() => adjust(item, 1)} aria-label="הוספה"
                  className="tap flex h-12 w-12 items-center justify-center rounded-2xl bg-card"><Plus className="h-5 w-5" /></button>
                <button onClick={() => adjust(item, item.restock_amount)}
                  className="tap h-12 flex-1 rounded-2xl bg-primary font-semibold text-primary-foreground">{item.restock_label}</button>
              </div>
              {level === "critical" && (
                <button onClick={() => addToList(item.name)}
                  className="tap mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-danger font-semibold text-primary-foreground">
                  <ShoppingCart className="h-5 w-5" /> הוספה לרשימת קניות
                </button>
              )}
            </div>
          );
        })}
        <p className="text-center text-xs text-muted-foreground">כל החלפת חיתול שנרשמת מורידה חיתול אחד מהמלאי אוטומטית</p>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><ShoppingCart className="h-5 w-5" /> רשימת קניות</h2>
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addToList(newItem); setNewItem(""); }}>
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="הוספת פריט..." className={fieldCls} />
          <button className="tap h-12 shrink-0 rounded-xl bg-primary px-4 font-semibold text-primary-foreground" aria-label="הוספה"><Plus className="h-5 w-5" /></button>
        </form>
        {list.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground">הרשימה ריקה</p>
        ) : (
          <ul className="space-y-2">
            {list.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <button onClick={() => toggle(l)} aria-label="סימון"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${l.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {l.done && <Check className="h-4 w-4" />}
                </button>
                <span className={`flex-1 ${l.done ? "text-muted-foreground line-through" : ""}`}>{l.name}</span>
                <button onClick={() => removeItem(l.id)} aria-label="מחיקה" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
