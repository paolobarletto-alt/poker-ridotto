import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers.admin_router import router as admin_router
from routers.auth_router import router as auth_router
from routers.users_router import router as users_router

logger = logging.getLogger("ridotto")

app = FastAPI(title="Ridotto Poker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)


@app.get("/")
async def root():
    return {"status": "ok", "app": "Ridotto Poker API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Errore interno del server"})
