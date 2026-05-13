
-- Roles enum + table (security best practice)
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  child_name text,
  child_age int,
  child_pronouns text,
  child_loves text,
  story_prompt text,
  story_theme text,
  art_style text,
  status text not null default 'draft', -- draft | paid | generating | ready | failed
  cover_url text,
  ebook_url text,
  page_count int default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.character_sheets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text,
  description text,
  approved boolean not null default false,
  regenerations int not null default 0,
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- character | book
  status text not null default 'queued', -- queued | running | done | failed
  progress int not null default 0,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.books enable row level security;
alter table public.character_sheets enable row level security;
alter table public.photos enable row level security;
alter table public.jobs enable row level security;

-- Profiles
create policy "profiles read all signed-in" on public.profiles
  for select to authenticated using (true);
create policy "profiles update self" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "profiles insert self" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- user_roles: only admins manage; users can read own
create policy "user_roles read self" on public.user_roles
  for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "user_roles admin write" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Books
create policy "books owner select" on public.books for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "books owner insert" on public.books for insert to authenticated
  with check (auth.uid() = user_id);
create policy "books owner update" on public.books for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "books owner delete" on public.books for delete to authenticated
  using (auth.uid() = user_id);

-- Character sheets
create policy "cs owner all" on public.character_sheets for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Photos
create policy "photos owner all" on public.photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Jobs
create policy "jobs owner select" on public.jobs for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "jobs owner write" on public.jobs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_books_touch before update on public.books
  for each row execute function public.touch_updated_at();
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- Auto-create profile + default user role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('storynest', 'storynest', false)
on conflict (id) do nothing;

create policy "storynest read own" on storage.objects for select to authenticated
  using (bucket_id = 'storynest' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storynest insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'storynest' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storynest update own" on storage.objects for update to authenticated
  using (bucket_id = 'storynest' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storynest delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'storynest' and (storage.foldername(name))[1] = auth.uid()::text);
