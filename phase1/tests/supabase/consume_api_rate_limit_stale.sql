-- Unit tests for consume_api_rate_limit stale recovery behavior.
-- Run with psql against a database where migrations are applied.

begin;

truncate table api_rate_limits;

-- 1) stale 状態で consume 時に in_flight が回収される
insert into api_rate_limits (key, window_start, request_count, in_flight, updated_at)
values (
  'stale-recovery',
  date_trunc('second', now()) - interval '30 seconds',
  0,
  2,
  now() - interval '61 seconds'
);

select allowed from consume_api_rate_limit('stale-recovery', 60, 30, 2);

do $$
declare
  v_row api_rate_limits%rowtype;
begin
  select * into v_row from api_rate_limits where key = 'stale-recovery';
  if v_row.in_flight <> 1 then
    raise exception 'expected stale in_flight to be reclaimed then consumed to 1, got %', v_row.in_flight;
  end if;
end $$;

-- 2) stale でない場合は既存挙動を維持する（同時実行上限で拒否）
insert into api_rate_limits (key, window_start, request_count, in_flight, updated_at)
values (
  'not-stale',
  date_trunc('second', now()) - make_interval(secs => (extract(epoch from now())::int % 60)),
  0,
  2,
  now() - interval '10 seconds'
)
on conflict (key) do update set
  window_start = excluded.window_start,
  request_count = excluded.request_count,
  in_flight = excluded.in_flight,
  updated_at = excluded.updated_at;

do $$
declare
  v_allowed boolean;
begin
  select allowed into v_allowed from consume_api_rate_limit('not-stale', 60, 30, 2);
  if v_allowed is distinct from false then
    raise exception 'expected non-stale request to be rejected by concurrency limit';
  end if;
end $$;

-- 3) クラッシュ復旧模擬: stale reclaim で 429 固着が解消
insert into api_rate_limits (key, window_start, request_count, in_flight, updated_at)
values (
  'crash-recovery',
  date_trunc('second', now()) - make_interval(secs => (extract(epoch from now())::int % 60)),
  0,
  2,
  now() - interval '5 seconds'
)
on conflict (key) do update set
  window_start = excluded.window_start,
  request_count = excluded.request_count,
  in_flight = excluded.in_flight,
  updated_at = excluded.updated_at;

-- first call: still blocked (stale ではない)
do $$
declare
  v_allowed boolean;
begin
  select allowed into v_allowed from consume_api_rate_limit('crash-recovery', 60, 30, 2);
  if v_allowed is distinct from false then
    raise exception 'expected first crash-recovery call to be blocked before stale threshold';
  end if;
end $$;

-- simulate time passing without release (crash)
update api_rate_limits set updated_at = now() - interval '61 seconds' where key = 'crash-recovery';

-- second call: stale reclaim should unblock
do $$
declare
  v_allowed boolean;
begin
  select allowed into v_allowed from consume_api_rate_limit('crash-recovery', 60, 30, 2);
  if v_allowed is distinct from true then
    raise exception 'expected second crash-recovery call to be allowed after stale reclaim';
  end if;
end $$;

rollback;
