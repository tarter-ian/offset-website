import { describe, expect, it } from "vitest";
import { isPhoneAgent } from "./extension";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WIN_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

describe("isPhoneAgent", () => {
  it("finds phones and tablets", () => {
    expect(isPhoneAgent(IPHONE, true)).toBe(true);
    expect(isPhoneAgent(ANDROID, true)).toBe(true);
    // iPadOS Safari reports a Mac; only its touch screen tells it apart.
    expect(isPhoneAgent(MAC_SAFARI, true)).toBe(true);
  });

  it("leaves computers alone", () => {
    expect(isPhoneAgent(MAC_SAFARI, false)).toBe(false);
    expect(isPhoneAgent(WIN_CHROME, false)).toBe(false);
    // A touch-screen Windows laptop can still run the extension.
    expect(isPhoneAgent(WIN_CHROME, true)).toBe(false);
  });
});
