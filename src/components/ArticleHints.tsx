"use client";

import { useEffect, useState } from "react";

interface Hit {
  id: string;
  title: string;
  excerpt: string;
}

// Suggests help articles while someone types a summary, so they may not need to ask.
export function ArticleHints({ inputId }: { inputId: string }) {
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 3) return setHits([]);
        ctrl?.abort();
        ctrl = new AbortController();
        try {
          const res = await fetch(`/api/kb/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
          if (res.ok) setHits(((await res.json()) as { results: Hit[] }).results);
        } catch {
          // Aborted or offline: keep what we had.
        }
      }, 250);
    };
    input.addEventListener("input", onInput);
    return () => {
      input.removeEventListener("input", onInput);
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [inputId]);
  if (!hits.length) return null;
  return (
    <div aria-live="polite" className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-semibold">These might sort it straight away:</p>
      {hits.map((h) => (
        <a key={h.id} href={`/portal/kb/${h.id}`} target="_blank" rel="noopener" className="block">
          {h.title}
          <span className="block text-sm text-muted">{h.excerpt}…</span>
        </a>
      ))}
    </div>
  );
}
