import { useCallback, useEffect, useState } from "preact/hooks";
import type { Answers } from "../types";

// URL-backed answer state so back/forward and shared links work.
// Serialises the Answers object to a base64 JSON blob in the URL hash, and
// the current step index as `s`. `s` is a non-negative integer; the special
// value that's >= the length of the visible step list means "show result".

const HASH_KEY = "a";

function encode(a: Answers): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(a)));
  } catch {
    return "";
  }
}

function decode(s: string): Answers | null {
  try {
    return JSON.parse(decodeURIComponent(atob(s)));
  } catch {
    return null;
  }
}

function readHash(): { answers: Answers; stepIndex: number } {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  const params = new URLSearchParams(h);
  const raw = params.get(HASH_KEY);
  const stepRaw = params.get("s");
  const answers = raw ? decode(raw) ?? {} : {};
  const stepIndex = stepRaw ? Math.max(0, parseInt(stepRaw, 10) || 0) : 0;
  return { answers, stepIndex };
}

function writeHash(a: Answers, stepIndex: number): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (Object.keys(a).length > 0) params.set(HASH_KEY, encode(a));
  params.set("s", String(stepIndex));
  const next = `#${params.toString()}`;
  if (window.location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

export function useAnswers() {
  const [{ answers, stepIndex }, setState] = useState(() => readHash());

  useEffect(() => {
    writeHash(answers, stepIndex);
  }, [answers, stepIndex]);

  useEffect(() => {
    const onPop = () => setState(readHash());
    window.addEventListener("hashchange", onPop);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onPop);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const update = useCallback((patch: Partial<Answers>) => {
    setState((prev) => ({ ...prev, answers: { ...prev.answers, ...patch } }));
  }, []);

  const goToStep = useCallback((s: number) => {
    setState((prev) => ({ ...prev, stepIndex: Math.max(0, s) }));
  }, []);

  const reset = useCallback(() => {
    setState({ answers: {}, stepIndex: 0 });
  }, []);

  return { answers, stepIndex, update, goToStep, reset };
}
