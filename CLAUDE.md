# WorkZen

AI-assisted workspace for company departments, built department by department. First module: RecruiteOne (HR applicant tracking). See README.md for run commands.

## Layout

- `BE/` back end (FastAPI), `USERFE/` front end (React + Vite + TypeScript). These two names are fixed.
- Back end layers: `api/` → `services/` → `repositories/` → `integrations/`, with `schemas/` and `agents/`. Each layer holds a subpackage per module (`recruiteone/`), so a new department is additive.
- Front end is one web app with a persistent sidebar: Home, Departments (each expands to its tools), General tools. A tool's own functions appear as a top tab bar inside the tool (`layouts/ToolLayout.tsx`), not in the sidebar.
- `src/modules/registry.ts` is the single source for the sidebar, home page, breadcrumbs and "coming soon" pages. To add a department, tool or general tool, add an entry there. Planned entries link to `/soon/:id`.
- Tool URLs follow `/<department>/<tool>/<function>`, for example `/hr/recruiteone/jds`.
- `src/modules/<tool>/` holds pages, components, data and types for one tool. Shared pieces live in `src/components/ui` and `src/components/layout`.

## Stack decisions

- LangGraph is the core agent framework. Chat model and evaluators come from Azure AI Foundry (model deployment name is set in `.env`).
- Azure Cosmos DB is the main database, Azure Blob Storage stores files.

## Back end rules

- No comments or docstrings in Python code.
- Use plain, descriptive function names. Never start a function name with an underscore.
- Never hardcode keys, secrets or endpoints. Everything goes in `.env` and is read through `app/core/config.py`. Keep `.env.example` in sync.

## Front end rules

- UI must look professional, clear and easy to navigate.
- Theme is strictly black and white (grays only). No purple, yellow or other accent colors. Status is shown with fill, outline and weight (filled black = positive, outline = negative, gray = neutral), not hue.
- Dense and professional: 8px outer margin, 12px gaps, 8-12px corner radius, 14px base text, 13px tables. Do not add generous padding or large rounded shapes.
- Source Serif 4 for page titles, card titles and big numbers, Inter for everything else.
- Layout (RevenueX template): a flush frosted sidebar on a light gray gloss background, and one white content panel that scrolls on its own. The panel starts with a flat top bar that stays pinned: tool sub-navigation (Dashboard, JDs, Vacancies...) on the left, notifications, settings and account on the right. A small breadcrumb line sits above the page title. The sidebar holds navigation only.
- Design tokens live in `src/styles/tokens.css`. Reuse them instead of new colors. The `accent-*`, `green-*`, `amber-*` and `coral-*` token names are kept for compatibility but map to grays.
- JDs, vacancies and candidates live in one browser store (`modules/recruiteone/state/RecruiteOneStore.tsx`), seeded from sample data and saved to localStorage, so data survives reloads and the public application link works in a new tab of the same browser. It is not shared between people or devices. Only the AI decomposition (`POST /api/v1/recruiteone/jds/decompose`) calls the back end.
- Vacancy popup flow: name, then a searchable pick of non-deleted JDs, then two independent optional choices: Shareable link (closing date required, generates `/apply/<token>`) and Schedule pipeline (name, description, stages with max candidates and interviewers; HR people are the default interviewers). Saving leads to an "Upload CVs now" action. From a JD the same popup opens with the JD preselected and an extra tab listing that JD's vacancies. `/apply/:token` is the public application page (JD details, application form, CV upload).
- CV batches: Upload CVs asks for a vacancy, a batch name, files and/or applications fetched from the shared link (link applications wait unbatched until fetched). Each CV in a batch is scored by the back end (`POST /api/v1/recruiteone/scoring/cv`, multipart file + JD) with 8 benchmark scores and reasoning; the overall score is the weighted average using the JD weights, ignoring benchmarks the JD does not list. The vacancy popup CVs tab drills batches > sorted CV list > per-benchmark reasoning. CV files are kept in IndexedDB (`lib/cvFiles.ts`) so they can be viewed and rescored. Excel export (top N, `services/exportExcel.ts`) loads exceljs lazily.
- Tabs of RecruiteOne: Dashboard, JDs, Vacancies, CV Pool, Interviews. There is no Evaluate tab: scoring happens when CVs enter a batch, and re-evaluation is done from the CV Pool.
- CV Pool drills vacancies > batches > CVs (state in URL params `vacancy` and `batch`). Ticking CVs marks them selected for interview. Selected CVs are never re-evaluated and are listed separately with the role and pipeline details. "Close collection" needs a pipeline and at least one selected CV, locks uploads, the pipeline and the shared link, and creates an Interview.
- Pipeline stages have a schedule date. Interviews live under the Interviews tab. HR users (department Human Resources) see every interview and every interviewer's scorecard and scores, combine them (average of each interviewer's percentage) and pass or reject candidates stage by stage. An interviewer assigned to a stage sees only that interview and stage, defines their own scorecard (criteria and highest score) and scores candidates beside the CV; nobody else's scorecards or scores are shown to them. This is enforced in the UI only until real sign-in exists. The top-right user menu is a demo "view as" switch (`state/CurrentUser.tsx`).
- Sample (seeded) candidates have generated sample scores and no stored file; only uploaded and link-applied CVs call the scoring endpoint and can be viewed.
- Pages with a main table (JDs, Vacancies, CV Pool) use `PageLayout fill`: the page never scrolls, only the table body does, with a sticky header. Popups blur everything behind them, and every popup (wizards, tabs, confirmations, viewers) has the same fixed width and height (960x680, shrinking only to fit the screen). Content scrolls inside the popup; never size a popup to its content.
- Status badges never use a black fill, so they cannot be mistaken for buttons.
- A JD has 8 requirement buckets (technical skills, soft skills, experience, responsibilities, education, certifications, job requirements, extra-curricular) and a 0-100 weight per bucket, default 50. JD status is derived: Published = has an open or on-hold vacancy, Draft = never had a vacancy, Deleted = soft deleted.
- Other pages currently use sample data from `src/modules/recruiteone/data`. Field names mirror the API (snake_case) so wiring up the real API needs no mapping.
- Interview page: stage tabs mark the Current stage (furthest stage with active candidates) and Done stages; the right-side nav is Overview | Create scorecard | Score candidates | Results. HR sees Overview (all candidates, per-interviewer %, View CV, pass/reject), Create scorecard (common scorecard for the stage, plus a personal one if HR is assigned), Score candidates (also for HR; a scorer who is not an assigned interviewer is added to that stage's score columns) and Results (HR only: ranking, per-interviewer scores, previous-stage score, selection by top N or manual ticks, optional reject-the-rest, limited to the places left in the next stage or the vacancy openings). Assigned interviewers see only Create scorecard (their own; the common one read-only) and Score candidates (candidates left, CV in the middle, scorecard right; the panes are resizable via `components/ui/ResizableColumns.tsx` and widths persist). An interviewer scores with their own scorecard if they have one, otherwise the common one. Interview components live in `modules/recruiteone/components/interview/` and shared math in `services/interviewMath.ts`.
