import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { brl, parseValor } from "@/lib/format";
import type { Fornecedor, Produto } from "@/types";
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
  Select,
  useConfirm,
} from "@/components/ui";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  tipo: z.enum(["produto", "servico"]),
  categoria: z.string().trim(),
  tamanho: z.string().trim(),
  fornecedor_id: z.string(),
  custo_unit: z.number().min(0, "Custo não pode ser negativo"),
  preco_venda: z.number().min(0, "Preço não pode ser negativo"),
});

const formVazio = {
  nome: "",
  tipo: "produto" as "produto" | "servico",
  categoria: "",
  tamanho: "",
  fornecedor_id: "",
  custo: "",
  preco: "",
};

export default function Produtos() {
  const qc = useQueryClient();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState(formVazio);
  const [erro, setErro] = useState<string | null>(null);

  const produtos = useQuery({
    queryKey: ["produtos"],
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
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

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        nome: form.nome,
        tipo: form.tipo,
        categoria: form.categoria,
        tamanho: form.tamanho,
        fornecedor_id: form.fornecedor_id,
        custo_unit: parseValor(form.custo),
        preco_venda: parseValor(form.preco),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const d = parsed.data;
      const row = {
        nome: d.nome,
        tipo: d.tipo,
        categoria: d.categoria || null,
        tamanho: d.tamanho || null,
        fornecedor_id: d.tipo === "produto" && d.fornecedor_id ? d.fornecedor_id : null,
        custo_unit: d.custo_unit,
        preco_venda: d.preco_venda,
      };
      const q = editando
        ? supabase.from("produtos").update(row).eq("id", editando.id)
        : supabase.from("produtos").insert(row);
      const { error } = await q;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      fechar();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const arquivar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      fechar();
    },
  });

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio);
    setErro(null);
    setModal(true);
  }

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setForm({
      nome: p.nome,
      tipo: p.tipo,
      categoria: p.categoria ?? "",
      tamanho: p.tamanho ?? "",
      fornecedor_id: p.fornecedor_id ?? "",
      custo: String(p.custo_unit).replace(".", ","),
      preco: String(p.preco_venda).replace(".", ","),
    });
    setErro(null);
    setModal(true);
  }

  function fechar() {
    setModal(false);
    setEditando(null);
    setErro(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    salvar.mutate();
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos.data ?? [];
    return (produtos.data ?? []).filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.categoria ?? "").toLowerCase().includes(q) ||
        (p.tamanho ?? "").toLowerCase().includes(q)
    );
  }, [produtos.data, busca]);

  if (produtos.isLoading) return <Loading />;
  if (produtos.isError) return <ErroCarga />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Produtos</h1>
          <p className="text-sm text-muted-foreground">{produtos.data?.length ?? 0} ativos</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="lucide h-4 w-4" /> Novo
        </Button>
      </header>

      <div className="relative">
        <Search className="lucide absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, categoria ou tamanho…"
          className="pl-10"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <Empty
            icon={<Package className="lucide h-8 w-8" />}
            title={busca ? "Nada encontrado" : "Nenhum produto cadastrado"}
            hint={busca ? undefined : "Cadastre os produtos com custo e fornecedor pra controlar o lucro de cada venda."}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtrados.map((p) => {
            const margem = p.preco_venda > 0 ? ((p.preco_venda - p.custo_unit) / p.preco_venda) * 100 : 0;
            return (
              <button
                key={p.id}
                onClick={() => abrirEdicao(p)}
                className="press-subtle mat-card rounded-[var(--r-card)] p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.categoria, p.tamanho].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {p.tipo === "servico" ? (
                    <Badge tone="gold">serviço</Badge>
                  ) : p.estoque_atual <= 0 ? (
                    <Badge tone="danger">sem estoque</Badge>
                  ) : p.estoque_atual <= 2 ? (
                    <Badge tone="warning">{p.estoque_atual} un.</Badge>
                  ) : (
                    <Badge tone="neutral">{p.estoque_atual} un.</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="text-xs text-muted-foreground">
                    custo <span className="font-mono-numbers">{brl(p.custo_unit)}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-numbers font-medium">{brl(p.preco_venda)}</p>
                    <p className={`text-xs ${margem >= 40 ? "text-success" : "text-muted-foreground"}`}>
                      {margem.toFixed(0)}% margem
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={fechar} title={editando ? "Editar produto" : "Novo produto"}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {(["produto", "servico"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={`press min-h-[44px] rounded-[var(--r-control)] text-sm font-medium transition-colors ${
                    form.tipo === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {t === "produto" ? "Produto físico" : "Serviço / ensaio"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Nome">
            <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </Field>
            <Field label="Tamanho">
              <Input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} />
            </Field>
          </div>
          {form.tipo === "produto" && (
            <Field label="Fornecedor">
              <Select value={form.fornecedor_id} onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })}>
                <option value="">— sem fornecedor —</option>
                {fornecedores.data?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={form.tipo === "produto" ? "Custo (R$)" : "Custo por sessão (R$)"}>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.custo}
                onChange={(e) => setForm({ ...form, custo: e.target.value })}
              />
            </Field>
            <Field label="Preço de venda (R$)">
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
              />
            </Field>
          </div>
          {erro && <p className="text-sm text-cost">{erro}</p>}
          <div className="mt-1 flex gap-2">
            {editando && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (await confirmar({ titulo: "Arquivar este produto?", mensagem: "Ele some da lista, mas o histórico de vendas fica intacto.", acao: "Arquivar" })) {
                    arquivar.mutate(editando.id);
                  }
                }}
              >
                Arquivar
              </Button>
            )}
            <Button type="submit" loading={salvar.isPending} className="flex-1">
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
