import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../lib/api";

// Wraps /login — if the person already has a valid session (e.g.
// they hit back-button or manually typed /login while logged in),
// bounce them straight to the dashboard instead of showing the form.
export default function RedirectIfAuthed() {
  const [status, setStatus] = useState<"checking" | "authed" | "unauthed">("checking");

  useEffect(() => {
    api
      .get("/auth/me")
      .then(() => setStatus("authed"))
      .catch(() => setStatus("unauthed"));
  }, []);

  if (status === "checking") return null;
  if (status === "authed") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}