import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/components/babysteps/AuthScreen";
import { Onboarding } from "@/components/babysteps/Onboarding";
import { Dashboard } from "@/components/babysteps/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BabySteps – מעקב תינוק משותף להורים" },
      { name: "description", content: "מעקב האכלות, חיתולים ושינה של התינוק – משותף לשני ההורים בזמן אמת." },
      { property: "og:title", content: "BabySteps – מעקב תינוק משותף להורים" },
      { property: "og:description", content: "מעקב האכלות, חיתולים ושינה של התינוק – משותף לשני ההורים בזמן אמת." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [babyId, setBabyId] = useState<string | null | undefined>(undefined);
  const [invite, setInvite] = useState<string | undefined>();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      sessionStorage.setItem("bs_invite", code.toUpperCase());
      window.history.replaceState(null, "", window.location.pathname);
    }
    setInvite(sessionStorage.getItem("bs_invite") ?? undefined);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadMembership = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("family_members").select("baby_id")
      .eq("user_id", session.user.id).order("created_at").limit(1);
    setBabyId(data?.[0]?.baby_id ?? null);
  }, [session]);

  useEffect(() => { setBabyId(undefined); loadMembership(); }, [loadMembership]);

  if (!ready) return <Splash />;
  if (!session) return <AuthScreen />;
  if (babyId === undefined) return <Splash />;
  if (babyId === null) return <Onboarding initialCode={invite} onDone={loadMembership} />;
  return <Dashboard babyId={babyId} userId={session.user.id} />;
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-pulse rounded-full bg-primary/40" />
    </div>
  );
}
