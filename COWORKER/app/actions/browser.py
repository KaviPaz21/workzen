import asyncio
import re
from typing import Any, Literal

from playwright.async_api import ElementHandle, Page, Playwright, async_playwright
from pydantic import BaseModel, Field

from app.actions.errors import ActionError, ApprovalNeeded
from app.actions.page_scripts import CURSOR_SCRIPT, DESCRIBE_SCRIPT, INSPECT_SCRIPT, POINT_SCRIPT
from app.actions.safety import classify, classify_form_submit
from app.actions.system import checked_web_address
from app.config import Settings

PAGE_TEXT_CHARACTERS = 6000
BRIEF_TEXT_CHARACTERS = 2500
LINK_LIMIT = 30
FIELD_LIMIT = 15
ISSUE_LIMIT = 60
NAVIGATION_TIMEOUT_MS = 30_000
ACTION_TIMEOUT_MS = 10_000
SETTLE_TIMEOUT_MS = 5_000
CURSOR_STEPS = 18
CURSOR_PAUSE_MS = 150
SETTLE_POLL_MS = 500
SETTLE_QUIET_SECONDS = 2.0
TYPING_DELAY_MS = 20
TYPING_ANIMATION_LIMIT = 120
KEY_PATTERN = re.compile(r"^[A-Za-z0-9+]{1,20}$")
REF_PATTERN = re.compile(r"^e\d{1,6}$")

PAGE_SCRIPT = """() => {
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const links = [...document.querySelectorAll('a[href]')]
    .filter(visible)
    .map((a) => ({ text: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 80), href: a.href }))
    .filter((link) => link.text);
  const fields = [...document.querySelectorAll('input, textarea, select')]
    .filter((field) => visible(field) && field.type !== 'hidden')
    .map((field) => ({
      type: field.type || field.tagName.toLowerCase(),
      name: field.name || '',
      label: field.getAttribute('aria-label') || field.placeholder || (field.labels && field.labels[0] ? field.labels[0].innerText.trim() : '') || field.id || '',
    }));
  return { links: links, fields: fields };
}"""


class OpenArgs(BaseModel):
    url: str


class ClickArgs(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    label: str = Field(default="", max_length=120)
    allow_create: bool = False


class HoverArgs(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    label: str = Field(default="", max_length=120)


class TypeArgs(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    text: str = Field(max_length=5000)
    label: str = Field(default="", max_length=120)
    submit: bool = False
    allow_create: bool = False


class SelectArgs(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    option: str = Field(min_length=1, max_length=200)
    label: str = Field(default="", max_length=120)


class PressArgs(BaseModel):
    key: str
    allow_create: bool = False


class ScrollArgs(BaseModel):
    direction: Literal["down", "up", "top", "bottom"] = "down"
    amount: int = Field(default=600, ge=50, le=5000)


class WaitArgs(BaseModel):
    text: str = Field(default="", max_length=200)
    seconds: float = Field(default=2, ge=0, le=30)
    settle: bool = False


class InspectArgs(BaseModel):
    filter: Literal["all", "inputs", "buttons", "links"] = "all"


class Check(BaseModel):
    kind: Literal["text_visible", "text_absent", "url_contains", "title_contains", "element_visible", "element_absent", "value_equals"]
    value: str = Field(default="", max_length=500)
    target: str = Field(default="", max_length=200)


class ExpectArgs(BaseModel):
    checks: list[Check] = Field(min_length=1, max_length=20)


class EmptyArgs(BaseModel):
    pass


class BrowserController:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.playwright: Playwright | None = None
        self.browser = None
        self.context = None
        self.page: Page | None = None
        self.lock = asyncio.Lock()
        self.issues: list[str] = []

    def clip(self, text: str, limit: int) -> str:
        if len(text) <= limit:
            return text
        head = limit // 4
        return f"{text[:head]}\n[... middle of the page omitted ...]\n{text[-(limit - head):]}"

    def note_issue(self, text: str) -> None:
        if len(self.issues) < ISSUE_LIMIT:
            self.issues.append(text[:300])

    def watch(self, page: Page) -> None:
        page.on("console", lambda message: self.note_issue(f"console {message.type}: {message.text}") if message.type in ("error", "warning") else None)
        page.on("pageerror", lambda error: self.note_issue(f"page error: {error}"))
        page.on("requestfailed", lambda request: self.note_issue(f"request failed: {request.method} {request.url}"))
        page.on("response", lambda response: self.note_issue(f"http {response.status}: {response.request.method} {response.url}") if response.status >= 400 else None)
        page.on("dialog", lambda dialog: asyncio.ensure_future(self.dismiss_dialog(dialog)))

    async def dismiss_dialog(self, dialog) -> None:
        self.note_issue(f"a {dialog.type} dialog was dismissed: {dialog.message}")
        try:
            await dialog.dismiss()
        except Exception:
            return

    def follow_new_tab(self, page: Page) -> None:
        self.watch(page)
        self.page = page

    async def ensure_page(self) -> Page:
        if self.page is not None and not self.page.is_closed():
            return self.page
        if self.playwright is None:
            self.playwright = await async_playwright().start()
        if self.browser is None or not self.browser.is_connected():
            channel = None if self.settings.coworker_browser_channel == "chromium" else self.settings.coworker_browser_channel
            try:
                self.browser = await self.playwright.chromium.launch(channel=channel, headless=self.settings.coworker_headless)
            except Exception as error:
                raise ActionError(f"The browser could not be started ({self.settings.coworker_browser_channel}). {str(error).splitlines()[0]}") from error
        self.context = await self.browser.new_context(accept_downloads=False)
        await self.context.add_init_script(CURSOR_SCRIPT)
        self.context.on("page", self.follow_new_tab)
        self.issues = []
        self.page = await self.context.new_page()
        return self.page

    async def settle(self, page: Page) -> None:
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=SETTLE_TIMEOUT_MS)
        except Exception:
            return

    async def page_text(self, page: Page) -> str:
        try:
            return re.sub(r"\n{3,}", "\n\n", await page.inner_text("body", timeout=ACTION_TIMEOUT_MS)).strip()
        except Exception:
            return ""

    async def snapshot(self, page: Page) -> dict[str, Any]:
        text = await self.page_text(page)
        extras = await page.evaluate(PAGE_SCRIPT)
        return {
            "url": page.url,
            "title": await page.title(),
            "text": self.clip(text, PAGE_TEXT_CHARACTERS),
            "text_truncated": len(text) > PAGE_TEXT_CHARACTERS,
            "links": extras["links"][:LINK_LIMIT],
            "fields": extras["fields"][:FIELD_LIMIT],
        }

    async def brief(self, page: Page, **extra: Any) -> dict[str, Any]:
        text = await self.page_text(page)
        result = {
            "url": page.url,
            "title": await page.title(),
            "text": self.clip(text, BRIEF_TEXT_CHARACTERS),
            "text_truncated": len(text) > BRIEF_TEXT_CHARACTERS,
            "new_issues": len(self.issues),
        }
        result.update(extra)
        return result

    async def element_from_locators(self, locators: list) -> tuple[ElementHandle | None, int]:
        for locator in locators:
            try:
                count = await locator.count()
                if count > 0:
                    handle = await locator.first.element_handle(timeout=ACTION_TIMEOUT_MS)
                    if handle is not None:
                        return handle, count
            except Exception:
                continue
        return None, 0

    async def find_element(self, page: Page, target: str, fields: bool) -> tuple[ElementHandle, int]:
        if REF_PATTERN.match(target):
            handle = await page.evaluate_handle("(ref) => (window.__wz && window.__wz.refs.get(ref)) || null", target)
            element = handle.as_element()
            if element is None or not await element.evaluate("(node) => node.isConnected"):
                raise ActionError(f"'{target}' is not on the page any more. Inspect the page again to get fresh references.")
            return element, 1
        if fields:
            locators = [page.get_by_label(target), page.get_by_placeholder(target), page.locator(f'[name="{target}"]'), page.get_by_role("textbox", name=target)]
        else:
            locators = [
                page.get_by_role("button", name=target),
                page.get_by_role("link", name=target),
                page.get_by_role("checkbox", name=target),
                page.get_by_role("radio", name=target),
                page.get_by_role("tab", name=target),
                page.get_by_role("menuitem", name=target),
                page.get_by_label(target),
                page.get_by_text(target),
            ]
        element, count = await self.element_from_locators(locators)
        if element is None:
            element, count = await self.element_from_locators([page.locator(target)])
        if element is None:
            raise ActionError(f"Nothing on the page matches '{target}'." if not fields else f"No input on the page matches '{target}'.")
        return element, count

    async def describe(self, element: ElementHandle) -> dict:
        return await element.evaluate(DESCRIBE_SCRIPT)

    async def glide_to(self, page: Page, element: ElementHandle, label: str) -> tuple[float, float]:
        try:
            await element.scroll_into_view_if_needed(timeout=ACTION_TIMEOUT_MS)
        except Exception as error:
            raise ActionError(f"The element could not be brought into view. {str(error).splitlines()[0]}") from error
        box = await element.bounding_box()
        if not box:
            raise ActionError("The element is not visible on the page.")
        x = box["x"] + box["width"] / 2
        y = box["y"] + min(box["height"] / 2, 40)
        await element.evaluate("(node, text) => window.__wz && window.__wz.mark(node, text)", label[:60])
        await page.mouse.move(x, y, steps=CURSOR_STEPS)
        await page.wait_for_timeout(CURSOR_PAUSE_MS)
        return x, y

    async def guard_click(self, page: Page, element: ElementHandle, point: tuple[float, float], allow_create: bool, verb: str) -> dict:
        info = await self.describe(element)
        covering = await page.evaluate_handle(POINT_SCRIPT, {"x": point[0], "y": point[1]})
        top = covering.as_element()
        infos = [info]
        if top is not None:
            infos.append(await self.describe(top))
        for item in infos:
            effect = classify(item)
            if effect == "delete":
                raise ActionError(f"Co-worker cannot delete things, so it did not {verb} '{item['label'][:60]}'.")
        for item in infos:
            if classify(item) == "create" and not allow_create:
                raise ApprovalNeeded(item["label"][:60] or item["tag"], "create")
        return info

    async def open_page(self, args: dict) -> dict:
        parsed = OpenArgs(**args)
        url = checked_web_address(parsed.url)
        async with self.lock:
            page = await self.ensure_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
            except Exception as error:
                raise ActionError(f"The page could not be opened. {str(error).splitlines()[0]}") from error
            return await self.snapshot(page)

    async def read_page(self, args: dict) -> dict:
        EmptyArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            return await self.snapshot(page)

    async def inspect(self, args: dict) -> dict:
        parsed = InspectArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            found = await page.evaluate(INSPECT_SCRIPT, parsed.filter)
            return {"url": page.url, "title": await page.title(), **found}

    async def click(self, args: dict) -> dict:
        parsed = ClickArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            element, matched = await self.find_element(page, parsed.target, fields=False)
            point = await self.glide_to(page, element, parsed.label or parsed.target)
            await self.guard_click(page, element, point, parsed.allow_create, "click")
            try:
                await element.click(timeout=ACTION_TIMEOUT_MS)
            except Exception as error:
                raise ActionError(f"Could not click '{parsed.target}'. {str(error).splitlines()[0]}") from error
            await self.settle(page)
            return await self.brief(page, matched=matched)

    async def hover(self, args: dict) -> dict:
        parsed = HoverArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            element, matched = await self.find_element(page, parsed.target, fields=False)
            await self.glide_to(page, element, parsed.label or parsed.target)
            await page.wait_for_timeout(300)
            return await self.brief(page, matched=matched)

    async def type_text(self, args: dict) -> dict:
        parsed = TypeArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            field, matched = await self.find_element(page, parsed.target, fields=True)
            info = await self.describe(field)
            if info["password"]:
                raise ActionError("Co-worker never types into password fields. Ask the user to do that step.")
            if parsed.submit and classify_form_submit(info) == "create" and not parsed.allow_create:
                raise ApprovalNeeded(f"Press Enter in '{parsed.target}'", "create")
            await self.glide_to(page, field, parsed.label or parsed.target)
            try:
                await field.click(timeout=ACTION_TIMEOUT_MS)
                await field.fill("", timeout=ACTION_TIMEOUT_MS)
                if len(parsed.text) <= TYPING_ANIMATION_LIMIT:
                    await page.keyboard.type(parsed.text, delay=TYPING_DELAY_MS)
                else:
                    await field.fill(parsed.text, timeout=ACTION_TIMEOUT_MS)
                if parsed.submit:
                    await field.press("Enter")
            except Exception as error:
                raise ActionError(f"Could not type into '{parsed.target}'. {str(error).splitlines()[0]}") from error
            await self.settle(page)
            return await self.brief(page, matched=matched)

    async def select_option(self, args: dict) -> dict:
        parsed = SelectArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            field, matched = await self.find_element(page, parsed.target, fields=True)
            await self.glide_to(page, field, parsed.label or parsed.target)
            try:
                try:
                    await field.select_option(label=parsed.option, timeout=ACTION_TIMEOUT_MS)
                except Exception:
                    await field.select_option(value=parsed.option, timeout=ACTION_TIMEOUT_MS)
            except Exception as error:
                raise ActionError(f"Could not choose '{parsed.option}' in '{parsed.target}'. {str(error).splitlines()[0]}") from error
            await self.settle(page)
            return await self.brief(page, matched=matched)

    async def press_key(self, args: dict) -> dict:
        parsed = PressArgs(**args)
        if not KEY_PATTERN.match(parsed.key):
            raise ActionError("That key name is not valid.")
        async with self.lock:
            page = await self.ensure_page()
            if parsed.key.lower() == "enter" and not parsed.allow_create:
                active = await page.evaluate_handle("() => document.activeElement")
                element = active.as_element()
                if element is not None:
                    info = await self.describe(element)
                    if classify(info) == "delete":
                        raise ActionError(f"Co-worker cannot delete things, so it did not press Enter on '{info['label'][:60]}'.")
                    if classify(info) == "create" or classify_form_submit(info) == "create":
                        raise ApprovalNeeded(f"Press Enter on '{info['label'][:60] or info['tag']}'", "create")
            await page.keyboard.press(parsed.key)
            await self.settle(page)
            return await self.brief(page)

    async def scroll(self, args: dict) -> dict:
        parsed = ScrollArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            size = page.viewport_size or {"width": 1280, "height": 720}
            await page.mouse.move(size["width"] / 2, size["height"] / 2, steps=CURSOR_STEPS)
            if parsed.direction in ("top", "bottom"):
                await page.evaluate("(where) => window.scrollTo({ top: where === 'top' ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' })", parsed.direction)
            else:
                await page.mouse.wheel(0, parsed.amount if parsed.direction == "down" else -parsed.amount)
            await page.wait_for_timeout(500)
            position = await page.evaluate("() => ({ y: Math.round(window.scrollY), max: Math.round(document.documentElement.scrollHeight - window.innerHeight) })")
            return await self.brief(page, scroll=position)

    async def wait(self, args: dict) -> dict:
        parsed = WaitArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            if parsed.text:
                try:
                    await page.get_by_text(parsed.text).first.wait_for(state="visible", timeout=max(parsed.seconds, 1) * 1000)
                except Exception as error:
                    raise ActionError(f"'{parsed.text}' did not appear within {parsed.seconds:g} seconds.") from error
            elif parsed.settle:
                await self.wait_until_quiet(page, parsed.seconds)
            else:
                await page.wait_for_timeout(parsed.seconds * 1000)
            return await self.brief(page)

    async def wait_until_quiet(self, page: Page, seconds: float) -> None:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + max(seconds, 1)
        last = await self.page_text(page)
        quiet_since = loop.time()
        while loop.time() < deadline:
            await page.wait_for_timeout(SETTLE_POLL_MS)
            current = await self.page_text(page)
            if current != last:
                last = current
                quiet_since = loop.time()
            elif loop.time() - quiet_since >= SETTLE_QUIET_SECONDS:
                return

    async def run_check(self, page: Page, check: Check, text: str) -> dict:
        passed = False
        detail = ""
        if check.kind == "text_visible":
            passed = check.value.lower() in text.lower()
        elif check.kind == "text_absent":
            passed = check.value.lower() not in text.lower()
        elif check.kind == "url_contains":
            passed = check.value in page.url
            detail = page.url
        elif check.kind == "title_contains":
            title = await page.title()
            passed = check.value.lower() in title.lower()
            detail = title
        else:
            try:
                element, _ = await self.find_element(page, check.target, fields=check.kind == "value_equals")
            except ActionError:
                element = None
            if check.kind == "element_visible":
                passed = element is not None and await element.is_visible()
            elif check.kind == "element_absent":
                passed = element is None or not await element.is_visible()
            else:
                actual = await element.input_value() if element is not None else None
                passed = actual == check.value
                detail = f"value is {actual!r}" if actual is not None else "input not found"
        return {"check": check.kind, "target": check.target or check.value, "expected": check.value, "passed": passed, "detail": detail}

    async def expect(self, args: dict) -> dict:
        parsed = ExpectArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            text = await self.page_text(page)
            results = [await self.run_check(page, check, text) for check in parsed.checks]
            return {"all_passed": all(item["passed"] for item in results), "results": results, "url": page.url}

    async def read_issues(self, args: dict) -> dict:
        EmptyArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            found, self.issues = self.issues, []
            return {"url": page.url, "count": len(found), "issues": found}

    async def close_browser(self, args: dict) -> dict:
        EmptyArgs(**args)
        await self.shutdown()
        return {"closed": True}

    async def shutdown(self) -> None:
        async with self.lock:
            if self.browser is not None:
                try:
                    await self.browser.close()
                except Exception:
                    pass
            self.browser = None
            self.context = None
            self.page = None
            if self.playwright is not None:
                try:
                    await self.playwright.stop()
                except Exception:
                    pass
            self.playwright = None
