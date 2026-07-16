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

export async function submitForm(id: string, data: Record<string, any>) {
  const res = await api.post(`/forms/${id}/submit`, { data });
  return res.data;
}