"use client";

import { useRef, useState } from "react";
import { commentAction } from "@/app/actions/items";
import { cx } from "./ui";
import { SubmitButton } from "./ui/submit";

export function CommentBox({
  itemId,
  returnTo,
  agent,
  canned = [],
  waitStatus,
  backdate = false,
}: {
  itemId: string;
  returnTo: string;
  agent: boolean;
  canned?: { id: string; title: string; body: string }[];
  // Offered as "send and wait" when the workflow can wait on the requester.
  waitStatus?: string | null;
  // Incidents: agents may add a note at a past time to rebuild the timeline.
  backdate?: boolean;
}) {
  const [internal, setInternal] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const tab = (on: boolean) => cx("-mb-px border-b-2 px-3 py-2", on ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-fg");
  return (
    <form action={commentAction} className="space-y-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {internal ? <input type="hidden" name="internal" value="1" /> : null}
      {agent ? (
        <div role="tablist" aria-label="Who sees this" className="flex border-b border-line">
          <button type="button" role="tab" aria-selected={!internal} className={tab(!internal)} onClick={() => setInternal(false)}>
            Reply to requester
          </button>
          <button type="button" role="tab" aria-selected={internal} className={tab(internal)} onClick={() => setInternal(true)}>
            Internal note
          </button>
        </div>
      ) : null}
      <label htmlFor={`body-${itemId}`} className="sr-only">
        {internal ? "Internal note" : "Message"}
      </label>
      <textarea
        ref={box}
        id={`body-${itemId}`}
        name="body"
        required
        className={cx("control", internal && "bg-warning-soft")}
        placeholder={internal ? "Only the IT team sees notes." : agent ? "The requester will see this." : "Add a message for the IT team"}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton name="then" value="">
          {internal ? "Add note" : agent ? "Send reply" : "Send"}
        </SubmitButton>
        {agent && !internal && waitStatus ? (
          <SubmitButton variant="secondary" name="then" value={waitStatus}>
            Send and mark {waitStatus.toLowerCase()}
          </SubmitButton>
        ) : null}
        {agent && internal && backdate ? (
          <span className="flex items-center gap-1.5 text-sm">
            <label htmlFor={`when-${itemId}`}>Happened at</label>
            <input id={`when-${itemId}`} name="occurredAt" type="datetime-local" className="control w-auto" />
          </span>
        ) : null}
        <span className="flex-1" />
        {agent && canned.length ? (
          <>
            <label htmlFor={`canned-${itemId}`} className="sr-only">
              Saved reply
            </label>
            <select
              id={`canned-${itemId}`}
              defaultValue=""
              className="control w-52"
              onChange={(e) => {
                const c = canned.find((x) => x.id === e.target.value);
                if (c && box.current) {
                  box.current.value = box.current.value ? `${box.current.value}\n\n${c.body}` : c.body;
                  box.current.focus();
                }
                e.target.value = "";
              }}
            >
              <option value="">Insert a saved reply…</option>
              {canned.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>
    </form>
  );
}
