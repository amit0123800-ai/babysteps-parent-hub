import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Baby, Eye, EyeOff } from "lucide-react";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message === "Invalid login credentials" ? "אימייל או סיסמה שגויים" : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-accent-foreground">
          <Baby className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">BabySteps</h1>
        <p className="mt-2 text-muted-foreground">מעקב משותף אחרי התינוק, בזמן אמת</p>
      </div>

      {sent ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold">בדקו את תיבת המייל 📬</h2>
          <p className="mt-2 text-sm text-muted-foreground">שלחנו קישור אימות אל {email}. לחצו עליו כדי להיכנס.</p>
          <button onClick={() => { setSent(false); setMode("in"); }} className="mt-4 text-sm font-medium text-primary">
            כבר אימתתי – כניסה
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-3xl bg-card p-6 shadow-sm">
          <input
            type="email" required dir="ltr" placeholder="email@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="relative" dir="ltr">
            <input
              type={show ? "text" : "password"} required minLength={6} placeholder="••••••" value={password}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 w-full rounded-2xl border border-input bg-background pl-4 pr-12 text-base outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "הסתרת סיסמה" : "הצגת סיסמה"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:bg-muted">
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <button disabled={loading} className="tap h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "רגע..." : mode === "up" ? "הרשמה" : "כניסה"}
          </button>
          <button type="button" onClick={() => setMode(mode === "up" ? "in" : "up")} className="w-full pt-2 text-sm text-muted-foreground">
            {mode === "up" ? "כבר יש לכם חשבון? כניסה" : "אין חשבון? הרשמה"}
          </button>
        </form>
      )}
    </div>
  );
}
