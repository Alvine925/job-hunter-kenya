export type FormFieldSource =
  | "profile"
  | "job"
  | "generated"
  | "static"
  | "user_required";

export type SiteFormField = {
  id: string;
  label: string;
  type: "text" | "date" | "radio" | "select" | "searchable_select" | "textarea" | "file" | "currency";
  required?: boolean;
  source: FormFieldSource;
  /** profiles column or logical key when source is profile */
  profileKey?: string;
  options?: string[];
  staticValue?: string;
  hint?: string;
};

export type SiteFormProfile = {
  id: string;
  name: string;
  domains: string[];
  applicationType: "form" | "email" | "mixed";
  applyFlowNote: string;
  fields: SiteFormField[];
  formResponseTemplate: string;
};
