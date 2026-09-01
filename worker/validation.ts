export const observationTypes = ["forest_entry", "firewood_collection", "wildlife_conflict", "restoration", "patrol_note"] as const;
export const observationSeverities = ["info", "low", "medium", "high"] as const;
export const bufferSectors = ["Northern buffer", "Eastern buffer", "Southern buffer", "Western buffer", "Cyamudongo"] as const;

export type ObservationInput = {
    sector: (typeof bufferSectors)[number];
    type: (typeof observationTypes)[number];
    severity: (typeof observationSeverities)[number];
    observedAt: string;
    notes: string;
};

type ParseResult = { ok: true; value: ObservationInput } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isOneOf = <T extends readonly string[]>(value: unknown, options: T): value is T[number] => typeof value === "string" && options.includes(value);

export const parseBearerToken = (header: string | null) => /^Bearer ([^\s]+)$/i.exec(header ?? "")?.[1] ?? null;

export function parseObservation(value: unknown): ParseResult {
    if (!isRecord(value)) return { ok: false, error: "A JSON object is required." };

    const { sector, type, severity, observedAt, notes } = value;
    if (!isOneOf(sector, bufferSectors)) return { ok: false, error: "Select a valid buffer sector." };
    if (!isOneOf(type, observationTypes)) return { ok: false, error: "Select a valid observation type." };
    if (!isOneOf(severity, observationSeverities)) return { ok: false, error: "Select a valid severity." };
    const observedTimestamp = typeof observedAt === "string" ? Date.parse(`${observedAt}T00:00:00Z`) : Number.NaN;
    if (
        typeof observedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(observedAt) ||
        Number.isNaN(observedTimestamp) ||
        new Date(observedTimestamp).toISOString().slice(0, 10) !== observedAt
    ) {
        return { ok: false, error: "Enter a valid observation date." };
    }
    if (typeof notes !== "string" || notes.trim().length < 10 || notes.trim().length > 500) {
        return { ok: false, error: "Notes must contain between 10 and 500 characters." };
    }

    return { ok: true, value: { sector, type, severity, observedAt, notes: notes.trim() } };
}
