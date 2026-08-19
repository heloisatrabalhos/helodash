-- 0002: projecoes — cenários de investimento (simulador "e se")
-- Números digitados são independentes do catálogo: a projeção não muda
-- quando um produto real muda de custo.
create table projecoes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null,
  itens         jsonb not null default '[]', -- [{descricao, qtd, custo_unit, preco_venda}]
  extras        jsonb not null default '[]', -- [{descricao, valor}] embalagem, frete, tráfego…
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index idx_projecoes_owner on projecoes (owner_id, criado_em);
alter table projecoes enable row level security;
create policy "dono_projecoes" on projecoes for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
