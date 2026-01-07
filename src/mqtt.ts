import mqtt, { MqttClient, IClientOptions } from "mqtt";
import type { MqttConfig } from "./config.js";

export type MessageHandler = (topic: string, payload: string) => void;

export interface MqttWillConfig {
  topic: string;
  payload: string;
  retain: boolean;
}

export interface MqttWrapper {
  publish(topic: string, payload: string | object, retain?: boolean): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
  isConnected(): boolean;
  close(): Promise<void>;
}

export async function connectMqtt(config: MqttConfig, will?: MqttWillConfig): Promise<MqttWrapper> {
  const options: IClientOptions = {
    clientId: config.clientId,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
  };

  if (config.username) {
    options.username = config.username;
  }
  if (config.password) {
    options.password = config.password;
  }

  // Configure Last Will and Testament (LWT) for availability tracking
  if (will) {
    options.will = {
      topic: will.topic,
      payload: Buffer.from(will.payload),
      qos: 1,
      retain: will.retain,
    };
  }

  const url = `mqtt://${config.host}:${config.port}`;

  return new Promise((resolve, reject) => {
    const client: MqttClient = mqtt.connect(url, options);
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        client.end(true);
        reject(new Error(`MQTT connection timeout to ${url}`));
      }
    }, options.connectTimeout);

    client.on("connect", () => {
      connected = true;
      clearTimeout(timeout);
      resolve(createWrapper(client));
    });

    client.on("error", (err) => {
      if (!connected) {
        clearTimeout(timeout);
        client.end(true); // Stop reconnection attempts
        reject(err);
      }
    });
  });
}

function createWrapper(client: MqttClient): MqttWrapper {
  const handlers = new Map<string, MessageHandler>();

  client.on("message", (topic, payload) => {
    const handler = handlers.get(topic);
    if (handler) {
      try {
        handler(topic, payload.toString());
      } catch (err) {
        console.error(`[ha-opencode] Error handling message on ${topic}:`, err);
      }
    }
  });

  return {
    publish(topic: string, payload: string | object, retain = false): Promise<void> {
      return new Promise((resolve, reject) => {
        const message = typeof payload === "string" ? payload : JSON.stringify(payload);
        client.publish(topic, message, { qos: 1, retain }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },

    subscribe(topic: string, handler: MessageHandler): Promise<void> {
      return new Promise((resolve, reject) => {
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            reject(err);
          } else {
            handlers.set(topic, handler);
            resolve();
          }
        });
      });
    },

    unsubscribe(topic: string): Promise<void> {
      return new Promise((resolve, reject) => {
        client.unsubscribe(topic, (err) => {
          if (err) {
            reject(err);
          } else {
            handlers.delete(topic);
            resolve();
          }
        });
      });
    },

    isConnected(): boolean {
      return client.connected;
    },

    close(): Promise<void> {
      return new Promise((resolve) => {
        client.end(false, {}, () => {
          resolve();
        });
      });
    },
  };
}
