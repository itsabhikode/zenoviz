from fastapi import FastAPI

from src.routes.auth import router as auth_router

app = FastAPI(title="Zenoviz")

app.include_router(auth_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
