import { useEffect, useState } from "react";
import { listForms, createForm, updateFormFields } from "./formsApi";
import type { FormSchemaModel, FormField } from "./formTypes";
import FieldEditorRow from "./FieldEditorRow";
import FormPreview from "./FormPreview";
import { Button } from "../../components/Button";
import { useAuthStore } from "../../store/authStore";

function newField(): FormField {
  return { id: `field_${Date.now()}`, label: "", type: "text" };
}

export default function FormsPage() {
  const [forms, setForms] = useState<FormSchemaModel[]>([]);
  const [active, setActive] = useState<FormSchemaModel | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
useEffect(() => {
  setActive(null);
  listForms().then(setForms);
}, [activeOrgId]);

  // useEffect(() => {
  //   listForms().then(setForms);
  // }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    const form = await createForm(newName);
    setForms((prev) => [...prev, form]);
    openForm(form);
    setNewName("");
  }

  function openForm(form: FormSchemaModel) {
    setActive(form);
    setFields(form.fields || []);
  }

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await updateFormFields(active.id, fields);
      setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } finally {
      setSaving(false);
    }
  }

  if (active) {
    return (
      <div className="p-8 max-w-5xl">
        <button onClick={() => setActive(null)} className="text-xs text-muted hover:text-text mb-4">
          ← Back to forms
        </button>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{active.name}</h2>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted">Fields</h3>
              <Button variant="secondary" onClick={() => setFields((f) => [...f, newField()])}>
                + Add Field
              </Button>
            </div>
            <div className="space-y-3">
              {fields.map((field) => (
                <FieldEditorRow
                  key={field.id}
                  field={field}
                  allFields={fields}
                  onChange={(updated) =>
                    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
                  }
                  onDelete={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted mb-3">Live Preview</h3>
            <FormPreview fields={fields} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Forms</h2>

      <div className="flex gap-2 mb-6 max-w-md">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New form name"
          className="flex-1 bg-surface border border-border rounded-sm px-3 py-2 text-sm"
        />
        <Button onClick={handleCreate}>Create</Button>
      </div>

      {forms.length === 0 ? (
        <p className="text-muted text-sm">No forms yet — create one above.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {forms.map((form) => (
            <button
              key={form.id}
              onClick={() => openForm(form)}
              className="text-left bg-surface border border-border rounded-md p-4 hover:border-accent transition-colors"
            >
              <h3 className="font-semibold text-sm">{form.name}</h3>
              <p className="text-xs text-muted mt-1">{form.fields?.length || 0} fields</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}