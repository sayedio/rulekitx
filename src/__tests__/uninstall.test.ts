import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";
import {
  previewUninstall,
  uninstallRuleKit,
} from "../uninstall.js";

vi.mock("fs/promises");

/** Default to "nothing exists anywhere" so uninstall previews return empty
 *  results unless a test explicitly opts in to a file/dir existing. */
function mockNoFilesystem() {
  vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
  vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
  vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));
  vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
  vi.mocked(fs.writeFile).mockResolvedValue();
  vi.mocked(fs.rm).mockResolvedValue();
  vi.mocked(fs.unlink).mockResolvedValue();
  vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
}

describe("uninstall", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNoFilesystem();
  });

  it("previewUninstall reports nothing to remove when the rulekit dir is missing", async () => {
    const result = await previewUninstall();

    expect(result.rulekitDirFound).toBe(false);
    expect(result.rulekitDirRemoved).toBe(false);
    expect(result.removedSkillDirs).toEqual([]);
    expect(result.removedSnippetFiles).toEqual([]);
    expect(result.removedLockEntries).toEqual([]);
  });

  it("previewUninstall uses the global rulekit dir by default", async () => {
    const result = await previewUninstall();

    expect(result.rulekitDir).toBe(path.join(homedir(), ".rulekit"));
  });

  it("previewUninstall uses the local rulekit dir when --local is passed", async () => {
    const result = await previewUninstall({
      local: true,
      projectDir: "/myproject",
    });

    expect(result.rulekitDir).toBe(path.join("/myproject", ".rulekit"));
  });

  it("uninstallRuleKit calls fs.rm on the rulekit dir when it exists", async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

    await uninstallRuleKit();

    expect(fs.rm).toHaveBeenCalledWith(
      path.join(homedir(), ".rulekit"),
      expect.objectContaining({ recursive: true, force: true }),
    );
  });

  it("collects errors without throwing when fs.rm fails", async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.rm).mockRejectedValue(new Error("disk full"));

    const result = await uninstallRuleKit();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.rulekitDirRemoved).toBe(false);
  });

  it("cleans up local Cursor rules when --local is passed", async () => {
    // Mock local rulekit dir exists
    vi.mocked(fs.stat).mockImplementation((p) => {
      const normalized = path.normalize(p as string).replace(/\\/g, "/");
      if (normalized === "/myproject/.rulekit" || normalized === "/myproject/.cursor/rules") {
        return Promise.resolve({ isDirectory: () => true } as any);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    // Mock readdir for .cursor/rules
    vi.mocked(fs.readdir).mockImplementation((p) => {
      const normalized = path.normalize(p as string).replace(/\\/g, "/");
      if (normalized === "/myproject/.cursor/rules") {
        return Promise.resolve(["rulekit-core.mdc", "other-rule.mdc"] as any);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await uninstallRuleKit({
      local: true,
      projectDir: "/myproject",
    });

    const normalizedRemoved = result.removedSnippetFiles.map(f => path.normalize(f).replace(/\\/g, "/"));
    expect(normalizedRemoved).toContain("/myproject/.cursor/rules/rulekit-core.mdc");
    expect(normalizedRemoved).not.toContain("/myproject/.cursor/rules/other-rule.mdc");
    
    // Check unlink call
    const unlinkCalls = vi.mocked(fs.unlink).mock.calls.map(args => path.normalize(args[0] as string).replace(/\\/g, "/"));
    expect(unlinkCalls).toContain("/myproject/.cursor/rules/rulekit-core.mdc");
  });
});
