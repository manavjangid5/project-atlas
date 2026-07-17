import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

// Zustand's isAuthenticated flag only lives in memory — a hard
// refresh or manual URL change loses it. So on every mount of a
// protected route, we re-validate the session against the backend
// (which will also silently refresh the access token if needed,
// via the axios interceptor) rather than trusting stale client state.
export default function RequireAuth() {
  const [status, setStatus] = useState<"checking" | "authed" | "unauthed">("checking");
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(() => {
        setAuthenticated(true);
        setStatus("authed");
      })
      .catch(() => {
        setAuthenticated(false);
        setStatus("unauthed");
      });
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (status === "unauthed") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}