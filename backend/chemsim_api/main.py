"""FastAPI application for ChemSim."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chemsim_api.routers import molecules, calculations, ws, ai_generate

app = FastAPI(title="ChemSim API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(molecules.router)
app.include_router(calculations.router)
app.include_router(ws.router)
app.include_router(ai_generate.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
