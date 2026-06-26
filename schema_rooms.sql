
-- 7. ROOMS
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  capacity integer,
  type text default 'Lecture Hall', -- Lecture Hall, Computer Lab, etc.
  building text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table rooms enable row level security;
create policy "Public Read Rooms" on rooms for select using (true);
create policy "Admin All Rooms" on rooms for all using (true);
