import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, Mail, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { loginRequest } from "@/lib/auth-api";
import { appStore, useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login - Last Puff" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      void navigate({ to: "/home", replace: true });
    }
  }, [hydrated, isAuthenticated, navigate]);

  const handleLogin = async () => {
    if (!isValidEmail(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    try {
      setErrorMessage("");
      setSubmitting(true);
      const response = await loginRequest({ email, password });

      appStore.login({
        id: response.user.id,
        username: response.user.name,
        email: response.user.email,
        rememberMe,
        token: response.token,
        cigarettePrice: response.user.cigarettePrice,
        visibilityEnabled: response.user.visibilityEnabled,
      });
      void navigate({ to: "/home", replace: true });
    } catch (error) {
      console.error("Login request failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Login error: email or password wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent px-5 py-6 text-foreground">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-foreground/10 bg-card shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <Sparkles className="h-8 w-8 text-foreground" />
          </div>
          <div className="text-3xl font-semibold tracking-tight">LAST.PUFF</div>
          <p className="mt-2 text-sm text-muted-foreground">Control your chaos.</p>
        </div>

        <div className="glass rounded-[2rem] border border-foreground/10 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Email</label>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 shadow-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="email"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Password</label>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="password"
                />
              </div>
            </div>

            {errorMessage ? <div className="text-sm text-red-500">{errorMessage}</div> : null}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-foreground/20 bg-transparent accent-primary"
                />
                Remember me
              </label>
              <button className="text-muted-foreground hover:text-foreground transition-colors">Forgot password</button>
            </div>

            <button
              onClick={handleLogin}
              disabled={submitting}
              className="glass-button relative w-full overflow-hidden rounded-2xl px-5 py-3 text-sm font-semibold tracking-wide transition-all"
            >
              <span className="relative">{submitting ? "Signing in..." : "Login"}</span>
            </button>

            <div className="text-center text-sm text-muted-foreground">
              No account yet? <Link to="/signup" className="text-primary hover:underline">Sign up</Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
