# helodash — Heloísa Duarte, Gestão

Sistema privado de gestão: produtos, custos, fornecedores, clientes, vendas,
follow-up e financeiro (caixa, despesas, lucro). Mobile-first, PT-BR.

- **Stack:** Vite + React + TypeScript + Tailwind · Supabase (Postgres/Auth/RLS) · Vercel
- **Rodar local:** `npm install && npm run dev` (requer `.env.local`, ver `.env.example`)
- **Banco:** migration em `supabase/migrations/` — RLS em todas as tabelas, estoque e
  snapshot de custo resolvidos por trigger no banco.
- **Plano/checklist:** `PLANO.md` e `CHECKLIST.md`
