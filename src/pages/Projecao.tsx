import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/format";
import type { Projecao } from "@/types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErroCarga,
  Field,
  Input,
  Loading,
  Modal,
  Textarea,
} from "@/components/ui";

/**
 * Projeção — simulador "e se" de investimento.
 * Planilha viva: peças (qtd × custo × preço) + custos extras (embalagem,
 * frete, tráfego). Calcula receita, lucro, margem, markup, custo real por
 * peça e ponto de equilíbrio. Independente do catálogo: números digitados
 * aqui não mudam quando um produto real muda de custo.
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

const schema = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao cenário (ex.: Lote de setembro)"),
  itens: z
    .array(
      z.object({
        descricao: z.string().trim().min(1, "Descreva todas as peças"),
        qtd: z.number().int().positive("Quantidade deve ser maior que zero"),
        custo_unit: z.number().min(0),
        preco_venda: z.number().min(0),
      })
    )
    .min(1, "Adicione ao menos uma peça"),
  extras: z.array(
    z.object({
      descricao: z.string().trim().min(1, "Descreva todos os custos extras"),
      valor: z.number().min(0),
    })
  ),
});

/** Toda a matemática da projeção em um lugar só. */
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

const itemVazio: ItemForm = { descricao: "", qtd: "1", custo: "", preco: "" };
const extraVazio: ExtraForm = { descricao: "", valor: "" };

export default function ProjecaoPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Projecao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([itemVazio]);
  const [extras, setExtras] = useState<ExtraForm[]>([]);

  const projecoes = useQuery({
    queryKey: ["projecoes"],
    queryFn: async (): Promise<Projecao[]> => {
      const { data, error } = await supabase
        .from("projecoes")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data as unknown as Projecao[]) ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        nome,
        itens: itens.map((i) => ({
          descricao: i.descricao,
          qtd: Number(i.qtd || 0),
          custo_unit: parseValor(i.custo),
          preco_venda: parseValor(i.preco),
        })),
        extras: extras.map((e) => ({ descricao: e.descricao, valor: parseValor(e.valor) })),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const row = { ...parsed.data, obs: obs || null, atualizado_em: new Date().toISOString() };
      const q = editando
        ? supabase.from("projecoes").update(row).eq("id", editando.id)
        : supabase.from("projecoes").insert(row);
      const { error } = await q;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projecoes"] });
      setModal(false);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projecoes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projecoes"] });
      setModal(false);
    },
  });

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setObs("");
    setItens([{ ...itemVazio }]);
    setExtras([]);
    setErro(null);
    setModal(true);
  }

  function abrirEdicao(p: Projecao) {
    setEditando(p);
    setNome(p.nome);
    setObs(p.obs ?? "");
    setItens(
      p.itens.map((i) => ({
        descricao: i.descricao,
        qtd: String(i.qtd),
        custo: String(i.custo_unit).replace(".", ","),
        preco: String(i.preco_venda).replace(".", ","),
      }))
    );
    setExtras(p.extras.map((e) => ({ descricao: e.descricao, valor: String(e.valor).replace(".", ",") })));
    setErro(null);
    setModal(true);
  }

  const r = calcular(itens, extras);

  if (projecoes.isLoading) return <Loading />;
  if (projecoes.isError) return <ErroCarga />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Projeção</h1>
          <p className="text-sm text-muted-foreground">Simule o investimento antes de comprar</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="lucide h-4 w-4" /> Novo cenário
        </Button>
      </header>

      {projecoes.data?.length === 0 ? (
        <Card>
          <Empty
            icon={<Calculator className="lucide h-8 w-8" />}
            title="Nenhum cenário ainda"
            hint="Monte um cenário com as peças que pretende comprar e os custos extras — o sistema mostra lucro, margem, markup e quantas peças vender pra empatar."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projecoes.data?.map((p) => {
            const c = calcular(
              p.itens.map((i) => ({
                descricao: i.descricao,
                qtd: String(i.qtd),
                custo: String(i.custo_unit),
                preco: String(i.preco_venda),
              })),
              p.extras.map((e) => ({ descricao: e.descricao, valor: String(e.valor) }))
            );
            return (
              <button
                key={p.id}
                onClick={() => abrirEdicao(p)}
                className="press-subtle mat-card rounded-[var(--r-card)] p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{p.nome}</p>
                  <Badge tone={c.lucro >= 0 ? "success" : "danger"}>
                    {c.margem === null ? "—" : `${c.margem.toFixed(0)}% margem`}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Investe</p>
                    <p className="font-mono-numbers">{brl(c.investTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Lucro projetado</p>
                    <p className={`font-mono-numbers font-medium ${c.lucro >= 0 ? "text-success" : "text-cost"}`}>
                      {brl(c.lucro)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar cenário" : "Novo cenário"} wide>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setErro(null);
            salvar.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Nome do cenário">
            <Input
              required
              placeholder="Ex.: Lote vestidos setembro"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Field>

          {/* Peças */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Peças / produtos do lote
            </span>
            <div className="flex flex-col gap-2">
              {itens.map((it, ix) => (
                <div key={ix} className="rounded-[var(--r-control)] bg-muted/60 p-2.5">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Descrição (ex.: Vestido midi)"
                      className="flex-1"
                      value={it.descricao}
                      onChange={(e) =>
                        setItens((arr) => arr.map((x, i) => (i === ix ? { ...x, descricao: e.target.value } : x)))
                      }
                    />
                    {itens.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remover peça"
                        onClick={() => setItens((arr) => arr.filter((_, i) => i !== ix))}
                        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-control)] text-cost hover:bg-cost-light"
                      >
                        <Trash2 className="lucide h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Input
                      inputMode="numeric"
                      placeholder="Qtd"
                      value={it.qtd}
                      onChange={(e) =>
                        setItens((arr) =>
                          arr.map((x, i) => (i === ix ? { ...x, qtd: e.target.value.replace(/\D/g, "") } : x))
                        )
                      }
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="Custo un."
                      value={it.custo}
                      onChange={(e) =>
                        setItens((arr) => arr.map((x, i) => (i === ix ? { ...x, custo: e.target.value } : x)))
                      }
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="Venderá por"
                      value={it.preco}
                      onChange={(e) =>
                        setItens((arr) => arr.map((x, i) => (i === ix ? { ...x, preco: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setItens((arr) => [...arr, { ...itemVazio }])}
              className="press mt-2 text-sm font-medium text-gold"
            >
              + adicionar peça
            </button>
          </div>

          {/* Custos extras */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Custos extras (embalagem, frete, motoboy, tráfego…)
            </span>
            <div className="flex flex-col gap-2">
              {extras.map((ex, ix) => (
                <div key={ix} className="flex gap-2">
                  <Input
                    placeholder="Descrição"
                    className="flex-1"
                    value={ex.descricao}
                    onChange={(e) =>
                      setExtras((arr) => arr.map((x, i) => (i === ix ? { ...x, descricao: e.target.value } : x)))
                    }
                  />
                  <Input
                    inputMode="decimal"
                    placeholder="R$"
                    className="w-28"
                    value={ex.valor}
                    onChange={(e) =>
                      setExtras((arr) => arr.map((x, i) => (i === ix ? { ...x, valor: e.target.value } : x)))
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remover custo"
                    onClick={() => setExtras((arr) => arr.filter((_, i) => i !== ix))}
                    className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-control)] text-cost hover:bg-cost-light"
                  >
                    <Trash2 className="lucide h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExtras((arr) => [...arr, { ...extraVazio }])}
              className="press mt-2 text-sm font-medium text-gold"
            >
              + adicionar custo
            </button>
          </div>

          {/* Resultado ao vivo */}
          <div className="rounded-[var(--r-control)] bg-muted p-3.5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resultado do cenário
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
              <Res label="Investimento total" valor={brl(r.investTotal)} />
              <Res label="Receita projetada" valor={brl(r.receita)} />
              <Res
                label="Lucro projetado"
                valor={brl(r.lucro)}
                cor={r.lucro > 0 ? "text-success" : r.lucro < 0 ? "text-cost" : undefined}
              />
              <Res label="Margem" valor={r.margem === null ? "—" : `${r.margem.toFixed(1).replace(".", ",")}%`} />
              <Res label="Markup" valor={r.markup === null ? "—" : `${r.markup.toFixed(2).replace(".", ",")}×`} />
              <Res label="Custo real por peça" valor={r.custoMedio === null ? "—" : brl(r.custoMedio)} />
            </div>
            {r.breakEven !== null && r.totalPecas > 0 && (
              <p className="mt-3 border-t border-border/70 pt-2.5 text-sm">
                Vendendo a {brl(r.precoMedio)} em média, você empata com{" "}
                <strong className="text-gold">{r.breakEven} de {r.totalPecas} peças</strong> — o resto é lucro.
                {r.breakEven > r.totalPecas && (
                  <span className="text-cost"> Atenção: nem vendendo tudo cobre o investimento.</span>
                )}
              </p>
            )}
          </div>

          <Field label="Observações">
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>

          {erro && <p className="text-sm text-cost">{erro}</p>}
          <div className="flex gap-2">
            {editando && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm("Excluir este cenário?")) excluir.mutate(editando.id);
                }}
              >
                Excluir
              </Button>
            )}
            <Button type="submit" loading={salvar.isPending} className="flex-1">
              {editando ? "Salvar" : "Salvar cenário"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Res({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex justify-between sm:block">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono-numbers font-medium sm:block ${cor ?? ""}`}>{valor}</span>
    </div>
  );
}
