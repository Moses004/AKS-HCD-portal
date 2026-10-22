-- Recovered verbatim from applied Supabase migration history on 2026-10-21.
-- Do not apply this file to the live production project; it represents an already-applied migration.

create or replace function private.aks_hcd_stamp_audit_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.actor_user_id := auth.uid();
  new.role := coalesce(private.aks_hcd_current_role(), 'public');
  new.timestamp := coalesce(new.timestamp, now());
  return new;
end;
$$;

create or replace function private.aks_hcd_stamp_ptr_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.executed_by_user_id := auth.uid();
  new.timestamp := coalesce(new.timestamp, now());
  return new;
end;
$$;

drop trigger if exists trg_aks_hcd_stamp_audit_actor on public.audit_logs;
create trigger trg_aks_hcd_stamp_audit_actor
before insert on public.audit_logs
for each row execute function private.aks_hcd_stamp_audit_actor();

drop trigger if exists trg_aks_hcd_stamp_ptr_actor on public.ptr_test_logs;
create trigger trg_aks_hcd_stamp_ptr_actor
before insert on public.ptr_test_logs
for each row execute function private.aks_hcd_stamp_ptr_actor();

revoke all on function private.aks_hcd_stamp_audit_actor() from public, anon;
revoke all on function private.aks_hcd_stamp_ptr_actor() from public, anon;

