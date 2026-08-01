import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo1234!", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@atlas.dev" },
    update: {},
    create: { email: "demo@atlas.dev", passwordHash, name: "Demo User" },
  });

  const org = await prisma.organization.create({ data: { name: "Demo Org" } });
  await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role: "OWNER" } });

  await prisma.workflow.create({
    data: {
      name: "Demo: Fetch + Summarize",
      organizationId: org.id,
      graph: {
        nodes: [
          { id: "n1", type: "custom", position: { x: 100, y: 100 }, data: { label: "Fetch Todo", kind: "http_request", config: { method: "GET", url: "https://jsonplaceholder.typicode.com/todos/1" } } },
          { id: "n2", type: "custom", position: { x: 400, y: 100 }, data: { label: "Summarize", kind: "ai_prompt", config: { prompt: "Summarize this in one sentence: {n1_output}" } } },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      },
    },
  });

  console.log("Seed complete: demo@atlas.dev / Demo1234!");
}

main().finally(() => prisma.$disconnect());