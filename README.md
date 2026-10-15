# WorkZen

AI-assisted workspace for company departments. The first module is **RecruiteOne**, an applicant tracking system for HR.

| Folder | What it is |
| --- | --- |
| `USERFE/` | Front end: React, TypeScript, Vite |
| `BE/` | Back end: FastAPI, LangGraph, Azure Cosmos DB, Azure Blob Storage, Azure AI Foundry |
| `COWORKER/` | Optional helper app that runs on a user's own computer so the AI Assistant's Co-worker can do small tasks there |

## Run the back end

```powershell
cd BE
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Fill in `BE/.env` with your Azure values. The API starts without them: `GET /api/v1/health` reports which services are configured, and data endpoints return `503` until Cosmos DB is configured. Interactive docs are at `http://localhost:8000/docs`.

Run the tests (no Azure access needed):

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Run the front end

```powershell
cd USERFE
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. Requests to `/api` are proxied to the back end address in `USERFE/.env`. The app starts empty: there is no sample data. JDs, vacancies, CVs, interviews and scores are stored in Cosmos DB and Blob Storage, so the back end must have both configured. Adding a JD with AI and scoring CVs also need Azure AI Foundry settings in `BE/.env`.

## Run the Co-worker helper (optional)

The AI Assistant's **Co-worker** tool can open web pages, drive a browser window and create Word documents on the user's computer. A web page cannot do that by itself, so it talks to a small helper that runs locally, listens only on 127.0.0.1, needs a pairing code, and only offers a fixed list of actions (every action is shown to the user first and runs only after they press Allow). It needs Google Chrome or Microsoft Edge installed.

```powershell
cd COWORKER
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m app
```n
The helper prints a pairing code. In WorkZen open **AI Assistant**, press **Co-worker** at the bottom of the chats panel and paste the code. Files the Co-worker creates go to `~/WorkZen Co-worker` (change it with `COWORKER_WORKSPACE`). Set `COWORKER_LAUNCH_APPS=false` to stop it opening Word or the default browser, and `COWORKER_HEADLESS=true` to run its browser without a window. Run the helper's tests with `.\.venv\Scripts\python.exe -m pytest`.

## Navigation

The sidebar is the map of the whole product: **Home**, **Departments** (Human Resources → RecruiteOne, plus planned ones) and **General tools**. Inside a tool, its functions are tabs in a top bar that stays visible while scrolling (RecruiteOne: Dashboard, Approvals, JDs, Vacancies, CV Pool, Interviews). Vacancies can publish a public application link at `/apply/<token>`. Add new entries in `USERFE/src/modules/registry.ts`.

## RecruiteOne evaluation flow

`BE/app/agents/recruiteone/graph.py` is a LangGraph workflow:

```
START ─┬─ extract_requirements ─┐
       └─ profile_candidate ────┴─ score_match ─ quality_check ─ END
```

`POST /api/v1/recruiteone/jds/decompose` uses a second small LangGraph graph (`jd_decomposer.py`) to turn pasted JD text into a role, sector, level and eight requirement buckets. Weights saved on a JD are passed to the scoring step.

`POST /api/v1/recruiteone/scoring/cv` (`cv_scorer.py`) scores one CV file against a JD: the model rates the eight benchmarks with reasoning, then code computes the overall score as a weighted average using the JD weights.

`quality_check` runs the Azure AI Foundry relevance, coherence and groundedness evaluators on the AI assessment.
