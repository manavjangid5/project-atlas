import amqp, { Channel, ChannelModel } from "amqplib";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export const QUEUE_NAME = process.env.RABBITMQ_QUEUE || "workflow-executions";

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;
  connection = await amqp.connect(process.env.RABBITMQ_URL!);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  return channel;
}

export async function publishMessage(message: object) {
  const ch = await getChannel();
  ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), { persistent: true });
}