import amqp, { ChannelModel, Channel } from "amqplib";

export const QUEUE_NAME = process.env.RABBITMQ_QUEUE || "workflow-executions";

export async function connectConsumer(): Promise<Channel> {
  const connection: ChannelModel = await amqp.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createChannel();

  await channel.assertExchange("workflow-executions-dlx", "fanout", { durable: true });
  await channel.assertQueue("workflow-executions-dlq", { durable: true });
  await channel.bindQueue("workflow-executions-dlq", "workflow-executions-dlx", "");

  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: { "x-dead-letter-exchange": "workflow-executions-dlx" },
  });
  channel.prefetch(1);
  return channel;
}