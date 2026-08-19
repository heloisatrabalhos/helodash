import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Vendas from "@/pages/Vendas";
import Clientes from "@/pages/Clientes";
import Produtos from "@/pages/Produtos";
import Compras from "@/pages/Compras";
import Financeiro from "@/pages/Financeiro";
import Projecao from "@/pages/Projecao";
import Ajustes from "@/pages/Ajustes";
import { Loading } from "@/components/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function Protegido() {
  const { session, carregando } = useAuth();
  if (carregando) return <Loading />;
  if (!session) return <Login />;
  return <Layout />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Protegido />}>
              <Route index element={<Dashboard />} />
              <Route path="vendas" element={<Vendas />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="produtos" element={<Produtos />} />
              <Route path="compras" element={<Compras />} />
              <Route path="financeiro" element={<Financeiro />} />
              <Route path="projecao" element={<Projecao />} />
              <Route path="ajustes" element={<Ajustes />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
