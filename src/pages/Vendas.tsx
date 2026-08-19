import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { brl, dataBR, hojeISO, mesBR, parseValor } from "@/lib/format";
import type { Cliente, Produto, Venda } from "@/types";
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
} from "@/components/ui";

interface ItemForm {
  produto_id: string;
  qtd: string;
  preco: string;
}

const vendaSchema = z.object({
  cliente_id: z.string().min(1, "Escolha a cliente"),
  data: z.string().min(1, "Data é obrigatória"),
  itens: z
    .array(
      z.object({
        produto_id: z.string().min(1, "Escolha o produto em todos os itens"),
        qtd: z.number().int().positive("Quantidade deve ser maior que zero"),
        preco: z.number().min(0),
      })
    )
    .min(1, "Adicione ao menos um item"),
  desconto: z.number().min(0),
  custo_entrega: z.number().min(0),
  valor_pago: z.number().min(0),
});

const statusTone = { pago: "success", parcial: "warning", pendente: "danger" } as const;

export default function Vendas() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [detalhe, setDetalhe] = useState<Venda | null>(null);
  const [filtroMes, setFiltroMes] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  // Form da nova venda
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [itens, setItens] = useState<ItemForm[]>([{ produto_id: "", qtd: "1", preco: "" }]);
  const [desconto, setDesconto] = useState("");
  const [entrega, setEntrega] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [canal, setCanal] = useState("");
  const [valorPago, setValorPago] = useState("");

  const vendas = useQuery({
    queryKey: ["vendas"],
    queryFn: async (): Promise<Venda[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, clientes(nome), venda_itens(*)")
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data as unknown as Venda[]) ?? [];
    },
  });

  const clientes = useQuery({
    queryKey: ["clientes"],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
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

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = vendaSchema.safeParse({
        cliente_id: clienteId,
        data,
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          qtd: Number(i.qtd || 0),
          preco: parseValor(i.preco),
        })),
        desconto: parseValor(desconto),
        custo_entrega: parseValor(entrega),
        valor_pago: parseValor(valorPago),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const d = parsed.data;

      const { data: venda, error: e1 } = await supabase
        .from("vendas")
        .insert({
          cliente_id: d.cliente_id,
          data: d.data,
          desconto: d.desconto,
          custo_entrega: d.custo_entrega,
          valor_pago: d.valor_pago,
          forma_pagamento: formaPagamento || null,
          canal: canal || null,
        })
        .select("id")
        .single();
      if (e1) throw new Error(e1.message);

      // Snapshot de custo/descrição: mandamos o valor atual; o trigger no banco
      // é a rede de segurança se vier vazio.
      const rows = d.itens.map((i) => {
        const p = produtos.data?.find((x) => x.id === i.produto_id);
        return {
          venda_id: venda.id,
          produto_id: i.produto_id,
          descricao: p?.nome ?? "",
          qtd: i.qtd,
          preco_unit: i.preco,
          custo_unit: p?.custo_unit ?? 0,
        };
      });
      const { error: e2 } = await supabase.from("venda_itens").insert(rows);
      if (e2) {
        // Não deixa venda órfã sem itens
        await supabase.from("vendas").delete().eq("id", venda.id);
        throw new Error(e2.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      fechar();
    },
    onError: (e: Error) => setErro(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      // Itens caem em cascade e o trigger devolve o estoque.
      const { error } = await supabase.from("vendas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setDetalhe(null);
    },
  });

  const registrarPagamento = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase.from("vendas").update({ valor_pago: valor }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setDetalhe(null);
    },
  });

  function abrirNova() {
    setClienteId("");
    setData(hojeISO());
    setItens([{ produto_id: "", qtd: "1", preco: "" }]);
    setDesconto("");
    setEntrega("");
    setFormaPagamento("");
    setCanal("");
    setValorPago("");
    setErro(null);
    setModal(true);
  }

  function fechar() {
    setModal(false);
    setErro(null);
  }

  function setItem(ix: number, patch: Partial<ItemForm>) {
    setItens((arr) => arr.map((it, i) => (i === ix ? { ...it, ...patch } : it)));
  }

  function escolherProduto(ix: number, produtoId: string) {
    const p = produtos.data?.find((x) => x.id === produtoId);
    setItem(ix, {
      produto_id: produtoId,
      preco: p && p.preco_venda > 0 ? String(p.preco_venda).replace(".", ",") : "",
    });
  }

  const subtotal = itens.reduce((s, i) => s + Number(i.qtd || 0) * parseValor(i.preco), 0);
  const total = Math.max(subtotal - parseValor(desconto), 0);

  const meses = useMemo(() => {
    const set = new Set((vendas.data ?? []).map((v) => v.data.slice(0, 7)));
    return [...set].sort().reverse();
  }, [vendas.data]);

  const filtradas = useMemo(
    () => (filtroMes ? (vendas.data ?? []).filter((v) => v.data.slice(0, 7) === filtroMes) : vendas.data ?? []),
    [vendas.data, filtroMes]
  );

  if (vendas.isLoading) return <Loading />;
  if (vendas.isError) return <ErroCarga />;

  const somaFiltro = filtradas.reduce((s, v) => s + v.valor_total, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Vendas</h1>
          <p className="text-sm text-muted-foreground">
            {filtradas.length} venda{filtradas.length === 1 ? "" : "s"} ·{" "}
            <span className="font-mono-numbers">{brl(somaFiltro)}</span>
          </p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="lucide h-4 w-4" /> Nova
        </Button>
      </header>

      {meses.length > 1 && (
        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
          <Chip ativo={filtroMes === ""} onClick={() => setFiltroMes("")}>
            Tudo
          </Chip>
          {meses.map((m) => (
            <Chip key={m} ativo={filtroMes === m} onClick={() => setFiltroMes(m)}>
              {mesBR(m)}
            </Chip>
          ))}
        </div>
      )}

      {filtradas.length === 0 ? (
        <Card>
          <Empty
            icon={<ShoppingBag className="lucide h-8 w-8" />}
            title="Nenhuma venda registrada"
            hint="Registre a primeira venda — estoque e financeiro se atualizam sozinhos."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtradas.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setDetalhe(v)}
                className="press-subtle mat-card flex w-full items-center justify-between gap-3 rounded-[var(--r-card)] p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{v.clientes?.nome ?? "Sem cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {dataBR(v.data)} · {v.venda_itens?.length ?? 0} item{(v.venda_itens?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-numbers font-medium">{brl(v.valor_total)}</span>
                  <Badge tone={statusTone[v.status_pagamento]}>{v.status_pagamento}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detalhe da venda */}
      <Modal open={!!detalhe} onClose={() => setDetalhe(null)} title="Detalhes da venda" wide>
        {detalhe && (
          <DetalheVenda
            venda={detalhe}
            onExcluir={() => {
              if (confirm("Excluir esta venda? O estoque dos itens volta automaticamente.")) {
                excluir.mutate(detalhe.id);
              }
            }}
            onPagar={(valor) => registrarPagamento.mutate({ id: detalhe.id, valor })}
            pagando={registrarPagamento.isPending}
          />
        )}
      </Modal>

      {/* Nova venda */}
      <Modal open={modal} onClose={fechar} title="Nova venda" wide>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setErro(null);
            salvar.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <Select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">— escolher —</option>
                {clientes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
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
              {itens.map((it, ix) => {
                const p = produtos.data?.find((x) => x.id === it.produto_id);
                return (
                  <div key={ix} className="rounded-[var(--r-control)] bg-muted/60 p-2.5">
                    <div className="flex gap-2">
                      <Select
                        className="flex-1"
                        value={it.produto_id}
                        onChange={(e) => escolherProduto(ix, e.target.value)}
                      >
                        <option value="">— produto ou serviço —</option>
                        {produtos.data?.map((pp) => (
                          <option key={pp.id} value={pp.id}>
                            {pp.nome}
                            {pp.tipo === "produto" ? ` (${pp.estoque_atual} un.)` : ""}
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
                        placeholder="Preço un. (R$)"
                        value={it.preco}
                        onChange={(e) => setItem(ix, { preco: e.target.value })}
                      />
                    </div>
                    {p && p.tipo === "produto" && Number(it.qtd || 0) > p.estoque_atual && (
                      <p className="mt-1.5 text-xs text-warning">
                        Atenção: estoque atual é {p.estoque_atual} un. — a venda vai deixar negativo.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setItens((arr) => [...arr, { produto_id: "", qtd: "1", preco: "" }])}
              className="press mt-2 text-sm font-medium text-gold"
            >
              + adicionar item
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Desconto (R$)">
              <Input inputMode="decimal" placeholder="0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </Field>
            <Field label="Entrega / motoboy (R$)" hint="Custo seu, sai do lucro">
              <Input inputMode="decimal" placeholder="0,00" value={entrega} onChange={(e) => setEntrega(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Forma de pagamento">
              <Select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                <option value="">—</option>
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Cartão de crédito</option>
                <option>Cartão de débito</option>
                <option>Transferência</option>
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={canal} onChange={(e) => setCanal(e.target.value)}>
                <option value="">—</option>
                <option>Instagram</option>
                <option>WhatsApp</option>
                <option>Presencial</option>
                <option>Indicação</option>
              </Select>
            </Field>
          </div>

          <div className="rounded-[var(--r-control)] bg-muted p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono-numbers">{brl(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between font-medium">
              <span>Total</span>
              <span className="font-mono-numbers text-gold">{brl(total)}</span>
            </div>
          </div>

          <Field label="Valor recebido agora (R$)" hint="Menor que o total = venda fica parcial/pendente">
            <Input inputMode="decimal" placeholder="0,00" value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
          </Field>

          {erro && <p className="text-sm text-cost">{erro}</p>}
          <Button type="submit" loading={salvar.isPending}>
            Registrar venda
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function DetalheVenda({
  venda,
  onExcluir,
  onPagar,
  pagando,
}: {
  venda: Venda;
  onExcluir: () => void;
  onPagar: (valor: number) => void;
  pagando: boolean;
}) {
  const [novoPago, setNovoPago] = useState("");
  const falta = venda.valor_total - venda.valor_pago;
  const custoItens = (venda.venda_itens ?? []).reduce((s, i) => s + i.qtd * i.custo_unit, 0);
  const lucro = venda.valor_total - custoItens - venda.custo_entrega;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info label="Cliente" valor={venda.clientes?.nome ?? "—"} />
        <Info label="Data" valor={dataBR(venda.data)} />
        <Info label="Pagamento" valor={venda.forma_pagamento ?? "—"} />
        <Info label="Canal" valor={venda.canal ?? "—"} />
      </div>

      <ul className="divide-y divide-border/70 rounded-[var(--r-control)] bg-muted/60 px-3">
        {(venda.venda_itens ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
            <span>
              {i.qtd}× {i.descricao || "item"}
            </span>
            <span className="font-mono-numbers">{brl(i.qtd * i.preco_unit)}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Linha label="Desconto" valor={brl(venda.desconto)} />
        <Linha label="Entrega" valor={brl(venda.custo_entrega)} />
        <Linha label="Total" valor={brl(venda.valor_total)} forte />
        <Linha label="Lucro da venda" valor={brl(lucro)} cor={lucro >= 0 ? "text-success" : "text-cost"} />
        <Linha label="Recebido" valor={brl(venda.valor_pago)} />
        <Linha label="Falta receber" valor={brl(Math.max(falta, 0))} cor={falta > 0 ? "text-warning" : undefined} />
      </div>

      {falta > 0 && (
        <div className="flex items-end gap-2">
          <Field label="Atualizar valor recebido (R$)">
            <Input
              inputMode="decimal"
              placeholder={String(venda.valor_total).replace(".", ",")}
              value={novoPago}
              onChange={(e) => setNovoPago(e.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            loading={pagando}
            onClick={() => onPagar(parseValor(novoPago))}
            disabled={!novoPago}
          >
            Salvar
          </Button>
        </div>
      )}

      <Button variant="destructive" onClick={onExcluir}>
        <Trash2 className="lucide h-4 w-4" /> Excluir venda
      </Button>
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        ativo ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}

function Linha({ label, valor, forte = false, cor }: { label: string; valor: string; forte?: boolean; cor?: string }) {
  return (
    <div className={`flex justify-between rounded-[var(--r-inner)] bg-muted/50 px-3 py-2 ${forte ? "font-medium" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono-numbers ${cor ?? ""}`}>{valor}</span>
    </div>
  );
}
