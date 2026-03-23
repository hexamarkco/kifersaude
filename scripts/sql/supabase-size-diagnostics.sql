-- Supabase size diagnostics
-- Run these queries in the Supabase SQL Editor to identify the real database space consumers.

-- 1) Largest relations by total size (table + indexes + toast)
select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
  pg_size_pretty(coalesce(pg_total_relation_size(c.reltoastrelid), 0)) as toast_size,
  pg_total_relation_size(c.oid) as total_size_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema')
order by pg_total_relation_size(c.oid) desc
limit 40;

-- 2) Largest tables in app-related schemas only
select
  n.nspname as schema_name,
  c.relname as relation_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
  pg_size_pretty(coalesce(pg_total_relation_size(c.reltoastrelid), 0)) as toast_size,
  s.n_live_tup,
  s.n_dead_tup,
  s.last_autovacuum,
  s.last_vacuum
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where c.relkind = 'r'
  and n.nspname in ('public', 'auth', 'storage')
order by pg_total_relation_size(c.oid) desc
limit 40;

-- 3) Tables with the most dead tuples / likely bloat pressure
select
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  round(
    case when n_live_tup > 0 then (n_dead_tup::numeric / n_live_tup::numeric) * 100 else 0 end,
    2
  ) as dead_pct,
  last_autovacuum,
  last_vacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname in ('public', 'auth', 'storage')
order by n_dead_tup desc, dead_pct desc
limit 40;

-- 4) Biggest indexes
select
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_relation_size(indexrelid) as index_size_bytes,
  idx_scan
from pg_stat_user_indexes
where schemaname in ('public', 'auth', 'storage')
order by pg_relation_size(indexrelid) desc
limit 40;

-- 5) Schema totals
select
  table_schema,
  pg_size_pretty(sum(pg_total_relation_size(format('%I.%I', table_schema, table_name)::regclass))) as total_size,
  sum(pg_total_relation_size(format('%I.%I', table_schema, table_name)::regclass)) as total_size_bytes
from information_schema.tables
where table_schema in ('public', 'auth', 'storage')
  and table_type = 'BASE TABLE'
group by table_schema
order by total_size_bytes desc;
