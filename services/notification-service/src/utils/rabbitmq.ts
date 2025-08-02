import amqp from "amqplib";
import logger from "../utils/logger.js";

let channel: amqp.Channel;

export const EXCHANGE_NAME = "notification_exchange";

export const connectRabbitMQ = async () => {
  const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq";
  const RETRY_DELAY = 5000;

  while (true) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });

      logger.info("Connected to RabbitMQ");
      return channel;
    } catch (error) {
      logger.warn("RabbitMQ not ready. Retrying in 5 seconds...");
      await new Promise((res) => setTimeout(res, RETRY_DELAY));
    }
  }
};

export const publishToQueue = async (routingKey: string, message: any) => {
  if (!channel) {
    await connectRabbitMQ();
  }
  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message))
  );
  logger.info(`Message published to ${routingKey}: ${JSON.stringify(message)}`);
};

export const subscribeToQueue = async (
  routingKey: string,
  callback: (msg: amqp.ConsumeMessage | null) => void
) => {
  if (!channel) {
    await connectRabbitMQ();
  }
  const queue = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(queue.queue, EXCHANGE_NAME, routingKey);

  channel.consume(queue.queue, (msg) => {
    logger.info(`Received message from ${routingKey}`);
    if (msg) {
      const content = JSON.parse(msg.content.toString());
      callback(content);
      channel.ack(msg);
    }
  });

  logger.info(`Subscribed to ${routingKey}`);
};
