/** Tipos do domínio — espelham o schema (supabase/migrations/0001). */

export type ItemTipo = "produto" | "servico";
export type MovTipo = "aporte" | "retirada" | "despesa";
export type StatusPagamento = "pago" | "parcial" | "pendente";

export interface Fornecedor {
  id: string;
  nome: string;
  contato: string | null;
  obs: string | null;
  criado_em: string;
}

export interface Produto {
  id: string;
  nome: string;
  tipo: ItemTipo;
  categoria: string | null;
  tamanho: string | null;
  fornecedor_id: string | null;
  custo_unit: number;
  preco_venda: number;
  estoque_atual: number;
  ativo: boolean;
  criado_em: string;
}

export interface Compra {
  id: string;
  fornecedor_id: string | null;
  data: string;
  frete: number;
  obs: string | null;
  criado_em: string;
  compra_itens?: CompraItem[];
  fornecedores?: { nome: string } | null;
}

export interface CompraItem {
  id: string;
  compra_id: string;
  produto_id: string;
  qtd: number;
  custo_unit: number;
  produtos?: { nome: string } | null;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tamanho_ref: string | null;
  aniversario: string | null;
  origem: string | null;
  obs: string | null;
  proximo_contato: string | null;
  criado_em: string;
}

export interface Venda {
  id: string;
  cliente_id: string | null;
  data: string;
  canal: string | null;
  forma_pagamento: string | null;
  desconto: number;
  custo_entrega: number;
  valor_total: number;
  valor_pago: number;
  obs: string | null;
  criado_em: string;
  status_pagamento: StatusPagamento;
  clientes?: { nome: string } | null;
  venda_itens?: VendaItem[];
}

export interface VendaItem {
  id: string;
  venda_id: string;
  produto_id: string | null;
  descricao: string;
  qtd: number;
  preco_unit: number;
  custo_unit: number;
}

export interface Movimentacao {
  id: string;
  tipo: MovTipo;
  categoria: string | null;
  valor: number;
  data: string;
  obs: string | null;
  criado_em: string;
}

export interface FinanceiroMensal {
  mes: string;
  faturamento: number;
  recebido: number;
  cmv: number;
  custo_entrega: number;
  aportes: number;
  retiradas: number;
  despesas: number;
  compras_total: number;
  lucro_bruto: number;
  lucro_liquido: number;
  saldo_caixa_mes: number;
}
