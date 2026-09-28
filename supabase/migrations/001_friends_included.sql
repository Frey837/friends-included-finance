create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  role text not null check (role in ('manager', 'salesperson', 'expense_reporter')),
  telegram_user_id bigint unique,
  telegram_chat_id bigint,
  created_at timestamptz not null default now()
);

insert into public.employees (slug, display_name, role) values
  ('svetlana', 'Svetlana de Monte Carlo', 'manager'),
  ('richard', 'Richard Darling', 'salesperson'),
  ('anastasia', 'Anastasia Ferrari', 'salesperson'),
  ('jean-claude', 'Jean-Claude Bērziņš', 'salesperson'),
  ('kevin', 'Kevin von Whatever', 'expense_reporter')
on conflict (slug) do update set display_name = excluded.display_name, role = excluded.role;

create table if not exists public.sales (
  reference text primary key,
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null references public.employees(id),
  salesperson_slug text not null,
  salesperson_name text not null,
  customer text not null,
  project text not null check (project in ('A', 'B')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  proposed_richard_pct integer not null check (proposed_richard_pct between 0 and 100),
  proposed_anastasia_pct integer not null check (proposed_anastasia_pct between 0 and 100),
  proposed_jean_claude_pct integer not null check (proposed_jean_claude_pct between 0 and 100),
  approved_richard_pct integer check (approved_richard_pct between 0 and 100),
  approved_anastasia_pct integer check (approved_anastasia_pct between 0 and 100),
  approved_jean_claude_pct integer check (approved_jean_claude_pct between 0 and 100),
  commission_pool_cents integer not null default 0,
  richard_commission_cents integer not null default 0,
  anastasia_commission_cents integer not null default 0,
  jean_claude_commission_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  origin text not null check (origin in ('website', 'telegram')),
  origin_chat_id bigint,
  notification_chat_id bigint,
  approved_by uuid references public.employees(id),
  approved_at timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  sync_error text,
  confirmation_status text not null default 'not_required' check (confirmation_status in ('not_required', 'pending', 'sent', 'failed')),
  confirmation_error text,
  notification_status text not null default 'not_required' check (notification_status in ('not_required', 'pending', 'sent', 'failed', 'no_recipient')),
  notification_error text,
  record_group text not null default 'homework' check (record_group in ('homework', 'instructor_test')),
  constraint proposed_split_total check (proposed_richard_pct + proposed_anastasia_pct + proposed_jean_claude_pct = 100),
  constraint approved_split_total check (
    approved_richard_pct is null or approved_richard_pct + approved_anastasia_pct + approved_jean_claude_pct = 100
  )
);

create table if not exists public.expenses (
  reference text primary key,
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null references public.employees(id),
  reporter_slug text not null,
  reporter_name text not null,
  description text not null,
  category text not null check (category in ('Materials', 'Travel', 'Other')),
  amount_cents integer not null check (amount_cents > 0),
  proposed_allocation text not null check (proposed_allocation in ('A', 'B', 'Company overhead')),
  final_allocation text check (final_allocation in ('A', 'B', 'Company overhead')),
  status text not null check (status in ('awaiting_allocation', 'allocated')),
  origin text not null check (origin in ('website', 'telegram')),
  origin_chat_id bigint,
  notification_chat_id bigint,
  allocated_by uuid references public.employees(id),
  allocated_at timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  sync_error text,
  confirmation_status text not null default 'not_required' check (confirmation_status in ('not_required', 'pending', 'sent', 'failed')),
  confirmation_error text,
  notification_status text not null default 'not_required' check (notification_status in ('not_required', 'pending', 'sent', 'failed', 'no_recipient')),
  notification_error text,
  record_group text not null default 'homework' check (record_group in ('homework', 'instructor_test'))
);

alter table public.employees enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;

create or replace function public.fi_submit_sale(
  p_actor_slug text,
  p_reference text,
  p_customer text,
  p_project text,
  p_description text,
  p_amount_cents integer,
  p_richard_pct integer,
  p_anastasia_pct integer,
  p_jean_claude_pct integer,
  p_origin text,
  p_origin_chat_id bigint default null,
  p_record_group text default 'homework'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor employees%rowtype;
  created sales%rowtype;
begin
  select * into actor from employees where slug = p_actor_slug;
  if actor.id is null then raise exception 'Unknown employee.'; end if;
  if actor.role <> 'salesperson' then raise exception 'Only salespeople can submit sales.'; end if;
  if p_project not in ('A', 'B') then raise exception 'Project must be A or B.'; end if;
  if p_record_group not in ('homework', 'instructor_test') then raise exception 'Invalid record group.'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Amount must be greater than zero.'; end if;
  if p_richard_pct + p_anastasia_pct + p_jean_claude_pct <> 100 then raise exception 'Commission shares must total 100%%.'; end if;

  insert into sales (
    reference, submitted_by, salesperson_slug, salesperson_name, customer, project, description, amount_cents,
    proposed_richard_pct, proposed_anastasia_pct, proposed_jean_claude_pct, origin, origin_chat_id, record_group
  ) values (
    upper(p_reference), actor.id, actor.slug, actor.display_name, p_customer, p_project, p_description, p_amount_cents,
    p_richard_pct, p_anastasia_pct, p_jean_claude_pct, p_origin, p_origin_chat_id, p_record_group
  ) returning * into created;
  return to_jsonb(created);
end $$;

create or replace function public.fi_submit_expense(
  p_actor_slug text,
  p_reference text,
  p_description text,
  p_category text,
  p_amount_cents integer,
  p_proposed_allocation text,
  p_origin text,
  p_origin_chat_id bigint default null,
  p_record_group text default 'homework'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor employees%rowtype;
  created expenses%rowtype;
  is_overhead boolean;
begin
  select * into actor from employees where slug = p_actor_slug;
  if actor.id is null then raise exception 'Unknown employee.'; end if;
  if actor.role <> 'expense_reporter' then raise exception 'Only Kevin can submit expenses.'; end if;
  if p_category not in ('Materials', 'Travel', 'Other') then raise exception 'Invalid expense category.'; end if;
  if p_record_group not in ('homework', 'instructor_test') then raise exception 'Invalid record group.'; end if;
  if p_proposed_allocation not in ('A', 'B', 'Company overhead') then raise exception 'Invalid proposed allocation.'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Amount must be greater than zero.'; end if;
  is_overhead := p_proposed_allocation = 'Company overhead';

  insert into expenses (
    reference, submitted_by, reporter_slug, reporter_name, description, category, amount_cents,
    proposed_allocation, final_allocation, status, origin, origin_chat_id, record_group
  ) values (
    upper(p_reference), actor.id, actor.slug, actor.display_name, p_description, p_category, p_amount_cents,
    p_proposed_allocation, case when is_overhead then 'Company overhead' else null end,
    case when is_overhead then 'allocated' else 'awaiting_allocation' end, p_origin, p_origin_chat_id, p_record_group
  ) returning * into created;
  return to_jsonb(created);
end $$;

create or replace function public.fi_approve_sale(
  p_actor_slug text,
  p_reference text,
  p_richard_pct integer,
  p_anastasia_pct integer,
  p_jean_claude_pct integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor employees%rowtype;
  current_sale sales%rowtype;
  pool integer;
  rc integer;
  ac integer;
  jc integer;
  remainder integer;
  target text;
begin
  select * into actor from employees where slug = p_actor_slug;
  if actor.id is null or actor.role <> 'manager' then raise exception 'Only Svetlana can approve sales.'; end if;
  select * into current_sale from sales where reference = upper(p_reference) for update;
  if current_sale.reference is null then raise exception 'Sale not found.'; end if;
  if current_sale.status = 'approved' then raise exception 'Sale is already approved; totals were not changed.'; end if;
  if p_richard_pct + p_anastasia_pct + p_jean_claude_pct <> 100 then raise exception 'Commission shares must total 100%%.'; end if;

  pool := round(current_sale.amount_cents * 0.10);
  rc := floor(pool * p_richard_pct / 100.0);
  ac := floor(pool * p_anastasia_pct / 100.0);
  jc := floor(pool * p_jean_claude_pct / 100.0);
  remainder := pool - rc - ac - jc;
  if p_richard_pct >= p_anastasia_pct and p_richard_pct >= p_jean_claude_pct then target := 'richard';
  elsif p_anastasia_pct >= p_jean_claude_pct then target := 'anastasia';
  else target := 'jean-claude'; end if;
  if target = 'richard' then rc := rc + remainder;
  elsif target = 'anastasia' then ac := ac + remainder;
  else jc := jc + remainder; end if;

  update sales set
    approved_richard_pct = p_richard_pct,
    approved_anastasia_pct = p_anastasia_pct,
    approved_jean_claude_pct = p_jean_claude_pct,
    commission_pool_cents = pool,
    richard_commission_cents = rc,
    anastasia_commission_cents = ac,
    jean_claude_commission_cents = jc,
    status = 'approved', approved_by = actor.id, approved_at = now(),
    notification_chat_id = coalesce(current_sale.origin_chat_id, (select telegram_chat_id from employees where id = current_sale.submitted_by)),
    notification_status = 'pending'
  where reference = current_sale.reference
  returning * into current_sale;
  return to_jsonb(current_sale);
end $$;

create or replace function public.fi_allocate_expense(
  p_actor_slug text,
  p_reference text,
  p_final_allocation text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor employees%rowtype;
  current_expense expenses%rowtype;
begin
  select * into actor from employees where slug = p_actor_slug;
  if actor.id is null or actor.role <> 'manager' then raise exception 'Only Svetlana can allocate expenses.'; end if;
  if p_final_allocation not in ('A', 'B', 'Company overhead') then raise exception 'Invalid final allocation.'; end if;
  select * into current_expense from expenses where reference = upper(p_reference) for update;
  if current_expense.reference is null then raise exception 'Expense not found.'; end if;
  if current_expense.status = 'allocated' then raise exception 'Expense is already allocated; totals were not changed.'; end if;

  update expenses set
    final_allocation = p_final_allocation, status = 'allocated', allocated_by = actor.id, allocated_at = now(),
    notification_chat_id = coalesce(current_expense.origin_chat_id, (select telegram_chat_id from employees where id = current_expense.submitted_by)),
    notification_status = 'pending'
  where reference = current_expense.reference
  returning * into current_expense;
  return to_jsonb(current_expense);
end $$;

create or replace function public.fi_link_telegram(
  p_actor_slug text,
  p_employee_slug text,
  p_telegram_user_id bigint,
  p_telegram_chat_id bigint
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor employees%rowtype;
  linked employees%rowtype;
begin
  select * into actor from employees where slug = p_actor_slug;
  if actor.id is null or actor.role <> 'manager' then raise exception 'Only Svetlana can link Telegram users.'; end if;
  update employees
  set telegram_user_id = null, telegram_chat_id = null
  where telegram_user_id = p_telegram_user_id and slug <> p_employee_slug;
  update employees set telegram_user_id = p_telegram_user_id, telegram_chat_id = p_telegram_chat_id
  where slug = p_employee_slug returning * into linked;
  if linked.id is null then raise exception 'Employee not found.'; end if;
  return to_jsonb(linked) - 'id';
end $$;

revoke all on table public.employees, public.sales, public.expenses from anon, authenticated;
revoke all on function public.fi_submit_sale(text,text,text,text,text,integer,integer,integer,integer,text,bigint,text) from public;
revoke all on function public.fi_submit_expense(text,text,text,text,integer,text,text,bigint,text) from public;
revoke all on function public.fi_approve_sale(text,text,integer,integer,integer) from public;
revoke all on function public.fi_allocate_expense(text,text,text) from public;
revoke all on function public.fi_link_telegram(text,text,bigint,bigint) from public;

grant execute on function public.fi_submit_sale(text,text,text,text,text,integer,integer,integer,integer,text,bigint,text) to service_role;
grant execute on function public.fi_submit_expense(text,text,text,text,integer,text,text,bigint,text) to service_role;
grant execute on function public.fi_approve_sale(text,text,integer,integer,integer) to service_role;
grant execute on function public.fi_allocate_expense(text,text,text) to service_role;
grant execute on function public.fi_link_telegram(text,text,bigint,bigint) to service_role;
