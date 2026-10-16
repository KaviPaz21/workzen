from app.installer import Installer


class MemoryStartup:
    def __init__(self):
        self.commands: list[str] = []
        self.on = False

    def enable(self, command: str) -> None:
        self.commands.append(command)
        self.on = True

    def disable(self) -> None:
        self.on = False

    def enabled(self) -> bool:
        return self.on


def make(tmp_path):
    source = tmp_path / "Downloads" / "WorkZenCoworker.exe"
    source.parent.mkdir()
    source.write_bytes(b"program")
    return Installer(install_dir=tmp_path / "Programs" / "WorkZen Co-worker", startup=MemoryStartup(), shortcuts=False), source


def test_install_copies_the_program_and_starts_it_with_windows(tmp_path):
    installer, source = make(tmp_path)
    target = installer.install(source)
    assert target == installer.install_dir / "WorkZenCoworker.exe"
    assert target.read_bytes() == b"program"
    assert installer.startup.commands == [f'"{target}"']
    assert installer.startup.enabled() is True


def test_running_from_the_install_folder_is_recognised(tmp_path):
    installer, source = make(tmp_path)
    assert installer.running_from_install(source) is False
    assert installer.running_from_install(installer.install(source)) is True


def test_installing_again_from_the_installed_copy_does_not_copy_it_onto_itself(tmp_path):
    installer, source = make(tmp_path)
    target = installer.install(source)
    again = installer.install(target)
    assert again == target and target.read_bytes() == b"program"
    assert len(installer.startup.commands) == 2


def test_uninstall_stops_it_starting_with_windows(tmp_path):
    installer, source = make(tmp_path)
    installer.install(source)
    installer.uninstall()
    assert installer.startup.enabled() is False
