"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// When the server refuses a form it sends people back with ?error=…, and the form comes back empty.
// This keeps what they typed: saved on submit, put back only on that error page, then forgotten.
const KEY = "itsm.typed";
const KEEP = ["text", "email", "number", "date", "datetime-local", "time", "url", "search", "tel"];

type Saved = { path: string; at: number; forms: Record<string, string>[] };

const kept = (el: Element): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
  (el instanceof HTMLInputElement && KEEP.includes(el.type)) || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

function put(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  // The native setter plus an input event, so inputs React controls pick the value up too.
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

export function KeepTyped() {
  const path = usePathname();
  const error = useSearchParams().get("error");

  useEffect(() => {
    const save = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const forms = Array.from(document.forms).map((f) => {
        const values: Record<string, string> = {};
        if (f === form) for (const el of Array.from(f.elements)) if (kept(el) && el.name && el.value) values[el.name] = el.value;
        return values;
      });
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ path: location.pathname, at: Date.now(), forms } satisfies Saved));
      } catch {}
    };
    document.addEventListener("submit", save, true);
    return () => document.removeEventListener("submit", save, true);
  }, []);

  useEffect(() => {
    let saved: Saved | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
      if (!error) sessionStorage.removeItem(KEY);
    } catch {}
    if (!error || !saved || saved.path !== path || Date.now() - saved.at > 120_000) return;
    // After React has reset the form from the finished action.
    const timer = setTimeout(() => {
      saved.forms.forEach((values, n) => {
        const form = document.forms[n];
        if (!form) return;
        for (const [name, value] of Object.entries(values)) {
          const el = form.elements.namedItem(name);
          if (el instanceof Element && kept(el)) put(el, value);
        }
      });
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [path, error]);

  return null;
}
