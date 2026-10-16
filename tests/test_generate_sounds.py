import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

import generate_sounds as gs  # noqa: E402


@pytest.fixture
def specs():
    return [gs.SoundSpec("a", "prompt a", 0.5), gs.SoundSpec("b", "prompt b", 1.0)]


def fake_fetcher(calls):
    def fetch(spec, api_key):
        calls.append((spec.name, api_key))
        return b"ID3" + spec.name.encode()

    return fetch


def test_generate_writes_each_sound(tmp_path, specs):
    calls = []
    written = gs.generate(specs, tmp_path, "key", fetcher=fake_fetcher(calls))

    assert [p.name for p in written] == ["a.mp3", "b.mp3"]
    assert (tmp_path / "a.mp3").read_bytes() == b"ID3a"
    assert calls == [("a", "key"), ("b", "key")]


def test_generate_skips_existing_unless_forced(tmp_path, specs):
    (tmp_path / "a.mp3").write_bytes(b"old")
    calls = []

    gs.generate(specs, tmp_path, "key", fetcher=fake_fetcher(calls))
    assert (tmp_path / "a.mp3").read_bytes() == b"old"
    assert [c[0] for c in calls] == ["b"]

    gs.generate(specs, tmp_path, "key", fetcher=fake_fetcher(calls), force=True)
    assert (tmp_path / "a.mp3").read_bytes() == b"ID3a"


def test_generate_rejects_empty_audio(tmp_path, specs):
    with pytest.raises(RuntimeError):
        gs.generate(specs, tmp_path, "key", fetcher=lambda spec, key: b"")


def test_fetch_sound_builds_request(monkeypatch):
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b"mp3"

    def fake_urlopen(request, timeout):
        captured["request"] = request
        return FakeResponse()

    monkeypatch.setattr(gs.urllib.request, "urlopen", fake_urlopen)
    spec = gs.SoundSpec("x", "crunch", 0.7, 0.5)

    assert gs.fetch_sound(spec, "secret") == b"mp3"
    req = captured["request"]
    assert req.full_url == gs.API_URL
    assert req.get_header("Xi-api-key") == "secret"
    assert b'"duration_seconds": 0.7' in req.data


def test_main_without_key_fails(monkeypatch, tmp_path):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    assert gs.main(["--out", str(tmp_path)]) == 1


def test_sound_names_are_unique():
    names = [s.name for s in gs.SOUNDS]
    assert len(names) == len(set(names))
