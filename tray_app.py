#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dzialki EGiB - tray: API :5001 + Cloudflare trycloud tunnel."""
from __future__ import annotations

import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path


def _no_window() -> int:
    if sys.platform == "win32":
        return getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    return 0


ROOT = Path(__file__).resolve().parent
DZIALKI = Path(os.environ.get("USERPROFILE", str(ROOT.parent))) / "dzialki"
VENV_PY = DZIALKI / ".venv" / "Scripts" / "python.exe"
VENV_PYW = DZIALKI / ".venv" / "Scripts" / "pythonw.exe"
CLOUDFLARED = DZIALKI / "tools" / "cloudflared.exe"
API_SCRIPT = ROOT / "server" / "public_api.py"
CONFIG_JS = ROOT / "docs" / "config.js"
ICON_ICO = ROOT / "assets" / "grid.ico"
ICON_PNG = ROOT / "assets" / "grid.png"
LOG = DZIALKI / "cloudflare.out"
LOG_ERR = DZIALKI / "cloudflare.out.err"
URL_FILE = DZIALKI / "tunnel_url.txt"
PORT = int(os.environ.get("PLOTS_PORT", "5001"))
PAGES = "https://xoogklastry.github.io/plots/"
LOCAL = f"http://127.0.0.1:{PORT}/"

_api_proc: subprocess.Popen | None = None
_tunnel_proc: subprocess.Popen | None = None
_tunnel_url: str | None = None
_lock = threading.Lock()
_icon = None  # pystray.Icon


def _py() -> str:
    if VENV_PY.exists():
        return str(VENV_PY)
    return sys.executable


def _health() -> bool:
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _pids_on_port(port: int) -> list[int]:
    try:
        out = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique",
            ],
            text=True,
            timeout=15,
        )
        pids = []
        for line in out.splitlines():
            line = line.strip()
            if line.isdigit():
                pids.append(int(line))
        return pids
    except Exception:
        return []


def start_api() -> None:
    global _api_proc
    if _health():
        return
    env = os.environ.copy()
    env.setdefault("PLOTS_DSN", "postgresql://postgres@localhost/gisss")
    env["PLOTS_PORT"] = str(PORT)
    creation = _no_window()
    _api_proc = subprocess.Popen(
        [_py(), str(API_SCRIPT)],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creation,
    )
    for _ in range(30):
        if _health():
            return
        time.sleep(0.3)


def _kill_cloudflared() -> None:
    global _tunnel_proc
    try:
        subprocess.run(
            ["taskkill", "/IM", "cloudflared.exe", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=_no_window(),
        )
    except Exception:
        pass
    if _tunnel_proc and _tunnel_proc.poll() is None:
        try:
            _tunnel_proc.terminate()
        except Exception:
            pass
    _tunnel_proc = None


def _read_url_from_logs(timeout: float = 90.0) -> str | None:
    pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    deadline = time.time() + timeout
    while time.time() < deadline:
        for path in (LOG_ERR, LOG):
            try:
                if not path.exists():
                    continue
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            matches = pattern.findall(text)
            if matches:
                return matches[-1]
        if _tunnel_proc and _tunnel_proc.poll() is not None:
            break
        time.sleep(0.8)
    return None


def _write_config(url: str) -> None:
    if not CONFIG_JS.exists():
        return
    c = CONFIG_JS.read_text(encoding="utf-8")
    n = re.sub(r'TILES_URL:\s*"[^"]*"', f'TILES_URL: "{url}"', c)
    CONFIG_JS.write_text(n, encoding="utf-8")


def start_tunnel() -> str | None:
    global _tunnel_proc, _tunnel_url
    with _lock:
        _kill_cloudflared()
        time.sleep(0.5)
        for p in (LOG, LOG_ERR):
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass
        if not CLOUDFLARED.exists():
            _notify("Brak cloudflared.exe")
            return None
        creation = _no_window()
        out_f = open(LOG, "w", encoding="utf-8", errors="replace")
        err_f = open(LOG_ERR, "w", encoding="utf-8", errors="replace")
        _tunnel_proc = subprocess.Popen(
            [
                str(CLOUDFLARED),
                "tunnel",
                "--url",
                f"http://127.0.0.1:{PORT}",
                "--no-autoupdate",
            ],
            stdout=out_f,
            stderr=err_f,
            creationflags=creation,
        )
        url = _read_url_from_logs(90.0)
        if url:
            _tunnel_url = url
            URL_FILE.write_text(url, encoding="utf-8")
            _write_config(url)
            # merge logs
            try:
                merged = ""
                for p in (LOG, LOG_ERR):
                    if p.exists():
                        merged += p.read_text(encoding="utf-8", errors="ignore")
                LOG.write_text(merged, encoding="utf-8")
            except Exception:
                pass
        return url


def stop_all() -> None:
    global _api_proc
    _kill_cloudflared()
    # kill API we started
    if _api_proc and _api_proc.poll() is None:
        try:
            _api_proc.terminate()
            _api_proc.wait(timeout=5)
        except Exception:
            try:
                _api_proc.kill()
            except Exception:
                pass
    _api_proc = None
    # also free port 5001 if our public_api still listens
    for pid in _pids_on_port(PORT):
        try:
            # only kill if command line looks like public_api
            out = subprocess.check_output(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    f"(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine",
                ],
                text=True,
                timeout=10,
            )
            if "public_api" in (out or "").lower() or "plots" in (out or "").lower():
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=_no_window(),
                )
        except Exception:
            pass


def current_url() -> str:
    global _tunnel_url
    if _tunnel_url:
        return _tunnel_url
    try:
        if URL_FILE.exists():
            u = URL_FILE.read_text(encoding="utf-8").strip()
            if u:
                _tunnel_url = u
                return u
    except Exception:
        pass
    return "(brak - zrestartuj tunel)"


def _notify(msg: str) -> None:
    global _icon
    try:
        if _icon:
            _icon.notify(msg, "Dzialki EGiB")
    except Exception:
        pass


def _load_image():
    from PIL import Image

    if ICON_ICO.exists():
        return Image.open(ICON_ICO)
    if ICON_PNG.exists():
        return Image.open(ICON_PNG)
    # fallback draw
    img = Image.new("RGBA", (64, 64), (46, 125, 50, 255))
    return img


def _on_open_local(icon, item):
    webbrowser.open(LOCAL)


def _on_open_pages(icon, item):
    webbrowser.open(PAGES)


def _on_show_url(icon, item):
    url = current_url()
    _notify(url)
    # also copy to clipboard
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{url}'"],
            creationflags=_no_window(),
        )
        _notify(f"Skopiowano: {url}")
    except Exception:
        pass


def _on_restart(icon, item):
    def work():
        _notify("Restartuje tunel...")
        url = start_tunnel()
        if url:
            _notify(f"Tunel: {url}")
        else:
            _notify("Nie udalo sie uruchomic tunelu")

    threading.Thread(target=work, daemon=True).start()


def _on_exit(icon, item):
    stop_all()
    icon.stop()


def bootstrap():
    start_api()
    url = start_tunnel()
    if url:
        _notify(f"Gotowe: {url}")
    else:
        _notify("API OK, ale tunel nie wstal - Restartuj tunel")


def main():
    global _icon
    try:
        import pystray
        from pystray import MenuItem as Item
    except ImportError:
        print("Zainstaluj: pip install pystray Pillow")
        sys.exit(1)

    image = _load_image()
    menu = pystray.Menu(
        Item("Otworz mape (lokalnie)", _on_open_local),
        Item("Otworz mape (GitHub Pages)", _on_open_pages),
        Item("Pokaz / kopiuj URL tunelu", _on_show_url),
        Item("Restartuj tunel", _on_restart),
        pystray.Menu.SEPARATOR,
        Item("Wyjdz (zatrzymaj API + tunel)", _on_exit),
    )
    _icon = pystray.Icon("dzialki_egib", image, "Dzialki EGiB", menu)

    threading.Thread(target=bootstrap, daemon=True).start()
    _icon.run()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--stop", "stop"):
        stop_all()
        print("stopped")
    else:
        main()
