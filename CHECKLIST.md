# Checklist de desenvolvimento — helodash

> Acompanhe aqui. Eu marco `[x]` conforme cada etapa fecha **com verificação**, não por opinião.
> Local: **http://localhost:5173** (no celular, mesmo Wi-Fi: `http://SEU-IP:5173`)

## Fase 1 — Esqueleto + design system ✅
- [x] Vite + React + TS + Tailwind instalados e rodando
- [x] Design system do Beacon portado (materiais liquid glass, tipografia com tracking por tamanho)
- [x] Paleta da marca aplicada: café escuro + creme + dourado (acento único), claro/escuro
- [x] Fonte serif da marca (Cormorant Garamond) em wordmark e títulos
- [x] Favicon "hD" (só a escrita, como pedido)
- [x] Localhost no ar

## Fase 2 — Banco (Supabase) ✅
- [x] Migration escrita: 8 tabelas + RLS em todas + triggers de estoque + snapshot de custo + view financeira
- [x] Migration aplicada no projeto `wzrtvhrkdjagmawxdnrj` (via SQL Editor, sessão sua) ✅
- [x] Login criado (joaovictordems@gmail.com) — autenticação testada no navegador ✅
- [x] Verificação: 19/19 testes E2E — RLS, triggers de estoque, snapshot, view financeira com números conferidos na mão ✅

## Fase 3 — Auth + shell ✅ (código pronto; testa após Fase 2)
- [x] Login e-mail/senha, sessão persistente, logout limpa cache
- [x] Sidebar flutuante desktop + bottom nav mobile
- [x] Tema claro/escuro com persistência

## Fase 4 — Telas ✅ (código pronto; teste ponta a ponta após Fase 2)
- [x] **Resumo** — KPIs do mês, gráfico faturamento × lucro, últimas vendas, follow-ups do dia
- [x] **Vendas** — lista + filtro por mês, nova venda (itens, desconto, entrega/motoboy, pagamento parcial), detalhe com lucro da venda, excluir (estoque reverte)
- [x] **Clientes** — busca, ficha com histórico + total gasto, botão WhatsApp, follow-up com data
- [x] **Produtos** — produto físico OU serviço/ensaio, custo/preço/margem, badge de estoque baixo, arquivar
- [x] **Compras** — entrada de estoque com frete, fornecedores na mesma tela
- [x] **Financeiro** — caixa atual, investido, lucro acumulado, a receber, aportes/retiradas/despesas, gráfico de evolução, tabela mês a mês
- [x] **Ajustes** — tema, export CSV (backup), sair

## Fase 5 — Verificação de qualidade ✅
- [x] Typecheck limpo (`tsc`)
- [x] Teste visual desktop (1280px) + mobile (390px) ✅
- [x] Fluxo completo testado: fornecedor → produto → compra → cliente → venda → financeiro batendo ✅
- [x] Conferência manual: faturamento 450, CMV 80, lucro líquido 325, caixa 435 — exatos ✅

## Fase 6 — GitHub + deploy ✅ (2 pendências suas)
- [x] `git init` + commit + push pro `heloisatrabalhos/helodash` ✅
- [ ] ⚠️ Repo está **Public** → trocar pra Private (Settings do repo)
- [x] Vercel conectado (projeto `helo21/helodash`) + env vars configuradas ✅
- [ ] GitHub Action de ping semanal (Supabase free não pausa)
- [x] Produção testada: login + dados carregando em https://helodash.vercel.app ✅ (teste no 4G: faça pelo celular)
- [ ] Revogar o PAT e o service_role que vazaram no chat, gerar novos

---

### 🔑 O único acesso que falta
A migration não aplica porque o conector Supabase daqui está logado na conta **eunnord-ecom**, e o projeto da Heloísa está na conta **heloisatrabalhos**. Resolve com 1 minuto:
**supabase.com → login na conta heloisatrabalhos → Account → Access Tokens → Generate new token** → me cola o token (`sbp_...`).
Com ele eu aplico a migration, crio a usuária e testo tudo de ponta a ponta.
