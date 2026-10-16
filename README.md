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

## Co-worker app (optional)

The AI Assistant's **Co-worker** tool can open web pages, drive a browser window and create Word documents on the user's computer. A web page cannot do that by itself, so it works through a small Windows app (`COWORKER/`) that runs on the user's own computer, listens only on `127.0.0.1`, and only offers a fixed list of actions. The user chooses how much it asks (every action, only important ones, or everything except creating) next to the Co-worker chip. Whatever they choose, it never deletes anything and always asks before it creates a file or submits something in a page. In a browser task it works like a tester: a visible Co-worker pointer clicks and types, and it can list the inputs and buttons on a page, run pass/fail checks and report page errors. It can also write the results as an Excel test case document in its workspace folder and return the file path. Typing and chatting in its own browser (for example testing a chatbot) does not ask per message; creating a file still asks.

**For users (no commands):** in WorkZen open **AI Assistant**, press **Co-worker** at the bottom of the chats panel, press **Download for Windows**, open the downloaded file and press **Install**. WorkZen notices the app by itself; press **Connect** and answer **Yes** to the Windows question. The app then starts with Windows and shows a small icon near the clock (open its folder, disconnect, uninstall, quit). It needs Google Chrome or Microsoft Edge for browser tasks.

**For administrators:**

```powershell
cd COWORKER
Copy-Item .env.example .env
```

Set `COWORKER_ALLOWED_ORIGINS` in `COWORKER/.env` to the address WorkZen is served from, then build the single-file app (the build bundles that `.env`):

```powershell
.\build.ps1
```

This creates `COWORKER/dist/WorkZenCoworker.exe`. Offer it to users by setting one of these in `BE/.env`: `COWORKER_INSTALLER_PATH` (the back end serves the file at `/api/v1/assistant/coworker/installer`) or `COWORKER_DOWNLOAD_URL` (a link where you host it). Files the Co-worker creates go to `~/WorkZen Co-worker` (`COWORKER_WORKSPACE`). `COWORKER_LAUNCH_APPS=false` stops it opening Word or the default browser, and `COWORKER_HEADLESS=true` runs its browser without a window.

**Updating.** The app does not update itself. After a new build (`.\build.ps1`) the back end serves the new file; users see "The Co-worker app on this computer is out of date" in the AI Assistant, download it and open it, and answer Yes to "Update now?". The old copy is closed and replaced and their documents are kept. Raise `APP_VERSION` in `COWORKER/app/main.py` and `COWORKER/version_info.txt` for every release.

**"Not commonly downloaded" warning.** An unsigned app that few people have downloaded makes the browser (Edge/Chrome) and Windows SmartScreen show "isn't commonly downloaded" or "Windows protected your PC". Users can continue (Keep, then More info, then Run anyway; the setup dialog explains this), but the warning only goes away for good by one of these:

- **Sign the app** with a code-signing certificate, then let it build reputation. An EV certificate, or Azure Trusted Signing, is trusted by SmartScreen immediately; a standard (OV) certificate builds reputation over some weeks of downloads. Set these before `.\build.ps1` and the build signs the file (it only warns when nothing is set):
  - `COWORKER_SIGN_PFX`, `COWORKER_SIGN_PASSWORD` and `COWORKER_SIGN_TIMESTAMP` (for example `http://timestamp.digicert.com`) for a certificate file, or
  - `COWORKER_SIGN_COMMAND` for any other signer, with `{file}` standing for the exe, for example the `signtool` command that your Azure Trusted Signing or hardware-token setup provides.
- **Install it from IT** so users never download it: the exe has silent switches, `WorkZenCoworker.exe --install` (installs for the signed-in user without questions, starts with Windows, then starts) and `--uninstall`. Because it installs per user (`%LOCALAPPDATA%` and the user's Run key), deploy it in the **user** context, for example an Intune Win32 app with install context "User" or a logon script from group policy. IT can also allow-list the file or its signer in SmartScreen / Defender policy.

**For developers:** run it from source in a terminal with `.\.venv\Scripts\python.exe -m app` (after `python -m venv .venv` and `.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt`). Use `COWORKER_PAIRING_PROMPT=false` only for automated tests: normally the Windows question must be answered. Run its tests with `.\.venv\Scripts\python.exe -m pytest`.
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
