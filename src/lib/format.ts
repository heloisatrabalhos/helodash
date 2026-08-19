/** Formatação BR centralizada — moeda, data, telefone. */

export function brl(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "2026-08-19" → "19/08/2026" (sem fuso: data pura, não Date). */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-08" → "ago/2026" */
export function mesBR(iso: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = iso.slice(0, 7).split("-");
  return `${meses[Number(m) - 1]}/${y}`;
}

/** Data de hoje em ISO (fuso local, não UTC — 21h em SP ainda é hoje). */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Máscara de telefone BR progressiva: (11) 98888-7777 */
export function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone → link wa.me (assume DDI 55 se não tiver). */
export function waLink(telefone: string, msg?: string): string {
  const d = telefone.replace(/\D/g, "");
  const full = d.length <= 11 ? `55${d}` : d;
  const q = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${full}${q}`;
}

/** Input "1.234,56" ou "1234.56" → número. Vazio → 0. */
export function parseValor(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}
