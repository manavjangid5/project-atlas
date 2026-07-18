import { useState } from "react";
import { createOrganization } from "./organizationsApi";
import type { Organization } from "./organizationsApi";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/Button";

interface Props {
  onCreated: (org: Organization) => void;
}

export default function OnboardingScreen({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const org = await createOrganization(name.trim());
      const orgWithRole = { ...org, role: "OWNER" } as Organization;
      onCreated(orgWithRole);
      setActiveOrg(org.id); // explicit — don't rely on stale-state auto-correction alone
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not create organization. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8">
        <h1 className="font-extrabold text-lg tracking-tight mb-1">Welcome to Atlas</h1>
        <p className="text-muted text-sm mb-6">
          Let's set up your workspace. Create an organization to get started — you'll be its owner.
        </p>

        <form onSubmit={handleCreate} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name (e.g. 'Acme Inc')"
            autoFocus
            className="w-full bg-bg border border-border rounded-sm px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </div>
    </div>
  );
}