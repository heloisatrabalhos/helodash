-- ============================================================================
-- helodash — schema inicial
-- Todas as tabelas: owner_id + RLS. Regra de negócio crítica vive AQUI
-- (estoque, snapshot de custo, total da venda), nunca só no front.
-- ============================================================================

create type item_tipo as enum ('produto', 'servico');
create type mov_tipo as enum ('aporte', 'retirada', 'despesa');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table fornecedores (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome       text not null,
  contato    text,
  obs        text,
  criado_em  timestamptz not null default now()
);

create table produtos (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null,
  tipo          item_tipo not null default 'produto',
  categoria     text,
  tamanho       text,
  fornecedor_id uuid references fornecedores (id) on delete set null,
  custo_unit    numeric(12,2) not null default 0 check (custo_unit >= 0),
  preco_venda   numeric(12,2) not null default 0 check (preco_venda >= 0),
  estoque_atual integer not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table compras (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fornecedor_id uuid references fornecedores (id) on delete set null,
  data          date not null default current_date,
  frete         numeric(12,2) not null default 0 check (frete >= 0),
  obs           text,
  criado_em     timestamptz not null default now()
);

create table compra_itens (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  compra_id  uuid not null references compras (id) on delete cascade,
  produto_id uuid not null references produtos (id) on delete restrict,
  qtd        integer not null check (qtd > 0),
  custo_unit numeric(12,2) not null check (custo_unit >= 0)
);

create table clientes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome             text not null,
  telefone         text,
  email            text,
  tamanho_ref      text,
  aniversario      date,
  origem           text,
  obs              text,
  proximo_contato  date,
  criado_em        timestamptz not null default now()
);

create table vendas (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id       uuid references clientes (id) on delete set null,
  data             date not null default current_date,
  canal            text,
  forma_pagamento  text,
  desconto         numeric(12,2) not null default 0 check (desconto >= 0),
  custo_entrega    numeric(12,2) not null default 0 check (custo_entrega >= 0),
  valor_total      numeric(12,2) not null default 0,
  valor_pago       numeric(12,2) not null default 0 check (valor_pago >= 0),
  obs              text,
  criado_em        timestamptz not null default now(),
  -- Derivado no banco: o front nunca calcula status de pagamento.
  status_pagamento text generated always as (
    case
      when valor_total > 0 and valor_pago >= valor_total then 'pago'
      when valor_pago > 0 then 'parcial'
      else 'pendente'
    end
  ) stored
);

create table venda_itens (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venda_id   uuid not null references vendas (id) on delete cascade,
  produto_id uuid references produtos (id) on delete set null,
  -- SNAPSHOTS: o lucro de uma venda passada nunca muda porque o produto mudou.
  descricao  text not null default '',
  qtd        integer not null check (qtd > 0),
  preco_unit numeric(12,2) not null check (preco_unit >= 0),
  custo_unit numeric(12,2) not null default 0 check (custo_unit >= 0)
);

-- Caixa: aportes da dona, retiradas e despesas operacionais (embalagem, motoboy…)
create table movimentacoes (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo      mov_tipo not null,
  categoria text,
  valor     numeric(12,2) not null check (valor > 0),
  data      date not null default current_date,
  obs       text,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index idx_fornecedores_owner on fornecedores (owner_id);
create index idx_produtos_owner     on produtos (owner_id, ativo);
create index idx_compras_owner      on compras (owner_id, data);
create index idx_compra_itens_owner on compra_itens (owner_id, compra_id);
create index idx_clientes_owner     on clientes (owner_id, nome);
create index idx_vendas_owner       on vendas (owner_id, data);
create index idx_venda_itens_owner  on venda_itens (owner_id, venda_id);
create index idx_mov_owner          on movimentacoes (owner_id, data);

-- ---------------------------------------------------------------------------
-- RLS — isolamento total por dono, em TODAS as tabelas
-- ---------------------------------------------------------------------------

alter table fornecedores  enable row level security;
alter table produtos      enable row level security;
alter table compras       enable row level security;
alter table compra_itens  enable row level security;
alter table clientes      enable row level security;
alter table vendas        enable row level security;
alter table venda_itens   enable row level security;
alter table movimentacoes enable row level security;

create policy "dono_fornecedores"  on fornecedores  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_produtos"      on produtos      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_compras"       on compras       for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_compra_itens"  on compra_itens  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_clientes"      on clientes      for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_vendas"        on vendas        for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_venda_itens"   on venda_itens   for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dono_movimentacoes" on movimentacoes for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Snapshot: item de venda congela custo e descrição do produto no momento
-- ---------------------------------------------------------------------------

create or replace function fn_venda_item_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if new.produto_id is not null then
    select nome, custo_unit into p from produtos where id = new.produto_id;
    if new.descricao = '' then
      new.descricao := coalesce(p.nome, '');
    end if;
    -- custo_unit = 0 e produto tem custo: assume que o front não mandou → congela o atual
    if new.custo_unit = 0 and p.custo_unit is not null then
      new.custo_unit := p.custo_unit;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_venda_item_snapshot
  before insert on venda_itens
  for each row execute function fn_venda_item_snapshot();

-- ---------------------------------------------------------------------------
-- Estoque: venda baixa, compra soma. Só itens tipo 'produto'. Delete reverte.
-- ---------------------------------------------------------------------------

create or replace function fn_estoque_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.produto_id is not null then
    update produtos set estoque_atual = estoque_atual - new.qtd
      where id = new.produto_id and tipo = 'produto';
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.produto_id is not null then
    update produtos set estoque_atual = estoque_atual + old.qtd
      where id = old.produto_id and tipo = 'produto';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_estoque_venda
  after insert or update of qtd, produto_id or delete on venda_itens
  for each row execute function fn_estoque_venda();

create or replace function fn_estoque_compra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update produtos set estoque_atual = estoque_atual + new.qtd
      where id = new.produto_id and tipo = 'produto';
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update produtos set estoque_atual = estoque_atual - old.qtd
      where id = old.produto_id and tipo = 'produto';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_estoque_compra
  after insert or update of qtd, produto_id or delete on compra_itens
  for each row execute function fn_estoque_compra();

-- ---------------------------------------------------------------------------
-- Total da venda: sempre derivado dos itens − desconto, recalculado no banco
-- ---------------------------------------------------------------------------

create or replace function fn_venda_recalc(p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update vendas v
     set valor_total = greatest(
       coalesce((select sum(qtd * preco_unit) from venda_itens where venda_id = p_venda_id), 0)
       - v.desconto, 0)
   where v.id = p_venda_id;
end;
$$;

create or replace function fn_venda_itens_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_venda_recalc(coalesce(new.venda_id, old.venda_id));
  return coalesce(new, old);
end;
$$;

create trigger trg_venda_itens_recalc
  after insert or update or delete on venda_itens
  for each row execute function fn_venda_itens_recalc();

-- Desconto alterado direto na venda → recalcula na hora, sem tocar nos itens
create or replace function fn_venda_desconto_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.valor_total := greatest(
    coalesce((select sum(qtd * preco_unit) from venda_itens where venda_id = new.id), 0)
    - new.desconto, 0);
  return new;
end;
$$;

create trigger trg_venda_desconto_recalc
  before update of desconto on vendas
  for each row execute function fn_venda_desconto_recalc();

-- ---------------------------------------------------------------------------
-- Visão financeira mensal — security_invoker: a view respeita a RLS de quem lê
-- ---------------------------------------------------------------------------

create view v_financeiro_mensal
with (security_invoker = on)
as
with meses as (
  select date_trunc('month', data)::date as mes from vendas
  union select date_trunc('month', data)::date from movimentacoes
  union select date_trunc('month', data)::date from compras
),
vd as (
  select date_trunc('month', v.data)::date as mes,
         sum(v.valor_total)   as faturamento,
         sum(v.valor_pago)    as recebido,
         sum(v.custo_entrega) as custo_entrega,
         sum((select coalesce(sum(i.qtd * i.custo_unit), 0)
                from venda_itens i where i.venda_id = v.id)) as cmv
    from vendas v
   group by 1
),
mv as (
  select date_trunc('month', data)::date as mes,
         sum(valor) filter (where tipo = 'aporte')   as aportes,
         sum(valor) filter (where tipo = 'retirada') as retiradas,
         sum(valor) filter (where tipo = 'despesa')  as despesas
    from movimentacoes
   group by 1
),
cp as (
  select date_trunc('month', c.data)::date as mes,
         sum(c.frete + (select coalesce(sum(i.qtd * i.custo_unit), 0)
                          from compra_itens i where i.compra_id = c.id)) as compras_total
    from compras c
   group by 1
)
select m.mes,
       coalesce(vd.faturamento, 0)   as faturamento,
       coalesce(vd.recebido, 0)      as recebido,
       coalesce(vd.cmv, 0)           as cmv,
       coalesce(vd.custo_entrega, 0) as custo_entrega,
       coalesce(mv.aportes, 0)       as aportes,
       coalesce(mv.retiradas, 0)     as retiradas,
       coalesce(mv.despesas, 0)      as despesas,
       coalesce(cp.compras_total, 0) as compras_total,
       coalesce(vd.faturamento, 0) - coalesce(vd.cmv, 0)
         - coalesce(vd.custo_entrega, 0)                          as lucro_bruto,
       coalesce(vd.faturamento, 0) - coalesce(vd.cmv, 0)
         - coalesce(vd.custo_entrega, 0) - coalesce(mv.despesas, 0) as lucro_liquido,
       coalesce(vd.recebido, 0) + coalesce(mv.aportes, 0)
         - coalesce(mv.retiradas, 0) - coalesce(mv.despesas, 0)
         - coalesce(cp.compras_total, 0) - coalesce(vd.custo_entrega, 0) as saldo_caixa_mes
  from meses m
  left join vd on vd.mes = m.mes
  left join mv on mv.mes = m.mes
  left join cp on cp.mes = m.mes
 order by m.mes;
