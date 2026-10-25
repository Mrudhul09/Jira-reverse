-- 003: fixes from /replica-entrepreneur.

-- Fix 2: show the emails sent about each work item.
alter table outbox add column item_id text references items(id) on delete set null;
create index outbox_item on outbox(item_id, created_at);

-- Fix 5: which kinds of email each person wants.
alter table users add column email_kinds text not null default '["assigned","my_requests","approvals","team","alerts","sla"]';
