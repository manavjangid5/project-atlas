import { prisma } from "../infrastructure/database/prismaClient";

export interface SearchResult {
  type: "workflow" | "form" | "rule" | "file" | "member" | "audit" | "apikey";
  id: string;
  title: string;
  subtitle?: string;
}

export async function globalSearch(organizationId: string, query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();

  const [workflows, forms, rules, files, memberships, auditLogs, apiKeys] = await Promise.all([
    prisma.workflow.findMany({
      where: { organizationId, deletedAt: null, name: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
    prisma.formSchema.findMany({
      where: { organizationId, name: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
    prisma.rule.findMany({
      where: { organizationId, name: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
    prisma.fileAsset.findMany({
      where: { organizationId, deletedAt: null, fileName: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
    prisma.membership.findMany({
      where: {
        organizationId,
        user: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      include: { user: true },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { organizationId, action: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
    prisma.apiKey.findMany({
      where: { organizationId, name: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
  ]);

  const results: SearchResult[] = [
    ...workflows.map((w) => ({ type: "workflow" as const, id: w.id, title: w.name, subtitle: "Workflow" })),
    ...forms.map((f) => ({ type: "form" as const, id: f.id, title: f.name, subtitle: "Form" })),
    ...rules.map((r) => ({ type: "rule" as const, id: r.id, title: r.name, subtitle: "Rule" })),
    ...files.map((f) => ({ type: "file" as const, id: f.id, title: f.fileName, subtitle: "File" })),
    ...memberships.map((m) => ({
      type: "member" as const,
      id: m.userId,
      title: m.user.name || m.user.email,
      subtitle: `Member — ${m.role}`,
    })),
    ...auditLogs.map((a) => ({ type: "audit" as const, id: a.id, title: a.action, subtitle: "Audit Log" })),
    ...apiKeys.map((k) => ({ type: "apikey" as const, id: k.id, title: k.name, subtitle: "API Key" })),

  ];

  return results;
}