import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Truck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { brl, dataBR, hojeISO, parseValor } from "@/lib/format";
import type { Compra, Fornecedor, Produto } from "@/types";
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

interface ItemForm {
  produto_id: string;
  qtd: string;
  custo: string;
}

const compraSchema = z.object({
  data: z.string().min(1),
  itens: z
    .array(
      z.object({
        produto_id: z.string().min(1, "Escolha o produto em todos os itens"),
        qtd: z.number().int().positive("Quantidade deve ser maior que zero"),
        custo: z.number().min(0),
      })
    )
    .min(1, "Adicione ao menos um item"),
});

export default function Compras() {
  const qc = useQueryClient();
  const confirmar = useConfirm();
  const [modal, setModal] = useState(false);
  const [modalForn, setModalForn] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [fornecedorId, setFornecedorId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [frete, setFrete] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([{ produto_id: "", qtd: "1", custo: "" }]);

  const [fornNome, setFornNome] = useState("");
  const [fornContato, setFornContato] = useState("");

  const compras = useQuery({
    queryKey: ["compras"],
    queryFn: async (): Promise<Compra[]> => {
      const { data, error } = await supabase
        .from("compras")
        .select("*, fornecedores(nome), compra_itens(*, produtos(nome))")
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data as unknown as Compra[]) ?? [];
    },
  });

  const fornecedores = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async (): Promise<Fornecedor[]> => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const produtos = useQuery({
    queryKey: ["produtos"],
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const soFisicos = (produtos.data ?? []).filter((p) => p.tipo === "produto");

  const salvarCompra = useMutation({
    mutationFn: async () => {
      const parsed = compraSchema.safeParse({
        data,
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          qtd: Number(i.qtd || 0),
          custo: parseValor(i.custo),
        })),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const d = parsed.data;

      const { data: compra, error: e1 } = await supabase
        .from("compras")
        .insert({
          fornecedor_id: fornecedorId || null,
          data: d.data,
          frete: parseValor(frete),
          obs: obs || null,
        })
        .select("id")
        .single();
      if (e1) throw new Error(e1.message);

      const { error: e2 } = await supabase.from("compra_itens").insert(
        d.itens.map((i) => ({
          compra_id: compra.id,
          produto_id: i.produto_id,
          qtd: i.qtd,
          custo_unit: i.custo,
        }))
      );
      if (e2) {
        await supabase.from("compras").delete().eq("id", compra.id);
        throw new Error(e2.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setModal(false);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const excluirCompra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const salvarForn = useMutation({
    mutationFn: async () => {
      if (!fornNome.trim()) throw new Error("Nome do fornecedor é obrigatório");
      const { error } = await supabase
        .from("fornecedores")
        .insert({ nome: fornNome.trim(), contato: fornContato.trim() || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      setModalForn(false);
      setFornNome("");
      setFornContato("");
    },
    onError: (e: Error) => setErro(e.message),
  });

  function abrirNova() {
    setFornecedorId("");
    setData(hojeISO());
    setFrete("");
    setObs("");
    setItens([{ produto_id: "", qtd: "1", custo: "" }]);
    setErro(null);
    setModal(true);
  }

  function setItem(ix: number, patch: Partial<ItemForm>) {
    setItens((arr) => arr.map((it, i) => (i === ix ? { ...it, ...patch } : it)));
  }

  if (compras.isLoading) return <Loading />;
  if (compras.isError) return <ErroCarga />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Compras</h1>
          <p className="text-sm text-muted-foreground">Entrada de estoque</p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="lucide h-4 w-4" /> Nova
        </Button>
      </header>

      {compras.data?.length === 0 ? (
        <Card>
          <Empty
            icon={<Truck className="lucide h-8 w-8" />}
            title="Nenhuma compra registrada"
            hint="Registre as compras de fornecedor — o estoque dos produtos sobe sozinho."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {compras.data?.map((c) => {
            const totalItens = (c.compra_itens ?? []).reduce((s, i) => s + i.qtd * i.custo_unit, 0);
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.fornecedores?.nome ?? "Sem fornecedor"}</p>
                    <p className="text-xs text-muted-foreground">{dataBR(c.data)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-numbers font-medium">{brl(totalItens + c.frete)}</span>
                    <button
                      aria-label="Excluir compra"
                      onClick={async () => {
                        if (await confirmar({ titulo: "Excluir esta compra?", mensagem: "O estoque dos itens é revertido." })) {
                          excluirCompra.mutate(c.id);
                        }
                      }}
                      className="press flex h-9 w-9 items-center justify-center rounded-[var(--r-chip)] text-cost hover:bg-cost-light"
                    >
                      <Trash2 className="lucide h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 border-t border-border/70 pt-2 text-sm text-muted-foreground">
                  {(c.compra_itens ?? []).map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>
                        {i.qtd}× {i.produtos?.nome ?? "produto"}
                      </span>
                      <span className="font-mono-numbers">{brl(i.qtd * i.custo_unit)}</span>
                    </li>
                  ))}
                  {c.frete > 0 && (
                    <li className="flex justify-between">
                      <span>Frete</span>
                      <span className="font-mono-numbers">{brl(c.frete)}</span>
                    </li>
                  )}
                </ul>
              </Card>
            );
          })}
        </ul>
      )}

      {/* Fornecedores */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Fornecedores</h2>
          <button onClick={() => { setErro(null); setModalForn(true); }} className="press text-sm font-medium text-gold">
            + novo
          </button>
        </div>
        {fornecedores.data?.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {fornecedores.data?.map((f) => (
              <li key={f.id} className="flex justify-between py-2 text-sm">
                <span className="font-medium">{f.nome}</span>
                <span className="text-muted-foreground">{f.contato ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Nova compra */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nova compra" wide>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setErro(null);
            salvarCompra.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fornecedor">
              <Select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
                <option value="">—</option>
                {fornecedores.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">Itens</span>
            <div className="flex flex-col gap-2">
              {itens.map((it, ix) => (
                <div key={ix} className="rounded-[var(--r-control)] bg-muted/60 p-2.5">
                  <div className="flex gap-2">
                    <Select
                      className="flex-1"
                      value={it.produto_id}
                      onChange={(e) => setItem(ix, { produto_id: e.target.value })}
                    >
                      <option value="">— produto —</option>
                      {soFisicos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </Select>
                    {itens.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remover item"
                        onClick={() => setItens((arr) => arr.filter((_, i) => i !== ix))}
                        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-control)] text-cost hover:bg-cost-light"
                      >
                        <Trash2 className="lucide h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      inputMode="numeric"
                      placeholder="Qtd"
                      value={it.qtd}
                      onChange={(e) => setItem(ix, { qtd: e.target.value.replace(/\D/g, "") })}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="Custo un. (R$)"
                      value={it.custo}
                      onChange={(e) => setItem(ix, { custo: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setItens((arr) => [...arr, { produto_id: "", qtd: "1", custo: "" }])}
              className="press mt-2 text-sm font-medium text-gold"
            >
              + adicionar item
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Frete (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={frete} onChange={(e) => setFrete(e.target.value)} />
            </Field>
            <Field label="Observações">
              <Input value={obs} onChange={(e) => setObs(e.target.value)} />
            </Field>
          </div>

          {erro && <p className="text-sm text-cost">{erro}</p>}
          <Button type="submit" loading={salvarCompra.isPending}>
            Registrar compra
          </Button>
        </form>
      </Modal>

      {/* Novo fornecedor */}
      <Modal open={modalForn} onClose={() => setModalForn(false)} title="Novo fornecedor">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setErro(null);
            salvarForn.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Nome">
            <Input required value={fornNome} onChange={(e) => setFornNome(e.target.value)} />
          </Field>
          <Field label="Contato" hint="Telefone, site ou @">
            <Input value={fornContato} onChange={(e) => setFornContato(e.target.value)} />
          </Field>
          {erro && <p className="text-sm text-cost">{erro}</p>}
          <Button type="submit" loading={salvarForn.isPending}>
            Cadastrar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
