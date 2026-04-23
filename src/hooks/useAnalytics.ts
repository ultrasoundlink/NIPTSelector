import { useCallback, useRef } from "preact/hooks";

// Event names the tool emits. Swap the sink by setting
// window.__niptSelectorConfig.analyticsEndpoint before the bundle loads.
export type AnalyticsEvent =
  | { type: "started" }
  | { type: "stage_entered"; stage: number }
  | { type: "stage_answered"; stage: number; answer: Record<string, unknown> }
  | {
      type: "recommended";
      primary?: string;
      alsoConsider?: string;
      shortCircuit?: string;
      durationMs: number;
    }
  | { type: "cta_clicked"; cta: "book-midwife" | "view-test" | "restart" }
  | { type: "override_clicked"; from: string; to: string };

declare global {
  interface Window {
    __niptSelectorConfig?: {
      analyticsEndpoint?: string;
      bookingUrl?: string;
    };
    dataLayer?: unknown[];
  }
}

export function useAnalytics() {
  const startedAt = useRef<number>(Date.now());

  const send = useCallback((event: AnalyticsEvent) => {
    const payload = { ...event, t: Date.now() };

    // Push to GTM dataLayer if present (Webflow sites usually have it).
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ event: `nipt_${event.type}`, ...payload });
    }

    // Fire-and-forget beacon to the configured endpoint.
    const endpoint = typeof window !== "undefined" ? window.__niptSelectorConfig?.analyticsEndpoint : undefined;
    if (endpoint) {
      try {
        const body = JSON.stringify(payload);
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, body);
        } else {
          void fetch(endpoint, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
        }
      } catch {
        // never throw from analytics
      }
    }

    if (import.meta.env.DEV) console.debug("[nipt-selector]", payload);
  }, []);

  const sinceStart = useCallback(() => Date.now() - startedAt.current, []);

  return { send, sinceStart };
}
