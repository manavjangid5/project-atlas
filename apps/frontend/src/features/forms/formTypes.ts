export type FieldType = "text" | "number" | "email" | "select" | "checkbox" | "file";

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  showIf?: { fieldId: string; equals: string | number | boolean };
}

export interface FormSchemaModel {
  id: string;
  name: string;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}