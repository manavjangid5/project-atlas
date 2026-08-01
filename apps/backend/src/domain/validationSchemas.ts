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