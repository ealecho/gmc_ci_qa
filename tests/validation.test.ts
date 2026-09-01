import { describe, expect, it } from "vitest";
import { parseBearerToken, parseObservation } from "../worker/validation";

describe("observation validation", () => {
    it("accepts the study schema and rejects unsafe or malformed input", () => {
        expect(
            parseObservation({
                sector: "Northern buffer",
                type: "forest_entry",
                severity: "medium",
                observedAt: "2026-09-01",
                notes: "A complete synthetic field observation.",
            }).ok,
        ).toBe(true);

        expect(
            parseObservation({
                sector: "Exact household location",
                type: "forest_entry",
                severity: "critical",
                observedAt: "not-a-date",
                notes: "short",
            }),
        ).toEqual({ ok: false, error: "Select a valid buffer sector." });

        expect(parseObservation({ sector: "Northern buffer", type: "forest_entry", severity: "low", observedAt: "2026-02-30", notes: "A long enough note." }).ok).toBe(false);
        expect(parseBearerToken("Bearer secret-value")).toBe("secret-value");
        expect(parseBearerToken("secret-value")).toBeNull();
    });
});
