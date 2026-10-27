-- CloudWatch alarms: what was measured, on which resource, and its CMDB record.
alter table alerts add column metric text;
alter table alerts add column metric_value real;
alter table alerts add column resource text;
alter table alerts add column asset_id text references asset_objects(id) on delete set null;
