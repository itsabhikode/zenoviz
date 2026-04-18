import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.app_settings import AppSettings
from src.db.session import create_tables, get_async_session_maker, init_engine
from src.jobs.expiry import expiry_background_loop
from src.repositories.impl.study_repository_sqlalchemy import SqlAlchemyStudyRepository
from src.routes.admin_roles import router as admin_roles_router
from src.routes.admin_study import router as admin_study_router
from src.routes.admin_users import router as admin_users_router
from src.routes.auth import router as auth_router
from src.routes.bookings import router as bookings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = AppSettings()
    init_engine(settings)
    await create_tables()
    factory = get_async_session_maker()
    async with factory() as session:
        async with session.begin():
            repo = SqlAlchemyStudyRepository(session)
            await repo.seed_if_empty()

    expiry_task = asyncio.create_task(expiry_background_loop(settings), name="booking-expiry")
    yield
    expiry_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await expiry_task


app = FastAPI(title="Zenoviz", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(admin_study_router)
app.include_router(admin_roles_router)
app.include_router(admin_users_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
