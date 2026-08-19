import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { brl, dataBR, hojeISO, mesBR, waLink } from "@/lib/format";
import type { Cliente, FinanceiroMensal, Venda } from "@/types";
import { Badge, Card, Empty, ErroCarga, Loading } from "@/components/ui";

const statusTone = { pago: "success", parcial: "warning", pendente: "danger" } as const;

export default function Dashboard() {
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);

  const fin = useQuery({
    queryKey: ["financeiro-mensal"],
    queryFn: async (): Promise<FinanceiroMensal[]> => {
      const { data, error } = await supabase.from("v_financeiro_mensal").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ultimas = useQuery({
    queryKey: ["vendas-ultimas"],
    queryFn: async (): Promise<Venda[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select("id, data, valor_total, valor_pago, status_pagamento, clientes(nome)")
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data as unknown as Venda[]) ?? [];
    },
  });

  const followups = useQuery({
    queryKey: ["followups-hoje"],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .lte("proximo_contato", hoje)
        .order("proximo_contato")
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (fin.isLoading) return <Loading />;
  if (fin.isError) return <ErroCarga />;

  const meses = fin.data ?? [];
  const doMes = meses.find((m) => m.mes.slice(0, 7) === mesAtual);
  const aReceber = meses.reduce((s, m) => s + (m.faturamento - m.recebido), 0);

  // Margem e markup do mês — derivados das vendas (preço) × compras (custo).
  const fat = doMes?.faturamento ?? 0;
  const custoTotal = (doMes?.cmv ?? 0) + (doMes?.custo_entrega ?? 0);
  const margem = fat > 0 ? ((doMes?.lucro_liquido ?? 0) / fat) * 100 : null;
  const markup = custoTotal > 0 ? fat / custoTotal : null;
  const grafico = meses.slice(-6).map((m) => ({
    nome: mesBR(m.mes),
    Faturamento: m.faturamento,
    Lucro: m.lucro_liquido,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-3xl">Resumo</h1>
        <p className="text-sm text-muted-foreground">{mesBR(hoje)}</p>
      </header>

      {/* KPIs do mês — margem e markup derivam de vendas × custos das outras abas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi titulo="Faturamento" valor={brl(fat)} />
        <Kpi titulo="Lucro líquido" valor={brl(doMes?.lucro_liquido)} destaque />
        <Kpi
          titulo="Margem de lucro"
          valor={margem === null ? "—" : `${margem.toFixed(1).replace(".", ",")}%`}
          hint="lucro ÷ faturamento"
        />
        <Kpi
          titulo="Markup"
          valor={markup === null ? "—" : `${markup.toFixed(2).replace(".", ",")}×`}
          hint="faturamento ÷ custo"
        />
        <Kpi titulo="Custo (produto + entrega)" valor={brl(custoTotal)} />
        <Kpi titulo="A receber (total)" valor={brl(aReceber)} alerta={aReceber > 0} />
      </div>

      {/* Gráfico mês a mês */}
      <Card>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Faturamento × lucro — últimos meses</h2>
        {grafico.length === 0 ? (
          <Empty
            icon={<ShoppingBag className="lucide h-8 w-8" />}
            title="Sem vendas ainda"
            hint="Registre a primeira venda e o gráfico nasce aqui."
          />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="nome" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v) => brl(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar dataKey="Faturamento" fill="hsl(var(--gold))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Lucro" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Últimas vendas */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Últimas vendas</h2>
            <Link to="/vendas" className="text-sm font-medium text-gold hover:underline">
              Ver todas
            </Link>
          </div>
          {ultimas.data?.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda registrada.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {ultimas.data?.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.clientes?.nome ?? "Sem cliente"}</p>
                    <p className="text-xs text-muted-foreground">{dataBR(v.data)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-numbers text-sm">{brl(v.valor_total)}</span>
                    <Badge tone={statusTone[v.status_pagamento]}>{v.status_pagamento}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Follow-ups */}
        <Card>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Follow-up — contatar</h2>
          {followups.data?.length === 0 ? (
            <Empty
              icon={<CalendarClock className="lucide h-8 w-8" />}
              title="Ninguém pra hoje"
              hint="Marque um retorno na ficha do cliente e ele aparece aqui na data."
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {followups.data?.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">desde {dataBR(c.proximo_contato)}</p>
                  </div>
                  {c.telefone && (
                    <a
                      href={waLink(c.telefone, `Oi ${c.nome.split(" ")[0]}! Tudo bem?`)}
                      target="_blank"
                      rel="noreferrer"
                      className="press rounded-[var(--r-chip)] bg-success-light px-3 py-1.5 text-xs font-medium text-success"
                    >
                      WhatsApp
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  destaque = false,
  alerta = false,
  hint,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
  alerta?: boolean;
  hint?: string;
}) {
  return (
    <Card className={destaque ? "outline outline-1 outline-gold/40" : ""}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p
        className={`font-mono-numbers mt-1 text-xl sm:text-2xl ${
          alerta ? "text-warning" : destaque ? "text-gold" : ""
        }`}
      >
        {valor}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>}
    </Card>
  );
}
