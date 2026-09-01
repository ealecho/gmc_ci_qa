# Nyungwe Nexus — 10-Minute Presentation and Demo Script

**Live demo:** https://nyungwe-nexus.alaara.workers.dev
**Target duration:** 9 minutes 45 seconds, leaving 15 seconds for transitions

## 0:00–0:45 — Opening

“Hello. My project is Nyungwe Nexus, a cloud-based impact observatory for a real research question: can reducing poverty also reduce pressure on a protected rainforest?

The project is motivated by the study described by 100WEEKS, African Parks, and Wageningen University & Research around Nyungwe National Park in Rwanda. The study involves 1,800 women in three randomised groups: cash plus training and savings groups, cash only, and a control group.

My system is publicly deployed at this URL. Everything shown in the demonstration is synthetic. It illustrates the software and research workflow; it is not a result from the active trial.”

**On screen:** Open the live application. Point to the project title and synthetic-data warning.

## 0:45–2:00 — Problem and research basis

“Nyungwe is a strong setting for this question because conservation and livelihoods meet at the park boundary. UNESCO inscribed Nyungwe as a World Heritage property in 2023 and identifies it as a highly intact, biodiverse montane landscape of about 101,900 hectares.

Families near protected forests may depend on fuelwood, food, materials, or land. More income could reduce urgent extraction by enabling alternatives, but that outcome is not guaranteed. Research from Sierra Leone found that unconditional conservation transfers increased short-run land clearance in that particular context. Research on payment for environmental services in Cambodia found reduced deforestation, while livelihood benefits depended on programme value and who could participate. The literature therefore supports a rigorous trial, not a predetermined success story.

The software problem is to connect livelihood and conservation indicators without exposing participants or turning descriptive data into unsupported causal claims. That led to three design principles: aggregate by study arm, minimise sensitive data, and label synthetic or preliminary information clearly.”

**On screen:** Scroll through “Study pulse” and the two outcome charts.

## 2:00–3:20 — User experience

“The first section gives an operational pulse: 1,800 coded participants, three study arms, response completion, and open conservation signals. It intentionally avoids names and household-level records.

The income chart compares the synthetic baseline and pilot rounds. The forest-visits chart places a conservation-related indicator beside it. These are called signals rather than impacts because an operational dashboard should not substitute for the pre-specified statistical analysis.

Below the charts, the study-arm cards expose exact aggregate values in an accessible text format. This also helps people who cannot interpret the graphics. The recent-observations section shows only a coarse buffer sector, type, date, severity, and workflow status. Public queries never return field notes or coordinates.

The interface uses official Untitled UI version 8 components and icons, adapted to a forest-green theme. It has desktop and mobile navigation, keyboard-compatible controls, labelled inputs, alert and status semantics, and responsive layouts.”

**On screen:** Show the three cohort cards and recent observations. Narrow the browser briefly if practical to demonstrate the mobile layout.

## 3:20–4:20 — Protected field workflow

“An authorised researcher can choose ‘Record observation.’ The form asks for a research key, coarse sector, type, severity, date, and notes. It reminds the user not to enter names or exact locations.

Submitting calls a protected Worker endpoint. The server rejects missing or incorrect access keys, non-JSON content, bodies larger than eight kilobytes, unapproved categories, invalid dates, and notes outside the allowed length. Valid values are inserted through a prepared database statement. The note remains private even after the observation appears in the public list.

For this recording I will not reveal the production key. The secret is encrypted in Cloudflare and excluded from the repository. The form can still be demonstrated safely by submitting without a key and showing the expected rejection.”

**On screen:** Open the observation modal, describe its fields, submit without a key, show the handled error, and close the modal.

## 4:20–5:50 — Architecture

“The architecture is deliberately compact. React 19, TypeScript, Vite, Tailwind CSS, Untitled UI, and Recharts implement the browser application. The compiled files and API are deployed together on Cloudflare Workers, so there is no cross-origin boundary or separate web server.

Requests under `/api` go to a typed Worker handler. The dashboard endpoint batches four database queries. The CSV endpoint computes group-level averages in SQL. The write endpoint authenticates and validates observations. Other requests use Cloudflare’s static asset binding.

Cloudflare D1 is appropriate because the study structure is relational. Participants belong to a study arm, responses belong to one participant and one survey round, and outcomes are grouped through joins. Database constraints enforce valid categories, non-negative financial values, bounded food-security scores, and one response per participant per round.

The migration creates the schema and deterministically generates 1,800 synthetic participants—600 per arm—plus two synthetic survey rounds. This makes local, CI, and production environments reproducible without committing a large fabricated data file.”

**On screen:** Show the architecture and entity-relationship diagrams in `docs/report.md`, or prepared slides based on them.

## 5:50–7:05 — Security, ethics, and scalability

“The system applies privacy by data minimisation. It stores no participant names, phone numbers, exact household coordinates, government IDs, payment credentials, or public participant rows. Aggregate CSV export is available, but an individual export is not.

Security controls include a Content Security Policy, clickjacking and MIME-sniffing protection, restricted browser permissions, no-store API caching, bounded streaming input, strict validation, constant-time token comparison, prepared SQL, generic public error responses, and structured logs that exclude notes and credentials.

Cloudflare Workers supplies managed TLS and horizontal edge execution. The Worker itself is stateless; D1 contains the durable records. Queries return a small fixed number of aggregate rows, so response size does not increase with every participant. Logs and sampled traces are enabled.

A real research deployment needs more governance: ethics approval, informed consent and withdrawal procedures, a data-protection impact assessment, organisational single sign-on, role-based permissions, audit trails, retention policy, disclosure controls, and an approved statistical analysis plan. The current shared secret is suitable for this prototype, not a multi-partner production trial.”

**On screen:** Scroll to the green “Research ethics by design” panel, then download the aggregate CSV and show that it contains only study-arm summaries.

## 7:05–8:15 — Engineering quality and deployment

“The project includes automated verification. TypeScript checks the frontend and Worker separately. A focused Vitest test covers the observation validator because that is the main untrusted write boundary. The production Vite build and Wrangler deployment dry run are also automated.

Two GitHub Actions workflows are included. Pull requests and pushes install from the lockfile, generate Cloudflare types, type-check, test, build, and validate the deploy bundle. The main branch workflow repeats the checks, applies D1 migrations, and deploys through the official Wrangler action. Cloudflare and GitHub hold credentials as secrets rather than source files.

During final verification, types passed, the validation test passed, the production build completed, migrations succeeded locally and remotely, and public smoke tests confirmed the site, health endpoint, dashboard API, CSV export, security headers, and protected-write rejection.”

**On screen:** Show the GitHub workflow files or a terminal screenshot with the passing commands. Return to the live dashboard.

## 8:15–9:15 — Evaluation and limitations

“The main strength of Nyungwe Nexus is that it delivers a complete vertical slice: research justification, professional UI, relational database, secure API, testing, CI/CD, and public cloud deployment. It communicates a complex interdisciplinary study without claiming an answer before the evidence exists.

Its main limitation is also explicit: all outcomes and observations are synthetic. There are no real users, causal estimates, remote-sensing feeds, offline forms, multilingual content, or formal allocation and missing-data workflows. The current JavaScript is about 222 kilobytes compressed; if testing on constrained connections identifies a problem, charts and the modal can be deferred into separate bundles.

The next step is not simply more features. It is stakeholder and ethics review to decide what may be collected, how long it may be retained, what minimum group size may be released, and who may access which fields. Technical identity and approved ingestion can follow those decisions.”

## 9:15–9:45 — Close

“In conclusion, Nyungwe Nexus demonstrates how a modern cloud system can support research at the intersection of poverty reduction and nature conservation. It is scalable, deployable, tested, and privacy-conscious, but careful about the boundary between monitoring and evidence.

The public application, source code, 2,500-to-3,500-word report, architecture diagrams, and deployment workflows are all included in the submission. Thank you.”

**On screen:** Leave the live application title and public URL visible.

## Recording checklist

- Use a 1920×1080 recording with browser zoom around 90–100%.
- Hide bookmarks, notifications, account details, tokens, and terminal credentials.
- Pre-open the live app, report diagrams, workflow file, and passing test output.
- Do not enter or display the production `RESEARCH_TOKEN`.
- Keep the synthetic-data warning visible when discussing chart values.
- Export the aggregate CSV before recording once to confirm downloads are allowed.
- Aim for 9:45 so normal pauses keep the final recording near 10 minutes.
