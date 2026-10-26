-- =====================================================================
-- VOLT STORE CO — operaciones del panel (RPC)
-- Cada función administrativa verifica el rol en el servidor antes de actuar
-- y corre en una sola transacción: si algo falla, no se guarda nada a medias.
-- =====================================================================

-- ---------- Lectura pública ----------
create function private.product_json(p public.products, c public.categories) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'c', c.code, 'n', p.name, 'b', p.brand, 'd', p.detail,
    'price', p.price, 'price_max', p.price_max, 'promo', p.promo_price, 's', p.stock,
    'f', case when p.featured then true end,
    'img', p.image_url, 'alt', p.image_alt,
    'gallery', case when jsonb_array_length(p.gallery) > 0 then p.gallery end,
    'features', case when cardinality(p.features) > 0 then to_jsonb(p.features) end,
    'cta', p.cta_label, 'msg', p.cta_message, 'url', p.cta_url
  ));
$$;

create function private.catalog_json(p_only_active boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name, 'singular', c.singular, 'icon', c.icon)
                       order by c.sort_order, c.name)
      from public.categories c where c.active or not p_only_active), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(private.product_json(p, c) order by p.featured desc, c.sort_order, p.sort_order, p.name)
      from public.products p join public.categories c on c.id = p.category_id
      where (p.active and c.active) or not p_only_active), '[]'::jsonb)
  );
$$;
revoke all on function private.catalog_json(boolean), private.product_json(public.products, public.categories) from public;

-- Lo que ve cualquier visitante: solo contenido publicado y productos activos.
create function public.get_public_site() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'content', coalesce((select jsonb_object_agg(key, data) from public.site_published), '{}'::jsonb),
    'updated_at', greatest(
      (select max(published_at) from public.site_published),
      (select max(updated_at) from public.products),
      (select max(updated_at) from public.categories))
  ) || private.catalog_json(true);
$$;
grant execute on function public.get_public_site() to anon, authenticated;

-- Vista previa: borradores sin publicar. Solo administradores.
create function public.get_preview_site() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'content', coalesce((select jsonb_object_agg(key, data) from public.site_content), '{}'::jsonb),
    'preview', true,
    'updated_at', now()
  ) || private.catalog_json(true);
end $$;

-- ---------- Perfil y resumen ----------
create function public.my_admin_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', user_id, 'email', email, 'role', role)
  from public.admin_users where user_id = (select auth.uid());
$$;

create function public.record_login() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() then
    perform private.log_event('login', 'session', (select auth.uid())::text, (select auth.jwt() ->> 'email'), null);
  end if;
end $$;

create function public.get_admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'products_total',    (select count(*) from public.products),
    'products_active',   (select count(*) from public.products where active),
    'products_out',      (select count(*) from public.products where active and stock = 0),
    'products_featured', (select count(*) from public.products where featured),
    'categories',        (select count(*) from public.categories),
    'media',             (select count(*) from public.media),
    'pending',           coalesce((select jsonb_agg(c.key order by c.key) from public.site_content c
                           left join public.site_published p on p.key = c.key
                           where p.key is null or p.data is distinct from c.data), '[]'::jsonb),
    'last_publish',      (select jsonb_build_object('at', published_at, 'by', published_by_email)
                           from public.content_versions order by published_at desc limit 1),
    'recent',            coalesce((select jsonb_agg(x) from (
                           select at, user_email, action, entity, label from public.audit_log
                           order by at desc limit 8) x), '[]'::jsonb)
  );
end $$;

-- ---------- Borradores y publicación ----------
-- Guarda un borrador. Si otra persona lo cambió desde que lo abriste, avisa en vez de pisarlo.
create function public.save_draft(p_key text, p_data jsonb, p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_current integer;
  v_row public.site_content;
begin
  perform private.require_admin();
  select version into v_current from public.site_content where key = p_key for update;
  if v_current is null then
    insert into public.site_content (key, data) values (p_key, p_data) returning * into v_row;
  else
    if p_expected_version is not null and p_expected_version <> v_current then
      raise exception 'Otra persona modificó “%” mientras editabas. Recarga para ver la versión actual.', p_key
        using errcode = '40001';
    end if;
    update public.site_content set data = p_data where key = p_key returning * into v_row;
  end if;
  return jsonb_build_object('key', v_row.key, 'version', v_row.version, 'updated_at', v_row.updated_at,
                            'updated_by_email', v_row.updated_by_email);
end $$;

create function public.publish_content(p_keys text[] default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_keys text[] := '{}';
begin
  perform private.require_admin();
  if p_note is not null and char_length(p_note) > 200 then
    raise exception 'La nota de publicación es demasiado larga.' using errcode = '22023';
  end if;
  for r in
    select c.key, c.data, c.version
    from public.site_content c left join public.site_published p on p.key = c.key
    where (p_keys is null or c.key = any (p_keys))
      and (p.key is null or p.data is distinct from c.data)
    order by c.key
    for update of c
  loop
    insert into public.site_published (key, data, draft_version, published_at, published_by, published_by_email)
    values (r.key, r.data, r.version, now(), (select auth.uid()), (select auth.jwt() ->> 'email'))
    on conflict (key) do update set
      data = excluded.data, draft_version = excluded.draft_version, published_at = excluded.published_at,
      published_by = excluded.published_by, published_by_email = excluded.published_by_email;
    insert into public.content_versions (key, data, draft_version, published_by, published_by_email, note)
    values (r.key, r.data, r.version, (select auth.uid()), (select auth.jwt() ->> 'email'), p_note);
    v_keys := v_keys || r.key;
  end loop;
  if cardinality(v_keys) > 0 then
    perform private.log_event('publish', 'site_published', array_to_string(v_keys, ','), p_note,
                              jsonb_build_object('keys', to_jsonb(v_keys)));
  end if;
  return jsonb_build_object('published', to_jsonb(v_keys), 'at', now());
end $$;

-- Descarta borradores: vuelve a lo que está publicado.
create function public.discard_drafts(p_keys text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform private.require_admin();
  update public.site_content c set data = p.data
  from public.site_published p
  where p.key = c.key and c.key = any (p_keys) and c.data is distinct from p.data;
  get diagnostics v_count = row_count;
  return jsonb_build_object('discarded', v_count);
end $$;

-- Restaura una versión publicada anterior como borrador (luego se publica).
create function public.restore_version(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.content_versions;
begin
  perform private.require_admin();
  select * into v from public.content_versions where id = p_id;
  if v.id is null then
    raise exception 'Esa versión no existe.' using errcode = 'P0002';
  end if;
  update public.site_content set data = v.data where key = v.key;
  perform private.log_event('restore', 'site_content', v.key, 'Versión del ' || to_char(v.published_at, 'YYYY-MM-DD HH24:MI'),
                            jsonb_build_object('version_id', v.id));
  return jsonb_build_object('key', v.key);
end $$;

-- ---------- Medios ----------
create function public.media_usage(p_url text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'content', coalesce((select jsonb_agg(key order by key) from public.site_content where position(p_url in data::text) > 0), '[]'::jsonb),
    'published', coalesce((select jsonb_agg(key order by key) from public.site_published where position(p_url in data::text) > 0), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(name order by name) from public.products where image_url = p_url or gallery ? p_url), '[]'::jsonb)
  );
end $$;

-- Reemplaza una imagen por otra en todo el contenido (borradores) y en los productos.
create function public.replace_media_url(p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_content integer; v_products integer;
begin
  perform private.require_admin();
  if p_old is null or p_new is null or p_old = p_new then
    raise exception 'Indica la imagen anterior y la nueva.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.media where url = p_new) then
    raise exception 'La imagen nueva no está en la biblioteca.' using errcode = '22023';
  end if;
  update public.site_content
     set data = replace(data::text, to_jsonb(p_old)::text, to_jsonb(p_new)::text)::jsonb
   where position(to_jsonb(p_old)::text in data::text) > 0;
  get diagnostics v_content = row_count;
  update public.products set
    image_url = case when image_url = p_old then p_new else image_url end,
    gallery = coalesce((select jsonb_agg(case when g = to_jsonb(p_old) then to_jsonb(p_new) else g end)
                        from jsonb_array_elements(gallery) g), '[]'::jsonb)
  where image_url = p_old or gallery ? p_old;
  get diagnostics v_products = row_count;
  return jsonb_build_object('content', v_content, 'products', v_products);
end $$;

-- ---------- Orden ----------
create function public.reorder_products(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.products p set sort_order = o.idx * 10
  from unnest(p_ids) with ordinality as o(id, idx)
  where p.id = o.id and p.sort_order is distinct from o.idx * 10;
end $$;

create function public.reorder_categories(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.categories c set sort_order = o.idx * 10
  from unnest(p_ids) with ordinality as o(id, idx)
  where c.id = o.id and c.sort_order is distinct from o.idx * 10;
end $$;

-- ---------- Respaldos ----------
create function public.export_site() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'format', 'volt-backup', 'format_version', 1, 'exported_at', now(),
    'drafts', coalesce((select jsonb_object_agg(key, data) from public.site_content), '{}'::jsonb),
    'published', coalesce((select jsonb_object_agg(key, data) from public.site_published), '{}'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
        'code', code, 'name', name, 'singular', singular, 'icon', icon, 'sort_order', sort_order, 'active', active)
        order by sort_order) from public.categories), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'category', c.code, 'name', p.name, 'brand', p.brand, 'detail', p.detail,
        'price', p.price, 'price_max', p.price_max, 'promo_price', p.promo_price, 'stock', p.stock,
        'active', p.active, 'featured', p.featured, 'sort_order', p.sort_order,
        'image_url', p.image_url, 'image_alt', p.image_alt, 'gallery', p.gallery, 'features', to_jsonb(p.features),
        'cta_label', p.cta_label, 'cta_message', p.cta_message, 'cta_url', p.cta_url)
        order by c.sort_order, p.sort_order) from public.products p join public.categories c on c.id = p.category_id), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object(
        'url', url, 'path', path, 'filename', filename, 'alt', alt, 'folder', folder, 'source', source,
        'mime', mime, 'size_bytes', size_bytes, 'width', width, 'height', height) order by created_at)
        from public.media), '[]'::jsonb)
  );
end $$;

-- Restaura un respaldo. Todo o nada: si un dato no es válido, no cambia nada.
-- El contenido se carga como BORRADOR (hay que publicarlo). Las imágenes no se borran nunca.
create function public.import_site(p_payload jsonb, p_replace_catalog boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k text; v jsonb; c jsonb; p jsonb;
  v_cat uuid; v_content integer := 0; v_cats integer := 0; v_products integer := 0;
begin
  perform private.require_owner();
  if p_payload ->> 'format' is distinct from 'volt-backup' then
    raise exception 'El archivo no es un respaldo de VOLT.' using errcode = '22023';
  end if;

  for k, v in select * from jsonb_each(coalesce(p_payload -> 'drafts', '{}'::jsonb)) loop
    insert into public.site_content (key, data) values (k, v)
    on conflict (key) do update set data = excluded.data where public.site_content.data is distinct from excluded.data;
    v_content := v_content + 1;
  end loop;

  if jsonb_typeof(p_payload -> 'categories') = 'array' then
    for c in select * from jsonb_array_elements(p_payload -> 'categories') loop
      insert into public.categories (code, name, singular, icon, sort_order, active)
      values (c ->> 'code', c ->> 'name', c ->> 'singular', coalesce(c ->> 'icon', '🛒'),
              coalesce((c ->> 'sort_order')::integer, 0), coalesce((c ->> 'active')::boolean, true))
      on conflict (code) do update set name = excluded.name, singular = excluded.singular, icon = excluded.icon,
        sort_order = excluded.sort_order, active = excluded.active;
      v_cats := v_cats + 1;
    end loop;
  end if;

  if jsonb_typeof(p_payload -> 'products') = 'array' then
    if p_replace_catalog then
      delete from public.products;
    end if;
    for p in select * from jsonb_array_elements(p_payload -> 'products') loop
      select id into v_cat from public.categories where code = p ->> 'category';
      if v_cat is null then
        raise exception 'El producto “%” usa una categoría que no existe (%).', p ->> 'name', p ->> 'category'
          using errcode = '22023';
      end if;
      insert into public.products (id, category_id, name, brand, detail, price, price_max, promo_price, stock,
                                   active, featured, sort_order, image_url, image_alt, gallery, features,
                                   cta_label, cta_message, cta_url)
      values (coalesce((p ->> 'id')::uuid, gen_random_uuid()), v_cat, p ->> 'name', p ->> 'brand', p ->> 'detail',
              (p ->> 'price')::integer, (p ->> 'price_max')::integer, (p ->> 'promo_price')::integer, (p ->> 'stock')::integer,
              coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'featured')::boolean, false),
              coalesce((p ->> 'sort_order')::integer, 0), p ->> 'image_url', p ->> 'image_alt',
              coalesce(p -> 'gallery', '[]'::jsonb),
              coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'features') x), '{}'),
              p ->> 'cta_label', p ->> 'cta_message', p ->> 'cta_url')
      on conflict (id) do update set category_id = excluded.category_id, name = excluded.name, brand = excluded.brand,
        detail = excluded.detail, price = excluded.price, price_max = excluded.price_max, promo_price = excluded.promo_price,
        stock = excluded.stock, active = excluded.active, featured = excluded.featured, sort_order = excluded.sort_order,
        image_url = excluded.image_url, image_alt = excluded.image_alt, gallery = excluded.gallery,
        features = excluded.features, cta_label = excluded.cta_label, cta_message = excluded.cta_message,
        cta_url = excluded.cta_url;
      v_products := v_products + 1;
    end loop;
  end if;

  perform private.log_event('import', 'backup', null, p_payload ->> 'exported_at',
    jsonb_build_object('content', v_content, 'categories', v_cats, 'products', v_products, 'replace_catalog', p_replace_catalog));
  return jsonb_build_object('content', v_content, 'categories', v_cats, 'products', v_products);
end $$;

-- ---------- Usuarios administradores (solo propietario) ----------
create function public.grant_admin(p_email text, p_role public.admin_role default 'editor') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_email text;
begin
  perform private.require_owner();
  select id, email into v_user, v_email from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No hay una cuenta con el correo %. Créala primero en Supabase → Authentication → Users.', p_email
      using errcode = 'P0002';
  end if;
  if v_user = (select auth.uid()) and p_role <> 'owner' and
     (select count(*) from public.admin_users where role = 'owner') <= 1 then
    raise exception 'No puedes quitarte el rol de propietario: eres el único.' using errcode = '42501';
  end if;
  insert into public.admin_users (user_id, email, role, created_by)
  values (v_user, v_email, p_role, (select auth.uid()))
  on conflict (user_id) do update set role = excluded.role, email = excluded.email;
  return jsonb_build_object('user_id', v_user, 'email', v_email, 'role', p_role);
end $$;

create function public.revoke_admin(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_owner();
  if (select role from public.admin_users where user_id = p_user_id) = 'owner'
     and (select count(*) from public.admin_users where role = 'owner') <= 1 then
    raise exception 'No se puede quitar al único propietario.' using errcode = '42501';
  end if;
  delete from public.admin_users where user_id = p_user_id;
end $$;

-- ---------- Permisos de ejecución ----------
-- Por defecto Supabase deja ejecutar funciones a "anon": se lo quitamos a todo lo administrativo.
do $$
declare f text;
begin
  foreach f in array array[
    'public.get_preview_site()', 'public.my_admin_profile()', 'public.record_login()', 'public.get_admin_overview()',
    'public.save_draft(text, jsonb, integer)', 'public.publish_content(text[], text)', 'public.discard_drafts(text[])',
    'public.restore_version(bigint)', 'public.media_usage(text)', 'public.replace_media_url(text, text)',
    'public.reorder_products(uuid[])', 'public.reorder_categories(uuid[])', 'public.export_site()',
    'public.import_site(jsonb, boolean)', 'public.grant_admin(text, public.admin_role)', 'public.revoke_admin(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
