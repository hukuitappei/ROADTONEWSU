alter table sessions add column if not exists user_id text;
alter table messages add column if not exists user_id text;
alter table documents add column if not exists user_id text;

create index if not exists sessions_user_id_created_at_idx on sessions (user_id, created_at desc);
create index if not exists documents_user_id_created_at_idx on documents (user_id, created_at desc);

update sessions set user_id = coalesce(user_id, 'legacy');
update messages set user_id = coalesce(user_id, 'legacy');
update documents set user_id = coalesce(user_id, 'legacy');

alter table sessions alter column user_id set not null;
alter table messages alter column user_id set not null;
alter table documents alter column user_id set not null;

create table if not exists api_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  request_count int not null default 0,
  in_flight int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function consume_api_rate_limit(p_key text, p_window_seconds int, p_max_requests int, p_max_concurrent int)
returns table(allowed boolean)
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('second', v_now) - make_interval(secs => (extract(epoch from v_now)::int % p_window_seconds));
  v_row api_rate_limits%rowtype;
begin
  insert into api_rate_limits (key, window_start, request_count, in_flight, updated_at)
  values (p_key, v_window_start, 0, 0, now())
  on conflict (key) do nothing;

  select * into v_row from api_rate_limits where key = p_key for update;

  if v_row.window_start <> v_window_start then
    v_row.window_start := v_window_start;
    v_row.request_count := 0;
    v_row.in_flight := 0;
  end if;

  if v_row.request_count >= p_max_requests or v_row.in_flight >= p_max_concurrent then
    update api_rate_limits
      set window_start = v_row.window_start, request_count = v_row.request_count, in_flight = v_row.in_flight, updated_at = now()
      where key = p_key;
    return query select false;
    return;
  end if;

  update api_rate_limits
    set window_start = v_row.window_start, request_count = v_row.request_count + 1, in_flight = v_row.in_flight + 1, updated_at = now()
    where key = p_key;

  return query select true;
end;
$$;

create or replace function release_api_rate_limit(p_key text)
returns void
language sql
as $$
  update api_rate_limits set in_flight = greatest(0, in_flight - 1), updated_at = now() where key = p_key;
$$;
