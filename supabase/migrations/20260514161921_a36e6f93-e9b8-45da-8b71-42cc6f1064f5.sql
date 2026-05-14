
drop policy if exists "print_interest anyone insert" on public.print_interest;
create policy "print_interest anyone insert" on public.print_interest
  for insert to anon, authenticated
  with check (email is not null and length(email) between 5 and 320 and email like '%_@_%.__%');
