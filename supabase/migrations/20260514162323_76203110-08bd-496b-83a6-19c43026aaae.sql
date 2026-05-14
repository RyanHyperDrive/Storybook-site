
alter table public.books
  add column if not exists dedication text,
  add column if not exists reading_level text default 'ages_4_7',
  add column if not exists details_include text,
  add column if not exists details_avoid text,
  add column if not exists is_twins boolean not null default false,
  add column if not exists guardian_consent_at timestamptz;

alter table public.child_profiles
  add column if not exists favorite_color text,
  add column if not exists favorite_activities text,
  add column if not exists personality_traits text,
  add column if not exists accessibility_details text,
  add column if not exists book_id uuid references public.books(id) on delete cascade,
  add column if not exists slot text default 'primary';
