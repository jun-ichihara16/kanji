-- =============================================
-- KANJI Supabase テーブル作成 & RLS設定
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================

-- ユーザー
create table if not exists users (
  id uuid references auth.users primary key,
  line_user_id text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- イベント
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  host_id uuid references users(id),
  title text not null,
  venue_name text,
  venue_address text,
  event_date text,
  fee_per_person integer,
  memo text,
  created_at timestamptz default now()
);

-- 参加者
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text not null,
  payment_method text not null,
  paypay_phone text,
  is_paid boolean default false,
  created_at timestamptz default now()
);

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

-- =============================================
-- RLS ポリシー
-- =============================================

-- users
alter table users enable row level security;
create policy "users_self" on users
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- events
alter table events enable row level security;
create policy "events_host_all" on events
  for all using (auth.uid() = host_id)
  with check (auth.uid() = host_id);
create policy "events_public_read" on events
  for select using (true);

-- participants
alter table participants enable row level security;
create policy "participants_host_all" on participants
  for all using (
    auth.uid() = (select host_id from events where id = event_id)
  )
  with check (
    auth.uid() = (select host_id from events where id = event_id)
  );
create policy "participants_insert_public" on participants
  for insert with check (true);
create policy "participants_select_public" on participants
  for select using (true);
create policy "participants_update_public" on participants
  for update using (true)
  with check (true);

-- advances
alter table advances enable row level security;
create policy "advances_host_all" on advances
  for all using (
    auth.uid() = (select host_id from events where id = event_id)
  )
  with check (
    auth.uid() = (select host_id from events where id = event_id)
  );
create policy "advances_insert_public" on advances
  for insert with check (true);
create policy "advances_select_public" on advances
  for select using (true);
