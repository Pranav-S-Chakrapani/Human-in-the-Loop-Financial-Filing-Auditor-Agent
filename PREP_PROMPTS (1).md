# PREP_PROMPTS.md — Everything Antigravity can do BEFORE the build starts

Rule reminder: "all code must be written during the hackathon". These prompts produce **data, notes, environment setup and docs only**. Any helper script an agent writes for prep must live **outside the repo** (e.g. `~/prep_tmp/`) or be run inline, and must **not be committed**. Only commit the data files and notes listed below.

## What YOU do by hand (agents can't)

1. Get the Groq key (console.groq.com) and Gemini key (aistudio.google.com/apikey).
2. Paste them into `.env` yourself. Never paste keys into a prompt.
3. Install Python 3.11+, Node 20+, Git if missing; sign in to Antigravity.
4. In Antigravity, set `RULES.md` as workspace rules (or let Prompt P1 create `AGENTS.md`).
5. Read each agent's output and approve it before moving on.

## Order and timing

| # | Prompt | Run | ~Time |
|---|---|---|---|
| P1 | Environment + folder setup | first, alone | 10 min |
| P2 | Dependency pinning + API doc check | after P1 | 10 min |
| P3 | Download SEC data | parallel with P2 | 10 min |
| P4 | Audit each filing | after P3 | 15 min |
| P5 | Ground-truth concept map | parallel with P4 | 10 min |
| P6 | Demo-machine rehearsal setup | after P1 | 5 min |
| P7 | Final prep commit + gate | last | 5 min |

---

## P1 — Environment and folder setup

```
You are helping prepare a 24-hour hackathon project (PS-01 Financial Filing Auditor). Do NOT write any project code. Setup only.

Read RULES.md, SPEC.md §4 (repo layout) first.

1. Detect my OS. Report versions of: python, node, npm, git. If any is missing or too old (need Python >=3.11, Node >=20), tell me exactly how to install it for my OS and STOP.
2. In the workspace root, create the empty directory layout from SPEC.md §4 (backend/app/graph/nodes, backend/app/api, backend/tests, frontend, eval, data/fixtures, data/cache) with .gitkeep files where needed.
3. Create .gitignore covering: .env, *.db, *.db-wal, *.db-shm, __pycache__/, .venv/, node_modules/, dist/, data/cache/, .DS_Store.
4. Create .env.example with placeholders only:
   GROQ_API_KEY=
   GEMINI_API_KEY=
   EDGAR_USER_AGENT=FilingAuditor your_real_email@example.com
   Do not create or print a real .env. If .env exists, never print its contents.
5. Copy RULES.md to AGENTS.md at the repo root (same content).
6. Create a Python venv at backend/.venv. Do not install packages yet.
7. git init (if needed), set main branch, make a first commit "prep: layout" with only layout files, the four spec/prompt files and .gitignore.
8. Write LOCAL_NOTES.md containing: my OS, how to activate the venv on this OS, and the EXACT command on this OS to hard-kill a process (the equivalent of kill -9: for Windows use taskkill /F /PID <pid>, for macOS/Linux kill -9 <pid>) plus how to find a process by port 8000.
Report what you did and anything that failed.
```

## P2 — Dependency pinning and API-drift check

```
Do NOT write project code. Research and setup only.

Goal: avoid API-drift surprises during the hackathon.

1. Inside backend/.venv install: fastapi, uvicorn[standard], langgraph, langgraph-checkpoint-sqlite, httpx, beautifulsoup4, lxml, pandas, pydantic, pyyaml, pytest, pytest-asyncio, python-dotenv, groq, google-genai. Then `pip freeze > backend/requirements.txt`. Verify each imports without error (use inline python -c, not saved files).
2. Verify against the INSTALLED version's source or docs (not memory) and write backend/../docs/langgraph_notes.md with the exact, working import paths and call signatures for:
   - interrupt(), Command(resume=...)
   - AsyncSqliteSaver (import path, how to create it from a connection string, how to use it as an async context manager inside FastAPI lifespan)
   - how to resume a paused thread, how to detect that a run is paused (the "__interrupt__" key / state.next), and how to resume an unfinished run with ainvoke(None, config)
   - how multiple parallel branches joining at one node are declared
   Include a tiny verified snippet for each (documentation only, put it in the md file; do not create runnable project files).
3. KNOWN ISSUE: `llama-3.3-70b-versatile` was deprecated by Groq on 2026-08-16 and no longer works — do not use it. Using my GROQ_API_KEY and GEMINI_API_KEY from .env (never print them), call Groq's models endpoint to list currently available models and confirm `openai/gpt-oss-120b` (or a newer equivalent if that too has since changed) actually responds. Do the same for Gemini and confirm `gemini-2.5-flash` responds. Tell me the current best choice for fast JSON-mode extraction from financial tables, including documented rate limits for the free tier. Record in docs/llm_notes.md: chosen model ids, rate limits, whether JSON mode is supported, and one successful 1-line test call result for each provider (print only the model reply, never the key).
4. In the same file, flag any difference from SPEC.md §3 (for example a renamed model) so I can update config.yaml.
5. Install frontend dependencies is NOT part of this prompt.
Report discrepancies clearly.
```

## P3 — Download SEC data (fixtures)

```
Research/data task. Do NOT write project code; use curl/inline commands or a throwaway script outside the repo that will not be committed.

EDGAR rules: every request must send the header User-Agent from EDGAR_USER_AGENT in .env; keep under 8 requests/second (sleep >=0.2s between calls); never hammer on failure (exponential backoff, max 3 tries).

1. Download https://www.sec.gov/files/company_tickers.json to data/fixtures/company_tickers.json.
2. For these tickers: AAPL, MSFT, KO, NKE, PEP, JNJ, GOOGL, AMZN — resolve CIK from the ticker map (10-digit zero padded) and download:
   - https://data.sec.gov/submissions/CIK##########.json  -> data/fixtures/<TICKER>/submissions.json
   - https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json -> data/fixtures/<TICKER>/companyfacts.json
3. From each submissions.json find the MOST RECENT filing with form exactly "10-K" (not 10-K/A, not 10-KT). Record accessionNumber, filingDate, reportDate, primaryDocument.
4. Download that filing's primary document HTML from https://www.sec.gov/Archives/edgar/data/<CIK without leading zeros>/<accession without dashes>/<primaryDocument> to data/fixtures/<TICKER>/10k.html.
5. Sanity-check each download: file size > 200KB, HTML contains "CONSOLIDATED BALANCE SHEETS" (case-insensitive), and companyfacts.json contains us-gaap data. Re-download if not.
6. Print a table: ticker, company name, CIK, accession, filing date, report (fiscal year end) date, file sizes, pass/fail. If a ticker fails, say why and suggest a replacement.
Do not commit yet.
```

## P4 — Audit each filing (the analysis that decides your company list)

```
Research task on the files in data/fixtures/<TICKER>/. Do NOT build extraction code for the project; use throwaway inline analysis outside the repo. This is to choose companies and pre-empt edge cases.

For each ticker's 10k.html, read the visible text only (ignore inline-XBRL tags) and report:
1. Statement titles found: balance sheet, income statement, cash flow statement (exact headings).
2. Units/scale ("in millions", "in thousands") for each statement and whether EPS is stated separately.
3. Period columns for each statement (labels and how many).
4. Balance sheet: is there a "Total liabilities" row? A non-controlling-interest row? What is the exact label for shareholders' equity (parent-only vs total incl. NCI)?
5. Income statement: exact labels for revenue, gross profit (absent?), net income (attributable to parent vs consolidated), diluted EPS.
6. Cash flow statement: exact label for operating cash flow, and the first line of operating activities (starts from net income? which net income?).
7. Does the filing contain a segment revenue table? Does the sum of segments equal total revenue? (note any reconciling items)
8. Anything weird: multi-row headers, split tables, negative numbers in parentheses, footnote markers in numbers, revenue labelled differently.
Then produce:
- PREP_REPORT.md: one section per company with the above, plus a verdict: CLEAN / MESSY(reason) / REJECT(reason).
- Recommend the final list of 8 companies: 5 clean + 2-3 messy (messy = no Total liabilities, NCI present, no segment table, or big YoY swing), all reporting all 8 metrics unless intentionally chosen as the "not reported" example. Explain each choice in one line.
- companies.json at repo root: array of {ticker, name, cik, accession, filing_date, report_date, primary_document, fixture_path, notes:{has_total_liabilities, has_nci, has_gross_profit, has_segment_table, scale, equity_label, revenue_label, net_income_label}}.
Show me the table of verdicts. Do not commit.
```

## P5 — Ground-truth concept map (research only; this is for the verifier later)

```
Research task using data/fixtures/<TICKER>/companyfacts.json and companies.json. Throwaway inline analysis only; do not create project code.

For each company and its pinned accession + fiscal year end, find which us-gaap concept actually carries each of the 8 metrics in Company Facts:
revenue, net_income (attributable to parent), total_assets, total_liabilities, shareholders_equity (parent), operating_cash_flow, gross_profit, diluted_eps.
For each metric report: the concept name, units (USD / USD-per-shares), the matching fact for the pinned accession and fiscal-year end (value, start, end, accn, form, fy, fp), and the prior-year value from the same filing if present. Flag metrics where no concept matches (e.g. no Liabilities fact) and note the likely reason.
Check for traps: duplicate facts for the same period with different accn, restated values, multiple revenue concepts across years, duration facts with non-annual spans, EPS reported under a different concept.
Output docs/groundtruth_map.md (table per company) and a machine-readable data/fixtures/groundtruth_map.json {ticker: {metric: {concept, current:{value,end,accn}, prior:{value,end,accn}|null}}}.
Do not modify companies.json. Do not commit.
```

## P6 — Demo-machine rehearsal setup

```
Setup/checklist task; no project code.
1. Read LOCAL_NOTES.md. Create REHEARSAL.md with a step-by-step checklist for the demo machine: how to start backend (no --reload) and frontend, how to find and hard-kill the backend process on this OS, how to restart it, how to confirm the port is free, where cached data lives, and what to do if venue Wi-Fi fails (use cached fixtures, Gemini fallback, pre-recorded video).
2. Verify ports 8000 and 5173 are free; report if something already uses them.
3. Run a trivial throwaway Python process on this OS, find its PID, kill it with the OS hard-kill command from LOCAL_NOTES.md, and confirm it died. Report the exact commands that worked.
4. Create a "backup plan" section: what to cut first if behind (MCP wrappers, adaptive thresholds, intro parallax, segment validation to a skip flag, companies down to 5), and what must never be cut (kill-resume, calibration/confusion report, audit chain).
```

## P7 — Final prep commit and readiness gate

```
Final prep check; no project code.
1. Confirm these exist and are non-empty: SPEC.md, CONTRACT.md, RULES.md, AGENTS.md, ANTIGRAVITY_PROMPTS.md, companies.json, PREP_REPORT.md, docs/langgraph_notes.md, docs/llm_notes.md, docs/groundtruth_map.md, data/fixtures/groundtruth_map.json, LOCAL_NOTES.md, REHEARSAL.md, backend/requirements.txt, and for each chosen company data/fixtures/<TICKER>/{10k.html,companyfacts.json,submissions.json}.
2. Confirm .env is NOT tracked by git and no secret appears in any tracked file (grep for the key prefixes without printing matches).
3. Check total size of data/fixtures; if any single file is over 90MB warn me (git limits). companyfacts.json files are large: add them to .gitignore if the repo would exceed ~300MB, but keep them on disk.
4. Commit everything allowed with message "prep: fixtures, notes, pins" and tag `prep`.
5. Print a READY / NOT READY summary listing any missing item and what I must do by hand (keys, installs).
```

---

## After prep: the 12:00 sequence

Use `ANTIGRAVITY_PROMPTS.md`: Prompt 1 (scaffold) → then BACKEND G1, FRONTEND, EVAL in parallel.

One change to Prompt 1 now that prep exists: tell the agent "Prep is already done: layout, venv, requirements.txt, companies.json and fixtures exist. Read docs/langgraph_notes.md and docs/llm_notes.md and use the verified imports and model names instead of assuming." Paste that line at the top of every build prompt.
