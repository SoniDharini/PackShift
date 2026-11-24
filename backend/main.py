"""PackShift redesign API."""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes.materials import router as materials_router
from routes.optimise import router as optimise_router
from routes.redesign import router as redesign_router
from services.validation_service import PackagingValidationError

app = FastAPI(
    title="PackShift Redesign API",
    version="1.0.0",
    summary="Calculate a redesigned carton from the product and the current package.",
)

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_origins = [origin.strip() for origin in os.getenv("PACKSHIFT_CORS_ORIGINS", _default_origins).split(",") if origin.strip()]
_origin_regex = os.getenv("PACKSHIFT_CORS_ORIGIN_REGEX", "").strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_origin_regex or None,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(materials_router)
app.include_router(redesign_router)
app.include_router(optimise_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "packshift-redesign", "version": app.version}


def _validation_payload(errors: list[dict[str, str]]) -> dict[str, object]:
    return {"status": "error", "errors": errors}


@app.exception_handler(RequestValidationError)
async def request_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: list[dict[str, str]] = []
    for item in exc.errors():
        location = [str(part) for part in item.get("loc", []) if part != "body"]
        errors.append({"field": ".".join(location) or "request", "message": str(item.get("msg", "Invalid value."))})
    return JSONResponse(status_code=422, content=_validation_payload(errors))


@app.exception_handler(PackagingValidationError)
async def packaging_validation_error(_request: Request, exc: PackagingValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=_validation_payload(exc.errors))
