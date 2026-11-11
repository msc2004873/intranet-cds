-- Catálogo para etiquetas (2026-11-11, pedido de Mario: "tener cargado el inventario para poder
-- imprimir cualquier producto y etiqueta, con diferente cantidad").
--
-- Los productos que se venden (TIENDA, MEDICAMENTOS, SUMINISTROS; activos) con su código, código de
-- barras, PVP y lo que QVet decía que había. Viene de la copia de QVet de cada noche (la base del
-- sistema paralelo, nucleo-lab) y la sube el robot `cds-agentes/catalogo-etiquetas.js`.
-- La lee SOLO la API de la intranet (/api/etiquetas/catalogo) con la llave de servicio: sin
-- políticas para anon (no repetir el hueco de las 5 tablas de caja).
-- Creada por la Management API (POST /v1/projects/<id>/database/query), como las demás.

create table if not exists public.catalogo_etiquetas (
  codigo        text primary key,            -- código interno de QVet (el que va en la etiqueta)
  codigo_barras text,
  nombre        text not null,
  precio        numeric(14,2) not null,      -- PVP con IVA, como sale en la etiqueta
  seccion       text,
  familia       text,
  existencias   numeric(14,3),               -- lo que QVet decía anoche (todas las bodegas)
  busqueda      text not null,               -- nombre + códigos en minúscula y sin tildes
  lote          text not null                -- qué corrida del robot dejó esta fila
);
create index if not exists catalogo_etiquetas_barras on public.catalogo_etiquetas (codigo_barras);

-- Una sola fila: cuándo se subió y de qué noche es la copia. La página lo muestra.
create table if not exists public.catalogo_etiquetas_estado (
  id          int primary key default 1 check (id = 1),
  actualizado timestamptz not null,          -- cuándo lo subió el robot
  copia_de    timestamptz,                   -- cuándo se copió de QVet (robot de la noche)
  filas       int not null
);

alter table public.catalogo_etiquetas enable row level security;
alter table public.catalogo_etiquetas_estado enable row level security;

-- El robot sube las filas por partes (upsert, cada una con su `lote`) y al final llama esto:
-- borra lo que no vino en esta corrida (productos desactivados) y anota el estado.
-- 🛟 Si vinieron muy pocas filas (algo se rompió), no borra nada y avisa con error.
create or replace function public.cerrar_catalogo_etiquetas(p_lote text, p_copia_de timestamptz, p_minimo int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  select count(*) into n from catalogo_etiquetas where lote = p_lote;
  if n < p_minimo then
    raise exception 'Solo llegaron % productos (mínimo %). No se borra nada.', n, p_minimo;
  end if;
  delete from catalogo_etiquetas where lote <> p_lote;
  insert into catalogo_etiquetas_estado (id, actualizado, copia_de, filas)
    values (1, now(), p_copia_de, n)
    on conflict (id) do update
      set actualizado = excluded.actualizado, copia_de = excluded.copia_de, filas = excluded.filas;
  return n;
end $$;

revoke all on function public.cerrar_catalogo_etiquetas(text, timestamptz, int) from public, anon, authenticated;
grant execute on function public.cerrar_catalogo_etiquetas(text, timestamptz, int) to service_role;
