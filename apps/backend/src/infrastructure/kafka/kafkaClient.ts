import { Kafka, logLevel } from "kafkajs";

export const kafka = new Kafka({
  clientId: "atlas-backend",
  brokers: [process.env.KAFKA_BROKER!],
  ssl: true,
  sasl: {
    mechanism: "scram-sha-256",
    username: process.env.KAFKA_USERNAME!,
    password: process.env.KAFKA_PASSWORD!,
  },
  logLevel: logLevel.ERROR,
});

export const producer = kafka.producer();

let connected = false;
export async function ensureProducerConnected() {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
}

export const EXECUTION_TOPIC = process.env.KAFKA_TOPIC || "workflow-executions";