import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { updateOrgName } from "./settingsApi";
import { Button } from "../../components/Button";

export default function SettingsPage() {
  const { activeOrgId, organizations, setOrganizations, getActiveOrg } = useAuthStore();
  const currentOrg = getActiveOrg();
  const [name, setName] = useState(currentOrg?.name || "");
  const [saved, setSaved] = useState(false);
  const canManage = currentOrg?.role === "OWNER";

  async function handleSave() {
    if (!activeOrgId) return;
    await updateOrgName(activeOrgId, name);
    setOrganizations(organizations.map((o) => (o.id === activeOrgId ? { ...o, name } : o)));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-8 max-w-lg">
      <h2 className="text-xl font-bold mb-6">Settings</h2>

      <div className="bg-surface border border-border rounded-md p-6">
        <label className="text-xs text-muted block mb-1">Organization name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
            className="flex-1 bg-bg border border-border rounded-sm px-3 py-2 text-sm disabled:opacity-50"
          />
          {canManage && <Button onClick={handleSave}>Save</Button>}
        </div>
        {!canManage && <p className="text-xs text-muted mt-2">Only the organization owner can edit this.</p>}
        {saved && <p className="text-xs text-accent mt-2">Saved.</p>}
      </div>
    </div>
  );
}