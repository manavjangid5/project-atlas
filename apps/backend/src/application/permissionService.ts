import { prisma } from "@atlas/database";

const DEFAULT_MATRIX: Record<string, Record<string, string[]>> = {
  workflow: { create: ["OWNER", "ADMIN", "DEVELOPER"], update: ["OWNER", "ADMIN", "DEVELOPER"], delete: ["OWNER", "ADMIN", "DEVELOPER"], run: ["OWNER", "ADMIN", "DEVELOPER"] },
  form: { create: ["OWNER", "ADMIN", "DEVELOPER"], update: ["OWNER", "ADMIN", "DEVELOPER"], submit: ["OWNER", "ADMIN", "DEVELOPER", "VIEWER"] },
  rule: { create: ["OWNER", "ADMIN", "DEVELOPER"], update: ["OWNER", "ADMIN", "DEVELOPER"], delete: ["OWNER", "ADMIN", "DEVELOPER"] },
  file: { create: ["OWNER", "ADMIN", "DEVELOPER"], delete: ["OWNER", "ADMIN", "DEVELOPER"] },
  flag: { create: ["OWNER"], update: ["OWNER"], delete: ["OWNER"] },
};

// Checks an org-specific override first; falls back to the sane
// built-in default matrix. This is what makes permissions genuinely
// dynamic/data-driven rather than hardcoded in route middleware —
// an Owner can grant a Viewer "run" access on workflows for their
// org specifically, without a code change.
export async function can(organizationId: string, role: string, resource: string, action: string): Promise<boolean> {
  try {
    const override = await prisma.permission.findUnique({
      where: { organizationId_role_resource_action: { organizationId, role: role as any, resource, action } },
    });
    if (override) return override.allowed;
    const result = DEFAULT_MATRIX[resource]?.[action]?.includes(role) ?? false;
    return result;
  } catch (err) {
    console.error("Permission check threw an error:", err);
    return false; // fail closed, but now we'll SEE why
  }
}