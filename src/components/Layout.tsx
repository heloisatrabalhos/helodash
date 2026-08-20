import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChartNoAxesCombined,
  MoreHorizontal,
  Package,
  ShoppingBag,
  Truck,
  TrendingUp,
  Users,
  Wallet,
  Settings,
} from "lucide-react";

/**
 * Shell do app: sidebar flutuante (desktop) + bottom nav (mobile).
 * Chrome translúcida sobre o campo ambiente; conteúdo em superfície sólida.
 */

const rotas = [
  { to: "/", label: "Resumo", icon: ChartNoAxesCombined, fim: true },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/compras", label: "Compras", icon: Truck },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/projecao", label: "Projeção", icon: TrendingUp },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

// Celular: 5 principais na barra; o resto vive no painel "Mais".
const rotasMobile = rotas.filter((r) =>
  ["/", "/vendas", "/clientes", "/produtos", "/financeiro"].includes(r.to)
);
const rotasMais = rotas.filter((r) => ["/projecao", "/compras", "/ajustes"].includes(r.to));

export default function Layout() {
  const [maisAberto, setMaisAberto] = useState(false);
  const { pathname } = useLocation();
  const emRotaDoMais = rotasMais.some((r) => pathname.startsWith(r.to));

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-3 left-3 z-40 hidden w-56 flex-col md:flex">
        <div className="mat-chrome-panel flex h-full flex-col p-3">
          <div className="mb-6 px-3 pt-2">
            <span className="font-display text-2xl leading-none text-foreground">Heloísa Duarte</span>
            <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-gold">Gestão</span>
          </div>
          <nav className="flex flex-col gap-1">
            {rotas.map(({ to, label, icon: Icon, fim }) => (
              <NavLink
                key={to}
                to={to}
                end={fim}
                className={({ isActive }) =>
                  `press-subtle flex items-center gap-3 rounded-[var(--r-control)] px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                      : "vibrant-secondary hover:bg-sidebar-accent"
                  }`
                }
              >
                <Icon className="lucide h-[18px] w-[18px]" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:pb-8 md:pl-64 md:pr-8 md:pt-7">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Painel "Mais" — mobile */}
      {maisAberto && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMaisAberto(false)}>
          <div className="mat-scrim absolute inset-0 will-fade animate-materialize" />
          <div
            className="mat-float absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-[var(--r-window)] p-2 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {rotasMais.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMaisAberto(false)}
                className={({ isActive }) =>
                  `press flex items-center gap-3 rounded-[var(--r-control)] px-4 py-3.5 text-base ${
                    isActive ? "bg-primary font-medium text-primary-foreground" : "vibrant"
                  }`
                }
              >
                <Icon className="lucide h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav — mobile */}
      <nav
        className="mat-chrome fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border/50 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navegação principal"
      >
        {rotasMobile.map(({ to, label, icon: Icon, fim }) => (
          <NavLink
            key={to}
            to={to}
            end={fim}
            onClick={() => setMaisAberto(false)}
            className={({ isActive }) =>
              `press flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-2 text-[11px] ${
                isActive ? "font-medium text-foreground" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`lucide h-6 w-6 ${isActive ? "text-gold" : ""}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMaisAberto((v) => !v)}
          aria-label="Mais opções"
          aria-expanded={maisAberto}
          className={`press flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-2 text-[11px] ${
            emRotaDoMais || maisAberto ? "font-medium text-foreground" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal className={`lucide h-6 w-6 ${emRotaDoMais || maisAberto ? "text-gold" : ""}`} />
          Mais
        </button>
      </nav>
    </div>
  );
}
