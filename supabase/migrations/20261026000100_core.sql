-- =====================================================================
-- VOLT STORE CO — panel de administración: esquema principal
-- Seguridad: toda autorización se verifica en la base de datos (RLS y
-- funciones SECURITY DEFINER que comprueban el rol del usuario).
-- =====================================================================

create extension if not exists pg_jsonschema with schema extensions;

-- Esquema privado: no se expone por la API (solo public lo está).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------
-- Administradores y roles
-- ---------------------------------------------------------------------
create type public.admin_role as enum ('owner', 'editor');

create table public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       public.admin_role not null default 'editor',
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.admin_users enable row level security;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()) and role = 'owner');
$$;

create function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'No autorizado: tu usuario no tiene permisos de administrador.' using errcode = '42501';
  end if;
end $$;

create function private.require_owner() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner() then
    raise exception 'No autorizado: esta acción es solo para el propietario.' using errcode = '42501';
  end if;
end $$;

revoke all on function private.is_admin(), private.is_owner(), private.require_admin(), private.require_owner() from public;
grant execute on function private.is_admin(), private.is_owner() to anon, authenticated;
grant execute on function private.require_admin(), private.require_owner() to authenticated;

create policy admin_users_select on public.admin_users
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Registro de cambios (auditoría)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  user_email text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  label      text,
  before     jsonb,
  after      jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log
  for select to authenticated using ((select private.is_admin()));

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_ignore text[] := array['updated_at', 'updated_by', 'updated_by_email', 'version'];
  v_row    jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_before := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_after := to_jsonb(new); end if;
  -- Ignora actualizaciones que no cambian nada relevante.
  if tg_op = 'UPDATE' and (v_before - v_ignore) = (v_after - v_ignore) then
    return null;
  end if;
  v_row := coalesce(v_after, v_before);
  insert into public.audit_log (user_id, user_email, action, entity, entity_id, label, before, after)
  values (
    (select auth.uid()),
    (select auth.jwt() ->> 'email'),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'code', v_row ->> 'user_id'),
    coalesce(v_row ->> 'name', v_row ->> 'filename', v_row ->> 'email', v_row ->> 'key'),
    v_before,
    v_after
  );
  return null;
end $$;

create function private.log_event(p_action text, p_entity text, p_entity_id text, p_label text, p_after jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (user_id, user_email, action, entity, entity_id, label, after)
  values ((select auth.uid()), (select auth.jwt() ->> 'email'), p_action, p_entity, p_entity_id, p_label, p_after);
$$;
revoke all on function private.log_event(text, text, text, text, jsonb) from public;

create trigger admin_users_audit after insert or update or delete on public.admin_users
  for each row execute function private.audit();

-- Sello de "quién y cuándo" + versión para detectar ediciones simultáneas.
create function private.stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  new.updated_by_email := (select auth.jwt() ->> 'email');
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Contenido del sitio: borrador (site_content) y publicado (site_published)
-- ---------------------------------------------------------------------
create table private.content_schemas (
  key    text primary key,
  label  text not null,
  schema json not null
);

create table public.site_content (
  key              text primary key references private.content_schemas(key),
  data             jsonb not null default '{}'::jsonb,
  version          integer not null default 1,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_email text,
  constraint site_content_size check (pg_column_size(data) < 200000)
);
alter table public.site_content enable row level security;
create policy site_content_select on public.site_content
  for select to authenticated using ((select private.is_admin()));

create function private.validate_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_schema json;
  v_errors text[];
begin
  select schema into v_schema from private.content_schemas where key = new.key;
  if v_schema is null then
    raise exception 'Sección desconocida: %', new.key using errcode = '22023';
  end if;
  if jsonb_typeof(new.data) <> 'object' then
    raise exception 'El contenido de "%" debe ser un objeto.', new.key using errcode = '22023';
  end if;
  if not extensions.jsonb_matches_schema(v_schema, new.data) then
    v_errors := extensions.jsonschema_validation_errors(v_schema, new.data::json);
    raise exception 'Datos no válidos en "%": %', new.key, coalesce(v_errors[1], 'formato incorrecto')
      using errcode = '22023';
  end if;
  return new;
end $$;

create trigger site_content_validate before insert or update on public.site_content
  for each row execute function private.validate_content();
create trigger site_content_stamp before insert or update on public.site_content
  for each row execute function private.stamp();
create trigger site_content_audit after insert or update or delete on public.site_content
  for each row execute function private.audit();

create table public.site_published (
  key                text primary key references private.content_schemas(key),
  data               jsonb not null,
  draft_version      integer not null,
  published_at       timestamptz not null default now(),
  published_by       uuid,
  published_by_email text
);
alter table public.site_published enable row level security;
-- Lo publicado es público: es exactamente lo que ven los visitantes.
create policy site_published_read on public.site_published
  for select to anon, authenticated using (true);

create table public.content_versions (
  id                 bigint generated always as identity primary key,
  key                text not null references private.content_schemas(key),
  data               jsonb not null,
  draft_version      integer,
  published_at       timestamptz not null default now(),
  published_by       uuid,
  published_by_email text,
  note               text check (note is null or char_length(note) <= 200)
);
create index content_versions_key_idx on public.content_versions (key, published_at desc);
alter table public.content_versions enable row level security;
create policy content_versions_select on public.content_versions
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- Catálogo: categorías y productos
-- ---------------------------------------------------------------------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[a-z0-9-]{2,24}$'),
  name             text not null check (char_length(name) between 1 and 40),
  singular         text not null check (char_length(singular) between 1 and 40),
  icon             text not null default '🛒' check (char_length(icon) between 1 and 16),
  sort_order       integer not null default 0,
  active           boolean not null default true,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_email text
);
alter table public.categories enable row level security;
create policy categories_read on public.categories
  for select to anon, authenticated using (active or (select private.is_admin()));
create policy categories_insert on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy categories_update on public.categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete on public.categories
  for delete to authenticated using ((select private.is_admin()));
create trigger categories_stamp before insert or update on public.categories
  for each row execute function private.stamp();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit();

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.categories(id) on delete restrict,
  name             text not null check (char_length(name) between 1 and 120),
  brand            text check (brand is null or char_length(brand) <= 60),
  detail           text check (detail is null or char_length(detail) <= 300),
  price            integer check (price is null or (price >= 0 and price <= 100000000)),
  price_max        integer check (price_max is null or (price_max >= 0 and price_max <= 100000000)),
  promo_price      integer check (promo_price is null or (promo_price >= 0 and promo_price <= 100000000)),
  stock            integer check (stock is null or (stock >= 0 and stock <= 1000000)),
  active           boolean not null default true,
  featured         boolean not null default false,
  sort_order       integer not null default 0,
  image_url        text check (image_url is null or image_url ~ '^((?:[A-Za-z0-9_-]+/)*[A-Za-z0-9._-]+\.(?:webp|png|jpe?g|gif|svg)|https://[^\s"''<>]+)$'),
  image_alt        text check (image_alt is null or char_length(image_alt) <= 160),
  gallery          jsonb not null default '[]'::jsonb,
  features         text[] not null default '{}',
  cta_label        text check (cta_label is null or char_length(cta_label) <= 30),
  cta_message      text check (cta_message is null or char_length(cta_message) <= 300),
  cta_url          text check (cta_url is null or cta_url ~ '^(#[A-Za-z0-9_-]*|https?://[^\s"''<>]+|mailto:[^\s"''<>]+|tel:[+0-9 ()-]+)$'),
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_email text,
  constraint products_price_range check (price_max is null or (price is not null and price_max >= price)),
  constraint products_gallery_shape check (
    jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 8
    and extensions.jsonb_matches_schema(
      '{"type":"array","items":{"type":"string","maxLength":500,"pattern":"^((?:[A-Za-z0-9_-]+/)*[A-Za-z0-9._-]+\\.(?:webp|png|jpe?g|gif|svg)|https://[^\\s\"''<>]+)$"}}',
      gallery)
  ),
  constraint products_features_shape check (
    cardinality(features) <= 12 and coalesce(char_length(array_to_string(features, '')), 0) <= 1200
  )
);
create index products_category_idx on public.products (category_id, sort_order);
create index products_active_idx on public.products (active, featured desc, sort_order);
alter table public.products enable row level security;
create policy products_read on public.products
  for select to anon, authenticated using (active or (select private.is_admin()));
create policy products_insert on public.products
  for insert to authenticated with check ((select private.is_admin()));
create policy products_update on public.products
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy products_delete on public.products
  for delete to authenticated using ((select private.is_admin()));
create trigger products_stamp before insert or update on public.products
  for each row execute function private.stamp();
create trigger products_audit after insert or update or delete on public.products
  for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- Biblioteca de medios
-- ---------------------------------------------------------------------
create table public.media (
  id               uuid primary key default gen_random_uuid(),
  path             text unique,                -- ruta en el bucket "media" (null para imágenes del repositorio)
  url              text not null unique,
  filename         text not null check (char_length(filename) between 1 and 160),
  alt              text not null default '' check (char_length(alt) <= 200),
  folder           text not null default 'general' check (folder ~ '^[a-z0-9-]{1,30}$'),
  mime             text,
  size_bytes       integer check (size_bytes is null or size_bytes between 0 and 5242880),
  width            integer,
  height           integer,
  source           text not null default 'upload' check (source in ('upload', 'repo')),
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  updated_by_email text,
  constraint media_url_shape check (url ~ '^((?:[A-Za-z0-9_-]+/)*[A-Za-z0-9._-]+\.(?:webp|png|jpe?g|gif|svg|ico)|https://[^\s"''<>]+)$')
);
alter table public.media enable row level security;

-- ¿Una URL de imagen está en uso por el contenido (borrador o publicado) o por productos?
create function private.media_in_use(p_url text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_url is not null and p_url <> '' and (
       exists (select 1 from public.site_content where position(p_url in data::text) > 0)
    or exists (select 1 from public.site_published where position(p_url in data::text) > 0)
    or exists (select 1 from public.products where image_url = p_url or gallery ? p_url)
  );
$$;

create function private.media_path_in_use(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.media_in_use((select url from public.media where path = p_path));
$$;
revoke all on function private.media_in_use(text), private.media_path_in_use(text) from public;
grant execute on function private.media_in_use(text), private.media_path_in_use(text) to authenticated;

create policy media_select on public.media
  for select to authenticated using ((select private.is_admin()));
create policy media_insert on public.media
  for insert to authenticated with check ((select private.is_admin()) and source = 'upload');
create policy media_update on public.media
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
-- No se puede borrar una imagen del repositorio ni una que siga en uso.
create policy media_delete on public.media
  for delete to authenticated using ((select private.is_admin()) and source = 'upload' and not private.media_in_use(url));
create trigger media_stamp before insert or update on public.media
  for each row execute function private.stamp();
create trigger media_audit after insert or update or delete on public.media
  for each row execute function private.audit();

-- Bucket de imágenes: solo tipos de imagen rasterizada (sin SVG: puede contener scripts), máx. 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy media_objects_select on storage.objects
  for select to authenticated using (bucket_id = 'media' and (select private.is_admin()));
create policy media_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media' and (select private.is_admin())
    and name ~ '^[a-z0-9-]{1,30}/[A-Za-z0-9._-]{1,160}$'
  );
create policy media_objects_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and (select private.is_admin()))
  with check (bucket_id = 'media' and (select private.is_admin()));
create policy media_objects_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'media' and (select private.is_admin()) and not private.media_path_in_use(name)
  );

-- ---------------------------------------------------------------------
-- Privilegios: las escrituras que no deben ser directas se quitan del API.
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.admin_users, public.audit_log, public.site_content,
  public.site_published, public.content_versions from anon, authenticated;
revoke insert, update, delete, truncate on public.categories, public.products, public.media from anon;
revoke truncate on public.categories, public.products, public.media from authenticated;
