import { get } from "./db";
import type { Item, RequestType, User } from "./types";

// The one place that answers "can this user do this to this record".
export const isAgent = (u: User | null | undefined): boolean => !!u && (u.role === "agent" || u.role === "admin");
export const isAdmin = (u: User | null | undefined): boolean => !!u && u.role === "admin";

export function canViewItem(u: User, item: Pick<Item, "id" | "reporter_id">): boolean {
  if (isAgent(u)) return true;
  if (item.reporter_id === u.id) return true;
  if (get("select 1 from item_people where item_id = ? and user_id = ? and kind = 'stakeholder'", item.id, u.id)) return true;
  return !!get("select 1 from approvals where item_id = ? and approver_id = ?", item.id, u.id);
}

export const canSeeInternal = isAgent;
export const canEditItem = isAgent;

// Employees may only cancel or close their own requests.
export function canMoveItem(u: User, item: Pick<Item, "reporter_id">, to: string): boolean {
  if (isAgent(u)) return true;
  return item.reporter_id === u.id && (to === "Canceled" || to === "Closed");
}

export function canRaise(u: User, rt: RequestType): boolean {
  if (isAgent(u)) return true;
  if (!rt.portal_visible) return false;
  if (!rt.restricted_team_id) return true;
  return !!get("select 1 from team_members where team_id = ? and user_id = ?", rt.restricted_team_id, u.id);
}
