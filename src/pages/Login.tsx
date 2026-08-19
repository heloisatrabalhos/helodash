import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input } from "@/components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) {
      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente."
      );
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="mat-sheet w-full max-w-sm rounded-[var(--r-window)] p-7">
        <div className="mb-8 text-center">
          <span className="font-display text-4xl text-foreground">Heloísa Duarte</span>
          <span className="mt-2 block text-xs uppercase tracking-[0.22em] text-gold">Gestão</span>
        </div>
        <form onSubmit={entrar} className="flex flex-col gap-4">
          <Field label="E-mail">
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Field>
          {erro && <p className="text-sm text-cost">{erro}</p>}
          <Button type="submit" loading={enviando} className="mt-2">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
