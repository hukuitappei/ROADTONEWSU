create extension if not exists pgcrypto;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text,
  tokens_used int,
  citations jsonb,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  extracted_text text,
  summary text,
  page_count int,
  char_count int,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_start int,
  page_end int,
  created_at timestamptz default now(),
  unique (document_id, chunk_index)
);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists documents_updated_at on documents;
create trigger documents_updated_at
before update on documents
for each row execute function update_updated_at();
