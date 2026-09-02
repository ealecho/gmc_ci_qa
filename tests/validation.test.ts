import { describe, expect, it } from "vitest";
import { parseBearerToken, parseObservation } from "../worker/validation";

const validObservation = {
    sector: "Northern buffer",
    type: "forest_entry",
    severity: "medium",
    observedAt: "2026-09-01",
    notes: "A complete synthetic field observation.",
};

describe("observation validation", () => {
    it("accepts and normalises a valid observation", () => {
        const result = parseObservation({ ...validObservation, notes: `  ${validObservation.notes}  ` });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.notes).toBe(validObservation.notes);
    });

    it("rejects disallowed locations and categories", () => {
        expect(parseObservation({ ...validObservation, sector: "Exact household location" })).toEqual({
            ok: false,
            error: "Select a valid buffer sector.",
        });
        expect(parseObservation({ ...validObservation, severity: "critical" }).ok).toBe(false);
    });

    it("rejects impossible dates and out-of-range notes", () => {
        expect(parseObservation({ ...validObservation, observedAt: "2026-02-30" }).ok).toBe(false);
        expect(parseObservation({ ...validObservation, notes: "too short" }).ok).toBe(false);
        expect(parseObservation({ ...validObservation, notes: "x".repeat(501) }).ok).toBe(false);
    });
});

describe("bearer token parsing", () => {
    it("accepts the Bearer scheme and rejects malformed authorization headers", () => {
        expect(parseBearerToken("Bearer secret-value")).toBe("secret-value");
        expect(parseBearerToken("bearer secret-value")).toBe("secret-value");
        expect(parseBearerToken("secret-value")).toBeNull();
        expect(parseBearerToken("Bearer too many parts")).toBeNull();
        expect(parseBearerToken(null)).toBeNull();
    });
});
