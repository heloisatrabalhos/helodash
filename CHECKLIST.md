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

## Fase 2 — Banco (Supabase) 🔶 aguardando 1 acesso
- [x] Migration escrita: 8 tabelas + RLS em todas + triggers de estoque + snapshot de custo + view financeira
- [ ] **BLOQUEADO** → aplicar no projeto `wzrtvhrkdjagmawxdnrj` (preciso do access token — ver nota no fim)
- [ ] Usuária criada (e-mail + senha da Heloísa)
- [ ] Verificação: RLS testada, estoque sobe/desce via trigger

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

## Fase 5 — Verificação de qualidade ⏳
- [ ] Typecheck limpo (`tsc`)
- [ ] Teste visual desktop + mobile (viewport real)
- [ ] Fluxo completo com dados reais: fornecedor → produto → compra → cliente → venda → financeiro bate
- [ ] Conferência manual dos números (3 vendas na mão vs. tela)

## Fase 6 — GitHub + deploy ⏳
- [ ] `git init` + primeiro commit + push pro `heloisatrabalhos/helodash`
- [ ] ⚠️ Repo está **Public** → trocar pra Private (Settings do repo)
- [ ] Vercel: você conecta o repo (env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] GitHub Action de ping semanal (Supabase free não pausa)
- [ ] Teste no 4G pelo celular
- [ ] Revogar o PAT e o service_role que vazaram no chat, gerar novos

---

### 🔑 O único acesso que falta
A migration não aplica porque o conector Supabase daqui está logado na conta **eunnord-ecom**, e o projeto da Heloísa está na conta **heloisatrabalhos**. Resolve com 1 minuto:
**supabase.com → login na conta heloisatrabalhos → Account → Access Tokens → Generate new token** → me cola o token (`sbp_...`).
Com ele eu aplico a migration, crio a usuária e testo tudo de ponta a ponta.
