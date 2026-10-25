-- 002: password resets, job bookkeeping. Times are UTC epoch milliseconds.

create table password_resets (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at integer not null,
  used_at integer,
  requested_ip text not null default '',
  created_at integer not null
);
create index password_resets_user on password_resets(user_id, created_at);
create index password_resets_ip on password_resets(requested_ip, created_at);

-- One row per job run, so admins can see the worker is alive and what failed.
create table job_runs (
  id text primary key,
  job text not null,
  ok integer not null check (ok in (0,1)),
  detail text not null default '',
  started_at integer not null,
  finished_at integer not null
);
create index job_runs_job on job_runs(job, started_at);

alter table users add column anonymised_at integer;
