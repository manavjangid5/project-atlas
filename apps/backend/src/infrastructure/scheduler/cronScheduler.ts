import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@atlas/database";
import { triggerWorkflowRun } from "../../application/workflowService";

const scheduledTasks = new Map<string, ScheduledTask>();

// Loads every workflow with a cron schedule and registers it. Called
// once at boot, and re-called whenever a workflow's schedule changes,
// so the running set of cron jobs always matches the database.
export async function loadScheduledWorkflows() {
  for (const task of scheduledTasks.values()) task.stop();
  scheduledTasks.clear();

  const workflows = await prisma.workflow.findMany({
    where: { cronSchedule: { not: null }, deletedAt: null },
    select: { id: true, organizationId: true, cronSchedule: true },
  });

  for (const wf of workflows) {
    if (!wf.cronSchedule || !cron.validate(wf.cronSchedule)) continue;
    const task = cron.schedule(wf.cronSchedule, () => {
      triggerWorkflowRun(wf.organizationId, wf.id).catch((err) =>
        console.error(`Scheduled run failed for workflow ${wf.id}:`, err)
      );
    });
    scheduledTasks.set(wf.id, task);
  }
  console.log(`Loaded ${scheduledTasks.size} scheduled workflow(s).`);
}