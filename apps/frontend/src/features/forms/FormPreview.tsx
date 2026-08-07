import { useState } from "react";
import type { FormField } from "./formTypes";
import { Button } from "../../components/Button";

interface Props {
  fields: FormField[];
  onSubmit?: (data: Record<string, unknown>) => void;
}

export default function FormPreview({ fields, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  function isVisible(field: FormField, values: Record<string, unknown>) {
    if (!field.showIf) return true;
    const val = values[field.showIf.fieldId];
    if (typeof val === "boolean") return val === true;
    return (
      val !== undefined &&
      val !== "" &&
      !(Array.isArray(val) && val.length === 0)
    );
  }

  function handleChange(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function RepeatableField({
    field,
    values,
    onChange,
  }: {
    field: FormField;
    values: unknown[];
    onChange: (v: unknown[]) => void;
  }) {
    const list = values.length > 0 ? values : [""];

    function updateItem(i: number, val: string) {
      const next = [...list];
      next[i] = val;
      onChange(next);
    }

    return (
      <div>
        <label className="text-xs text-muted block mb-1">{field.label}</label>
        {list.map((val, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={val as string}
              onChange={(e) => updateItem(i, e.target.value)}
              className="flex-1 bg-bg border border-border rounded-sm px-3 py-2 text-sm"
            />
            {list.length > 1 && (
              <button
                onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                className="text-muted hover:text-danger text-xs"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => onChange([...list, ""])}
          className="text-xs text-accent hover:underline"
        >
          + Add another
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-md p-6 space-y-4">
      {fields.length === 0 && (
        <p className="text-xs text-muted">Add fields to see a live preview.</p>
      )}

      {fields
        .filter((field) => isVisible(field, values))
        .map((field) => (
          <div key={field.id}>
            <label className="text-xs text-muted block mb-1">
              {field.label || "Untitled field"}{" "}
              {field.required && <span className="text-danger">*</span>}
            </label>

            {field.repeatable ? (
              <RepeatableField
                field={field}
                values={(values[field.id] as unknown[]) || []}
                onChange={(v) => handleChange(field.id, v)}
              />
            ) : field.type === "select" ? (
              <select
                value={String(values[field.id] || "")}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={!!values[field.id]}
                onChange={(e) => handleChange(field.id, e.target.checked)}
              />
            ) : field.type === "file" ? (
              <input type="file" className="text-sm text-muted" />
            ) : (
              <input
                type={field.type}
                value={String(values[field.id] || "")}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}

      {onSubmit && fields.length > 0 && (
        <Button onClick={() => onSubmit(values)} className="mt-2">
          Submit
        </Button>
      )}
    </div>
  );
}
