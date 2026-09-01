PRAGMA foreign_keys = ON;

CREATE TABLE study_arms (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    sequence INTEGER NOT NULL UNIQUE
);

CREATE TABLE participants (
    id TEXT PRIMARY KEY,
    sequence INTEGER NOT NULL UNIQUE,
    arm_id TEXT NOT NULL REFERENCES study_arms(id),
    buffer_sector TEXT NOT NULL CHECK (buffer_sector IN ('Northern buffer', 'Eastern buffer', 'Southern buffer', 'Western buffer', 'Cyamudongo')),
    consent_recorded INTEGER NOT NULL DEFAULT 1 CHECK (consent_recorded IN (0, 1)),
    enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'withdrawn', 'completed')),
    enrolled_at TEXT NOT NULL
);

CREATE TABLE survey_rounds (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sequence INTEGER NOT NULL UNIQUE,
    collected_at TEXT NOT NULL,
    is_synthetic INTEGER NOT NULL DEFAULT 1 CHECK (is_synthetic IN (0, 1))
);

CREATE TABLE survey_responses (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    round_id TEXT NOT NULL REFERENCES survey_rounds(id),
    household_income_rwf INTEGER NOT NULL CHECK (household_income_rwf >= 0),
    savings_rwf INTEGER NOT NULL CHECK (savings_rwf >= 0),
    food_security_score INTEGER NOT NULL CHECK (food_security_score BETWEEN 0 AND 10),
    forest_visits_30d INTEGER NOT NULL CHECK (forest_visits_30d >= 0),
    firewood_trips_30d INTEGER NOT NULL CHECK (firewood_trips_30d >= 0),
    alternative_livelihood INTEGER NOT NULL CHECK (alternative_livelihood IN (0, 1)),
    surveyed_at TEXT NOT NULL,
    UNIQUE (participant_id, round_id)
);

CREATE TABLE observations (
    id TEXT PRIMARY KEY,
    sector TEXT NOT NULL CHECK (sector IN ('Northern buffer', 'Eastern buffer', 'Southern buffer', 'Western buffer', 'Cyamudongo')),
    type TEXT NOT NULL CHECK (type IN ('forest_entry', 'firewood_collection', 'wildlife_conflict', 'restoration', 'patrol_note')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'closed')),
    observed_at TEXT NOT NULL,
    notes TEXT NOT NULL CHECK (length(notes) BETWEEN 10 AND 500),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_arm ON participants(arm_id, enrollment_status);
CREATE INDEX idx_responses_round ON survey_responses(round_id, participant_id);
CREATE INDEX idx_observations_status_date ON observations(status, observed_at DESC);

INSERT INTO study_arms (id, slug, name, description, sequence) VALUES
    ('cash_plus', 'cash_plus', 'Cash + programme', 'Unconditional cash, training, and savings groups', 1),
    ('cash_only', 'cash_only', 'Cash only', 'Unconditional cash transfers without programme add-ons', 2),
    ('control', 'control', 'Control', 'No programme support during the study period', 3);

INSERT INTO survey_rounds (id, slug, name, sequence, collected_at) VALUES
    ('baseline', 'baseline', 'Synthetic baseline', 1, '2026-01-15'),
    ('synthetic_pilot', 'synthetic_pilot', 'Synthetic pilot', 2, '2026-08-15');

WITH RECURSIVE numbers(n) AS (
    VALUES(1)
    UNION ALL SELECT n + 1 FROM numbers WHERE n < 1800
)
INSERT INTO participants (id, sequence, arm_id, buffer_sector, enrolled_at)
SELECT
    printf('NYU-%04d', n),
    n,
    CASE n % 3 WHEN 1 THEN 'cash_plus' WHEN 2 THEN 'cash_only' ELSE 'control' END,
    CASE n % 5
        WHEN 1 THEN 'Northern buffer'
        WHEN 2 THEN 'Eastern buffer'
        WHEN 3 THEN 'Southern buffer'
        WHEN 4 THEN 'Western buffer'
        ELSE 'Cyamudongo'
    END,
    '2026-01-10'
FROM numbers;

INSERT INTO survey_responses (
    id, participant_id, round_id, household_income_rwf, savings_rwf,
    food_security_score, forest_visits_30d, firewood_trips_30d,
    alternative_livelihood, surveyed_at
)
SELECT
    'BASE-' || id,
    id,
    'baseline',
    45000 + (sequence % 20) * 2500,
    5000 + (sequence % 10) * 1000,
    4 + (sequence % 3),
    8 + (sequence % 5),
    12 + (sequence % 6),
    CASE WHEN sequence % 5 = 0 THEN 1 ELSE 0 END,
    '2026-01-15'
FROM participants;

INSERT INTO survey_responses (
    id, participant_id, round_id, household_income_rwf, savings_rwf,
    food_security_score, forest_visits_30d, firewood_trips_30d,
    alternative_livelihood, surveyed_at
)
SELECT
    'PILOT-' || p.id,
    p.id,
    'synthetic_pilot',
    b.household_income_rwf + CASE p.arm_id WHEN 'cash_plus' THEN 24000 WHEN 'cash_only' THEN 18000 ELSE 3000 END,
    b.savings_rwf + CASE p.arm_id WHEN 'cash_plus' THEN 18000 WHEN 'cash_only' THEN 7000 ELSE 1000 END,
    MIN(10, b.food_security_score + CASE p.arm_id WHEN 'cash_plus' THEN 2 WHEN 'cash_only' THEN 1 ELSE 0 END),
    MAX(0, b.forest_visits_30d - CASE p.arm_id WHEN 'cash_plus' THEN 3 WHEN 'cash_only' THEN 2 ELSE 0 END),
    MAX(0, b.firewood_trips_30d - CASE p.arm_id WHEN 'cash_plus' THEN 4 WHEN 'cash_only' THEN 2 ELSE 0 END),
    CASE
        WHEN p.arm_id = 'cash_plus' AND (p.sequence % 2 = 0 OR b.alternative_livelihood = 1) THEN 1
        WHEN p.arm_id = 'cash_only' AND (p.sequence % 3 = 0 OR b.alternative_livelihood = 1) THEN 1
        ELSE b.alternative_livelihood
    END,
    '2026-08-15'
FROM participants p
JOIN survey_responses b ON b.participant_id = p.id AND b.round_id = 'baseline';

INSERT INTO observations (id, sector, type, severity, status, observed_at, notes) VALUES
    ('obs-001', 'Western buffer', 'firewood_collection', 'medium', 'reviewing', '2026-08-29', 'Synthetic patrol note: repeated firewood collection activity reported near an approved monitoring zone.'),
    ('obs-002', 'Southern buffer', 'restoration', 'info', 'closed', '2026-08-27', 'Synthetic restoration check: community nursery seedlings recorded as healthy after the latest visit.'),
    ('obs-003', 'Northern buffer', 'wildlife_conflict', 'high', 'open', '2026-08-25', 'Synthetic alert: crop damage attributed to wildlife requires verification by the response team.'),
    ('obs-004', 'Eastern buffer', 'forest_entry', 'medium', 'open', '2026-08-22', 'Synthetic observation: an unplanned forest entry route was noted during a routine community walk.'),
    ('obs-005', 'Cyamudongo', 'patrol_note', 'low', 'closed', '2026-08-19', 'Synthetic patrol note: no new snares or cutting activity found along the monitored route.'),
    ('obs-006', 'Western buffer', 'restoration', 'info', 'closed', '2026-08-15', 'Synthetic restoration record: erosion-control planting completed with a local savings group.'),
    ('obs-007', 'Southern buffer', 'firewood_collection', 'low', 'reviewing', '2026-08-12', 'Synthetic observation: household fuelwood collection frequency discussed during a group session.'),
    ('obs-008', 'Northern buffer', 'patrol_note', 'info', 'closed', '2026-08-08', 'Synthetic patrol note: boundary markers were visible and no immediate incident was recorded.');
