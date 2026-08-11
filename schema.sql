-- =========================================================================
-- AI 中长跑训练系统 — Supabase 数据库 Schema
-- -------------------------------------------------------------------------
-- 使用方法：在 Supabase 控制台 -> SQL Editor 中粘贴本文件全部内容并运行。
-- 该脚本可重复执行（使用 create table if not exists / drop policy if exists）。
--
-- 包含表：
--   1. profiles              用户运动档案（扩展 auth.users）
--   2. performance_records   成绩数据库（项目/成绩/日期）
--   3. analysis_snapshots    能力分析快照（输入 + 分析结果 + 训练计划）
--
-- 所有表均启用 RLS，用户只能读写自己的数据。
-- =========================================================================

-- 扩展 pgcrypto 以使用 gen_random_uuid()
create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- 1. profiles：用户运动档案
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  age int,
  gender text,
  height numeric,
  weight numeric,
  main_event text,            -- 主要项目：800 / 1500 / 3000 / 5000
  training_years numeric,
  sessions_per_week int,
  weekly_volume numeric,       -- 当前周跑量（km）
  has_coach boolean,
  goal_event text,            -- 目标项目
  goal_time text,             -- 目标成绩（原始文本，如 "2:05"）
  race_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- updated_at 自动维护
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------------------
-- 2. performance_records：成绩数据库
-- -------------------------------------------------------------------------
create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,        -- 距离：400 / 600 / 800 / 1500 / 3000 / 5000
  time_seconds numeric,        -- 成绩（秒），null 表示未测试
  time_text text,             -- 原始输入文本（如 "2:05"），便于展示
  record_date date,           -- 测试日期
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_perf_user_date
  on public.performance_records (user_id, record_date desc);

alter table public.performance_records enable row level security;

drop policy if exists "perf_select_own" on public.performance_records;
create policy "perf_select_own"
  on public.performance_records for select
  using (auth.uid() = user_id);

drop policy if exists "perf_insert_own" on public.performance_records;
create policy "perf_insert_own"
  on public.performance_records for insert
  with check (auth.uid() = user_id);

drop policy if exists "perf_update_own" on public.performance_records;
create policy "perf_update_own"
  on public.performance_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "perf_delete_own" on public.performance_records;
create policy "perf_delete_own"
  on public.performance_records for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 3. analysis_snapshots：能力分析快照（输入 + 分析结果 + 训练计划）
-- -------------------------------------------------------------------------
create table if not exists public.analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_json jsonb not null,     -- analyzeAthlete 的完整 input
  analysis_json jsonb not null, -- analyzeAthlete 返回的完整 analysis
  plan_json jsonb,              -- buildPlan 返回的 weeks 数组
  phases_json jsonb,            -- splitPhases 返回的 phases
  label text,                   -- 简短标签（如 "800米 / 目标 2:05"）
  created_at timestamptz default now()
);

create index if not exists idx_snap_user_created
  on public.analysis_snapshots (user_id, created_at desc);

alter table public.analysis_snapshots enable row level security;

drop policy if exists "snap_select_own" on public.analysis_snapshots;
create policy "snap_select_own"
  on public.analysis_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "snap_insert_own" on public.analysis_snapshots;
create policy "snap_insert_own"
  on public.analysis_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "snap_delete_own" on public.analysis_snapshots;
create policy "snap_delete_own"
  on public.analysis_snapshots for delete
  using (auth.uid() = user_id);

-- =========================================================================
-- 完成。运行后请回到 supabase-config.js 填入 Project URL 与 anon key。
-- =========================================================================
