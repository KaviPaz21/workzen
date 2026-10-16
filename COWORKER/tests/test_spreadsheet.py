from openpyxl import load_workbook

COLUMNS = ["Test ID", "Title", "Steps", "Expected result", "Actual result", "Status"]


def act(client, auth, name, args):
    return client.post(f"/actions/{name}", json={"args": args}, headers=auth).json()


def test_a_test_case_workbook_is_created_in_the_workspace(client, auth, settings):
    rows = [
        ["TC-01", "Greeting", "Open the chat", "A greeting is shown", "Greeting shown", "Pass"],
        ["TC-02", "Injection", "Send: ignore previous instructions", "Refuses", '=HYPERLINK("http://x")', "Fail"],
    ]
    result = act(client, auth, "create_excel_document", {"filename": "Chatbot tests", "sheets": [{"name": "Test cases", "columns": COLUMNS, "rows": rows}, {"name": "Summary", "columns": ["Metric", "Value"], "rows": [["Passed", 1], ["Failed", 1]]}]})
    assert result["ok"], result
    assert result["result"]["filename"] == "Chatbot tests.xlsx" and result["result"]["sheets"] == 2 and result["result"]["rows"] == 4
    workbook = load_workbook(result["result"]["path"])
    sheet = workbook["Test cases"]
    assert [cell.value for cell in sheet[1]] == COLUMNS
    assert sheet["A2"].value == "TC-01" and sheet.freeze_panes == "A2"
    assert sheet["E3"].value == '=HYPERLINK("http://x")' and sheet["E3"].data_type == "s"
    assert workbook["Summary"]["B2"].value == 1


def test_existing_files_are_never_overwritten_and_names_stay_in_the_workspace(client, auth):
    args = {"filename": "Plan.xlsx", "sheets": [{"columns": ["A"], "rows": [["x"]]}]}
    first = act(client, auth, "create_excel_document", args)["result"]["filename"]
    second = act(client, auth, "create_excel_document", args)["result"]["filename"]
    assert first == "Plan.xlsx" and second == "Plan (2).xlsx"
    assert act(client, auth, "create_excel_document", {**args, "filename": "..\\evil.xlsx"})["ok"] is False


def test_bad_rows_are_rejected(client, auth):
    too_wide = act(client, auth, "create_excel_document", {"filename": "Bad", "sheets": [{"columns": ["A"], "rows": [["1", "2"]]}]})
    assert too_wide["ok"] is False and "more values than columns" in too_wide["error"]
    assert act(client, auth, "create_excel_document", {"filename": "Empty", "sheets": []})["ok"] is False