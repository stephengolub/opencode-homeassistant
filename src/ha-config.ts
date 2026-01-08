/**
 * Home Assistant connection configuration management.
 * 
 * Stores and retrieves the HA connection info (URL, instance token) that is
 * established during pairing. This is stored in a local file so the plugin
 * can automatically reconnect on restart.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

export interface HAConnectionConfig {
  url: string;          // WebSocket URL, e.g., ws://homeassistant.local:8123/api/websocket
  accessToken: string;  // HA long-lived access token for authentication
  instanceToken: string; // Token received from pairing
  instanceId: string;   // Instance ID assigned by HA
  pairedAt: string;     // ISO timestamp of pairing
}

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "ha-connection.json");

/**
 * Load saved HA connection configuration.
 * Returns null if no configuration exists.
 */
export async function loadHAConnectionConfig(): Promise<HAConnectionConfig | null> {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    
    const content = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content) as HAConnectionConfig;
    
    // Validate required fields
    if (!config.url || !config.accessToken || !config.instanceToken || !config.instanceId) {
      return null;
    }
    
    return config;
  } catch {
    return null;
  }
}

/**
 * Save HA connection configuration.
 */
export async function saveHAConnectionConfig(config: HAConnectionConfig): Promise<void> {
  try {
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      await mkdir(CONFIG_DIR, { recursive: true });
    }
    
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    throw err;
  }
}

/**
 * Clear saved HA connection configuration.
 * Called when unpairing or when the connection becomes invalid.
 */
export async function clearHAConnectionConfig(): Promise<void> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const { unlink } = await import("fs/promises");
      await unlink(CONFIG_FILE);
    }
  } catch {
    // Silent failure
  }
}

/**
 * Check if HA connection is configured.
 */
export function isHAConfigured(): boolean {
  return existsSync(CONFIG_FILE);
}

/**
 * Build WebSocket URL from user-provided Home Assistant URL.
 * Handles various input formats:
 * - http://homeassistant.local:8123 -> ws://homeassistant.local:8123/api/websocket
 * - https://ha.example.com -> wss://ha.example.com/api/websocket
 * - homeassistant.local:8123 -> ws://homeassistant.local:8123/api/websocket
 * - ws://homeassistant.local:8123/api/websocket -> unchanged
 */
export function buildWebSocketUrl(input: string): string {
  let url = input.trim();
  
  // Already a websocket URL
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    // Ensure it ends with the correct path
    if (!url.includes("/api/websocket")) {
      url = url.replace(/\/$/, "") + "/api/websocket";
    }
    return url;
  }
  
  // HTTP URL
  if (url.startsWith("http://")) {
    url = "ws://" + url.slice(7);
  } else if (url.startsWith("https://")) {
    url = "wss://" + url.slice(8);
  } else {
    // Plain hostname:port, assume ws://
    url = "ws://" + url;
  }
  
  // Remove trailing slash and add websocket path
  url = url.replace(/\/$/, "") + "/api/websocket";
  
  return url;
}
