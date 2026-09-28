drop policy if exists "Admins delete questions" on public.questions;

create policy "Admins delete questions" on public.questions
for delete to authenticated using (public.is_admin());