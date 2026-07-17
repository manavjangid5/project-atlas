import dotenv from "dotenv";
dotenv.config();
import { startHealthServer } from "./healthServer";
import { connectConsumer, QUEUE_NAME } from "./rabbitmqConsumer";
import { executeGraph } from "./graphExecutor";
import { prisma } from "./db";

async function main() {
  startHealthServer(); 
  
  const channel = await connectConsumer();
  console.log(`Worker listening on queue "${QUEUE_NAME}"...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    const payload = JSON.parse(msg.content.toString());
    const { runId, graph } = payload;

    console.log(`Executing run ${runId}...`);
    try {
      const status = await executeGraph(runId, graph);
      console.log(`Run ${runId} finished: ${status}`);
      channel.ack(msg);
    } catch (err) {
      console.error(`Run ${runId} crashed:`, err);
      await prisma.executionRun.update({
        where: { id: runId },
        data: { status: "FAILED", finishedAt: new Date() },
      });
      channel.ack(msg); // ack anyway to avoid infinite requeue loop; dead-letter handling noted as a documented next step
    }
  });
}

main().catch((err) => {
  console.error("Worker fatal error:", err);
  process.exit(1);
});