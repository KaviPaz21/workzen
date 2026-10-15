import asyncio
import re
from typing import Any

from playwright.async_api import Page, Playwright, async_playwright
from pydantic import BaseModel, Field

from app.actions.errors import ActionError
from app.actions.system import checked_web_address
from app.config import Settings

PAGE_TEXT_CHARACTERS = 6000
LINK_LIMIT = 30
FIELD_LIMIT = 15
NAVIGATION_TIMEOUT_MS = 30_000
ACTION_TIMEOUT_MS = 10_000
SETTLE_TIMEOUT_MS = 5_000
KEY_PATTERN = re.compile(r"^[A-Za-z0-9+]{1,20}$")

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


class TypeArgs(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    text: str = Field(max_length=5000)
    submit: bool = False


class PressArgs(BaseModel):
    key: str


class EmptyArgs(BaseModel):
    pass


class BrowserController:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.playwright: Playwright | None = None
        self.browser = None
        self.page: Page | None = None
        self.lock = asyncio.Lock()

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
        context = await self.browser.new_context()
        self.page = await context.new_page()
        return self.page

    async def settle(self, page: Page) -> None:
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=SETTLE_TIMEOUT_MS)
        except Exception:
            return

    async def snapshot(self, page: Page) -> dict[str, Any]:
        text = ""
        try:
            text = re.sub(r"\n{3,}", "\n\n", await page.inner_text("body", timeout=ACTION_TIMEOUT_MS)).strip()
        except Exception:
            text = ""
        extras = await page.evaluate(PAGE_SCRIPT)
        return {
            "url": page.url,
            "title": await page.title(),
            "text": text[:PAGE_TEXT_CHARACTERS],
            "text_truncated": len(text) > PAGE_TEXT_CHARACTERS,
            "links": extras["links"][:LINK_LIMIT],
            "fields": extras["fields"][:FIELD_LIMIT],
        }

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

    async def click(self, args: dict) -> dict:
        parsed = ClickArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            candidates = [
                page.get_by_role("button", name=parsed.target),
                page.get_by_role("link", name=parsed.target),
                page.get_by_text(parsed.target),
            ]
            for candidate in candidates:
                if await candidate.count() > 0:
                    try:
                        await candidate.first.click(timeout=ACTION_TIMEOUT_MS)
                    except Exception as error:
                        raise ActionError(f"Could not click '{parsed.target}'. {str(error).splitlines()[0]}") from error
                    await self.settle(page)
                    return await self.snapshot(page)
            try:
                await page.locator(parsed.target).first.click(timeout=ACTION_TIMEOUT_MS)
            except Exception as error:
                raise ActionError(f"Nothing on the page matches '{parsed.target}'.") from error
            await self.settle(page)
            return await self.snapshot(page)

    async def type_text(self, args: dict) -> dict:
        parsed = TypeArgs(**args)
        async with self.lock:
            page = await self.ensure_page()
            candidates = [
                page.get_by_label(parsed.target),
                page.get_by_placeholder(parsed.target),
                page.locator(f'[name="{parsed.target}"]'),
            ]
            field = None
            for candidate in candidates:
                if await candidate.count() > 0:
                    field = candidate.first
                    break
            if field is None:
                try:
                    probe = page.locator(parsed.target)
                    if await probe.count() > 0:
                        field = probe.first
                except Exception:
                    field = None
            if field is None:
                raise ActionError(f"No input on the page matches '{parsed.target}'.")
            try:
                await field.fill(parsed.text, timeout=ACTION_TIMEOUT_MS)
                if parsed.submit:
                    await field.press("Enter")
            except Exception as error:
                raise ActionError(f"Could not type into '{parsed.target}'. {str(error).splitlines()[0]}") from error
            await self.settle(page)
            return await self.snapshot(page)

    async def press_key(self, args: dict) -> dict:
        parsed = PressArgs(**args)
        if not KEY_PATTERN.match(parsed.key):
            raise ActionError("That key name is not valid.")
        async with self.lock:
            page = await self.ensure_page()
            await page.keyboard.press(parsed.key)
            await self.settle(page)
            return await self.snapshot(page)

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
            self.page = None
            if self.playwright is not None:
                try:
                    await self.playwright.stop()
                except Exception:
                    pass
            self.playwright = None
