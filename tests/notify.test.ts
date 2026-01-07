import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notify } from "../src/notify.js";

describe("notify", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1704067200000);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  it("should write OSC 99 notification to stdout", () => {
    notify("Test Title", "Test Message");

    // Check OSC 99 format was written
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("\x1b]99;")
    );
  });

  it("should include title in notification", () => {
    notify("My Title", "Body text");

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("p=title;My Title\x07")
    );
  });

  it("should include message body in notification", () => {
    notify("Title", "My Body Message");

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("p=body;My Body Message\x07")
    );
  });

  it("should use consistent ID for title and body parts", () => {
    notify("Title", "Body");

    const call = writeSpy.mock.calls[0][0] as string;
    
    // ID should be the mocked timestamp
    expect(call).toContain("i=1704067200000:");
    
    // Both title and body should have same ID
    const idMatches = call.match(/i=(\d+):/g);
    expect(idMatches).toHaveLength(2);
    expect(idMatches![0]).toBe(idMatches![1]);
  });

  it("should trigger terminal bell after notification", () => {
    notify("Title", "Body");

    // Second call should be the BEL character
    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenLastCalledWith("\x07");
  });

  it("should handle special characters in title and message", () => {
    notify("Title: with;special", "Body\nwith\nnewlines");

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("Title: with;special")
    );
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("Body\nwith\nnewlines")
    );
  });

  it("should handle empty strings", () => {
    notify("", "");

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("p=title;\x07")
    );
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("p=body;\x07")
    );
  });

  it("should handle unicode characters", () => {
    notify("Alert 🚨", "Permission needed 🔐");

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("Alert 🚨")
    );
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("Permission needed 🔐")
    );
  });
});
