import amqp, { ChannelModel, Channel } from "amqplib";

export const QUEUE_NAME = process.env.RABBITMQ_QUEUE || "workflow-executions";

export async function connectConsumer(): Promise<Channel> {
  const connection: ChannelModel = await amqp.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  channel.prefetch(1); // process one run at a time per worker instance
  return channel;
}