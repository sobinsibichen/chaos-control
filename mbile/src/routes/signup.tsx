import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, Mail, Sparkles, User } from "lucide-react";
import { useEffect, useState } from "react";
import { signupRequest } from "@/lib/auth-api";
import { appStore, useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign Up - Last Puff" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const hydrated = useAppStore((state) => state.meta.hydrated);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      void navigate({ to: "/home", replace: true });
    }
  }, [hydrated, isAuthenticated, navigate]);

  const handleSignup = async () => {
    if (!username.trim()) {
      setErrorMessage("Please enter your username.");
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Signup error: passwords do not match.");
      return;
    }

    try {
      setErrorMessage("");
      setSubmitting(true);
      const response = await signupRequest({
        name: username,
        email,
        password,
      });

      appStore.login({
        id: response.user.id,
        username: response.user.name,
        email: response.user.email,
        rememberMe: true,
        token: response.token,
        cigarettePrice: response.user.cigarettePrice,
        visibilityEnabled: response.user.visibilityEnabled,
      });
    } catch (error) {
      console.error("Signup request failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Signup error: unable to create account.");
      setSubmitting(false);
      return;
    }

    void navigate({ to: "/home", replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent px-5 py-6 text-foreground">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-foreground/10 bg-card shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <Sparkles className="h-8 w-8 text-foreground" />
          </div>
          <div className="text-3xl font-semibold tracking-tight">Create Account</div>
          <p className="mt-2 text-sm text-muted-foreground">Join and start tracking.</p>
        </div>

        <div className="glass rounded-[2rem] border border-foreground/10 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Username</label>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 shadow-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Your name"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Email</label>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 shadow-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Your email"
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
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Confirm Password</label>
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/70 px-4 py-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="password"
                />
              </div>
            </div>

            {errorMessage ? <div className="text-sm text-red-500">{errorMessage}</div> : null}

            <button
              onClick={handleSignup}
              disabled={submitting}
              className="glass-button w-full rounded-2xl px-5 py-3 text-sm font-semibold tracking-wide transition-all"
            >
              {submitting ? "Creating..." : "Create Account"}
            </button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
