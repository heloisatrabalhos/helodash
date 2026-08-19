import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/format";
import type { Projecao } from "@/types";
import { Button, Card, Empty, ErroCarga, Loading, useConfirm } from "@/components/ui";

/**
 * Projeção — planilha de planejamento em tela cheia.
 * Colunas editáveis direto na célula, totais ao vivo, SALVAMENTO AUTOMÁTICO
 * (debounce de 800ms — clicar fora ou trocar de aba nunca perde dado) e
 * export CSV. Vários cenários coexistem como abas no topo.
 * Os números são independentes do catálogo: mudar um produto real não
 * reescreve o planejamento.
 */

interface ItemForm {
  descricao: string;
  qtd: string;
  custo: string;
  preco: string;
}

interface ExtraForm {
  descricao: string;
  valor: string;
}

const itemVazio: ItemForm = { descricao: "", qtd: "", custo: "", preco: "" };

function calcular(itens: ItemForm[], extras: ExtraForm[]) {
  const investPecas = itens.reduce((s, i) => s + Number(i.qtd || 0) * parseValor(i.custo), 0);
  const extrasTotal = extras.reduce((s, e) => s + parseValor(e.valor), 0);
  const investTotal = investPecas + extrasTotal;
  const receita = itens.reduce((s, i) => s + Number(i.qtd || 0) * parseValor(i.preco), 0);
  const totalPecas = itens.reduce((s, i) => s + Number(i.qtd || 0), 0);
  const lucro = receita - investTotal;
  const margem = receita > 0 ? (lucro / receita) * 100 : null;
  const markup = investTotal > 0 ? receita / investTotal : null;
  const custoMedio = totalPecas > 0 ? investTotal / totalPecas : null;
  const precoMedio = totalPecas > 0 ? receita / totalPecas : null;
  const breakEven = precoMedio && precoMedio > 0 ? Math.ceil(investTotal / precoMedio) : null;
  return { investPecas, extrasTotal, investTotal, receita, totalPecas, lucro, margem, markup, custoMedio, precoMedio, breakEven };
}

function paraForm(p: Projecao) {
  return {
    nome: p.nome,
    itens: p.itens.length
      ? p.itens.map((i) => ({
          descricao: i.descricao,
          qtd: i.qtd ? String(i.qtd) : "",
          custo: i.custo_unit ? String(i.custo_unit).replace(".", ",") : "",
          preco: i.preco_venda ? String(i.preco_venda).replace(".", ",") : "",
        }))
      : [{ ...itemVazio }],
    extras: p.extras.map((e) => ({
      descricao: e.descricao,
      valor: e.valor ? String(e.valor).replace(".", ",") : "",
    })),
  };
}

function paraBanco(nome: string, itens: ItemForm[], extras: ExtraForm[]) {
  return {
    nome: nome.trim() || "Sem nome",
    itens: itens
      .filter((i) => i.descricao.trim() || i.qtd || i.custo || i.preco)
      .map((i) => ({
        descricao: i.descricao.trim(),
        qtd: Number(i.qtd || 0),
        custo_unit: parseValor(i.custo),
        preco_venda: parseValor(i.preco),
      })),
    extras: extras
      .filter((e) => e.descricao.trim() || e.valor)
      .map((e) => ({ descricao: e.descricao.trim(), valor: parseValor(e.valor) })),
    atualizado_em: new Date().toISOString(),
  };
}

const celula =
  "w-full min-h-[42px] bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/60 rounded-[var(--r-inner)]";

export default function ProjecaoPage() {
  const qc = useQueryClient();
  const confirmar = useConfirm();
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }]);
  const [extras, setExtras] = useState<ExtraForm[]>([]);
  const [salvando, setSalvando] = useState<"idle" | "sujo" | "salvando" | "salvo">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregado = useRef<string | null>(null);

  const projecoes = useQuery({
    queryKey: ["projecoes"],
    queryFn: async (): Promise<Projecao[]> => {
      const { data, error } = await supabase.from("projecoes").select("*").order("criado_em");
      if (error) throw error;
      return (data as unknown as Projecao[]) ?? [];
    },
  });

  const ativo = projecoes.data?.find((p) => p.id === ativoId) ?? projecoes.data?.[0] ?? null;

  // Carrega o form quando o cenário ativo muda (nunca sobrescreve digitação do mesmo cenário)
  useEffect(() => {
    if (!ativo || carregado.current === ativo.id) return;
    carregado.current = ativo.id;
    setAtivoId(ativo.id);
    const f = paraForm(ativo);
    setNome(f.nome);
    setItens(f.itens);
    setExtras(f.extras);
    setSalvando("idle");
  }, [ativo]);

  /** Autosave: qualquer mudança agenda um update em 800ms. */
  const salvar = useCallback(
    async (id: string, n: string, it: ItemForm[], ex: ExtraForm[]) => {
      setSalvando("salvando");
      const { error } = await supabase.from("projecoes").update(paraBanco(n, it, ex)).eq("id", id);
      setSalvando(error ? "sujo" : "salvo");
      if (!error) qc.invalidateQueries({ queryKey: ["projecoes"] });
    },
    [qc]
  );

  function agendar(n: string, it: ItemForm[], ex: ExtraForm[]) {
    if (!ativo) return;
    setSalvando("sujo");
    if (timer.current) clearTimeout(timer.current);
    const id = ativo.id;
    timer.current = setTimeout(() => salvar(id, n, it, ex), 800);
  }

  // Flush ao sair da página / fechar aba
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const criar = useMutation({
    mutationFn: async () => {
      const n = `Cenário ${(projecoes.data?.length ?? 0) + 1}`;
      const { data, error } = await supabase
        .from("projecoes")
        .insert({ nome: n, itens: [], extras: [] })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Projecao;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projecoes"] });
      carregado.current = null;
      setAtivoId(p.id);
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projecoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      carregado.current = null;
      setAtivoId(null);
      qc.invalidateQueries({ queryKey: ["projecoes"] });
    },
  });

  function setNomeA(v: string) {
    setNome(v);
    agendar(v, itens, extras);
  }

  function setItem(ix: number, patch: Partial<ItemForm>) {
    setItens((arr) => {
      const novo = arr.map((x, i) => (i === ix ? { ...x, ...patch } : x));
      agendar(nome, novo, extras);
      return novo;
    });
  }

  function addItem() {
    setItens((arr) => [...arr, { ...itemVazio }]);
  }

  function rmItem(ix: number) {
    setItens((arr) => {
      const novo = arr.length > 1 ? arr.filter((_, i) => i !== ix) : [{ ...itemVazio }];
      agendar(nome, novo, extras);
      return novo;
    });
  }

  function setExtra(ix: number, patch: Partial<ExtraForm>) {
    setExtras((arr) => {
      const novo = arr.map((x, i) => (i === ix ? { ...x, ...patch } : x));
      agendar(nome, itens, novo);
      return novo;
    });
  }

  function rmExtra(ix: number) {
    setExtras((arr) => {
      const novo = arr.filter((_, i) => i !== ix);
      agendar(nome, itens, novo);
      return novo;
    });
  }

  function exportarCSV() {
    const r = calcular(itens, extras);
    const linhas = [
      ["Produto", "Qtd", "Custo un.", "Venderá por", "Investimento", "Receita", "Lucro"],
      ...itens
        .filter((i) => i.descricao.trim() || i.qtd)
        .map((i) => {
          const q = Number(i.qtd || 0);
          const c = parseValor(i.custo);
          const p = parseValor(i.preco);
          return [i.descricao, q, c, p, q * c, q * p, q * (p - c)];
        }),
      [],
      ...extras.filter((e) => e.descricao.trim() || e.valor).map((e) => ["Custo extra: " + e.descricao, "", "", "", parseValor(e.valor)]),
      [],
      ["Investimento total", r.investTotal],
      ["Receita projetada", r.receita],
      ["Lucro projetado", r.lucro],
      ["Margem %", r.margem === null ? "" : r.margem.toFixed(1)],
      ["Markup", r.markup === null ? "" : r.markup.toFixed(2)],
      ["Peças para empatar", r.breakEven ?? ""],
    ];
    const csv = linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projecao-${nome.trim().toLowerCase().replace(/\s+/g, "-") || "cenario"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (projecoes.isLoading) return <Loading />;
  if (projecoes.isError) return <ErroCarga />;

  const r = calcular(itens, extras);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Projeção</h1>
          <p className="text-sm text-muted-foreground">Planilha de planejamento — salva sozinha enquanto você digita</p>
        </div>
        <div className="flex items-center gap-2">
          {ativo && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {salvando === "salvando" || salvando === "sujo" ? (
                <>
                  <Loader2 className="lucide h-3.5 w-3.5 animate-spin" /> salvando…
                </>
              ) : salvando === "salvo" ? (
                <>
                  <Check className="lucide h-3.5 w-3.5 text-success" /> salvo
                </>
              ) : null}
            </span>
          )}
          <Button onClick={() => criar.mutate()} loading={criar.isPending}>
            <Plus className="lucide h-4 w-4" /> Novo cenário
          </Button>
        </div>
      </header>

      {!ativo ? (
        <Card>
          <Empty
            icon={<Calculator className="lucide h-8 w-8" />}
            title="Nenhum cenário ainda"
            hint="Crie um cenário e planeje o próximo investimento como numa planilha: peças, custos e o retorno projetado."
          />
        </Card>
      ) : (
        <>
          {/* Abas de cenários */}
          {(projecoes.data?.length ?? 0) > 1 && (
            <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
              {projecoes.data!.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    carregado.current = null;
                    setAtivoId(p.id);
                  }}
                  className={`press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    p.id === ativo.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          )}

          {/* KPIs do cenário — sempre visíveis */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi titulo="Investimento" valor={brl(r.investTotal)} />
            <Kpi titulo="Receita projetada" valor={brl(r.receita)} />
            <Kpi titulo="Lucro projetado" valor={brl(r.lucro)} cor={r.lucro > 0 ? "text-success" : r.lucro < 0 ? "text-cost" : undefined} destaque />
            <Kpi titulo="Margem" valor={r.margem === null ? "—" : `${r.margem.toFixed(1).replace(".", ",")}%`} />
            <Kpi titulo="Markup" valor={r.markup === null ? "—" : `${r.markup.toFixed(2).replace(".", ",")}×`} />
            <Kpi titulo="Custo real/peça" valor={r.custoMedio === null ? "—" : brl(r.custoMedio)} />
          </div>

          {r.breakEven !== null && r.totalPecas > 0 && (
            <p className="rounded-[var(--r-control)] bg-gold/10 px-4 py-2.5 text-sm">
              Vendendo a {brl(r.precoMedio)} em média, você empata com{" "}
              <strong className="text-gold">{r.breakEven} de {r.totalPecas} peças</strong> — o resto é lucro.
              {r.breakEven > r.totalPecas && (
                <span className="font-medium text-cost"> Atenção: nem vendendo tudo cobre o investimento.</span>
              )}
            </p>
          )}

          {/* Planilha de peças */}
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
              <input
                aria-label="Nome do cenário"
                className="min-w-0 flex-1 bg-transparent text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring/60 rounded-[var(--r-inner)] px-1.5 py-0.5"
                value={nome}
                onChange={(e) => setNomeA(e.target.value)}
                placeholder="Nome do cenário"
              />
              <div className="flex shrink-0 gap-1.5">
                <Button variant="ghost" onClick={exportarCSV} title="Exportar CSV">
                  <Download className="lucide h-4 w-4" /> <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button
                  variant="ghost"
                  className="text-cost"
                  onClick={async () => {
                    if (await confirmar({ titulo: `Excluir "${ativo.nome}"?`, mensagem: "O cenário some para sempre — as outras abas não são afetadas." })) {
                      excluir.mutate(ativo.id);
                    }
                  }}
                  title="Excluir cenário"
                >
                  <Trash2 className="lucide h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium sm:px-5">Produto</th>
                    <th className="w-20 px-2 py-2.5 font-medium">Qtd</th>
                    <th className="w-28 px-2 py-2.5 font-medium">Custo un.</th>
                    <th className="w-28 px-2 py-2.5 font-medium">Venderá por</th>
                    <th className="w-28 px-2 py-2.5 text-right font-medium">Investe</th>
                    <th className="w-28 px-2 py-2.5 text-right font-medium">Lucro</th>
                    <th className="w-12 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, ix) => {
                    const q = Number(it.qtd || 0);
                    const investe = q * parseValor(it.custo);
                    const lucroLinha = q * (parseValor(it.preco) - parseValor(it.custo));
                    return (
                      <tr key={ix} className="border-b border-border/40">
                        <td className="px-2 sm:px-3">
                          <input
                            className={celula}
                            placeholder="Ex.: Vestido midi"
                            value={it.descricao}
                            onChange={(e) => setItem(ix, { descricao: e.target.value })}
                          />
                        </td>
                        <td className="px-1">
                          <input
                            className={`${celula} text-center`}
                            inputMode="numeric"
                            placeholder="0"
                            value={it.qtd}
                            onChange={(e) => setItem(ix, { qtd: e.target.value.replace(/\D/g, "") })}
                          />
                        </td>
                        <td className="px-1">
                          <input
                            className={celula}
                            inputMode="decimal"
                            placeholder="0,00"
                            value={it.custo}
                            onChange={(e) => setItem(ix, { custo: e.target.value })}
                          />
                        </td>
                        <td className="px-1">
                          <input
                            className={celula}
                            inputMode="decimal"
                            placeholder="0,00"
                            value={it.preco}
                            onChange={(e) => setItem(ix, { preco: e.target.value })}
                          />
                        </td>
                        <td className="font-mono-numbers px-3 text-right text-muted-foreground">{investe ? brl(investe) : "—"}</td>
                        <td className={`font-mono-numbers px-3 text-right ${lucroLinha > 0 ? "text-success" : lucroLinha < 0 ? "text-cost" : "text-muted-foreground"}`}>
                          {q ? brl(lucroLinha) : "—"}
                        </td>
                        <td className="px-1 text-center">
                          <button
                            aria-label="Remover linha"
                            onClick={() => rmItem(ix)}
                            className="press inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-chip)] text-muted-foreground hover:bg-cost-light hover:text-cost"
                          >
                            <Trash2 className="lucide h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-sm font-medium">
                    <td className="px-4 py-2.5 sm:px-5">
                      <button onClick={addItem} className="press text-sm font-medium text-gold">
                        + nova linha
                      </button>
                    </td>
                    <td className="px-3 text-center font-mono-numbers">{r.totalPecas || ""}</td>
                    <td colSpan={2}></td>
                    <td className="font-mono-numbers px-3 text-right">{brl(r.investPecas)}</td>
                    <td className="font-mono-numbers px-3 text-right">{brl(r.receita - r.investPecas)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Custos extras */}
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 pb-1 pt-4 sm:px-5">
              <h2 className="text-sm font-medium text-muted-foreground">
                Custos extras — embalagem, frete, motoboy, tráfego…
              </h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {extras.map((ex, ix) => (
                  <tr key={ix} className="border-b border-border/40">
                    <td className="px-2 sm:px-3">
                      <input
                        className={celula}
                        placeholder="Ex.: Embalagem"
                        value={ex.descricao}
                        onChange={(e) => setExtra(ix, { descricao: e.target.value })}
                      />
                    </td>
                    <td className="w-32 px-1">
                      <input
                        className={`${celula} text-right`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={ex.valor}
                        onChange={(e) => setExtra(ix, { valor: e.target.value })}
                      />
                    </td>
                    <td className="w-12 px-1 text-center">
                      <button
                        aria-label="Remover custo"
                        onClick={() => rmExtra(ix)}
                        className="press inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-chip)] text-muted-foreground hover:bg-cost-light hover:text-cost"
                      >
                        <Trash2 className="lucide h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="px-4 py-2.5 sm:px-5">
                    <button
                      onClick={() => setExtras((arr) => [...arr, { descricao: "", valor: "" }])}
                      className="press text-sm font-medium text-gold"
                    >
                      + novo custo
                    </button>
                  </td>
                  <td className="font-mono-numbers px-3 py-2.5 text-right">{extras.length ? brl(r.extrasTotal) : ""}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, cor, destaque = false }: { titulo: string; valor: string; cor?: string; destaque?: boolean }) {
  return (
    <Card className={`!p-3.5 ${destaque ? "outline outline-1 outline-gold/40" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={`font-mono-numbers mt-0.5 text-lg ${cor ?? ""}`}>{valor}</p>
    </Card>
  );
}
