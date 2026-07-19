import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { Button } from "../../components/Button";

export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "needsAuth" | "accepting" | "success" | "error">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    // First confirm the user is actually logged in — if not, send them
    // to register/login, then bounce back here afterward using the
    // token still in the URL.
    api
      .get("/auth/me")
      .then(() => acceptInvite())
      .catch(() => setStatus("needsAuth"));
  }, [token]);

  async function acceptInvite() {
    setStatus("accepting");
    try {
      await api.post(`/invitations/${token}/accept`);
      setStatus("success");
      setTimeout(() => {
        window.location.href = "/dashboard"; // full reload so orgs list refetches with the new membership
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || "This invite link is invalid or has expired.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 text-center">
        <h1 className="font-extrabold text-lg mb-4">Atlas</h1>

        {status === "checking" && <p className="text-muted text-sm">Checking your session…</p>}

        {status === "needsAuth" && (
          <>
            <p className="text-sm mb-4">You need to sign in first to accept this invitation.</p>
            <Button onClick={() => navigate(`/login?redirect=/invitations/${token}/accept`)} className="w-full">
              Sign in
            </Button>
            <p className="text-xs text-muted mt-3">
              Don't have an account?{" "}
              <a href={`/register?redirect=/invitations/${token}/accept`} className="text-accent hover:underline">
                Create one
              </a>
            </p>
          </>
        )}

        {status === "accepting" && <p className="text-muted text-sm">Joining organization…</p>}

        {status === "success" && (
          <p className="text-sm text-accent">You've joined the organization! Redirecting…</p>
        )}

        {status === "error" && <p className="text-danger text-sm">{error}</p>}
      </div>
    </div>
  );
}