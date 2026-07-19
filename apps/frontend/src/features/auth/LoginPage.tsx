import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/Button";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

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
        <h1 className="font-extrabold text-lg tracking-tight text-white">
          Atlas
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8">
          <h2 className="text-2xl font-extrabold mb-6 tracking-tight text-center">
            Welcome to Atlas
          </h2>

          <div className="flex gap-4">
            <a href={`${API_URL}/auth/google`} className="flex-1">
              <Button
                variant="secondary"
                type="button"
                className="w-full flex items-center justify-center gap-2"
              >
                <FcGoogle className="h-5 w-5" />
                Google
              </Button>
            </a>

            <a href={`${API_URL}/auth/github`} className="flex-1">
              <Button
                variant="secondary"
                type="button"
                className="w-full flex items-center justify-center gap-2"
              >
                <FaGithub className="h-5 w-5" />
                GitHub
              </Button>
            </a>
          </div>

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
            <Button type="submit" className="w-full mt-2">
              Continue
            </Button>
            <p className="text-xs text-muted mt-6 text-center">
              Don't have an account?{" "}
              <Link to="/register" className="text-accent hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
