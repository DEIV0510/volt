-- Pruebas de permisos por rol. Simula sesiones (sin crear cuentas reales):
-- todo ocurre dentro de un bloque que termina con un error a propósito, así
-- Postgres deshace TODO y el resultado llega en el mensaje del error.
-- Ejecutar en el SQL Editor de Supabase o con la herramienta execute_sql.
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_editor uuid := gen_random_uuid();
  v_nobody uuid := gen_random_uuid();
  v_out text := '';
  v_ver integer;
  v_res jsonb;
  v_n integer;
  v_hero jsonb;
  v_ok boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (v_owner, 'prueba-owner@volt.test', 'authenticated', 'authenticated'),
    (v_editor, 'prueba-editor@volt.test', 'authenticated', 'authenticated'),
    (v_nobody, 'prueba-sinpermisos@volt.test', 'authenticated', 'authenticated');
  insert into public.admin_users (user_id, email, role) values (v_owner, 'prueba-owner@volt.test', 'owner');

  ---------------- Usuario autenticado SIN rol de administrador ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_nobody, 'email', 'prueba-sinpermisos@volt.test', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.site_content;
  v_out := v_out || format(E'\n[sin rol] ve borradores: %s (esperado 0)', v_n);
  select count(*) into v_n from public.products where not active;
  v_out := v_out || format(E'\n[sin rol] ve productos ocultos: %s (esperado 0)', v_n);
  begin
    perform public.save_draft('hero', '{"title":"x"}'::jsonb, null);
    v_out := v_out || E'\n[sin rol] save_draft: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[sin rol] save_draft bloqueado: %s', sqlerrm); end;
  begin
    perform public.publish_content(null, null);
    v_out := v_out || E'\n[sin rol] publicar: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[sin rol] publicar bloqueado: %s', sqlerrm); end;
  update public.products set price = 1 where price is not null;
  get diagnostics v_n = row_count;
  v_out := v_out || format(E'\n[sin rol] productos modificados: %s (esperado 0)', v_n);
  begin
    insert into public.products (category_id, name) select id, 'hack' from public.categories limit 1;
    v_out := v_out || E'\n[sin rol] crear producto: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[sin rol] crear producto bloqueado: %s', sqlerrm); end;
  delete from public.products;
  get diagnostics v_n = row_count;
  v_out := v_out || format(E'\n[sin rol] productos borrados: %s (esperado 0)', v_n);
  select count(*) into v_n from public.audit_log;
  v_out := v_out || format(E'\n[sin rol] ve el historial: %s filas (esperado 0)', v_n);

  reset role;

  ---------------- Propietario: da rol de editor ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'email', 'prueba-owner@volt.test', 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_res := public.grant_admin('prueba-editor@volt.test', 'editor');
  v_out := v_out || format(E'\n[owner] grant_admin editor: %s', v_res ->> 'role');
  begin
    perform public.revoke_admin(v_owner);
    v_out := v_out || E'\n[owner] quitarse siendo único owner: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[owner] quitar único owner bloqueado: %s', sqlerrm); end;
  reset role;

  ---------------- Editor ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_editor, 'email', 'prueba-editor@volt.test', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select version, data into v_ver, v_hero from public.site_content where key = 'hero';
  v_res := public.save_draft('hero', jsonb_set(v_hero, '{title}', '"Título de prueba"'), v_ver);
  v_out := v_out || format(E'\n[editor] guardar borrador: versión %s → %s, por %s', v_ver, v_res ->> 'version', v_res ->> 'updated_by_email');

  select (data ->> 'title') = 'Título de prueba' into v_ok from public.site_published where key = 'hero';
  v_out := v_out || format(E'\n[editor] el borrador NO es público todavía: %s (esperado true)', not v_ok);

  begin
    perform public.save_draft('hero', v_hero, v_ver);
    v_out := v_out || E'\n[editor] guardar con versión vieja: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[editor] edición simultánea detectada: %s', sqlerrm); end;

  begin
    perform public.save_draft('hero', jsonb_set(v_hero, '{secondary,href}', '"javascript:alert(1)"'), null);
    v_out := v_out || E'\n[editor] enlace javascript: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[editor] enlace javascript: rechazado (%s)', left(sqlerrm, 90)); end;

  begin
    perform public.save_draft('hero', jsonb_set(v_hero, '{campoInventado}', '"<script>"'), null);
    v_out := v_out || E'\n[editor] campo desconocido: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[editor] campo desconocido: rechazado (%s)', left(sqlerrm, 90)); end;

  begin
    perform public.save_draft('theme', '{"primary":"red; background:url(x)"}'::jsonb, null);
    v_out := v_out || E'\n[editor] color con CSS inyectado: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[editor] color con CSS inyectado: rechazado (%s)', left(sqlerrm, 90)); end;

  v_res := public.publish_content(array['hero'], 'prueba');
  select (data ->> 'title') = 'Título de prueba' into v_ok from public.site_published where key = 'hero';
  v_out := v_out || format(E'\n[editor] publicar: %s, ahora es público: %s', v_res -> 'published', v_ok);
  select (public.get_public_site() -> 'content' -> 'hero' ->> 'title') = 'Título de prueba' into v_ok;
  v_out := v_out || format(E'\n[editor] get_public_site devuelve el cambio: %s', v_ok);

  update public.products set price = 99000 where name = 'Mouse Inalámbrico';
  get diagnostics v_n = row_count;
  v_out := v_out || format(E'\n[editor] cambiar precio de un producto: %s fila(s)', v_n);
  begin
    update public.products set price = 10, price_max = 5 where name = 'Mouse Inalámbrico';
    v_out := v_out || E'\n[editor] rango de precio inválido: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || E'\n[editor] rango de precio inválido: rechazado'; end;

  begin
    perform public.import_site('{"format":"volt-backup"}'::jsonb, false);
    v_out := v_out || E'\n[editor] restaurar respaldo: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[editor] restaurar respaldo bloqueado: %s', sqlerrm); end;
  begin
    perform public.grant_admin('prueba-sinpermisos@volt.test', 'owner');
    v_out := v_out || E'\n[editor] dar permisos: PERMITIDO  <-- FALLO';
  exception when others then v_out := v_out || format(E'\n[editor] dar permisos bloqueado: %s', sqlerrm); end;

  begin
    delete from public.media where url = 'img/cases.webp';
    get diagnostics v_n = row_count;
    v_out := v_out || format(E'\n[editor] borrar imagen del repositorio en uso: %s fila(s) (esperado 0)', v_n);
  end;

  select count(*) into v_n from public.audit_log where user_email = 'prueba-editor@volt.test';
  v_out := v_out || format(E'\n[editor] cambios registrados en el historial: %s', v_n);
  reset role;

  raise exception 'RESULTADOS (todo se deshizo):%', v_out;
end $$;
