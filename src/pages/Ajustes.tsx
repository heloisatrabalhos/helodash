import { useState } from "react";
import { Download, LogOut, Moon, Sun } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button, Card } from "@/components/ui";

/** Export CSV client-side: backup rápido que a Heloísa mesma consegue baixar. */
async function exportarCSV(tabela: string, colunas: string) {
  const { data, error } = await supabase.from(tabela).select(colunas).csv();
  if (error || !data) {
    alert("Não foi possível exportar. Tente de novo.");
    return;
  }
  const blob = new Blob(["﻿" + data], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tabela}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const exportaveis = [
  { tabela: "clientes", label: "Clientes", colunas: "nome, telefone, email, tamanho_ref, aniversario, origem, obs, proximo_contato" },
  { tabela: "produtos", label: "Produtos", colunas: "nome, tipo, categoria, tamanho, custo_unit, preco_venda, estoque_atual" },
  { tabela: "vendas", label: "Vendas", colunas: "data, valor_total, valor_pago, status_pagamento, forma_pagamento, canal, desconto, custo_entrega" },
  { tabela: "movimentacoes", label: "Financeiro", colunas: "tipo, categoria, valor, data, obs" },
];

export default function Ajustes() {
  const { session, sair } = useAuth();
  const [escuro, setEscuro] = useState(document.documentElement.classList.contains("dark"));

  function alternarTema() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem("helo-theme", novo ? "dark" : "light");
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-3xl">Ajustes</h1>
        <p className="text-sm text-muted-foreground">{session?.user.email}</p>
      </header>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Aparência</h2>
        <Button variant="secondary" onClick={alternarTema}>
          {escuro ? <Sun className="lucide h-4 w-4" /> : <Moon className="lucide h-4 w-4" />}
          {escuro ? "Tema claro" : "Tema escuro"}
        </Button>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">Backup</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Baixe uma cópia dos seus dados em CSV (abre no Excel / Google Sheets).
        </p>
        <div className="flex flex-wrap gap-2">
          {exportaveis.map((e) => (
            <Button key={e.tabela} variant="secondary" onClick={() => exportarCSV(e.tabela, e.colunas)}>
              <Download className="lucide h-4 w-4" /> {e.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <Button variant="destructive" onClick={sair}>
          <LogOut className="lucide h-4 w-4" /> Sair da conta
        </Button>
      </Card>
    </div>
  );
}
