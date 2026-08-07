import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
});

export const updateWorkflowGraphSchema = z.object({
  graph: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "DEVELOPER", "VIEWER"]),
});
export const createFormSchema = z.object({ name: z.string().min(1).max(200) });
export const updateFormFieldsSchema = z.object({ fields: z.array(z.any()) });
export const submitFormSchema = z.object({ data: z.record(z.string(), z.any()) });

export const createRuleSchema = z.object({ name: z.string().min(1).max(200) });
export const updateRuleSchema = z.object({
  conditions: z.any().optional(),
  action: z.any().optional(),
  isActive: z.boolean().optional(),
});

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  description: z.string().optional(),
});
export const updateFeatureFlagSchema = z.object({
  isGloballyEnabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targetOrgIds: z.array(z.string()).optional(),
});