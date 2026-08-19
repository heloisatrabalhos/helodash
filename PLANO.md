# Heloísa Duarte — Gestão

Sistema web privado de controle de produtos, custos, clientes, vendas e resultado financeiro.
Uso: 1 pessoa (Heloísa), celular + notebook, navegador.

> Este arquivo é o painel de acompanhamento. Marque `[x]` conforme cada fase fecha.
> Status: **Fase 0 — aguardando decisões**

---

## 1. Decisões travadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Front | Vite + React 18 + TypeScript | Mesma base do Beacon System — o design system vem de graça |
| Estilo | Tailwind + shadcn/ui + `index.css` do Beacon | Materiais translúcidos, dark mode e tipografia já resolvidos |
| Backend | Supabase (Postgres + Auth + RLS) | Multi-dispositivo exige servidor; localStorage perde dado |
| Validação | Zod (servidor é a fonte de verdade) | Front valida só pra UX |
| Dados no client | TanStack Query | Cache, refetch e estado de loading sem gambiarra |
| Gráficos | Recharts | Já usado no Beacon |
| Hospedagem | Vercel (Hobby) + GitHub privado | Deploy automático a cada push |
| Mobile | Responsivo + PWA (ícone na home) | Sem app nativo, sem loja |
| Custo | **R$ 0/mês** | Domínio próprio opcional (~R$40/ano) |

### Identidade visual

Derivada da LP `Documents/LP da Helo fotos`: monograma **HD**, serif fina para títulos,
paleta marrom-café escuro (fundo) + creme + dourado suave (acento único, saturação baixa).
Base neutra Zinc, nunca preto puro. Uma cor de acento só.

---

## 2. Modelo de dados

Todas as tabelas com `owner_id uuid references auth.users` e **RLS ativa**.

| Tabela | Campos principais |
|---|---|
| `fornecedores` | nome, contato, obs |
| `produtos` | nome, `tipo` (produto/servico), categoria, tamanho, fornecedor_id, custo_unit, preco_sugerido, estoque_atual, ativo |
| `compras` | fornecedor_id, data, valor_total, obs |
| `compra_itens` | compra_id, produto_id, qtd, custo_unit |
| `clientes` | nome, telefone, email, tamanho_ref, aniversario, origem, obs |
| `vendas` | cliente_id, data, vendedora, canal, forma_pagamento, desconto, valor_total, valor_pago, status_pagamento (pago/parcial/pendente) |
| `venda_itens` | venda_id, produto_id, `descricao_snapshot`, qtd, preco_unit, `custo_unit_snapshot` |

**Decisão que não dá pra corrigir depois:** `venda_itens` grava *snapshot* do custo e da descrição.
Se o custo do produto mudar amanhã, o lucro de uma venda de março **não pode mudar junto**.
Sem snapshot, o histórico financeiro inteiro se reescreve sozinho.

**Regra de estoque:** compra confirmada soma; venda confirmada subtrai. Item `tipo=servico`
não mexe em estoque e não exige fornecedor.

### KPIs derivados (views SQL, calculados no servidor)

Faturamento do período · CMV (custo dos itens vendidos) · Lucro bruto e margem %
· Ticket médio · Valor a receber (vendas parciais/pendentes) · Top clientes
· Top produtos · Estoque parado (sem venda há N dias) · Investido em compras no mês.

---

## 3. Telas

1. **Login** — e-mail + senha, sessão persistente
2. **Visão geral** — KPIs, gráfico mês a mês, filtro de período, últimas vendas
3. **Vendas** — lista filtrável + nova venda (cliente → itens → pagamento)
4. **Clientes** — ficha com histórico de compras, total gasto, botão WhatsApp, marcar follow-up
5. **Produtos** — lista com custo, preço, estoque, fornecedor, tamanho
6. **Compras** — entrada de estoque vinculada ao fornecedor
7. **Fornecedores** — cadastro simples
8. **Ajustes** — perfil, exportar CSV, tema

Navegação: sidebar no desktop, **bottom nav no celular**.

---

## 4. Checklist de execução

### Fase 0 — Decisões e contas `[ ]`

- [ ] Confirmar as 3 lacunas da varredura anti-negligência
- [ ] Conta/org GitHub definida · repo **privado** criado
- [ ] Conta Supabase (org definida)
- [ ] Conta Vercel ligada ao GitHub
- [ ] Nome oficial do sistema confirmado
- [ ] Confirmar se existe planilha/caderno atual pra importar
- **Pronto quando:** as 3 contas existem e o repo vazio já está no GitHub

### Fase 1 — Esqueleto + design system `[ ]`

- [ ] `npm create vite` (react-ts), Tailwind, shadcn/ui
- [ ] Copiar `index.css` + `tailwind.config.ts` do Beacon System
- [ ] Adaptar tokens pra paleta da Heloísa (marrom/creme/dourado)
- [ ] Logo HD + favicon
- [ ] `npm run dev -- --host` rodando (acessível do celular na mesma rede)
- **Pronto quando:** você abre `localhost:5173` no notebook e o IP da rede no celular, e vê a casca com a identidade dela

### Fase 2 — Banco `[ ]`

- [ ] Projeto Supabase criado, chaves em `.env.local` (nunca no código)
- [ ] Migration com todas as tabelas
- [ ] **RLS ativa em todas** + policies por `owner_id`
- [ ] Views de KPI
- [ ] Types TypeScript gerados do schema
- **Pronto quando:** teste com 2 usuários prova que um não lê nada do outro

### Fase 3 — Auth + shell `[ ]`

- [ ] Login/logout, rota protegida, sessão persistente
- [ ] Sidebar desktop + bottom nav mobile
- [ ] Limpar todo cache no logout
- **Pronto quando:** sem login não carrega nada; com login navega entre telas vazias

### Fase 4 — Fornecedores + Produtos `[ ]`

- [ ] CRUD fornecedores
- [ ] CRUD produtos (com `tipo` produto/serviço), validação Zod
- [ ] Busca e filtro por categoria/fornecedor/tamanho
- **Pronto quando:** cadastra, edita e lista produto e serviço

### Fase 5 — Compras `[ ]`

- [ ] Nova compra com múltiplos itens
- [ ] Estoque soma ao confirmar
- **Pronto quando:** compra de 5 un. leva o estoque de 0 pra 5

### Fase 6 — Clientes `[ ]`

- [ ] CRUD cliente (nome, telefone, tamanho, aniversário, origem, obs)
- [ ] Telefone com máscara BR
- **Pronto quando:** cadastra e busca cliente por nome ou telefone

### Fase 7 — Vendas `[ ]`

- [ ] Nova venda: cliente → itens → desconto → pagamento
- [ ] Snapshot de custo e descrição no item
- [ ] Estoque subtrai ao confirmar
- [ ] Pagamento parcial (valor pago + saldo devedor)
- **Pronto quando:** venda registrada baixa estoque, aparece no histórico do cliente e o saldo devedor bate

### Fase 8 — Financeiro `[ ]`

- [ ] KPIs do período + filtro por mês
- [ ] Gráfico faturamento × custo × lucro mês a mês
- [ ] Lista de a receber
- **Pronto quando:** os números batem com uma conferência manual de 3 vendas

### Fase 9 — Follow-up `[ ]`

- [ ] Marcar cliente pra retorno com data
- [ ] Lista "retornar hoje / atrasado"
- [ ] Botão WhatsApp (`wa.me`) com mensagem pronta
- **Pronto quando:** clica e abre o WhatsApp do celular no contato certo

### Fase 10 — Mobile + acabamento `[ ]`

- [ ] Testar em viewport real de celular (não só devtools)
- [ ] Áreas de toque ≥44px, formulários com teclado certo (`inputmode="numeric"` em valor)
- [ ] PWA: manifest + ícone HD, "adicionar à tela de início"
- [ ] Estados vazios, loading e erro em toda tela
- **Pronto quando:** você usa o sistema inteiro só com o polegar, no celular

### Fase 11 — Deploy `[ ]`

- [ ] Push no GitHub (privado)
- [ ] Vercel conectado, env vars configuradas
- [ ] Build de produção verificado no celular via 4G (fora do Wi-Fi)
- [ ] GitHub Action semanal de ping (impede o Supabase free de pausar)
- [ ] `noindex` — a URL não vai pro Google
- **Pronto quando:** ela abre o link no 4G e loga

### Fase 12 — Entrega `[ ]`

- [ ] Conta dela criada, senha entregue por canal seguro
- [ ] Backup: export CSV na tela de ajustes + dump agendado
- [ ] Walkthrough de 10 min com ela, cadastrando uma venda real
- **Pronto quando:** ela cadastra uma venda sozinha, sem você do lado

---

## 5. O que eu preciso de você

**Bloqueia a Fase 0:**

1. Resposta das 3 lacunas da varredura
2. Conta GitHub (usuário/org)
3. Conta Supabase (criar em supabase.com, plano free)
4. Conta Vercel (login com GitHub)

**Bloqueia a Fase 1** (posso derivar dos screenshots se não vier):

5. Arquivo original da logo HD (PNG/SVG com fundo transparente) — só tenho screenshot

**Bloqueia a Fase 12:**

6. E-mail da Heloísa pra criar a conta dela
7. Planilha atual, se existir

**Fora de escopo** (não faço sem você pedir):
emissão de nota fiscal · gateway de pagamento · múltiplos usuários com permissões
· app nativo em loja · integração com Instagram ou agenda de ensaios.

---

## 6. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Supabase free pausa após ~7 dias sem uso | Ping semanal via GitHub Actions (Fase 11) |
| Dado pessoal de cliente (telefone) — LGPD | Acesso só autenticado, RLS, sem indexação, export sob demanda |
| Perda de dados | Export CSV na UI + backup do Postgres |
| Custo do produto mudar e reescrever lucro histórico | Snapshot no `venda_itens` (Fase 7) |
| Marca é de fotografia, sistema é de gestão | Tema deriva da identidade, mas o layout é de dashboard, não de LP |
