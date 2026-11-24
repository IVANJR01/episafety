import { describe, it, expect } from "vitest";
import { isNetworkFailure } from "./offlineViewCache";

describe("isNetworkFailure", () => {
  it("reconhece falta de internet no erro do Supabase (objeto, não Error)", () => {
    expect(isNetworkFailure({ message: "TypeError: Failed to fetch", details: "" })).toBe(true);
    expect(isNetworkFailure({ message: "", details: "TypeError: Load failed" })).toBe(true);
  });
  it("continua reconhecendo o Error comum", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
  });
  it("erro de verdade não é confundido com falta de internet", () => {
    expect(isNetworkFailure({ message: "permission denied for table epis" })).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});
