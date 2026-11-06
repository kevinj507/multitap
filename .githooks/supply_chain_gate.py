#!/usr/bin/env python3
"""Supply-chain gate — runs from the pre-push hook (or standalone).

Checks every pinned dependency in this repo against OSV.dev and enforces a
cooling-off window on newly-introduced pins:

  1. OSV querybatch over all pins (uv.lock, requirements*.txt,
     package-lock.json, bun.lock if present):
       - any MAL-* (malicious package) advisory ............ BLOCK the push
       - ordinary vulnerability advisories (GHSA/CVE) ...... WARN, don't block
  2. Pins that CHANGED relative to origin/main must be at least
     MIN_AGE_DAYS old on their registry (PyPI / npm) ....... BLOCK if younger
     (set SUPPLY_GATE_ALLOW_FRESH=1 to override deliberately)

Network failures fail OPEN with a loud warning (a dead laptop Wi-Fi should not
brick pushes). Skip entirely with SUPPLY_GATE_SKIP=1.
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MIN_AGE_DAYS = 10
OSV_BATCH = "https://api.osv.dev/v1/querybatch"


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout


def repo_root():
    return Path(sh("git", "rev-parse", "--show-toplevel").strip() or ".")


def parse_uv_lock(text):
    pins = []
    for block in text.split("[[package]]"):
        if 'registry = "https://pypi.org/simple"' not in block:
            continue
        name = re.search(r'^name = "([^"]+)"', block, re.M)
        ver = re.search(r'^version = "([^"]+)"', block, re.M)
        if name and ver:
            pins.append(("PyPI", name.group(1), ver.group(1)))
    return pins


def parse_requirements(text):
    pins = []
    for line in text.splitlines():
        line = line.split("#")[0].strip()
        m = re.match(r"^([A-Za-z0-9._-]+)==([A-Za-z0-9.+!-]+)$", line)
        if m:
            pins.append(("PyPI", m.group(1), m.group(2)))
    return pins


def parse_package_lock(text):
    pins = []
    try:
        data = json.loads(text)
    except ValueError:
        return pins
    for path, meta in (data.get("packages") or {}).items():
        if not path or not isinstance(meta, dict):
            continue
        name = path.split("node_modules/")[-1]
        ver = meta.get("version")
        if name and ver:
            pins.append(("npm", name, ver))
    return pins


def parse_bun_lock(text):
    # bun.lock is JSONC; best-effort extraction of "name@version" specifiers.
    pins = []
    for m in re.finditer(r'"(@?[A-Za-z0-9._/-]+)@(\d[A-Za-z0-9.+-]*)"', text):
        pins.append(("npm", m.group(1), m.group(2)))
    return pins


PARSERS = {
    "uv.lock": parse_uv_lock,
    "package-lock.json": parse_package_lock,
    "bun.lock": parse_bun_lock,
}


def collect_pins(read_file):
    """read_file(relpath) -> text or None. Returns {(eco, name, ver)}."""
    pins = set()
    root = repo_root()
    candidates = ["uv.lock", "package-lock.json", "bun.lock"]
    candidates += [
        str(p.relative_to(root)) for p in root.glob("**/requirements*.txt")
        if ".venv" not in str(p) and "node_modules" not in str(p)
    ]
    for rel in candidates:
        text = read_file(rel)
        if not text:
            continue
        parser = PARSERS.get(Path(rel).name, parse_requirements)
        pins.update(parser(text))
    return pins


def read_worktree(rel):
    p = repo_root() / rel
    return p.read_text(errors="replace") if p.exists() else None


def read_origin(rel):
    out = subprocess.run(
        ["git", "show", f"origin/main:{rel}"], capture_output=True, text=True
    )
    return out.stdout if out.returncode == 0 else None


def osv_query(pins):
    queries = [
        {"package": {"ecosystem": eco, "name": name}, "version": ver}
        for eco, name, ver in pins
    ]
    req = urllib.request.Request(
        OSV_BATCH,
        data=json.dumps({"queries": queries}).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req, timeout=30))["results"]


def release_age_days(eco, name, ver):
    if eco == "PyPI":
        url = f"https://pypi.org/pypi/{name}/{ver}/json"
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.load(r)
        times = [u["upload_time_iso_8601"] for u in data.get("urls", [])]
        if not times:
            return None
        ts = min(times)
    else:
        url = f"https://registry.npmjs.org/{name}"
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.load(r)
        ts = (data.get("time") or {}).get(ver)
        if not ts:
            return None
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).total_seconds() / 86400


def main():
    if os.environ.get("SUPPLY_GATE_SKIP") == "1":
        print("[supply-gate] SUPPLY_GATE_SKIP=1 — skipped")
        return 0

    pins = collect_pins(read_worktree)
    if not pins:
        print("[supply-gate] no pinned dependencies found — nothing to check")
        return 0
    pins = sorted(pins)

    try:
        results = osv_query(pins)
    except Exception as e:  # fail open, loudly
        print(f"[supply-gate] WARNING: OSV unreachable ({e}) — push allowed UNCHECKED")
        return 0

    malicious, vulns = [], []
    for (eco, name, ver), res in zip(pins, results):
        ids = [v["id"] for v in (res.get("vulns") or [])]
        mal = [i for i in ids if i.startswith("MAL-")]
        if mal:
            malicious.append((name, ver, mal))
        elif ids:
            vulns.append((name, ver, ids))

    for name, ver, ids in vulns:
        print(f"[supply-gate] WARN  {name}=={ver}: advisories {ids} (not blocking; fix soon)")

    # Cooling-off check on pins changed vs origin/main
    fresh = []
    origin_pins = collect_pins(read_origin)
    changed = [p for p in pins if p not in origin_pins]
    if changed and os.environ.get("SUPPLY_GATE_ALLOW_FRESH") != "1":
        for eco, name, ver in changed[:40]:
            try:
                age = release_age_days(eco, name, ver)
            except Exception:
                continue  # registry hiccup: don't block on the age check alone
            if age is not None and age < MIN_AGE_DAYS:
                fresh.append((name, ver, age))

    ok = True
    for name, ver, mal in malicious:
        print(f"[supply-gate] BLOCK {name}=={ver}: MALICIOUS-PACKAGE advisory {mal}")
        ok = False
    for name, ver, age in fresh:
        print(
            f"[supply-gate] BLOCK {name}=={ver}: published {age:.1f} days ago "
            f"(< {MIN_AGE_DAYS}-day cooling-off; SUPPLY_GATE_ALLOW_FRESH=1 to override)"
        )
        ok = False

    if ok:
        print(
            f"[supply-gate] OK — {len(pins)} pins checked against OSV"
            + (f", {len(changed)} changed pins age-checked" if changed else "")
            + (f"; {len(vulns)} non-blocking advisories above" if vulns else "")
        )
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
