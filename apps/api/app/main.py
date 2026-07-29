from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import router as v1_router
from app.api.routes import router
from app.core.config import API_TITLE, API_VERSION, POD_UPLOAD_DIR, WEB_ORIGINS

app = FastAPI(title=API_TITLE, version=API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=WEB_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router, prefix="/api")
app.include_router(v1_router, prefix="/api/v1")
app.mount(
    "/uploads",
    StaticFiles(directory=str(POD_UPLOAD_DIR.parent), check_dir=False),
    name="uploads",
)
