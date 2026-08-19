-- 0004: ofertas por quantidade na projeção (leve X pague Y, margem real da oferta)
alter table projecoes add column ofertas jsonb not null default '[]';
