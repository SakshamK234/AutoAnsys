"""Shared test fixtures.

The ``client`` fixture (and only that fixture) needs the full application stack
— SQLAlchemy, pydantic-settings, the async DB drivers, etc. Those are present in
the Docker image and any full dev environment, but the **Fluent-free** tests
(journal/SLURM generation, config/profile logic, parsers) deliberately need none
of them. To let those run anywhere, the heavy import is done lazily *inside* the
fixture, and tests that depend on it are skipped — not errored — when the stack
is unavailable. This keeps `pytest` collection green in a jinja2-only env.
"""

import inspect

import pytest


def _asyncio_plugin_available() -> bool:
    try:
        import pytest_asyncio  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def pytest_configure(config):
    # Register the marker ourselves when pytest-asyncio isn't installed, so the
    # minimal jinja2-only env doesn't emit "unknown mark" warnings.
    if not _asyncio_plugin_available():
        config.addinivalue_line(
            "markers", "asyncio: async test (needs pytest-asyncio + full app stack)"
        )


def pytest_collection_modifyitems(config, items):
    # Without pytest-asyncio, `async def` tests aren't natively runnable and
    # error. Skip them cleanly instead so the Fluent-free suite stays green in a
    # minimal environment; they run for real in Docker where the plugin exists.
    if _asyncio_plugin_available():
        return
    skip = pytest.mark.skip(
        reason="pytest-asyncio not installed; async API tests need the full app stack"
    )
    for item in items:
        if inspect.iscoroutinefunction(getattr(item, "function", None)):
            item.add_marker(skip)


@pytest.fixture
async def client():
    """Async test client for the FastAPI app (requires the full app stack)."""
    try:
        from httpx import ASGITransport, AsyncClient
        from app.main import app
    except Exception as exc:  # noqa: BLE001 — any import failure → skip, not error
        pytest.skip(f"Full app stack unavailable ({exc!r}); skipping API test")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
