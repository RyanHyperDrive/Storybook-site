create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;

drop policy if exists "user_roles read self" on public.user_roles;
drop policy if exists "user_roles admin write" on public.user_roles;

create policy "user_roles read self"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);