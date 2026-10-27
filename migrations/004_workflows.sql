-- Admin changes to the four built-in workflows.
-- A row with `base` renames a built-in status (items keep the built-in name; people see `name`).
-- A row without `base` adds a status that behaves like `like_status`: same kind, same moves in and out.
create table workflow_statuses (
  id text primary key,
  category text not null check (category in ('service_request', 'incident', 'problem', 'change')),
  name text not null,
  base text,
  like_status text,
  created_at integer not null,
  check ((base is null) <> (like_status is null))
);
create unique index workflow_statuses_name on workflow_statuses(category, name collate nocase);
create unique index workflow_statuses_base on workflow_statuses(category, base) where base is not null;

-- Requests that came in by email, so a resent message isn't raised twice.
create table inbound_mail (
  message_id text primary key,
  item_id text references items(id) on delete set null,
  created_at integer not null
);
