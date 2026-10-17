from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import bff
from app.routes import auth, bookings, movies, seats, shows

app = FastAPI(title="Yogizo Cinema API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(movies.router)
app.include_router(shows.router)
app.include_router(seats.router)
app.include_router(bookings.router)


@app.get("/health", tags=["meta"])
def health():
    try:
        bff.sb.table("movies").select("id").limit(1).execute()
        database = "ok"
    except Exception as exc:
        database = str(exc)
    return {"status": "ok", "database": database}
