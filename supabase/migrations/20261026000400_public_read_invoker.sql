-- La lectura pública corre con los permisos del visitante (SECURITY INVOKER):
-- solo ve lo que las políticas RLS permiten a "anon" (publicado y activo).
alter function private.catalog_json(boolean) security invoker;
alter function public.get_public_site() security invoker;
grant execute on function private.catalog_json(boolean), private.product_json(public.products, public.categories) to anon, authenticated;
