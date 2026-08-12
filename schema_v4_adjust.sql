-- =========================================================================
-- schema_v4_adjust.sql  —  第四阶段：动态调整训练计划数据库升级
-- 运行前请确保 schema.sql、schema_v2_logs.sql、schema_v3_sync.sql 已执行完毕
-- =========================================================================

-- 1) 为 analysis_snapshots 添加 adjust_log 列（记录最近一次动态调整的日志）
alter table public.analysis_snapshots
  add column if not exists adjust_log jsonb;

comment on column public.analysis_snapshots.adjust_log is '最近一次动态调整记录，包含 applied_at、coefficient、loadMult、summary、reasons、affectedWeeks、affectedDays 等字段';

-- 2) 为 analysis_snapshots 添加 UPDATE RLS 策略（原来只有 select/insert/delete，没有 update）
drop policy if exists "snap_update_own" on public.analysis_snapshots;
create policy "snap_update_own"
  on public.analysis_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- 升级完成。请在 Supabase SQL Editor 中执行此脚本。
-- =========================================================================
