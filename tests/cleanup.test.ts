import { describe, it, expect } from "vitest";
import { Discovery } from "../src/discovery.js";

describe("Discovery.getEntityKeys", () => {
  it("should return all entity keys for cleanup purposes", () => {
    const keys = Discovery.getEntityKeys();

    expect(keys).toContain("device_id");
    expect(keys).toContain("state");
    expect(keys).toContain("session_title");
    expect(keys).toContain("model");
    expect(keys).toContain("current_tool");
    expect(keys).toContain("tokens_input");
    expect(keys).toContain("tokens_output");
    expect(keys).toContain("cost");
    expect(keys).toContain("last_activity");
    expect(keys).toContain("permission");
    expect(keys.length).toBe(10);
  });
});

// Note: The cleanup module's discoverSessions function uses setTimeout which is
// difficult to test with fake timers due to Promise interaction. The actual cleanup
// logic is tested through integration tests or manual testing.
// 
// Key cleanup behaviors:
// 1. Subscribes to opencode/+/last_activity to discover sessions
// 2. Compares last_activity timestamps against maxAgeDays cutoff
// 3. For stale sessions, publishes empty configs to all HA discovery topics
// 4. Clears retained state messages for removed sessions
// 5. Results are published to opencode/cleanup/response topic

describe("cleanup module exports", () => {
  it("should export required functions", async () => {
    const cleanup = await import("../src/cleanup.js");

    expect(typeof cleanup.cleanupStaleSessions).toBe("function");
    expect(typeof cleanup.cleanupStaleSessionsManual).toBe("function");
    expect(typeof cleanup.runCleanupInBackground).toBe("function");
  });
});
