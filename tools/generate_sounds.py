"""Generate the game's sound effects with the ElevenLabs Sound Effects API.

Run once during development; the resulting mp3 files are committed so the
API key never reaches the browser.

    ELEVENLABS_API_KEY=... python3 tools/generate_sounds.py [--force] [--only NAME]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

API_URL = "https://api.elevenlabs.io/v1/sound-generation"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "sounds"


class StructuredLogger:
    """Logger whose messages are static text; dynamic data goes in params."""

    def __init__(self, name: str = "generate_sounds") -> None:
        self._logger = logging.getLogger(name)

    def _log(self, level: int, message: str, **params: object) -> None:
        suffix = " ".join(f"{key}={value!r}" for key, value in params.items())
        self._logger.log(level, "%s %s", message, suffix, extra={"params": params})

    def info(self, message: str, **params: object) -> None:
        self._log(logging.INFO, message, **params)

    def error(self, message: str, **params: object) -> None:
        self._log(logging.ERROR, message, **params)


logger = StructuredLogger()


@dataclass(frozen=True)
class SoundSpec:
    name: str
    prompt: str
    duration_seconds: float
    prompt_influence: float = 0.6


SOUNDS: tuple[SoundSpec, ...] = (
    SoundSpec(
        "squash1",
        "Close-up foley of a large cockroach being crushed under a shoe on a hard floor, "
        "short wet crunchy squish, exoskeleton cracking",
        0.8,
    ),
    SoundSpec(
        "squash2",
        "Bug squished by a hand slap on a tile floor, gooey crunch with a juicy splat, close microphone",
        0.7,
    ),
    SoundSpec(
        "squash3",
        "Crisp crunch of an insect shell cracking under a sneaker, followed by a small sticky squelch",
        0.9,
    ),
    SoundSpec(
        "miss",
        "Single flat palm slap on a hard floor, dry thud, no reverb",
        0.5,
    ),
    SoundSpec(
        "scurry",
        "Cockroach legs skittering quickly across a hard floor, tiny rapid tapping clicks, close up, seamless",
        2.0,
        0.7,
    ),
    SoundSpec(
        "levelup",
        "Short cheerful arcade game level up jingle, bright synth arpeggio",
        1.5,
        0.4,
    ),
    SoundSpec(
        "cartoon_scream",
        "Funny high-pitched cartoon bug screaming in panic, squeaky comedic yelp, animated show style",
        1.2,
        0.5,
    ),
    SoundSpec(
        "slipper_whack",
        "Loud comedic flip-flop slipper whack on a tile floor, sharp rubber slap",
        0.6,
    ),
    SoundSpec(
        "gameover",
        "Short descending cartoon game over trombone, comedic",
        1.8,
        0.4,
    ),
)

Fetcher = Callable[[SoundSpec, str], bytes]


def fetch_sound(spec: SoundSpec, api_key: str) -> bytes:
    body = json.dumps(
        {
            "text": spec.prompt,
            "duration_seconds": spec.duration_seconds,
            "prompt_influence": spec.prompt_influence,
        }
    ).encode()
    request = urllib.request.Request(
        API_URL,
        data=body,
        method="POST",
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def generate(
    specs: Iterable[SoundSpec],
    out_dir: Path,
    api_key: str,
    fetcher: Fetcher = fetch_sound,
    force: bool = False,
) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for spec in specs:
        target = out_dir / f"{spec.name}.mp3"
        if target.exists() and not force:
            logger.info("sound exists, skipping", name=spec.name)
            continue
        audio = fetcher(spec, api_key)
        if not audio:
            raise RuntimeError(f"empty audio for {spec.name}")
        target.write_bytes(audio)
        logger.info("sound generated", name=spec.name, bytes=len(audio))
        written.append(target)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument("--only", action="append", help="generate only these sound names")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.error("missing api key", env_var="ELEVENLABS_API_KEY")
        return 1

    specs = [s for s in SOUNDS if not args.only or s.name in args.only]
    generate(specs, args.out, api_key, force=args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
