import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/login", { email, password });
      setAuthenticated(true);
      navigate("/dashboard");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="min-h-screen gradient-mesh flex flex-col">
      <div className="px-8 py-6">
        <h1 className="font-extrabold text-lg tracking-tight text-white">Atlas</h1>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8">
          <h2 className="text-2xl font-extrabold mb-6 tracking-tight">Welcome back</h2>

          <a href="http://localhost:4000/api/v1/auth/google" className="block mb-4">
            <Button variant="secondary" type="button" className="w-full">
              Continue with Google
            </Button>
          </a>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" className="w-full mt-2">Continue</Button>
          </form>
        </div>
      </div>
    </div>
  );
}