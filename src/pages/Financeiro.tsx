import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Plus, ReceiptText, Trash2, Wallet } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { brl, dataBR, hojeISO, mesBR, parseValor } from "@/lib/format";
import type { FinanceiroMensal, Movimentacao, MovTipo, Venda } from "@/types";
import {
  Button,
  Card,
  Empty,
  ErroCarga,
  Field,
  Input,
  Loading,
  Modal,
  Select,
  useConfirm,
} from "@/components/ui";

const movSchema = z.object({
  tipo: z.enum(["aporte", "retirada", "despesa"]),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data: z.string().min(1),
  categoria: z.string().trim(),
  obs: z.string().trim(),
});

const tipoLabel: Record<MovTipo, string> = {
  aporte: "Aporte (dinheiro que entrou no caixa)",
  retirada: "Retirada (dinheiro que ela tirou)",
  despesa: "Despesa (embalagem, motoboy, taxa…)",
};

export default function Financeiro() {
  const qc = useQueryClient();
  const confirmar = useConfirm();
  const [modal, setModal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [tipo, setTipo] = useState<MovTipo>("despesa");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [categoria, setCategoria] = useState("");
  const [obs, setObs] = useState("");

  const fin = useQuery({
    queryKey: ["financeiro-mensal"],
    queryFn: async (): Promise<FinanceiroMensal[]> => {
      const { data, error } = await supabase.from("v_financeiro_mensal").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const movs = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async (): Promise<Movimentacao[]> => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendentes = useQuery({
    queryKey: ["vendas-pendentes"],
    queryFn: async (): Promise<Venda[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select("id, data, valor_total, valor_pago, status_pagamento, clientes(nome)")
        .in("status_pagamento", ["parcial", "pendente"])
        .order("data");
      if (error) throw error;
      return (data as unknown as Venda[]) ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = movSchema.safeParse({
        tipo,
        valor: parseValor(valor),
        data,
        categoria,
        obs,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const d = parsed.data;
      const { error } = await supabase.from("movimentacoes").insert({
        tipo: d.tipo,
        valor: d.valor,
        data: d.data,
        categoria: d.categoria || null,
        obs: d.obs || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setModal(false);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  if (fin.isLoading) return <Loading />;
  if (fin.isError) return <ErroCarga />;

  const meses = fin.data ?? [];
  const saldoCaixa = meses.reduce((s, m) => s + m.saldo_caixa_mes, 0);
  const investidoTotal = meses.reduce((s, m) => s + m.compras_total + m.despesas, 0);
  const lucroTotal = meses.reduce((s, m) => s + m.lucro_liquido, 0);
  const aReceber = (pendentes.data ?? []).reduce((s, v) => s + (v.valor_total - v.valor_pago), 0);

  let acumulado = 0;
  const grafico = meses.map((m) => {
    acumulado += m.saldo_caixa_mes;
    return { nome: mesBR(m.mes), Caixa: acumulado };
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Caixa, investimento e retorno</p>
        </div>
        <Button
          onClick={() => {
            setTipo("despesa");
            setValor("");
            setData(hojeISO());
            setCategoria("");
            setObs("");
            setErro(null);
            setModal(true);
          }}
        >
          <Plus className="lucide h-4 w-4" /> Lançar
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Caixa atual" valor={brl(saldoCaixa)} destaque negativo={saldoCaixa < 0} />
        <Kpi titulo="Investido (compras + despesas)" valor={brl(investidoTotal)} />
        <Kpi titulo="Lucro líquido acumulado" valor={brl(lucroTotal)} negativo={lucroTotal < 0} />
        <Kpi titulo="A receber" valor={brl(aReceber)} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Evolução do caixa</h2>
        {grafico.length === 0 ? (
          <Empty icon={<Wallet className="lucide h-8 w-8" />} title="Sem movimento ainda" />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={grafico} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="caixa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="nome" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
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
                <Area type="monotone" dataKey="Caixa" stroke="hsl(var(--gold))" strokeWidth={2} fill="url(#caixa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* A receber */}
        <Card>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">A receber</h2>
          {(pendentes.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tudo recebido. 🎉</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {pendentes.data!.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.clientes?.nome ?? "Sem cliente"}</p>
                    <p className="text-xs text-muted-foreground">{dataBR(v.data)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-numbers text-sm font-medium text-warning">
                      {brl(v.valor_total - v.valor_pago)}
                    </p>
                    <p className="text-xs text-muted-foreground">de {brl(v.valor_total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Movimentações */}
        <Card>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Últimos lançamentos</h2>
          {(movs.data ?? []).length === 0 ? (
            <Empty
              icon={<ReceiptText className="lucide h-8 w-8" />}
              title="Nenhum lançamento"
              hint="Registre aportes, retiradas e despesas (embalagem, motoboy, taxas)."
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {movs.data!.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {m.tipo === "aporte" ? (
                      <ArrowUpCircle className="lucide h-5 w-5 shrink-0 text-success" />
                    ) : (
                      <ArrowDownCircle className="lucide h-5 w-5 shrink-0 text-cost" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.categoria || (m.tipo === "aporte" ? "Aporte" : m.tipo === "retirada" ? "Retirada" : "Despesa")}
                      </p>
                      <p className="text-xs text-muted-foreground">{dataBR(m.data)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono-numbers text-sm ${m.tipo === "aporte" ? "text-success" : "text-cost"}`}
                    >
                      {m.tipo === "aporte" ? "+" : "−"}
                      {brl(m.valor)}
                    </span>
                    <button
                      aria-label="Excluir lançamento"
                      onClick={async () => {
                        if (await confirmar({ titulo: "Excluir este lançamento?" })) excluir.mutate(m.id);
                      }}
                      className="press flex h-8 w-8 items-center justify-center rounded-[var(--r-chip)] text-muted-foreground hover:bg-cost-light hover:text-cost"
                    >
                      <Trash2 className="lucide h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Detalhe mensal */}
      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Mês a mês</h2>
        {meses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Mês</th>
                  <th className="pb-2 pr-3 font-medium">Faturou</th>
                  <th className="pb-2 pr-3 font-medium">Custos</th>
                  <th className="pb-2 pr-3 font-medium">Despesas</th>
                  <th className="pb-2 pr-3 font-medium">Compras</th>
                  <th className="pb-2 font-medium">Lucro líquido</th>
                </tr>
              </thead>
              <tbody>
                {[...meses].reverse().map((m) => (
                  <tr key={m.mes} className="border-t border-border/70">
                    <td className="py-2 pr-3 font-medium">{mesBR(m.mes)}</td>
                    <td className="py-2 pr-3 font-mono-numbers">{brl(m.faturamento)}</td>
                    <td className="py-2 pr-3 font-mono-numbers">{brl(m.cmv + m.custo_entrega)}</td>
                    <td className="py-2 pr-3 font-mono-numbers">{brl(m.despesas)}</td>
                    <td className="py-2 pr-3 font-mono-numbers">{brl(m.compras_total)}</td>
                    <td className={`py-2 font-mono-numbers font-medium ${m.lucro_liquido >= 0 ? "text-success" : "text-cost"}`}>
                      {brl(m.lucro_liquido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Novo lançamento */}
      <Modal open={modal} onClose={() => setModal(false)} title="Novo lançamento">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setErro(null);
            salvar.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as MovTipo)}>
              {(Object.keys(tipoLabel) as MovTipo[]).map((t) => (
                <option key={t} value={t}>
                  {tipoLabel[t]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <Input
                inputMode="decimal"
                required
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </Field>
            <Field label="Data">
              <Input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
          </div>
          <Field label="Categoria" hint="Ex.: embalagem, motoboy, taxa de máquina">
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </Field>
          <Field label="Observações">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
          {erro && <p className="text-sm text-cost">{erro}</p>}
          <Button type="submit" loading={salvar.isPending}>
            Lançar
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  destaque = false,
  negativo = false,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
  negativo?: boolean;
}) {
  return (
    <Card className={destaque ? "outline outline-1 outline-gold/40" : ""}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={`font-mono-numbers mt-1 text-xl sm:text-2xl ${negativo ? "text-cost" : destaque ? "text-gold" : ""}`}>
        {valor}
      </p>
    </Card>
  );
}
