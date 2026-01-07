import type { MqttWrapper } from "./mqtt.js";
import type { HaConfig } from "./config.js";
import { Discovery } from "./discovery.js";

export interface CleanupConfig {
  maxAgeDays: number;
  haConfig: HaConfig;
}

export interface CleanupResult {
  sessionsRemoved: number;
  sessionIds: string[];
}

const CLEANUP_RESPONSE_TOPIC = "opencode/cleanup/response";

/**
 * Find all OpenCode sessions by subscribing to last_activity topics.
 * Returns a map of deviceId -> last activity timestamp.
 */
async function discoverSessions(
  mqtt: MqttWrapper,
  timeoutMs: number = 5000
): Promise<Map<string, Date>> {
  const sessions = new Map<string, Date>();

  return new Promise((resolve) => {
    const topic = "opencode/+/last_activity";
    let timeoutId: NodeJS.Timeout;

    const handleMessage = (_topic: string, payload: string) => {
      // Extract device ID from topic: opencode/{deviceId}/last_activity
      const match = _topic.match(/^opencode\/([^/]+)\/last_activity$/);
      if (match) {
        const deviceId = match[1];
        const timestamp = new Date(payload);
        if (!isNaN(timestamp.getTime())) {
          sessions.set(deviceId, timestamp);
        }
      }
    };

    // Subscribe and collect retained messages
    mqtt.subscribe(topic, handleMessage).then(() => {
      // Wait for retained messages to arrive, then resolve
      timeoutId = setTimeout(async () => {
        try {
          await mqtt.unsubscribe(topic);
        } catch {
          // Ignore unsubscribe errors
        }
        resolve(sessions);
      }, timeoutMs);
    }).catch(() => {
      clearTimeout(timeoutId);
      resolve(sessions);
    });
  });
}

/**
 * Remove a stale session's entities from Home Assistant.
 */
async function removeSession(
  mqtt: MqttWrapper,
  deviceId: string,
  haConfig: HaConfig
): Promise<void> {
  const entityKeys = Discovery.getEntityKeys();
  const discoveryPrefix = haConfig.discoveryPrefix;

  // Publish empty config to remove each entity from HA
  for (const key of entityKeys) {
    const configTopic = `${discoveryPrefix}/sensor/${deviceId}/${key}/config`;
    await mqtt.publish(configTopic, "", true);
  }

  // Clear retained state messages
  const stateTopicBase = `opencode/${deviceId}`;
  for (const key of entityKeys) {
    await mqtt.publish(`${stateTopicBase}/${key}`, "", true);
    // Also clear attributes topics for entities that have them
    if (key === "device_id" || key === "state" || key === "permission") {
      await mqtt.publish(`${stateTopicBase}/${key}/attributes`, "", true);
    }
  }

  // Clear availability topic
  await mqtt.publish(`${stateTopicBase}/availability`, "", true);
}

/**
 * Clean up stale OpenCode sessions from Home Assistant.
 * Removes entities for sessions that haven't been active in `maxAgeDays` days.
 *
 * @param mqtt - MQTT client wrapper
 * @param config - Cleanup configuration
 * @returns Result with count and IDs of removed sessions
 */
export async function cleanupStaleSessions(
  mqtt: MqttWrapper,
  config: CleanupConfig
): Promise<CleanupResult> {
  const maxAgeMs = config.maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - maxAgeMs);

  // Discover all sessions
  const sessions = await discoverSessions(mqtt);

  const removedSessionIds: string[] = [];

  for (const [deviceId, lastActivity] of sessions) {
    if (lastActivity < cutoffDate) {
      try {
        await removeSession(mqtt, deviceId, config.haConfig);
        removedSessionIds.push(deviceId);
        console.log(
          `[ha-opencode] Cleaned up stale session: ${deviceId} (last active: ${lastActivity.toISOString()})`
        );
      } catch (err) {
        console.error(
          `[ha-opencode] Failed to clean up session ${deviceId}:`,
          err
        );
      }
    }
  }

  return {
    sessionsRemoved: removedSessionIds.length,
    sessionIds: removedSessionIds,
  };
}

/**
 * Manually trigger cleanup and publish results to MQTT.
 * Called via the cleanup_stale_sessions command.
 */
export async function cleanupStaleSessionsManual(
  mqtt: MqttWrapper,
  config: CleanupConfig
): Promise<void> {
  const result = await cleanupStaleSessions(mqtt, config);

  // Publish result to global cleanup response topic
  await mqtt.publish(
    CLEANUP_RESPONSE_TOPIC,
    {
      type: "cleanup_result",
      sessions_removed: result.sessionsRemoved,
      session_ids: result.sessionIds,
      max_age_days: config.maxAgeDays,
      timestamp: new Date().toISOString(),
    },
    false
  );
}

/**
 * Run cleanup in the background (non-blocking).
 * Logs results but doesn't throw on error.
 */
export function runCleanupInBackground(
  mqtt: MqttWrapper,
  config: CleanupConfig
): void {
  cleanupStaleSessions(mqtt, config)
    .then((result) => {
      if (result.sessionsRemoved > 0) {
        console.log(
          `[ha-opencode] Cleanup complete: removed ${result.sessionsRemoved} stale session(s)`
        );
      }
    })
    .catch((err) => {
      console.error("[ha-opencode] Background cleanup failed:", err);
    });
}
