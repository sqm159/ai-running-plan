-- =========================================================================
-- AI 中长跑训练系统 V2 — 训练日志模块（第二阶段）
-- -------------------------------------------------------------------------
-- 使用方法：在 Supabase 控制台 -> SQL Editor 中粘贴本文件全部内容并运行。
-- 本脚本可重复执行（使用 create table if not exists / drop policy if exists）。
--
-- 新增表：
--   4. plan_assignments   课表启用记录（哪份分析快照从哪天开始执行）
--   5. training_logs      每日训练日志（完成情况 + 训练负荷）
--
-- 所有表均启用 RLS，用户只能读写自己的数据。
-- =========================================================================

-- -------------------------------------------------------------------------
-- 4. plan_assignments：课表启用记录
-- -------------------------------------------------------------------------
-- 一条记录代表「用户把某次分析快照当作课表，从 start_date 开始执行」
-- 同一用户同一时间只能有一条 active 课表（is_active = true）
-- -------------------------------------------------------------------------
create table if not exists public.plan_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null references public.analysis_snapshots(id) on delete cascade,
  start_date date not null,           -- 课表开始日期
  total_weeks int not null default 12,
  is_active boolean not null default true,
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_pa_user_active
  on public.plan_assignments (user_id, is_active);

alter table public.plan_assignments enable row level security;

drop policy if exists "pa_select_own" on public.plan_assignments;
create policy "pa_select_own"
  on public.plan_assignments for select
  using (auth.uid() = user_id);

drop policy if exists "pa_insert_own" on public.plan_assignments;
create policy "pa_insert_own"
  on public.plan_assignments for insert
  with check (auth.uid() = user_id);

drop policy if exists "pa_update_own" on public.plan_assignments;
create policy "pa_update_own"
  on public.plan_assignments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pa_delete_own" on public.plan_assignments;
create policy "pa_delete_own"
  on public.plan_assignments for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 5. training_logs：每日训练日志
-- -------------------------------------------------------------------------
-- 每条记录代表「某用户在某一天的训练完成情况」
-- 训练负荷计算公式（前端计算后存入）：
--   load = duration_min * intensity_factor
--   intensity_factor 基于 RPE（6-20）或心率区间推算
--   - RPE 6-8 (轻松)：0.6
--   - RPE 9-11 (中等)：0.8
--   - RPE 12-14 (阈值)：1.0
--   - RPE 15-17 (高强度)：1.2
--   - RPE 18-20 (极限)：1.4
-- -------------------------------------------------------------------------
create table if not exists public.training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,             -- 训练日期
  planned_title text,                -- 计划训练标题（来自课表）
  planned_detail text,               -- 计划训练详情
  status text not null default 'pending',  -- pending / completed / partial / skipped
  duration_min numeric,              -- 实际训练时长（分钟）
  distance_km numeric,               -- 实际训练距离（km）
  avg_hr numeric,                    -- 平均心率
  rpe numeric,                       -- 主观强度 6-20
  intensity_factor numeric,          -- 强度系数（由 RPE/心率推算）
  training_load numeric,             -- 训练负荷 = duration_min * intensity_factor
  feeling text,                      -- 主观感受
  note text,                         -- 备注
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- 同一用户同一天只能有一条日志，用于 upsert
  constraint uq_tl_user_date unique (user_id, log_date)
);

create index if not exists idx_tl_user_date
  on public.training_logs (user_id, log_date desc);

alter table public.training_logs enable row level security;

drop policy if exists "tl_select_own" on public.training_logs;
create policy "tl_select_own"
  on public.training_logs for select
  using (auth.uid() = user_id);

drop policy if exists "tl_insert_own" on public.training_logs;
create policy "tl_insert_own"
  on public.training_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "tl_update_own" on public.training_logs;
create policy "tl_update_own"
  on public.training_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tl_delete_own" on public.training_logs;
create policy "tl_delete_own"
  on public.training_logs for delete
  using (auth.uid() = user_id);

-- 自动维护 updated_at
create or replace function public.touch_tl_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tl_touch on public.training_logs;
create trigger trg_tl_touch
  before update on public.training_logs
  for each row execute function public.touch_tl_updated_at();

-- =========================================================================
-- 完成。运行后即可使用训练日历、每日训练日志、训练负荷历史等新功能。
-- =========================================================================
