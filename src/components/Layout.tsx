import { NavLink, Outlet } from "react-router-dom";
import {
  ChartNoAxesCombined,
  Package,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  TrendingUp,
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

// No celular só as 5 principais entram na barra; Compras/Ajustes ficam no Resumo.
const rotasMobile = rotas.filter((r) => !["/compras", "/ajustes"].includes(r.to));

export default function Layout() {
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
      </nav>
    </div>
  );
}
