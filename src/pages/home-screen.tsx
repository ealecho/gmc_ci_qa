import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart01, Download01, FileSearch01, HomeLine, Menu01, Plus, ShieldTick, Users01, XClose } from "@untitledui/icons";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";

type Metadata = { participants: number; completed_surveys: number; open_observations: number; study_arms: number };
type Outcome = {
    arm: "cash_plus" | "cash_only" | "control";
    arm_name: string;
    round: "baseline" | "synthetic_pilot";
    round_name: string;
    responses: number;
    income: number;
    savings: number;
    food_security: number;
    forest_visits: number;
    firewood_trips: number;
    alternative_livelihood_rate: number;
};
type Observation = {
    id: string;
    sector: string;
    type: string;
    severity: "info" | "low" | "medium" | "high";
    status: "open" | "reviewing" | "closed";
    observed_at: string;
};
type DashboardData = { notice: string; metadata: Metadata; outcomes: Outcome[]; observations: Observation[]; updatedAt: string };

const navItems = [
    { label: "Overview", href: "#overview", icon: HomeLine },
    { label: "Study cohorts", href: "#cohorts", icon: Users01 },
    { label: "Outcome signals", href: "#outcomes", icon: BarChart01 },
    { label: "Field observations", href: "#observations", icon: FileSearch01 },
    { label: "Data safeguards", href: "#safeguards", icon: ShieldTick },
];

const typeLabels: Record<string, string> = {
    forest_entry: "Forest entry",
    firewood_collection: "Firewood collection",
    wildlife_conflict: "Wildlife conflict",
    restoration: "Restoration",
    patrol_note: "Patrol note",
};
const armShortNames: Record<Outcome["arm"], string> = { cash_plus: "Cash + programme", cash_only: "Cash only", control: "Control" };
const formatRwf = new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 });
const number = (value: unknown) => Number(value ?? 0);

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Users01 }) {
    return (
        <article className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-tertiary">{label}</p>
                    <p className="mt-2 text-display-xs font-semibold tracking-tight text-primary">{value}</p>
                    <p className="mt-1 text-sm text-tertiary">{helper}</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-primary text-fg-brand-primary">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
            </div>
        </article>
    );
}

const severityColor = (severity: Observation["severity"]): "gray" | "success" | "warning" | "error" =>
    severity === "high" ? "error" : severity === "medium" ? "warning" : severity === "low" ? "success" : "gray";

export const HomeScreen = () => {
    const [data, setData] = useState<DashboardData>();
    const [error, setError] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState("");
    const [form, setForm] = useState({
        token: "",
        sector: "Northern buffer",
        type: "patrol_note",
        severity: "info",
        observedAt: new Date().toISOString().slice(0, 10),
        notes: "",
    });

    const loadDashboard = async () => {
        try {
            const response = await fetch("/api/dashboard", { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("The dashboard API is not available.");
            setData(await response.json());
            setError("");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Unable to load the dashboard.");
        }
    };

    useEffect(() => {
        void loadDashboard();
    }, []);

    const outcomes = useMemo(
        () =>
            data?.outcomes.map((item) => ({
                ...item,
                responses: number(item.responses),
                income: number(item.income),
                savings: number(item.savings),
                food_security: number(item.food_security),
                forest_visits: number(item.forest_visits),
                firewood_trips: number(item.firewood_trips),
                alternative_livelihood_rate: number(item.alternative_livelihood_rate),
            })) ?? [],
        [data],
    );
    const findOutcome = (arm: Outcome["arm"], round: Outcome["round"]) => outcomes.find((item) => item.arm === arm && item.round === round);
    const arms: Outcome["arm"][] = ["cash_plus", "cash_only", "control"];
    const trendData = [
        {
            round: "Baseline",
            "Cash + programme": findOutcome("cash_plus", "baseline")?.income,
            "Cash only": findOutcome("cash_only", "baseline")?.income,
            Control: findOutcome("control", "baseline")?.income,
        },
        {
            round: "Pilot",
            "Cash + programme": findOutcome("cash_plus", "synthetic_pilot")?.income,
            "Cash only": findOutcome("cash_only", "synthetic_pilot")?.income,
            Control: findOutcome("control", "synthetic_pilot")?.income,
        },
    ];
    const forestData = arms.map((arm) => ({
        arm: armShortNames[arm],
        Baseline: findOutcome(arm, "baseline")?.forest_visits,
        Pilot: findOutcome(arm, "synthetic_pilot")?.forest_visits,
    }));

    const submitObservation = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setSubmitMessage("");
        try {
            const response = await fetch("/api/observations", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${form.token}` },
                body: JSON.stringify({ sector: form.sector, type: form.type, severity: form.severity, observedAt: form.observedAt, notes: form.notes }),
            });
            const result = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(result.error ?? "The observation could not be recorded.");
            setSubmitMessage("Observation recorded. The public view contains no names, coordinates, or field notes.");
            setForm((current) => ({ ...current, notes: "" }));
            await loadDashboard();
        } catch (reason) {
            setSubmitMessage(reason instanceof Error ? reason.message : "The observation could not be recorded.");
        } finally {
            setSubmitting(false);
        }
    };

    const metrics = data?.metadata;
    const completion = metrics?.participants ? Math.round((number(metrics.completed_surveys) / number(metrics.participants)) * 100) : 0;

    return (
        <div className="min-h-screen bg-secondary">
            <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-secondary bg-primary px-4 lg:hidden">
                <a href="#overview" className="flex items-center gap-2.5" aria-label="Nyungwe Nexus home">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#0d3b2c] text-sm font-bold text-white">N</span>
                    <span className="font-semibold text-primary">Nyungwe Nexus</span>
                </a>
                <Button color="tertiary" iconLeading={menuOpen ? XClose : Menu01} aria-label="Toggle navigation" onClick={() => setMenuOpen((open) => !open)} />
            </header>
            {menuOpen && (
                <nav className="sticky top-16 z-30 border-b border-secondary bg-primary p-3 lg:hidden" aria-label="Mobile navigation">
                    {navItems.map(({ label, href, icon: Icon }) => (
                        <a key={label} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-secondary hover:bg-primary_hover">
                            <Icon className="size-5 text-fg-quaternary" />
                            {label}
                        </a>
                    ))}
                </nav>
            )}

            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-secondary bg-primary lg:flex lg:flex-col">
                <div className="flex h-20 items-center gap-3 border-b border-secondary px-6">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[#0d3b2c] text-lg font-bold text-white shadow-sm">N</span>
                    <div>
                        <p className="font-semibold text-primary">Nyungwe Nexus</p>
                        <p className="text-xs text-tertiary">Impact observatory</p>
                    </div>
                </div>
                <nav className="flex flex-1 flex-col gap-1 px-4 py-6" aria-label="Primary navigation">
                    {navItems.map(({ label, href, icon: Icon }, index) => (
                        <a key={label} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${index === 0 ? "bg-brand-primary text-brand-secondary" : "text-secondary hover:bg-primary_hover"}`}>
                            <Icon className="size-5" aria-hidden="true" />
                            {label}
                        </a>
                    ))}
                </nav>
                <div className="m-4 rounded-xl bg-brand-primary p-4 ring-1 ring-brand-200">
                    <BadgeWithDot color="success" size="sm">Privacy-safe demo</BadgeWithDot>
                    <p className="mt-3 text-sm font-semibold text-primary">No participant identities</p>
                    <p className="mt-1 text-xs leading-5 text-tertiary">Only coded, synthetic records and aggregated indicators are exposed.</p>
                </div>
            </aside>

            <main className="lg:pl-64">
                <div id="overview" className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                            <Badge color="brand" size="md">Research workspace</Badge>
                            <h1 className="mt-3 text-display-sm font-semibold tracking-tight text-primary sm:text-display-md">Can stronger livelihoods protect a rainforest?</h1>
                            <p className="mt-2 max-w-3xl text-md leading-7 text-tertiary">A cloud-based observatory for monitoring poverty outcomes, programme delivery, and conservation signals around Nyungwe National Park.</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-3">
                            <Button color="secondary" size="md" iconLeading={Download01} href="/api/export.csv">Export summary</Button>
                            <Button size="md" iconLeading={Plus} onClick={() => setModalOpen(true)}>Record observation</Button>
                        </div>
                    </div>

                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-utility-amber-200 bg-utility-amber-50 p-4 text-sm text-utility-amber-700">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                        <p><strong>Demonstration only.</strong> {data?.notice ?? "All displayed outcome data is synthetic and must not be interpreted as a finding from the live Nyungwe study."}</p>
                    </div>

                    {error && (
                        <div role="alert" className="mb-6 rounded-xl border border-utility-red-200 bg-utility-red-50 p-4 text-sm text-utility-red-700">
                            {error} Run the Cloudflare Worker locally or deploy it to load the D1-backed dashboard.
                        </div>
                    )}

                    <section aria-labelledby="study-pulse-heading">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 id="study-pulse-heading" className="text-lg font-semibold text-primary">Study pulse</h2>
                                <p className="text-sm text-tertiary">An anonymised operational view of the three-arm study.</p>
                            </div>
                            <BadgeWithDot color={error ? "error" : "success"} size="sm">{error ? "Offline" : data ? "Live" : "Loading"}</BadgeWithDot>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard label="Participants" value={metrics ? number(metrics.participants).toLocaleString() : "—"} helper="Coded study records" icon={Users01} />
                            <MetricCard label="Study arms" value={metrics ? String(metrics.study_arms) : "—"} helper="Randomised comparison groups" icon={BarChart01} />
                            <MetricCard label="Pilot completion" value={metrics ? `${completion}%` : "—"} helper="Synthetic response round" icon={FileSearch01} />
                            <MetricCard label="Open signals" value={metrics ? String(metrics.open_observations) : "—"} helper="Require research-team review" icon={AlertTriangle} />
                        </div>
                    </section>

                    <section id="outcomes" className="mt-8 grid gap-6 xl:grid-cols-5" aria-labelledby="outcome-heading">
                        <article className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset xl:col-span-3">
                            <div className="mb-6">
                                <h2 id="outcome-heading" className="text-lg font-semibold text-primary">Household income signal</h2>
                                <p className="text-sm text-tertiary">Average monthly income by study arm, in synthetic Rwandan francs.</p>
                            </div>
                            <div className="h-72" aria-label="Line chart comparing synthetic household income by study arm">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                                        <XAxis dataKey="round" axisLine={false} tickLine={false} tickMargin={10} />
                                        <YAxis axisLine={false} tickLine={false} width={64} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                                        <Tooltip content={<ChartTooltipContent formatter={(value) => formatRwf.format(Number(value))} />} />
                                        <Legend content={<ChartLegendContent className="pt-4" />} />
                                        <Line type="monotone" dataKey="Cash + programme" stroke="#16875b" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Cash only" stroke="#2e90fa" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="Control" stroke="#98a2b3" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </article>

                        <article className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset xl:col-span-2">
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-primary">Forest visits</h2>
                                <p className="text-sm text-tertiary">Self-reported visits during the previous 30 days.</p>
                            </div>
                            <div className="h-72" aria-label="Bar chart comparing synthetic forest visits">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={forestData} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                                        <XAxis dataKey="arm" axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
                                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Legend content={<ChartLegendContent className="pt-4" />} />
                                        <Bar dataKey="Baseline" fill="#98a2b3" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Pilot" fill="#16875b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </article>
                    </section>

                    <section id="cohorts" className="mt-8" aria-labelledby="cohort-heading">
                        <div className="mb-4">
                            <h2 id="cohort-heading" className="text-lg font-semibold text-primary">Study-arm comparison</h2>
                            <p className="text-sm text-tertiary">Descriptive synthetic indicators only; causal analysis remains outside this application.</p>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-3">
                            {arms.map((arm) => {
                                const baseline = findOutcome(arm, "baseline");
                                const pilot = findOutcome(arm, "synthetic_pilot");
                                return (
                                    <article key={arm} className="rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="font-semibold text-primary">{armShortNames[arm]}</h3>
                                            <Badge color={arm === "cash_plus" ? "brand" : arm === "cash_only" ? "blue" : "gray"}>{pilot?.responses ?? 600} records</Badge>
                                        </div>
                                        <dl className="mt-5 space-y-4">
                                            <div className="flex items-end justify-between border-b border-secondary pb-3">
                                                <dt className="text-sm text-tertiary">Income</dt>
                                                <dd className="text-right"><span className="block font-semibold text-primary">{pilot ? formatRwf.format(pilot.income) : "—"}</span><span className="text-xs text-success-primary">{baseline && pilot ? `+${formatRwf.format(pilot.income - baseline.income)}` : "—"}</span></dd>
                                            </div>
                                            <div className="flex items-end justify-between border-b border-secondary pb-3"><dt className="text-sm text-tertiary">Savings</dt><dd className="font-semibold text-primary">{pilot ? formatRwf.format(pilot.savings) : "—"}</dd></div>
                                            <div className="flex items-end justify-between border-b border-secondary pb-3"><dt className="text-sm text-tertiary">Food security</dt><dd className="font-semibold text-primary">{pilot?.food_security ?? "—"} / 10</dd></div>
                                            <div className="flex items-end justify-between"><dt className="text-sm text-tertiary">Alternative livelihood</dt><dd className="font-semibold text-primary">{pilot?.alternative_livelihood_rate ?? "—"}%</dd></div>
                                        </dl>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section id="observations" className="mt-8 rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset" aria-labelledby="observations-heading">
                        <div className="flex flex-col justify-between gap-4 border-b border-secondary p-5 sm:flex-row sm:items-center">
                            <div><h2 id="observations-heading" className="text-lg font-semibold text-primary">Recent field observations</h2><p className="text-sm text-tertiary">Approximate buffer sectors only; notes and coordinates are not public.</p></div>
                            <Button color="secondary" iconLeading={Plus} onClick={() => setModalOpen(true)}>Add observation</Button>
                        </div>
                        <div className="divide-y divide-secondary">
                            {data?.observations.map((observation) => (
                                <article key={observation.id} className="grid gap-3 p-5 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-fg-brand-primary"><FileSearch01 className="size-5" /></span>
                                        <div><h3 className="text-sm font-semibold text-primary">{typeLabels[observation.type] ?? observation.type}</h3><p className="text-sm text-tertiary">{observation.sector}</p></div>
                                    </div>
                                    <p className="text-sm text-tertiary">{new Date(`${observation.observed_at}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>
                                    <div className="flex items-center gap-2 sm:justify-end"><Badge color={severityColor(observation.severity)}>{observation.severity}</Badge><BadgeWithDot color={observation.status === "closed" ? "success" : observation.status === "reviewing" ? "warning" : "error"}>{observation.status}</BadgeWithDot></div>
                                </article>
                            ))}
                            {!data?.observations.length && <p className="p-6 text-sm text-tertiary">No observations are available.</p>}
                        </div>
                    </section>

                    <section id="safeguards" className="mt-8 grid gap-6 rounded-2xl bg-[#0d3b2c] p-6 text-white lg:grid-cols-3 lg:p-8" aria-labelledby="safeguards-heading">
                        <div><Badge color="success">Research ethics by design</Badge><h2 id="safeguards-heading" className="mt-4 text-display-xs font-semibold">Useful evidence without exposing families.</h2></div>
                        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
                            {[
                                ["Coded records", "Participant names and contact details are excluded."],
                                ["Coarse geography", "Only broad buffer sectors appear in the system."],
                                ["Aggregate exports", "Downloads contain study-arm summaries, never individual rows."],
                            ].map(([title, text]) => <article key={title} className="rounded-xl bg-white/8 p-4 ring-1 ring-white/15"><ShieldTick className="size-5 text-brand-300" /><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-white/70">{text}</p></article>)}
                        </div>
                    </section>

                    <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-secondary pt-6 text-sm text-tertiary sm:flex-row">
                        <p>Nyungwe Nexus · Academic cloud-system prototype</p>
                        <p>Last synced {data ? new Date(data.updatedAt).toLocaleString() : "when the API connects"}</p>
                    </footer>
                </div>
            </main>

            <ModalOverlay isOpen={modalOpen} onOpenChange={setModalOpen} isDismissable>
                <Modal className="max-w-xl">
                    <Dialog>
                        {({ close }) => (
                            <form onSubmit={submitObservation} className="w-full rounded-2xl bg-primary shadow-xl ring-1 ring-secondary ring-inset">
                                <div className="flex items-start justify-between border-b border-secondary p-5 sm:p-6">
                                    <div><h2 className="text-lg font-semibold text-primary">Record field observation</h2><p className="mt-1 text-sm text-tertiary">Research-team access is required. Do not include names or exact locations.</p></div>
                                    <Button type="button" color="tertiary" iconLeading={XClose} aria-label="Close" onClick={close} />
                                </div>
                                <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                                    <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-secondary">Research access key</span><input required type="password" autoComplete="off" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} className="w-full rounded-lg bg-primary px-3.5 py-2.5 text-md text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus:ring-2 focus:ring-brand" /></label>
                                    <NativeSelect label="Buffer sector" value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} options={["Northern buffer", "Eastern buffer", "Southern buffer", "Western buffer", "Cyamudongo"].map((value) => ({ label: value, value }))} />
                                    <NativeSelect label="Observation type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} options={Object.entries(typeLabels).map(([value, label]) => ({ label, value }))} />
                                    <NativeSelect label="Severity" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })} options={["info", "low", "medium", "high"].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value }))} />
                                    <label><span className="mb-1.5 block text-sm font-medium text-secondary">Observed on</span><input required type="date" value={form.observedAt} onChange={(event) => setForm({ ...form, observedAt: event.target.value })} className="w-full rounded-lg bg-primary px-3.5 py-2 text-md text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus:ring-2 focus:ring-brand" /></label>
                                    <TextArea isRequired className="sm:col-span-2" label="Research notes" hint="10–500 characters. Exclude names, phone numbers, and precise household locations." rows={4} value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
                                    {submitMessage && <p role="status" className="rounded-lg bg-secondary p-3 text-sm text-secondary sm:col-span-2">{submitMessage}</p>}
                                </div>
                                <div className="flex justify-end gap-3 border-t border-secondary p-5 sm:px-6"><Button type="button" color="secondary" onClick={close}>Cancel</Button><Button type="submit" isLoading={submitting} showTextWhileLoading>Save observation</Button></div>
                            </form>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
};
