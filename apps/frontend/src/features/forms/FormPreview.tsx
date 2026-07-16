import { useState } from "react";
import type { FormField } from "./formTypes";
import { Button } from "../../components/Button";

interface Props {
  fields: FormField[];
  onSubmit?: (data: Record<string, any>) => void;
}

export default function FormPreview({ fields, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, any>>({});

  function isVisible(field: FormField) {
    if (!field.showIf) return true;
    return String(values[field.showIf.fieldId]) === String(field.showIf.equals);
  }

  function handleChange(id: string, value: any) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <div className="bg-surface border border-border rounded-md p-6 space-y-4">
      {fields.length === 0 && <p className="text-xs text-muted">Add fields to see a live preview.</p>}
      {fields.filter(isVisible).map((field) => (
        <div key={field.id}>
          <label className="text-xs text-muted block mb-1">
            {field.label || "Untitled field"} {field.required && <span className="text-danger">*</span>}
          </label>
          {field.type === "select" ? (
            <select
              value={values[field.id] || ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
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
              value={values[field.id] || ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm"
            />
          )}
        </div>
      ))}
      {onSubmit && fields.length > 0 && (
        <Button onClick={() => onSubmit(values)} className="mt-2">Submit</Button>
      )}
    </div>
  );
}