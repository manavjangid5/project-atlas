export type FieldType = "text" | "number" | "email" | "select" | "checkbox" | "file" | "group";

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];              // for select
  showIf?: { fieldId: string; equals: any }; // conditional visibility
  repeatable?: boolean;             // repeating groups
  fields?: FormField[];             // nested fields for "group" type
}