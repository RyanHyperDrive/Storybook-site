
-- ============ CHILD PROFILES ============
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  age int,
  pronouns text,
  loves text,
  notes text,
  default_art_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.child_profiles enable row level security;
create policy "child_profiles owner select" on public.child_profiles for select to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
create policy "child_profiles owner insert" on public.child_profiles for insert to authenticated
  with check (auth.uid() = user_id);
create policy "child_profiles owner update" on public.child_profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "child_profiles owner delete" on public.child_profiles for delete to authenticated
  using (auth.uid() = user_id);
create trigger child_profiles_touch before update on public.child_profiles
  for each row execute function public.touch_updated_at();

-- ============ CHILD SUBJECTS (locked likeness) ============
create table public.child_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_profile_id uuid references public.child_profiles(id) on delete cascade,
  description text,
  reference_storage_path text,
  approved boolean not null default false,
  locked boolean not null default false,
  regenerations int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.child_subjects enable row level security;
create policy "child_subjects owner select" on public.child_subjects for select to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
create policy "child_subjects owner insert" on public.child_subjects for insert to authenticated
  with check (auth.uid() = user_id);
create policy "child_subjects owner update" on public.child_subjects for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "child_subjects owner delete" on public.child_subjects for delete to authenticated
  using (auth.uid() = user_id);
create trigger child_subjects_touch before update on public.child_subjects
  for each row execute function public.touch_updated_at();

-- ============ UPLOADED PHOTOS ============
create table public.uploaded_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_profile_id uuid references public.child_profiles(id) on delete set null,
  book_id uuid references public.books(id) on delete set null,
  storage_bucket text not null default 'raw-uploads',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  exif_stripped boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.uploaded_photos enable row level security;
create policy "uploaded_photos owner select" on public.uploaded_photos for select to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
create policy "uploaded_photos owner write" on public.uploaded_photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ BOOK PAGES ============
create table public.book_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_number int not null,
  text_content text,
  image_storage_path text,
  status text not null default 'pending',
  regenerations int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, page_number)
);
alter table public.book_pages enable row level security;
create policy "book_pages owner select" on public.book_pages for select to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
create policy "book_pages owner write" on public.book_pages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger book_pages_touch before update on public.book_pages
  for each row execute function public.touch_updated_at();

-- ============ GENERATION JOBS ============
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  kind text not null,
  status text not null default 'queued',
  progress int not null default 0,
  payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.generation_jobs enable row level security;
create policy "generation_jobs owner select" on public.generation_jobs for select to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
create policy "generation_jobs owner write" on public.generation_jobs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger generation_jobs_touch before update on public.generation_jobs
  for each row execute function public.touch_updated_at();

-- ============ PAYMENTS ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  provider text not null default 'stripe',
  provider_session_id text,
  provider_payment_intent text,
  amount_cents int,
  currency text default 'usd',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "payments owner select" on public.payments for select to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'admin'));
-- Inserts/updates from webhooks happen via service role (bypasses RLS).
-- Allow owner to insert their own pending row from checkout init if needed.
create policy "payments owner insert" on public.payments for insert to authenticated
  with check (auth.uid() = user_id);
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ============ PRINT INTEREST (waitlist) ============
create table public.print_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  child_age int,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.print_interest enable row level security;
create policy "print_interest anyone insert" on public.print_interest for insert to anon, authenticated
  with check (true);
create policy "print_interest admin read" on public.print_interest for select to authenticated
  using (has_role(auth.uid(), 'admin'));

-- ============ STORAGE BUCKETS ============
insert into storage.buckets (id, name, public) values
  ('raw-uploads', 'raw-uploads', false),
  ('character-sheets', 'character-sheets', false),
  ('generated-pages', 'generated-pages', false),
  ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

-- ============ STORAGE POLICIES (per-bucket, owner folder = user id) ============
-- raw-uploads
create policy "raw-uploads owner read" on storage.objects for select to authenticated
  using (bucket_id = 'raw-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "raw-uploads owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'raw-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "raw-uploads owner update" on storage.objects for update to authenticated
  using (bucket_id = 'raw-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "raw-uploads owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'raw-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

-- character-sheets
create policy "character-sheets owner read" on storage.objects for select to authenticated
  using (bucket_id = 'character-sheets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "character-sheets owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'character-sheets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "character-sheets owner update" on storage.objects for update to authenticated
  using (bucket_id = 'character-sheets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "character-sheets owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'character-sheets' and auth.uid()::text = (storage.foldername(name))[1]);

-- generated-pages
create policy "generated-pages owner read" on storage.objects for select to authenticated
  using (bucket_id = 'generated-pages' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "generated-pages owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'generated-pages' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "generated-pages owner update" on storage.objects for update to authenticated
  using (bucket_id = 'generated-pages' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "generated-pages owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'generated-pages' and auth.uid()::text = (storage.foldername(name))[1]);

-- pdfs
create policy "pdfs owner read" on storage.objects for select to authenticated
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs owner update" on storage.objects for update to authenticated
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
