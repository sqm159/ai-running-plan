-- =========================================================================
-- schema_v5_load_v2.sql  —  Training Load V2 · Beta
-- 运行前请确保 schema.sql、schema_v2_logs.sql、schema_v3_sync.sql、
-- schema_v4_adjust.sql 已执行完毕。
--
-- 本脚本可重复执行。不删除、不重命名现有字段。
-- 不持久化 CV/MET/NM/MECH 派生分数（读取时由 verified scorer 重算）。
-- =========================================================================

-- Optional structured interval input for Training Load V2 Beta.
-- Example keys: repetitions, repDistanceM, repTimeRaw, recoveryRaw,
-- recoveryType, provenance (exact|range|approx|summary|unknown),
-- intervalStructure.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_logs'
      and column_name = 'load_v2_input'
  ) then
    alter table public.training_logs add column load_v2_input jsonb;
  end if;
end $$;

comment on column public.training_logs.load_v2_input is
  'Optional structured interval input for Training Load V2 Beta (reps, rest, provenance). Derived four-dimension scores are recomputed on read and are not stored here.';

-- =========================================================================
-- 升级完成。请在 Supabase SQL Editor 中执行此脚本。
-- 未执行时：App 仍可保存旧日志字段，间歇结构会回退到本机 localStorage。
-- =========================================================================
