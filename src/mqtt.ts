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

/**
 * Check if a topic matches a pattern with MQTT wildcards.
 * + matches a single level, # matches multiple levels.
 */
function topicMatchesPattern(topic: string, pattern: string): boolean {
  const topicParts = topic.split("/");
  const patternParts = pattern.split("/");

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];

    if (patternPart === "#") {
      // # matches everything from this point
      return true;
    }

    if (i >= topicParts.length) {
      // Topic is shorter than pattern
      return false;
    }

    if (patternPart !== "+" && patternPart !== topicParts[i]) {
      // Not a wildcard and doesn't match
      return false;
    }
  }

  // Pattern and topic must be same length (unless pattern ends with #)
  return topicParts.length === patternParts.length;
}

function createWrapper(client: MqttClient): MqttWrapper {
  const handlers = new Map<string, MessageHandler>();

  client.on("message", (topic, payload) => {
    // Check all registered patterns for a match
    for (const [pattern, handler] of handlers) {
      if (topicMatchesPattern(topic, pattern)) {
        try {
          handler(topic, payload.toString());
        } catch (err) {
          console.error(`[ha-opencode] Error handling message on ${topic}:`, err);
        }
        break; // Only call first matching handler
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
