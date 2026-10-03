import { useEffect, useState } from "react";

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function useNightMode() {
  const [night, setNight] = useState(false);
  useEffect(() => { setNight(localStorage.getItem("bs_night") === "1"); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("night", night);
    localStorage.setItem("bs_night", night ? "1" : "0");
  }, [night]);
  return [night, setNight] as const;
}
