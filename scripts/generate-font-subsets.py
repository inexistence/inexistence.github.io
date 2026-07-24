#!/usr/bin/env python3
"""Generate cached Noto Sans SC assets for site content and Waline comments."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Iterable

from fontTools import __version__ as FONTTOOLS_VERSION
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent
SOURCE_ROOT = ROOT / "src"
FONT_DIRECTORY = ROOT / "node_modules" / "animal-island-ui" / "dist" / "files"
PUBLIC_FONTS = ROOT / "public" / "fonts"
STATIC_DIRECTORY = PUBLIC_FONTS / "static"
COMMENT_DIRECTORY = PUBLIC_FONTS / "comment"
COMMENT_CSS = PUBLIC_FONTS / "comment-fonts.css"
MANIFEST_PATH = ROOT / ".cache" / "inexistence-fonts" / "manifest.json"
WEIGHTS = (400, 500, 700)
CHUNK_COUNT = 48
GENERATOR_VERSION = "2026-07-24.2"
SOURCE_EXTENSIONS = {".astro", ".css", ".md", ".mdx", ".ts", ".tsx", ".js", ".jsx", ".json"}
# Cap workers so a laptop rebuild does not thrash disk while still using several cores.
MAX_WORKERS = 8


def worker_count() -> int:
    return max(1, min(os.cpu_count() or 2, MAX_WORKERS))

# This list is deliberately fixed: article edits must not reshuffle comment chunks.
# It starts with commonly used Simplified Chinese characters so Waline's own UI and
# ordinary short comments usually touch the earliest, cache-friendly chunks.
PRIORITY_CHARACTERS = """
的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处理世车安打每话义万清写增再保望转百让门东导色济声美规站采张接重注字众先风周院林识候单东话归听处走观""".replace("\n", "")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def find_source_font(weight: int) -> Path:
    matches = sorted(FONT_DIRECTORY.glob(f"noto-sans-sc-chinese-simplified-{weight}-normal.*.woff2"))
    if len(matches) != 1:
        raise RuntimeError(f"Could not find exactly one Noto Sans SC {weight} source font in {FONT_DIRECTORY}.")
    return matches[0]


def source_fonts() -> dict[int, Path]:
    return {weight: find_source_font(weight) for weight in WEIGHTS}


def collect_site_text() -> bytes:
    digest = hashlib.sha256()
    for path in sorted(SOURCE_ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        digest.update(path.relative_to(ROOT).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.digest()


def collect_site_characters() -> set[int]:
    characters: set[int] = set()
    for path in sorted(SOURCE_ROOT.rglob("*")):
        if path.is_file() and path.suffix.lower() in SOURCE_EXTENSIONS:
            characters.update(map(ord, path.read_text(encoding="utf-8")))
    return characters


def font_codepoints(font_path: Path) -> set[int]:
    font = TTFont(font_path, lazy=True)
    try:
        codepoints: set[int] = set()
        for table in font["cmap"].tables:
            if table.isUnicode():
                codepoints.update(table.cmap)
        return codepoints
    finally:
        font.close()


def file_fingerprint(fonts: dict[int, Path]) -> dict[str, str]:
    return {str(weight): sha256_file(path) for weight, path in fonts.items()}


def read_manifest() -> dict:
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_manifest(manifest: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = MANIFEST_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(MANIFEST_PATH)


def stable_hash(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return sha256_bytes(encoded)


def subset_font(source: Path, codepoints: Iterable[int], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=set(codepoints))
    font = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
    try:
        subsetter.subset(font)
        font.flavor = "woff2"
        with tempfile.NamedTemporaryFile(dir=destination.parent, suffix=".woff2", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            font.save(temporary_path)
            temporary_path.replace(destination)
        finally:
            temporary_path.unlink(missing_ok=True)
    finally:
        font.close()


def _subset_job(payload: tuple[str, list[int], str]) -> str:
    """Picklable worker for ProcessPoolExecutor (Windows spawn-safe)."""
    source, codepoints, destination = payload
    subset_font(Path(source), codepoints, Path(destination))
    return destination


def run_subset_jobs(jobs: list[tuple[str, list[int], str]]) -> None:
    if not jobs:
        return
    if len(jobs) == 1:
        _subset_job(jobs[0])
        return

    workers = min(worker_count(), len(jobs))
    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_subset_job, job) for job in jobs]
        for future in as_completed(futures):
            future.result()


def unicode_range(codepoints: Iterable[int]) -> str:
    points = sorted(codepoints)
    ranges: list[str] = []
    start = previous = points[0]
    for point in points[1:]:
        if point == previous + 1:
            previous = point
            continue
        ranges.append(f"U+{start:04X}" if start == previous else f"U+{start:04X}-{previous:04X}")
        start = previous = point
    ranges.append(f"U+{start:04X}" if start == previous else f"U+{start:04X}-{previous:04X}")
    return ", ".join(ranges)


def priority_order(codepoints: set[int]) -> list[int]:
    priority: list[int] = []
    seen: set[int] = set()
    for character in PRIORITY_CHARACTERS:
        codepoint = ord(character)
        if codepoint in codepoints and codepoint not in seen:
            priority.append(codepoint)
            seen.add(codepoint)
    return priority + sorted(codepoints - seen)


def chunks(codepoints: set[int]) -> list[list[int]]:
    ordered = priority_order(codepoints)
    if len(ordered) < CHUNK_COUNT:
        raise RuntimeError(f"The comment font has only {len(ordered)} codepoints; cannot make {CHUNK_COUNT} chunks.")
    return [ordered[index * len(ordered) // CHUNK_COUNT : (index + 1) * len(ordered) // CHUNK_COUNT] for index in range(CHUNK_COUNT)]


def static_outputs_exist() -> bool:
    outputs = [STATIC_DIRECTORY / f"noto-sans-sc-static-{weight}.woff2" for weight in WEIGHTS]
    return all(path.is_file() and path.stat().st_size > 0 for path in outputs)


def comment_outputs_exist() -> bool:
    if not COMMENT_CSS.is_file() or COMMENT_CSS.stat().st_size == 0:
        return False
    files = [COMMENT_DIRECTORY / f"noto-sans-sc-comment-{weight}-{index:02d}.woff2" for weight in WEIGHTS for index in range(1, CHUNK_COUNT + 1)]
    return all(path.is_file() and path.stat().st_size > 0 for path in files)


def build_static(fonts: dict[int, Path]) -> None:
    characters = collect_site_characters()
    jobs: list[tuple[str, list[int], str]] = []
    for weight, source in fonts.items():
        available = font_codepoints(source)
        destination = STATIC_DIRECTORY / f"noto-sans-sc-static-{weight}.woff2"
        jobs.append((str(source), sorted(characters & available), str(destination)))
    run_subset_jobs(jobs)
    for legacy in PUBLIC_FONTS.glob("noto-sans-sc-site-*.woff2"):
        legacy.unlink()


def build_comment(fonts: dict[int, Path]) -> None:
    rules: list[str] = ["/* Generated by scripts/generate-font-subsets.py. Do not edit. */", ""]
    jobs: list[tuple[str, list[int], str]] = []
    COMMENT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for weight, source in fonts.items():
        for index, codepoints in enumerate(chunks(font_codepoints(source)), start=1):
            filename = f"noto-sans-sc-comment-{weight}-{index:02d}.woff2"
            jobs.append((str(source), list(codepoints), str(COMMENT_DIRECTORY / filename)))
            rules.extend([
                "@font-face {",
                "  font-family: 'Noto Sans SC Comment';",
                "  font-style: normal;",
                f"  font-weight: {weight};",
                "  font-display: swap;",
                f"  src: url('/fonts/comment/{filename}') format('woff2');",
                f"  unicode-range: {unicode_range(codepoints)};",
                "}",
                "",
            ])
    print(f"  subsetting {len(jobs)} comment chunks with {min(worker_count(), len(jobs))} workers…")
    run_subset_jobs(jobs)
    COMMENT_CSS.parent.mkdir(parents=True, exist_ok=True)
    COMMENT_CSS.write_text("\n".join(rules), encoding="utf-8")


def main() -> None:
    if not FONT_DIRECTORY.is_dir():
        raise RuntimeError("animal-island-ui is missing. Run npm install before generating fonts.")
    fonts = source_fonts()
    source_hashes = file_fingerprint(fonts)
    generator_hash = sha256_file(Path(__file__))
    static_fingerprint = stable_hash({
        "generator": GENERATOR_VERSION,
        "generatorHash": generator_hash,
        "fontTools": FONTTOOLS_VERSION,
        "fonts": source_hashes,
        "siteText": collect_site_text().hex(),
        "staticStrategy": "all-source-text-codepoints",
    })
    comment_fingerprint = stable_hash({
        "generator": GENERATOR_VERSION,
        "generatorHash": generator_hash,
        "fontTools": FONTTOOLS_VERSION,
        "fonts": source_hashes,
        "chunkCount": CHUNK_COUNT,
        "priority": PRIORITY_CHARACTERS,
        "commentStrategy": "complete-cmap-frequency-priority",
    })
    manifest = read_manifest()
    new_manifest = {"version": 1, "static": static_fingerprint, "comment": comment_fingerprint}

    if manifest.get("static") == static_fingerprint and static_outputs_exist():
        print("Static Noto Sans SC subsets are current; skipped.")
    else:
        print("Generating static Noto Sans SC subsets (400, 500, 700)…")
        build_static(fonts)

    if manifest.get("comment") == comment_fingerprint and comment_outputs_exist():
        print("Waline Noto Sans SC comment chunks are current; skipped.")
    else:
        print(f"Generating complete Waline Noto Sans SC coverage ({CHUNK_COUNT} chunks × 3 weights)…")
        build_comment(fonts)

    write_manifest(new_manifest)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"[font generator] {error}", file=sys.stderr)
        sys.exit(1)
