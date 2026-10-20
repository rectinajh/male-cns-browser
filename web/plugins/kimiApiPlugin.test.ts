import { describe, expect, it } from "vitest";
import { buildKimiMessages, parseEnvFile } from "./kimiApiPlugin";

describe("parseEnvFile", () => {
  it("parses KEY=VALUE and ignores comments", () => {
    const out = parseEnvFile(
      "# comment\nKIMI_MODEL=moonshot-v1-8k\nKIMI_BASE_URL='https://api.moonshot.cn/v1'\n",
    );
    expect(out.KIMI_MODEL).toBe("moonshot-v1-8k");
    expect(out.KIMI_BASE_URL).toBe("https://api.moonshot.cn/v1");
  });
});

describe("buildKimiMessages", () => {
  it("includes neuron context and Chinese system prompt", () => {
    const msgs = buildKimiMessages({
      question: "这个类型干什么？",
      neuron: { id: 42, name: "foo", type: "LC10", side: "R" },
    });
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("中文");
    expect(msgs[1].content).toContain("id=42");
    expect(msgs[1].content).toContain("type=LC10");
    expect(msgs[1].content).toContain("这个类型干什么？");
  });
});
