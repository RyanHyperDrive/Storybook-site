
-- Sample art assets table
create table public.sample_art_assets (
  id uuid primary key default gen_random_uuid(),
  sample_key text not null,
  style_key text not null,
  asset_type text not null check (asset_type in ('cover','page_1','page_2')),
  prompt text not null,
  kie_task_id text,
  source_url text,
  storage_path text,
  public_url text,
  status text not null default 'pending' check (status in ('pending','queued','processing','success','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sample_key, asset_type)
);

create index sample_art_assets_status_idx on public.sample_art_assets (status);

alter table public.sample_art_assets enable row level security;

-- Public can read successful assets only
create policy "public read successful sample assets"
on public.sample_art_assets for select
to anon, authenticated
using (status = 'success');

-- Admins can read everything
create policy "admins read all sample assets"
on public.sample_art_assets for select
to authenticated
using (has_role(auth.uid(), 'admin'));

-- Admins can write
create policy "admins write sample assets"
on public.sample_art_assets for all
to authenticated
using (has_role(auth.uid(), 'admin'))
with check (has_role(auth.uid(), 'admin'));

create trigger sample_art_assets_touch
before update on public.sample_art_assets
for each row execute function public.touch_updated_at();

-- Public storage bucket for sample marketing images
insert into storage.buckets (id, name, public)
values ('public-samples', 'public-samples', true)
on conflict (id) do nothing;

-- Anyone can read
create policy "public read public-samples"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'public-samples');

-- Only admins can write/update/delete (service role bypasses RLS anyway)
create policy "admins write public-samples"
on storage.objects for insert
to authenticated
with check (bucket_id = 'public-samples' and has_role(auth.uid(), 'admin'));

create policy "admins update public-samples"
on storage.objects for update
to authenticated
using (bucket_id = 'public-samples' and has_role(auth.uid(), 'admin'));

create policy "admins delete public-samples"
on storage.objects for delete
to authenticated
using (bucket_id = 'public-samples' and has_role(auth.uid(), 'admin'));
