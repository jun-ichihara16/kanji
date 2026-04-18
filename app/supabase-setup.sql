-- =============================================
-- AI KANJI Supabase テーブル作成 & RLS設定
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

-- ユーザー
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  display_name text,
  avatar_url text,
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

-- イベント
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  host_id uuid,
  title text not null,
  venue_name text,
  venue_address text,
  event_date text,
  fee_per_person integer,
  memo text,
  line_group_id text,
  created_at timestamptz default now()
);

-- 参加者
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  payment_method text not null,
  paypay_phone text,
  paypay_link_url text,
  paypay_link_type text check (paypay_link_type is null or paypay_link_type in ('amount_free')),
  is_paid boolean default false,
  created_at timestamptz default now(),
  constraint participants_paypay_link_url_check check (
    paypay_link_url is null
    or paypay_link_url ~ '^https://(pay|qr)\.paypay\.ne\.jp/'
  )
);

-- 同一ユーザーが同じイベントに二重追加されないよう部分UNIQUE
create unique index if not exists idx_participants_user_event
  on participants(event_id, user_id)
  where user_id is not null;

-- 立替記録
create table if not exists advances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  payer_name text not null,
  amount integer not null,
  description text,
  split_target text not null,
  target_names text[],
  created_at timestamptz default now()
);

-- 精算状態
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  from_name text not null,
  to_name text not null,
  amount integer not null,
  is_settled boolean default false,
  created_at timestamptz default now(),
  unique (event_id, from_name, to_name)
);

-- お問い合わせ
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  category text,
  message text not null,
  created_at timestamptz default now()
);

-- =============================================
-- RLS ポリシー
-- =============================================

-- users: SELECT/UPDATEは全開放（Supabase Auth未使用のため）
alter table users enable row level security;
create policy "users_all" on users for all using (true) with check (true);

-- events: 誰でもSELECT可。INSERT/UPDATE/DELETEも全開放（認証がlocalStorageのため）
alter table events enable row level security;
create policy "events_select" on events for select using (true);
create policy "events_insert" on events for insert with check (true);
create policy "events_update" on events for update using (true) with check (true);
create policy "events_delete" on events for delete using (true);

-- participants: 全操作可（ゲストがURL経由で操作するため）
alter table participants enable row level security;
create policy "participants_all" on participants for all using (true) with check (true);

-- advances: 全操作可
alter table advances enable row level security;
create policy "advances_all" on advances for all using (true) with check (true);

-- settlements: 全操作可
alter table settlements enable row level security;
create policy "settlements_all" on settlements for all using (true) with check (true);

-- contacts: INSERTのみ公開、SELECTは管理者
alter table contacts enable row level security;
create policy "contacts_insert" on contacts for insert with check (true);
create policy "contacts_select" on contacts for select using (true);
