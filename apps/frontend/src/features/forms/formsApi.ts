import { api } from "../../lib/api";
import type { FormSchemaModel, FormField } from "./formTypes";

export async function listForms(): Promise<FormSchemaModel[]> {
  const res = await api.get("/forms");
  return res.data;
}

export async function createForm(name: string): Promise<FormSchemaModel> {
  const res = await api.post("/forms", { name });
  return res.data;
}

export async function updateFormFields(id: string, fields: FormField[]): Promise<FormSchemaModel> {
  const res = await api.patch(`/forms/${id}`, { fields });
  return res.data;
}

export async function submitForm(id: string, data: Record<string, unknown>) {
  const hasFile = Object.values(data).some((v) => v instanceof File);
  if (!hasFile) {
    const res = await api.post(`/forms/${id}/submit`, { data });
    return res.data;
  }

  const formData = new FormData();
  const plainData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof File) {
      formData.append(key, value);
    } else {
      plainData[key] = value;
    }
  }
  formData.append("data", JSON.stringify(plainData));
  const res = await api.post(`/forms/${id}/submit`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}