import ctypes
import sys

MB_OK = 0x0
MB_YESNO = 0x4
MB_ICONINFORMATION = 0x40
MB_ICONQUESTION = 0x20
MB_DEFBUTTON2 = 0x100
MB_SETFOREGROUND = 0x10000
MB_TOPMOST = 0x40000
IDYES = 6

APP_TITLE = "WorkZen Co-worker"


def show_box(text: str, flags: int) -> int:
    return ctypes.windll.user32.MessageBoxW(0, text, APP_TITLE, flags | MB_SETFOREGROUND | MB_TOPMOST)


def tell(text: str) -> None:
    if sys.platform.startswith("win"):
        show_box(text, MB_OK | MB_ICONINFORMATION)
    else:
        print(text)


def ask(text: str, default_no: bool = True) -> bool:
    if not sys.platform.startswith("win"):
        return False
    flags = MB_YESNO | MB_ICONQUESTION | (MB_DEFBUTTON2 if default_no else 0)
    return show_box(text, flags) == IDYES
