export type Category = "service_request" | "incident" | "problem" | "change";
export type StatusTone = "todo" | "inprogress" | "done";

export const CATEGORIES: Category[] = ["service_request", "incident", "problem", "change"];

export const CATEGORY_LABEL: Record<Category, string> = {
  service_request: "Service request",
  incident: "Incident",
  problem: "Problem",
  change: "Change",
};

export const CATEGORY_PATH: Record<Category, string> = {
  service_request: "/queues",
  incident: "/incidents",
  problem: "/problems",
  change: "/changes",
};

interface Workflow {
  initial: string;
  statuses: Record<string, StatusTone>;
  moves: Record<string, string[]>;
  // The resolution clock stops while work sits in these.
  paused: string[];
  approval?: { status: string; approved: string; declined: string };
}

export const WORKFLOWS: Record<Category, Workflow> = {
  service_request: {
    initial: "Waiting for support",
    statuses: {
      "Waiting for approval": "todo",
      "Waiting for support": "todo",
      "In progress": "inprogress",
      "Waiting for customer": "inprogress",
      Resolved: "done",
      Closed: "done",
      Declined: "done",
      Canceled: "done",
    },
    moves: {
      "Waiting for approval": ["Canceled"],
      "Waiting for support": ["In progress", "Waiting for customer", "Resolved", "Canceled"],
      "In progress": ["Waiting for support", "Waiting for customer", "Resolved", "Canceled"],
      "Waiting for customer": ["In progress", "Resolved", "Canceled"],
      Resolved: ["Closed", "In progress"],
      Closed: [],
      Declined: [],
      Canceled: [],
    },
    paused: ["Waiting for approval", "Waiting for customer"],
    approval: { status: "Waiting for approval", approved: "Waiting for support", declined: "Declined" },
  },
  incident: {
    initial: "Open",
    statuses: { Open: "todo", "Work in progress": "inprogress", Pending: "inprogress", Resolved: "done", Closed: "done", Canceled: "done" },
    moves: {
      Open: ["Work in progress", "Pending", "Resolved", "Canceled"],
      "Work in progress": ["Pending", "Resolved", "Canceled"],
      Pending: ["Work in progress", "Resolved", "Canceled"],
      Resolved: ["Closed", "Work in progress"],
      Closed: [],
      Canceled: [],
    },
    paused: ["Pending"],
  },
  problem: {
    initial: "Open",
    statuses: { Open: "todo", "Under investigation": "inprogress", "Known error": "inprogress", Completed: "done", Canceled: "done" },
    moves: {
      Open: ["Under investigation", "Canceled"],
      "Under investigation": ["Known error", "Completed", "Canceled"],
      "Known error": ["Under investigation", "Completed", "Canceled"],
      Completed: [],
      Canceled: [],
    },
    paused: [],
  },
  change: {
    initial: "Review",
    statuses: {
      Review: "todo",
      Planning: "inprogress",
      "Awaiting approval": "inprogress",
      "Awaiting implementation": "inprogress",
      Implementing: "inprogress",
      Completed: "done",
      Failed: "done",
      Declined: "done",
      Canceled: "done",
    },
    moves: {
      Review: ["Planning", "Canceled"],
      Planning: ["Awaiting approval", "Canceled"],
      "Awaiting approval": ["Canceled"],
      "Awaiting implementation": ["Implementing", "Canceled"],
      Implementing: ["Completed", "Failed"],
      Completed: [],
      Failed: ["Planning"],
      Declined: ["Planning"],
      Canceled: [],
    },
    paused: [],
    approval: { status: "Awaiting approval", approved: "Awaiting implementation", declined: "Declined" },
  },
};

export const DONE_STATUSES = Array.from(
  new Set(CATEGORIES.flatMap((c) => Object.entries(WORKFLOWS[c].statuses).filter(([, t]) => t === "done").map(([s]) => s))),
);

export const ALL_STATUSES = Array.from(new Set(CATEGORIES.flatMap((c) => Object.keys(WORKFLOWS[c].statuses))));

export function tone(category: Category, status: string): StatusTone {
  return WORKFLOWS[category].statuses[status] ?? "todo";
}

export function isDone(category: Category, status: string): boolean {
  return tone(category, status) === "done";
}

// Standard changes are pre-approved; emergency changes may skip planning.
export function nextStatuses(category: Category, status: string, changeType?: string | null): string[] {
  const base = WORKFLOWS[category].moves[status] ?? [];
  if (category !== "change") return base;
  if (changeType === "standard" && status === "Planning") return ["Awaiting implementation", "Canceled"];
  if (changeType === "emergency" && status === "Review") return ["Awaiting approval", "Planning", "Canceled"];
  return base;
}

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as string[]).includes(v);
}
