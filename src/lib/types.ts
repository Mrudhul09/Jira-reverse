import type { Category } from "./workflows";

export type Role = "employee" | "agent" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: number;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date";
  required?: boolean;
  options?: string[];
}

export interface RequestType {
  id: string;
  name: string;
  description: string;
  icon: string;
  group_name: string;
  category: Category;
  approver_id: string | null;
  team_id: string | null;
  restricted_team_id: string | null;
  fields_json: string;
  portal_visible: number;
  position: number;
}

export interface Item {
  id: string;
  key: string;
  category: Category;
  request_type_id: string | null;
  summary: string;
  description: string;
  status: string;
  priority: number;
  impact: number | null;
  urgency: number | null;
  reporter_id: string;
  assignee_id: string | null;
  team_id: string | null;
  is_major: number;
  change_type: string | null;
  change_risk: string | null;
  planned_start: number | null;
  planned_end: number | null;
  plan_implementation: string;
  plan_backout: string;
  plan_test: string;
  root_cause: string;
  workaround: string;
  resolution: string;
  fields_json: string;
  first_response_at: number | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ItemRow extends Item {
  reporter_name: string;
  assignee_name: string | null;
  team_name: string | null;
  request_type_name: string | null;
}

export interface Comment {
  id: string;
  item_id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  body: string;
  internal: number;
  occurred_at: number;
  created_at: number;
}

export interface HistoryRow {
  id: string;
  item_id: string;
  actor_id: string | null;
  actor_name: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
}

export interface Approval {
  id: string;
  item_id: string;
  approver_id: string;
  approver_name: string;
  stage: string;
  rule: "all" | "any";
  decision: "pending" | "approved" | "declined" | "skipped";
  note: string;
  created_at: number;
  decided_at: number | null;
}
