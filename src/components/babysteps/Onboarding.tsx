import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChoiceButton } from "./BottomSheet";
import { LogOut } from "lucide-react";

const roles = ["אמא", "אבא", "סבתא", "סבא", "מטפל/ת"];

export function Onboarding({ initialCode, onDone }: { initialCode?: string | undefined; onDone: () => void }) {
  const [tab, setTab] = useState<"create" | "join">(initialCode ? "join" : "create");
  const [role, setRole] = useState("אמא");
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("boy");
  const [code, setCode] = useState(initialCode ?? "");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } =
      tab === "create"
        ? await supabase.rpc("create_baby", { _name: name, _birthdate: birthdate, _gender: gender, _role_label: role })
        : await supabase.rpc("join_family", { _code: code, _role_label: role });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("invalid code") ? "קוד לא תקין" : "משהו השתבש, נסו שוב");
      return;
    }
    sessionStorage.removeItem("bs_invite");
    onDone();
  }

  const input = "h-14 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ברוכים הבאים 👶</h1>
        <button onClick={() => supabase.auth.signOut()} aria-label="יציאה" className="rounded-full p-2 text-muted-foreground">
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {(["create", "join"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`h-11 rounded-xl text-sm font-medium ${tab === t ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            {t === "create" ? "פרופיל תינוק חדש" : "הצטרפות עם קוד"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">מי אני?</label>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button type="button" key={r} onClick={() => setRole(r)}
                className={`tap h-11 rounded-full border px-4 text-sm ${role === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {tab === "create" ? (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium">שם התינוק/ת</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">תאריך לידה</label>
              <input required type="date" value={birthdate} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthdate(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">מין</label>
              <div className="grid grid-cols-3 gap-2">
                <ChoiceButton active={gender === "boy"} onClick={() => setGender("boy")}>בן</ChoiceButton>
                <ChoiceButton active={gender === "girl"} onClick={() => setGender("girl")}>בת</ChoiceButton>
                <ChoiceButton active={gender === "other"} onClick={() => setGender("other")}>אחר</ChoiceButton>
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-medium">קוד משפחה (6 תווים)</label>
            <input required maxLength={6} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`${input} text-center font-mono text-2xl tracking-[0.4em]`} />
          </div>
        )}

        <button disabled={loading} className="tap h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-60">
          {loading ? "רגע..." : tab === "create" ? "יצירת פרופיל" : "הצטרפות"}
        </button>
      </form>
    </div>
  );
}
