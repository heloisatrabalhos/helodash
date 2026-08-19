-- 0003: margem desejada por cenário de projeção (base do preço sugerido)
alter table projecoes add column margem_desejada numeric(5,2) not null default 50;
