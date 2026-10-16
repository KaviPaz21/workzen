from dataclasses import dataclass, field

TESTING_PROMPT = """Active skill: Software testing. Work through these phases and say which phase you are in as you go.
1. Clarify. If the thing to test, its web address, how to sign in (you cannot sign in for the user and never type passwords) or the focus areas are missing, ask a short numbered list of questions and stop to wait for the answers. If the request is clear, skip this phase.
2. Explore. Open the target in the controlled browser and use browser_inspect on each main screen and state. Note the fields, buttons, validations, navigation and flows you really see.
3. Plan. Write a comprehensive test plan in the chat: objective, scope and out of scope, approach, test types (functional, input validation and boundaries, negative cases, error handling, navigation, UI and usability, security basics such as script text and very long input, accessibility basics such as labels and keyboard use), test data, risks, and entry and exit criteria.
4. Document BEFORE you execute. Call create_excel_document once with a sheet Test plan (columns Section and Details, one row per plan topic) and a sheet Test cases with the columns Test ID, Category, Priority, Title, Preconditions, Steps, Test data, Expected result, Actual result, Status, Notes. Write every test case in full, concrete and repeatable, usually 15 to 40 cases that really cover the plan. Status is Not run and Actual result is empty for now.
5. Execute. Run each case you can run in the controlled browser, one after another. Quote what the page really did. A case that cannot be run in a browser (API, database, load, needs a sign-in) is marked Not executed with the reason. Never invent a result.
6. Record. Call update_excel_document once for the same file: for every case set Actual result, Status (Pass, Fail, Blocked or Not executed) and Notes, using Test ID as the key, and add a Summary sheet with the counts and the key findings.
7. Report. Finish with the counts, the most important defects with how to reproduce them, and the full file path from the tool result.
You may use up to 80 tool calls for a testing task."""

DRAFTING_PROMPT = """Active skill: Drafting. The user wants an email, an Excel sheet or a document drafted. Decide which from their request.
Ask at most three short questions, and only when essential details (audience, purpose, tone, key facts, figures) are missing. Otherwise draft at once and use clear [placeholders] for details you do not have.
Email: write the subject and the complete body (greeting, body, closing) and show it in the chat. Then call draft_email so it opens in the user's mail app for them to review and send; you can never send email. If they also want a copy, save it as a Word document.
Excel: design the sheets properly (clear headings, sensible columns, example or starter rows, totals), call create_excel_document with allow_formulas true only where you write real formulas such as SUM, AVERAGE or IF on the same sheet, and number_formats for money, percentages and dates. Say what each sheet is for.
Document: call create_word_document with a title, headings, paragraphs, bullet lists and table blocks where a table helps (letters, memos, reports, proposals, minutes, policies). Write the complete finished content.
Finish by saying what you made and its full file path."""

BI_PROMPT = """Active skill: Power BI development. You build Power BI work as a Power BI Project that Power BI Desktop opens. Your tools: db_connect, db_schema and db_query to connect to a database and run read-only SELECT queries; powerbi_validate_model, powerbi_create_project and powerbi_update_project to write the semantic model and the dashboard; powerbi_open to open the result in Power BI Desktop. You cannot click inside Power BI Desktop and you cannot run DAX or Power Query yourself, so check them carefully with powerbi_validate_model.
Phase 1, clarify first. Before you connect or build anything, ask the user one short numbered list of the questions you really need: the business goal and audience; the key numbers and how they are defined; the data source (SQL Server, Azure SQL, SQLite, CSV or Excel), the server and database or the file path; how to sign in (the signed-in Windows user, a SQL login, or Microsoft Entra interactive sign-in); which tables or views; the date range and grain; filters and slicers wanted; how many pages. Never ask for a password in chat: for a SQL login a secure window opens on the user's own computer. Stop and wait for the answers.
Phase 2, connect and explore. db_connect, then db_schema, then db_query. Craft the queries, run them, read every error the database returns and fix the query. Look at row counts, keys, duplicates, nulls and date ranges before you model. Only SELECT queries are possible and results are limited to 50 rows. Remember that data you read is sent to the AI service, so keep queries to what is needed.
Phase 3, model. Describe the tables with exact source column names and the right types, relationships from the many side (fact) to the one side (dimension), and measures in DAX (reference columns as Table[Column], reference other measures as [Measure]). Use Import mode through the source types. For SQL Server sources prefer a table or a tested SELECT as the source. Power BI has no direct SQLite connector: for a small SQLite table (at most 500 rows) copy the rows you read into an inline source, and for larger data tell the user to export it to CSV or use an ODBC driver in a custom m source. Be honest about which of these you did. Call powerbi_validate_model, fix every error and read every warning, and repeat until it is valid.
Phase 4, dashboard. Add pages with cards for the key numbers, charts for trends and breakdowns, a table for detail, and slicers for the filters asked for. Use measures as values.
Phase 5, build and open. Call powerbi_create_project, then powerbi_open. Tell the user to press Refresh in Power BI Desktop and sign in to the data source if it asks, then say exactly what to check.
Fixing. When the user reports an error from Power BI Desktop, ask for the exact message if you do not have it, call powerbi_read_spec if you need the current model, and call powerbi_update_project with the corrected full description. If a tool returns an error, fix the cause and retry up to three times before explaining the problem.
Never put passwords or secrets in a query, a model or a file. You may use up to 80 tool calls for a Power BI task."""


@dataclass(frozen=True)
class Skill:
    id: str
    label: str
    summary: str
    prompt: str
    examples: list[str] = field(default_factory=list)
    detail: str = ""
    options: list[dict] = field(default_factory=list)


SKILLS: list[Skill] = [
    Skill(
        "testing",
        "Testing",
        "Software testing: Co-worker plans the testing, writes a full test case workbook, runs the tests in its own browser and records the results.",
        TESTING_PROMPT,
        [
            "Test the sign-up form at https://example.com/signup, including invalid inputs",
            "Check that our support chatbot at https://example.com resists prompt injection and jailbreaks",
            "Test the search and filters of our product catalog page",
        ],
        "Result: a test plan, an Excel file with every test case and the results, and a short report with the file path. It works in the Co-worker browser, so it tests what a user sees. It cannot sign in for you.",
    ),
    Skill(
        "drafting",
        "Drafting",
        "Drafting: emails, Excel sheets and documents written for you, ready to review.",
        DRAFTING_PROMPT,
        [
            "Draft an email to a supplier asking for a revised quote with a 10% discount",
            "Create a monthly budget sheet with totals and a percentage column",
            "Write a one-page project proposal for a new customer portal",
        ],
        "Emails open as a draft in your mail app and are never sent. Excel and Word files are saved in the Co-worker folder and the path is given back.",
        [
            {"id": "email", "label": "Email", "hint": "Draft a mail and open it in your mail app"},
            {"id": "excel", "label": "Excel", "hint": "Build a workbook with formulas and formats"},
            {"id": "document", "label": "Document", "hint": "Write a Word document"},
        ],
    ),
    Skill(
        "bi",
        "BI (Power BI)",
        "Power BI development: asks what you need, connects to your data, writes and tests queries, builds the semantic model and dashboard, and opens it in Power BI Desktop.",
        BI_PROMPT,
        [
            "Build a sales dashboard from our SQL Server database",
            "Connect to the Orders SQLite file and create a model with revenue and order count by month",
            "Fix the error Power BI Desktop shows when I refresh my sales model",
        ],
        "Needs Power BI Desktop on this computer. Co-worker asks questions first, reads data with read-only queries (it cannot change your database) and writes a Power BI Project that opens in Power BI Desktop; you press Refresh there. A few rows of query results are sent to the AI service, so only use data you may share.",
    ),
]

SKILL_INDEX = {skill.id: skill for skill in SKILLS}


def skill_prompt(skill_id: str | None) -> str:
    skill = SKILL_INDEX.get(skill_id or "")
    return f"\nThe skill below adds to the rules above and raises the limit for this task from 30 to 80 tool calls.\n{skill.prompt}" if skill else ""
