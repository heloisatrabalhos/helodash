import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, MessageCircle, Plus, Search, Users } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { brl, dataBR, maskTelefone, waLink } from "@/lib/format";
import type { Cliente, Venda } from "@/types";
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

const schema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  telefone: z.string().trim(),
  email: z.string().trim().email("E-mail inválido").or(z.literal("")),
  tamanho_ref: z.string().trim(),
  aniversario: z.string(),
  origem: z.string().trim(),
  obs: z.string().trim(),
  proximo_contato: z.string(),
});

const formVazio = {
  nome: "",
  telefone: "",
  email: "",
  tamanho_ref: "",
  aniversario: "",
  origem: "",
  obs: "",
  proximo_contato: "",
};

export default function Clientes() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [ficha, setFicha] = useState<Cliente | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(formVazio);
  const [erro, setErro] = useState<string | null>(null);

  const clientes = useQuery({
    queryKey: ["clientes"],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const historico = useQuery({
    queryKey: ["vendas-cliente", ficha?.id],
    enabled: !!ficha,
    queryFn: async (): Promise<Venda[]> => {
      const { data, error } = await supabase
        .from("vendas")
        .select("id, data, valor_total, valor_pago, status_pagamento")
        .eq("cliente_id", ficha!.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data as unknown as Venda[]) ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const d = parsed.data;
      const row = {
        nome: d.nome,
        telefone: d.telefone || null,
        email: d.email || null,
        tamanho_ref: d.tamanho_ref || null,
        aniversario: d.aniversario || null,
        origem: d.origem || null,
        obs: d.obs || null,
        proximo_contato: d.proximo_contato || null,
      };
      const q = editando
        ? supabase.from("clientes").update(row).eq("id", editando.id)
        : supabase.from("clientes").insert(row);
      const { error } = await q;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["followups-hoje"] });
      setModal(false);
      setFicha(null);
    },
    onError: (e: Error) => setErro(e.message),
  });

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio);
    setErro(null);
    setModal(true);
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c);
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      tamanho_ref: c.tamanho_ref ?? "",
      aniversario: c.aniversario ?? "",
      origem: c.origem ?? "",
      obs: c.obs ?? "",
      proximo_contato: c.proximo_contato ?? "",
    });
    setErro(null);
    setFicha(null);
    setModal(true);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    salvar.mutate();
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes.data ?? [];
    return (clientes.data ?? []).filter(
      (c) => c.nome.toLowerCase().includes(q) || (c.telefone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "␀")
    );
  }, [clientes.data, busca]);

  if (clientes.isLoading) return <Loading />;
  if (clientes.isError) return <ErroCarga />;

  const totalGasto = (historico.data ?? []).reduce((s, v) => s + v.valor_total, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clientes.data?.length ?? 0} cadastradas</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="lucide h-4 w-4" /> Nova
        </Button>
      </header>

      <div className="relative">
        <Search className="lucide absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone…"
          className="pl-10"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <Empty
            icon={<Users className="lucide h-8 w-8" />}
            title={busca ? "Nada encontrado" : "Nenhuma cliente ainda"}
            hint={busca ? undefined : "Cadastre as clientes pra acompanhar histórico de compras e follow-up."}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtrados.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setFicha(c)}
                className="press-subtle mat-card flex w-full items-center justify-between gap-3 rounded-[var(--r-card)] p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[c.telefone, c.origem].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {c.proximo_contato && (
                  <Badge tone="gold">
                    <CalendarClock className="lucide mr-1 h-3 w-3" />
                    {dataBR(c.proximo_contato)}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ficha da cliente */}
      <Modal open={!!ficha} onClose={() => setFicha(null)} title={ficha?.nome ?? ""} wide>
        {ficha && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {ficha.telefone && (
                <a
                  href={waLink(ficha.telefone, `Oi ${ficha.nome.split(" ")[0]}! Tudo bem?`)}
                  target="_blank"
                  rel="noreferrer"
                  className="press inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-control)] bg-success px-4 text-sm font-medium text-success-foreground"
                >
                  <MessageCircle className="lucide h-4 w-4" /> WhatsApp
                </a>
              )}
              <Button variant="secondary" onClick={() => abrirEdicao(ficha)}>
                Editar ficha
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Info label="Telefone" valor={ficha.telefone} />
              <Info label="Tamanho" valor={ficha.tamanho_ref} />
              <Info label="Aniversário" valor={ficha.aniversario ? dataBR(ficha.aniversario) : null} />
              <Info label="Origem" valor={ficha.origem} />
              <Info label="Follow-up" valor={ficha.proximo_contato ? dataBR(ficha.proximo_contato) : null} />
              <Info label="Total gasto" valor={brl(totalGasto)} />
            </div>
            {ficha.obs && <p className="rounded-[var(--r-control)] bg-muted p-3 text-sm">{ficha.obs}</p>}

            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Histórico de compras</h3>
              {historico.isLoading ? (
                <Loading />
              ) : (historico.data ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma compra registrada.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {historico.data!.map((v) => (
                    <li key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-muted-foreground">{dataBR(v.data)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-numbers">{brl(v.valor_total)}</span>
                        <Badge tone={v.status_pagamento === "pago" ? "success" : v.status_pagamento === "parcial" ? "warning" : "danger"}>
                          {v.status_pagamento}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Criar / editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar cliente" : "Nova cliente"}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <Input
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
              />
            </Field>
            <Field label="Tamanho de referência">
              <Input value={form.tamanho_ref} onChange={(e) => setForm({ ...form, tamanho_ref: e.target.value })} />
            </Field>
          </div>
          <Field label="E-mail">
            <Input
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Aniversário">
              <Input type="date" value={form.aniversario} onChange={(e) => setForm({ ...form, aniversario: e.target.value })} />
            </Field>
            <Field label="Origem" hint="Ex.: Instagram, indicação">
              <Input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} />
            </Field>
          </div>
          <Field label="Follow-up — contatar em" hint="A cliente aparece no Resumo nesta data">
            <Input
              type="date"
              value={form.proximo_contato}
              onChange={(e) => setForm({ ...form, proximo_contato: e.target.value })}
            />
          </Field>
          <Field label="Observações">
            <Textarea value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
          </Field>
          {erro && <p className="text-sm text-cost">{erro}</p>}
          <Button type="submit" loading={salvar.isPending}>
            {editando ? "Salvar" : "Cadastrar"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{valor || "—"}</p>
    </div>
  );
}
