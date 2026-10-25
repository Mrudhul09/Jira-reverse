-- 001: initial schema. Ids are UUID text; times are UTC epoch milliseconds.

create table teams (
  id text primary key,
  name text not null unique collate nocase,
  created_at integer not null,
  updated_at integer not null
);

create table users (
  id text primary key,
  name text not null,
  email text not null unique collate nocase,
  role text not null check (role in ('employee','agent','admin')),
  password_hash text not null,
  active integer not null default 1 check (active in (0,1)),
  email_notifications integer not null default 1 check (email_notifications in (0,1)),
  system integer not null default 0 check (system in (0,1)),
  created_at integer not null,
  updated_at integer not null
);
create index users_role on users(role, active);

create table team_members (
  team_id text not null references teams(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (team_id, user_id)
);
create index team_members_user on team_members(user_id);

create table sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at integer not null,
  created_at integer not null
);
create index sessions_user on sessions(user_id);
create index sessions_expires on sessions(expires_at);

create table login_attempts (
  id text primary key,
  email text not null collate nocase,
  ip text not null,
  ok integer not null check (ok in (0,1)),
  created_at integer not null
);
create index login_attempts_email on login_attempts(email, created_at);
create index login_attempts_ip on login_attempts(ip, created_at);

create table counters (
  name text primary key,
  value integer not null
);

create table request_types (
  id text primary key,
  name text not null,
  description text not null default '',
  icon text not null default '',
  group_name text not null default 'General',
  category text not null check (category in ('service_request','incident','problem','change')),
  approver_id text references users(id) on delete set null,
  team_id text references teams(id) on delete set null,
  restricted_team_id text references teams(id) on delete set null,
  fields_json text not null default '[]',
  portal_visible integer not null default 1 check (portal_visible in (0,1)),
  position integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);
create index request_types_category on request_types(category, position);

create table items (
  id text primary key,
  key text not null unique,
  category text not null check (category in ('service_request','incident','problem','change')),
  request_type_id text references request_types(id) on delete set null,
  summary text not null,
  description text not null default '',
  status text not null,
  priority integer not null default 3 check (priority between 1 and 5),
  impact integer check (impact between 1 and 4),
  urgency integer check (urgency between 1 and 4),
  reporter_id text not null references users(id) on delete restrict,
  assignee_id text references users(id) on delete set null,
  team_id text references teams(id) on delete set null,
  is_major integer not null default 0 check (is_major in (0,1)),
  change_type text check (change_type in ('standard','normal','emergency')),
  change_risk text check (change_risk in ('low','medium','high','critical')),
  planned_start integer,
  planned_end integer,
  plan_implementation text not null default '',
  plan_backout text not null default '',
  plan_test text not null default '',
  root_cause text not null default '',
  workaround text not null default '',
  resolution text not null default '',
  fields_json text not null default '{}',
  first_response_at integer,
  resolved_at integer,
  created_at integer not null,
  updated_at integer not null,
  check (planned_start is null or planned_end is null or planned_end > planned_start)
);
create index items_category_status on items(category, status);
create index items_reporter on items(reporter_id);
create index items_assignee on items(assignee_id);
create index items_team on items(team_id);
create index items_request_type on items(request_type_id);
create index items_created on items(created_at);
create index items_resolved on items(resolved_at);
create index items_planned on items(planned_start);

create table comments (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  author_id text not null references users(id) on delete restrict,
  body text not null,
  internal integer not null default 0 check (internal in (0,1)),
  occurred_at integer not null,
  created_at integer not null
);
create index comments_item on comments(item_id, occurred_at);

create table history (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  actor_id text references users(id) on delete set null,
  field text not null,
  old_value text,
  new_value text,
  created_at integer not null
);
create index history_item on history(item_id, created_at);
create index history_status on history(field, item_id);

create table approvals (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  approver_id text not null references users(id) on delete cascade,
  stage text not null,
  rule text not null check (rule in ('all','any')),
  decision text not null default 'pending' check (decision in ('pending','approved','declined','skipped')),
  note text not null default '',
  created_at integer not null,
  decided_at integer,
  unique (item_id, approver_id, stage)
);
create index approvals_approver on approvals(approver_id, decision);

create table links (
  id text primary key,
  from_id text not null references items(id) on delete cascade,
  to_id text not null references items(id) on delete cascade,
  type text not null check (type in ('relates','causes','fixes','duplicates')),
  created_at integer not null,
  unique (from_id, to_id, type),
  check (from_id != to_id)
);
create index links_to on links(to_id);

create table item_people (
  item_id text not null references items(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  kind text not null check (kind in ('responder','stakeholder')),
  created_at integer not null,
  primary key (item_id, user_id, kind)
);
create index item_people_user on item_people(user_id);

create table services (
  id text primary key,
  name text not null unique collate nocase,
  description text not null default '',
  tier integer not null default 3 check (tier between 1 and 4),
  owner_team_id text references teams(id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);
create index services_owner on services(owner_team_id);

create table service_dependencies (
  service_id text not null references services(id) on delete cascade,
  depends_on_id text not null references services(id) on delete cascade,
  primary key (service_id, depends_on_id),
  check (service_id != depends_on_id)
);
create index service_dependencies_on on service_dependencies(depends_on_id);

create table item_services (
  item_id text not null references items(id) on delete cascade,
  service_id text not null references services(id) on delete cascade,
  primary key (item_id, service_id)
);
create index item_services_service on item_services(service_id);

create table asset_schemas (
  id text primary key,
  name text not null unique collate nocase,
  description text not null default '',
  created_at integer not null,
  updated_at integer not null
);

create table asset_types (
  id text primary key,
  schema_id text not null references asset_schemas(id) on delete cascade,
  name text not null collate nocase,
  attributes_json text not null default '[]',
  created_at integer not null,
  updated_at integer not null,
  unique (schema_id, name)
);

create table asset_objects (
  id text primary key,
  type_id text not null references asset_types(id) on delete cascade,
  label text not null,
  attrs_json text not null default '{}',
  created_at integer not null,
  updated_at integer not null,
  unique (type_id, label)
);
create index asset_objects_label on asset_objects(label);

create table item_assets (
  item_id text not null references items(id) on delete cascade,
  asset_id text not null references asset_objects(id) on delete cascade,
  primary key (item_id, asset_id)
);
create index item_assets_asset on item_assets(asset_id);

create table sla_calendars (
  id text primary key,
  name text not null unique,
  always_on integer not null default 0 check (always_on in (0,1)),
  days_json text not null default '[1,2,3,4,5]',
  start_minute integer not null default 540 check (start_minute between 0 and 1439),
  end_minute integer not null default 1020 check (end_minute between 1 and 1440),
  utc_offset_minutes integer not null default 0 check (utc_offset_minutes between -840 and 840),
  holidays_json text not null default '[]',
  created_at integer not null,
  updated_at integer not null,
  check (end_minute > start_minute)
);

create table slas (
  id text primary key,
  name text not null unique,
  metric text not null check (metric in ('first_response','resolution')),
  goals_json text not null default '[]',
  enabled integer not null default 1 check (enabled in (0,1)),
  position integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);

create table sla_notices (
  item_id text not null references items(id) on delete cascade,
  sla_id text not null references slas(id) on delete cascade,
  kind text not null check (kind in ('warning','breached')),
  created_at integer not null,
  primary key (item_id, sla_id, kind)
);

create table queues (
  id text primary key,
  name text not null,
  filter_json text not null default '{}',
  position integer not null default 0,
  owner_id text references users(id) on delete cascade,
  created_at integer not null,
  updated_at integer not null
);
create index queues_owner on queues(owner_id, position);

create table queue_stars (
  queue_id text not null references queues(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (queue_id, user_id)
);
create index queue_stars_user on queue_stars(user_id);

create table articles (
  id text primary key,
  title text not null,
  body text not null,
  category text not null default 'General',
  portal_visible integer not null default 1 check (portal_visible in (0,1)),
  views integer not null default 0,
  helpful integer not null default 0,
  not_helpful integer not null default 0,
  author_id text references users(id) on delete set null,
  source_item_id text references items(id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);
create index articles_category on articles(category, title);

create table article_votes (
  article_id text not null references articles(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  helpful integer not null check (helpful in (0,1)),
  created_at integer not null,
  primary key (article_id, user_id)
);

create table alerts (
  id text primary key,
  number integer not null unique,
  alias text,
  source text not null default 'manual',
  message text not null,
  description text not null default '',
  priority integer not null default 3 check (priority between 1 and 5),
  status text not null default 'open' check (status in ('open','acked','closed')),
  team_id text references teams(id) on delete set null,
  acked_by text references users(id) on delete set null,
  incident_id text references items(id) on delete set null,
  count integer not null default 1,
  escalated_at integer,
  created_at integer not null,
  updated_at integer not null
);
create unique index alerts_open_alias on alerts(alias) where alias is not null and status != 'closed';
create index alerts_status on alerts(status, created_at);
create index alerts_team on alerts(team_id);
create index alerts_incident on alerts(incident_id);

create table oncall_schedules (
  id text primary key,
  name text not null,
  team_id text not null references teams(id) on delete cascade,
  rotation_json text not null default '[]',
  shift_hours integer not null default 168 check (shift_hours between 1 and 672),
  starts_at integer not null,
  escalate_after_minutes integer not null default 15 check (escalate_after_minutes >= 1),
  escalate_to_id text references users(id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);
create index oncall_team on oncall_schedules(team_id);

create table automation_rules (
  id text primary key,
  name text not null,
  trigger text not null check (trigger in ('item_created','status_changed','comment_added','alert_created')),
  conditions_json text not null default '{}',
  actions_json text not null default '[]',
  enabled integer not null default 1 check (enabled in (0,1)),
  runs integer not null default 0,
  position integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);
create index automation_trigger on automation_rules(trigger, enabled, position);

create table automation_log (
  id text primary key,
  rule_id text not null references automation_rules(id) on delete cascade,
  item_id text references items(id) on delete set null,
  ok integer not null check (ok in (0,1)),
  result text not null,
  created_at integer not null
);
create index automation_log_created on automation_log(created_at);

create table notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  item_id text references items(id) on delete cascade,
  message text not null,
  read integer not null default 0 check (read in (0,1)),
  created_at integer not null
);
create index notifications_user on notifications(user_id, read, created_at);

create table outbox (
  id text primary key,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','held')),
  attempts integer not null default 0,
  last_error text not null default '',
  created_at integer not null,
  sent_at integer
);
create index outbox_status on outbox(status, created_at);

create table canned_responses (
  id text primary key,
  title text not null,
  body text not null,
  created_at integer not null,
  updated_at integer not null
);

create table csat (
  item_id text primary key references items(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comment text not null default '',
  created_at integer not null
);

create table pirs (
  id text primary key,
  incident_id text not null unique references items(id) on delete cascade,
  summary text not null default '',
  impact text not null default '',
  root_cause text not null default '',
  timeline text not null default '',
  actions text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  author_id text references users(id) on delete set null,
  created_at integer not null,
  updated_at integer not null
);
