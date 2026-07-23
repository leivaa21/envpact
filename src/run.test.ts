import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { run } from "./run.ts";

describe("run", () => {
  it("prints the package version for --version", () => {
    const result = run(["--version"]);

    expect(result.output).toBe(pkg.version);
    expect(result.exitCode).toBe(0);
  });

  it("prints usage for --help and for a bare invocation", () => {
    for (const argv of [["--help"], []]) {
      const result = run(argv);

      expect(result.output).toContain("Usage:");
      expect(result.exitCode).toBe(0);
    }
  });

  it("fails on an unknown command and names it", () => {
    const result = run(["chekc"]);

    expect(result.output).toContain('Unknown command "chekc"');
    expect(result.exitCode).toBe(1);
  });
});
