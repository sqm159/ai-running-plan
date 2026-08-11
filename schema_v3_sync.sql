-- =========================================================================
-- AI 中长跑训练系统 V3 — 数据同步/高驰导入模块（第三阶段）
-- -------------------------------------------------------------------------
-- 使用方法：在 Supabase 控制台 -> SQL Editor 中粘贴本文件全部内容并运行。
-- 本脚本可重复执行（使用 if not exists / add column if not exists）。
--
-- 新增内容：
--   6. external_platform_connections   第三方平台连接（Strava/高驰等 OAuth 凭据）
--   training_logs 表新增 3 列：         标记数据源与外部 ID
--
-- 所有表均启用 RLS，用户只能读写自己的数据。
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. training_logs 表新增数据源列（如果不存在则添加）
-- -------------------------------------------------------------------------
-- source_type: 'manual' (手动填写) / 'coros' (高驰导入) / 'strava' (Strava 导入) / 'file_tcx' / 'file_gpx' / 'file_csv'
-- external_id:  外部平台的活动 ID，便于去重
-- external_raw_json:  原始导入数据备份（调试/溯源用）
-- -------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_logs' and column_name = 'source_type'
  ) then
    alter table public.training_logs add column source_type text not null default 'manual';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_logs' and column_name = 'external_id'
  ) then
    alter table public.training_logs add column external_id text;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_logs' and column_name = 'external_raw_json'
  ) then
    alter table public.training_logs add column external_raw_json jsonb;
  end if;
end $$;

-- 为 external_id 建索引，用于去重查询
create index if not exists idx_tl_user_external
  on public.training_logs (user_id, source_type, external_id);

-- -------------------------------------------------------------------------
-- 6. external_platform_connections：第三方平台连接
-- -------------------------------------------------------------------------
-- 一条记录代表「某用户已授权连接到某个第三方平台」
-- 平台类型：coros / strava / garmin / ...
-- access_token/refresh_token 加密存储（当前前端实现暂留扩展位）
-- -------------------------------------------------------------------------
create table if not exists public.external_platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,                   -- 'coros' / 'strava' / 'garmin'
  status text not null default 'pending',   -- 'pending' / 'connected' / 'expired' / 'revoked'
  external_user_id text,                    -- 平台侧的用户 ID
  access_token_enc text,                    -- 预留：加密的 access_token（需后端解密）
  refresh_token_enc text,                   -- 预留：加密的 refresh_token
  expires_at timestamptz,                   -- token 过期时间
  scope text,                               -- 授权的 scope
  last_sync_at timestamptz,                 -- 最后一次成功同步时间
  sync_cursor text,                         -- 同步游标（上次同步位置）
  note text,                                -- 用户备注
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- 同一用户同一平台只能有一条连接
  constraint uq_epc_user_platform unique (user_id, platform)
);

create index if not exists idx_epc_user_status
  on public.external_platform_connections (user_id, status);

alter table public.external_platform_connections enable row level security;

drop policy if exists "epc_select_own" on public.external_platform_connections;
create policy "epc_select_own"
  on public.external_platform_connections for select
  using (auth.uid() = user_id);

drop policy if exists "epc_insert_own" on public.external_platform_connections;
create policy "epc_insert_own"
  on public.external_platform_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "epc_update_own" on public.external_platform_connections;
create policy "epc_update_own"
  on public.external_platform_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "epc_delete_own" on public.external_platform_connections;
create policy "epc_delete_own"
  on public.external_platform_connections for delete
  using (auth.uid() = user_id);

-- 自动维护 updated_at
create or replace function public.touch_epc_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_epc_touch on public.external_platform_connections;
create trigger trg_epc_touch
  before update on public.external_platform_connections
  for each row execute function public.touch_epc_updated_at();

-- =========================================================================
-- 完成。接下来：
--   1) 把更新后的 app.js / index.html / styles.css 上传到 GitHub
--   2) 引导用户按以下流程导入高驰数据：
--        a. 高驰 APP → 具体活动 → 分享/导出 → TCX/GPX 文件
--        b. 或 高驰官网 (coros.com) → 活动详情 → 导出 TCX
--        c. 在本系统「数据同步」页面批量上传解析
--   3) （可选进阶）如需 Strava OAuth 自动拉取，需部署一个简单后端：
--        - Strava OAuth 授权回调
--        - token 加密存储到 access_token_enc / refresh_token_enc
--        - 定时 / 手动触发 GET /athlete/activities 并导入
-- =========================================================================
