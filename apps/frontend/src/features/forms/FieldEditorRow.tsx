import type { FormField } from "./formTypes";

interface Props {
  field: FormField;
  allFields: FormField[];
  onChange: (updated: FormField) => void;
  onDelete: () => void;
}

const TYPE_OPTIONS: FormField["type"][] = ["text", "number", "email", "select", "checkbox", "file"];

export default function FieldEditorRow({ field, allFields, onChange, onDelete }: Props) {
  const otherFields = allFields.filter((f) => f.id !== field.id);

  return (
    <div className="bg-surface border border-border rounded-md p-4 space-y-3">
      <div className="flex gap-2">
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Field label"
          className="flex-1 bg-bg border border-border rounded-sm px-3 py-2 text-sm"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as FormField["type"] })}
          className="bg-bg border border-border rounded-sm px-2 py-2 text-sm"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button onClick={onDelete} className="text-muted hover:text-danger px-2 text-sm">✕</button>
      </div>

      {field.type === "select" && (
        <input
          value={field.options?.join(", ") || ""}
          onChange={(e) =>
            onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="Options (comma separated)"
          className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
        />
      )}

      <div className="flex items-center gap-4 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Required
        </label>

        {otherFields.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span>Show only if</span>
            <select
              value={field.showIf?.fieldId || ""}
              onChange={(e) =>
                onChange({
                  ...field,
                  showIf: e.target.value
                    ? { fieldId: e.target.value, equals: field.showIf?.equals ?? true }
                    : undefined,
                })
              }
              className="bg-bg border border-border rounded-sm px-1.5 py-1"
            >
              <option value="">— none —</option>
              {otherFields.map((f) => (
                <option key={f.id} value={f.id}>{f.label || f.id}</option>
              ))}
            </select>
            {field.showIf && (
              <>
                <span>equals</span>
                <input
                  value={String(field.showIf.equals)}
                  onChange={(e) =>
                    onChange({ ...field, showIf: { ...field.showIf!, equals: e.target.value } })
                  }
                  className="w-20 bg-bg border border-border rounded-sm px-1.5 py-1"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}