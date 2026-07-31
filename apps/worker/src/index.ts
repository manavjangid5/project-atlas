import dotenv from "dotenv";
dotenv.config();
import { startHealthServer } from "./healthServer";
import { connectConsumer, QUEUE_NAME } from "./rabbitmqConsumer";
import { executeGraph } from "./graphExecutor";
import { prisma } from "./db";
import { startKeepAlive } from "./keepAlive";

async function main() {
  startHealthServer(); 
  startKeepAlive();
  
  const channel = await connectConsumer();
  console.log(`Worker listening on queue "${QUEUE_NAME}"...`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    const payload = JSON.parse(msg.content.toString());
    const { runId, graph, initialPayload } = payload;

    // Idempotency guard: if RabbitMQ redelivers this message (e.g. after
    // a worker crash before ack), don't re-execute a run that's already
    // past PENDING — prevents duplicate side effects (double Slack posts,
    // double AI calls, etc.) on redelivery.
    const existing = await prisma.executionRun.findUnique({ where: { id: runId } });
    if (!existing || existing.status !== "PENDING") {
      console.log(`Skipping redelivered/duplicate message for run ${runId} (status: ${existing?.status})`);
      channel.ack(msg);
      return;
    }

    console.log(`Executing run ${runId}...`);
    try {
      const status = await executeGraph(runId, graph, initialPayload);
      console.log(`Run ${runId} finished: ${status}`);
      channel.ack(msg);
    } catch (err) {
      console.error(`Run ${runId} crashed:`, err);
      channel.nack(msg, false, false); // send to DLQ instead of silently ack'ing a poison message
    }
  });
}

main().catch((err) => {
  console.error("Worker fatal error:", err);
  process.exit(1);
});