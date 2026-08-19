import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

interface AuthCtx {
  session: Session | null;
  carregando: boolean;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ session: null, carregando: true, sair: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    // Isolamento: nenhum dado fica em cache depois do logout.
    qc.clear();
  }

  return <Ctx.Provider value={{ session, carregando, sair }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
