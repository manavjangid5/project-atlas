import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAuthStore } from "../store/authStore";
import { fetchOrganizations } from "../features/organizations/organizationsApi";
import { api } from "../lib/api";
import NotificationBell from "../features/notifications/NotificationBell";
import GlobalSearchBar from "../features/search/GlobalSearchBar";
import OnboardingScreen from "../features/organizations/OnboardingScreen";
import { createOrganization } from "../features/organizations/organizationsApi";

const NAV_ITEMS = [
  { label: "Workflows", path: "/dashboard/workflows" },
  { label: "Forms", path: "/dashboard/forms" },
  { label: "Analytics", path: "/dashboard/analytics" },
  { label: "Members", path: "/dashboard/members" },
  { label: "Settings", path: "/dashboard/settings" },
  { label: "Audit Log", path: "/dashboard/audit" },
  { label: "Rules", path: "/dashboard/rules" },
  { label: "Files", path: "/dashboard/files" },
  { label: "API Keys", path: "/dashboard/api-keys" },
  { label: "Feature Flags", path: "/dashboard/feature-flags" },
];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    organizations,
    activeOrgId,
    setOrganizations,
    setActiveOrg,
    getActiveOrg,
    setAuthenticated 
  } = useAuthStore();
  const [loading, setLoading] = useState(true);

  const [showCreateOrg, setShowCreateOrg] = useState(false);
const [newOrgName, setNewOrgName] = useState("");

  useEffect(() => {
    fetchOrganizations()
      .then(setOrganizations)
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
  try {
    await api.post("/auth/logout");
  } catch {
    // even if the backend call fails, still clear the client-side
    // session state and navigate away — the user's intent to log out
    // should never get stuck behind a failed network request
  } finally {
    setAuthenticated(false);
    navigate("/login", { replace: true });
  }
}

async function handleCreateOrg() {
  if (!newOrgName.trim()) return;
  const org = await createOrganization(newOrgName.trim());
  const orgWithRole = { ...org, role: "OWNER" };
  setOrganizations([...organizations, orgWithRole]);
  setActiveOrg(org.id);
  setNewOrgName("");
  setShowCreateOrg(false);
}

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
        Loading workspace…
      </div>
    );
  }

  if (organizations.length === 0) {
  return <OnboardingScreen onCreated={(org) => setOrganizations([org])} />;
}

  return (
    <div className="min-h-screen flex bg-bg">
      <aside className="w-56 border-r border-border flex flex-col bg-surface h-screen sticky top-0">
        <div className="px-4 py-5 border-b border-border">
          <h1 className="font-extrabold text-lg tracking-tight">Atlas</h1>
        </div>

        <div className="px-4 py-3 border-b border-border">
  <label className="text-xs text-muted block mb-1">Organization</label>
  <select
    value={activeOrgId ?? ""}
    onChange={(e) => {
      if (e.target.value === "__create__") {
        setShowCreateOrg(true);
      } else {
        setActiveOrg(e.target.value);
      }
    }}
    className="w-full text-sm border border-border rounded-sm px-2 py-1.5 bg-bg text-text"
  >
    {organizations.map((org) => (
      <option key={org.id} value={org.id}>
        {org.name}
      </option>
    ))}
    <option value="__create__">+ Create new organization</option>
  </select>
  <p className="text-xs text-muted mt-1">{getActiveOrg()?.role}</p>

  {showCreateOrg && (
    <div className="mt-2 flex gap-1">
      <input
        autoFocus
        value={newOrgName}
        onChange={(e) => setNewOrgName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
        placeholder="Org name"
        className="flex-1 text-xs border border-border rounded-sm px-2 py-1 bg-bg"
      />
      <button
        onClick={handleCreateOrg}
        className="text-xs bg-accent text-white px-2 rounded-sm"
      >
        Add
      </button>
      <button
        onClick={() => { setShowCreateOrg(false); setNewOrgName(""); }}
        className="text-xs text-muted px-1"
      >
        ✕
      </button>
    </div>
  )}
</div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "block px-4 py-2 text-sm",
                location.pathname.startsWith(item.path)
                  ? "text-accent bg-surfaceHover border-r-2 border-accent"
                  : "text-muted hover:text-text",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
  <GlobalSearchBar />
  <div className="flex items-center gap-4">
    <NotificationBell />
    <button
      onClick={handleLogout}
      className="text-sm text-muted hover:text-danger"
    >
      Sign out
    </button>
  </div>
</div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
