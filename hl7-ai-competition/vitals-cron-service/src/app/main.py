import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from app.config import get_settings
from app.schemas import CycleResult
from app.vitals import run_cycle

logger = logging.getLogger("vitals_cron")


class _State:
    last_result: CycleResult | None = None


_state = _State()


async def _scheduled_run() -> None:
    settings = get_settings()
    try:
        _state.last_result = await run_cycle(settings)
        logger.info("cycle complete: %s", _state.last_result)
    except Exception:
        logger.exception("scheduled vitals cycle failed")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_scheduled_run, "interval", hours=settings.interval_hours, next_run_time=None)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        summary="Forwards each patient's last-hour vitals from apple-healthkit-simulator to a downstream URL.",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/status")
    def status() -> CycleResult | None:
        return _state.last_result

    @app.post("/run-now")
    async def run_now() -> CycleResult:
        _state.last_result = await run_cycle(get_settings())
        return _state.last_result

    return app


app = create_app()
