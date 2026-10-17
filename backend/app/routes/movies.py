from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import bff
from app.auth import require_admin
from app.db import get_db

router = APIRouter(prefix="/movies", tags=["movies"])


class MovieCreate(BaseModel):
    title: str
    description: str | None = None
    poster_url: str | None = None
    duration_minutes: int = Field(gt=0)
    genre: str | None = None
    rating: Any | None = None
    language: str | None = "English"


class MovieUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    poster_url: str | None = None
    duration_minutes: int | None = Field(default=None, gt=0)
    genre: str | None = None
    rating: Any | None = None
    language: str | None = None


@router.get("", response_model=List[Dict[str, Any]])
def list_movies():
    """
    GET /movies
    Returns all movies from the database.
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, description, poster_url, duration_minutes, genre, rating,
                           COALESCE(language, 'English') AS language
                    FROM movies
                    ORDER BY id ASC;
                    """
                )
                movies = [dict(row) for row in cur.fetchall()]
                
                # Add booking counts for each movie
                for movie in movies:
                    cur.execute(
                        """
                        SELECT COUNT(DISTINCT b.id) as booking_count
                        FROM bookings b
                        JOIN shows s ON s.id = b.show_id
                        WHERE s.movie_id = %s;
                        """,
                        (movie["id"],)
                    )
                    result = cur.fetchone()
                    movie["booking_count"] = result["booking_count"] if result else 0
                
                return movies
    except Exception:
        # Fallback to Supabase client
        return bff.list_movies()


@router.get("/{movie_id}")
def get_movie(movie_id: int):
    """
    GET /movies/{id}
    Returns movie metadata plus its upcoming shows (start_time > now) grouped by date.
    Calculates available_seats (80 - active holds & bookings) using a single join query.
    Returns 404 if movie does not exist.
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # 1. Fetch movie
                cur.execute(
                    """
                    SELECT id, title, description, poster_url, duration_minutes, genre, rating,
                           COALESCE(language, 'English') AS language
                    FROM movies
                    WHERE id = %s;
                    """,
                    (movie_id,),
                )
                movie_row = cur.fetchone()
                if not movie_row:
                    raise HTTPException(status_code=404, detail="Movie not found")

                movie = dict(movie_row)

                # 2. Fetch upcoming shows (start_time > NOW()) with available_seats in one single SQL query with JOIN
                cur.execute(
                    """
                    SELECT 
                        s.id,
                        s.start_time,
                        s.price,
                        80 - COUNT(sr.id) FILTER (
                            WHERE sr.status = 'booked' OR (sr.status = 'held' AND sr.held_until > NOW())
                        ) AS available_seats
                    FROM shows s
                    LEFT JOIN seat_reservations sr ON sr.show_id = s.id
                    WHERE s.movie_id = %s AND s.start_time > NOW()
                    GROUP BY s.id, s.start_time, s.price
                    ORDER BY s.start_time ASC;
                    """,
                    (movie_id,),
                )
                shows_rows = cur.fetchall()

                # Group shows by date
                grouped: Dict[str, list] = defaultdict(list)
                for s in shows_rows:
                    st = s["start_time"]
                    if isinstance(st, datetime):
                        date_key = st.date().isoformat()
                        iso_time = st.isoformat()
                    else:
                        dt = datetime.fromisoformat(str(st).replace("Z", "+00:00"))
                        date_key = dt.date().isoformat()
                        iso_time = dt.isoformat()

                    grouped[date_key].append(
                        {
                            "id": s["id"],
                            "start_time": iso_time,
                            "price": float(s["price"]),
                            "available_seats": max(0, int(s["available_seats"])),
                        }
                    )

                movie["shows"] = [
                    {"date": d, "showtimes": grouped[d]}
                    for d in sorted(grouped.keys())
                ]
                return movie

    except HTTPException:
        raise
    except Exception:
        # Fallback to BFF
        movie = bff.get_movie(movie_id)
        if not movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        movie["shows"] = bff.get_upcoming_shows_grouped(movie_id)
        return movie


@router.post("", status_code=status.HTTP_201_CREATED)
def create_movie(body: MovieCreate, _: dict = Depends(require_admin)):
    print(f"Creating movie: {body}")
    try:
        result = bff.create_movie(body.model_dump())
        print(f"Movie created successfully: {result}")
        return result
    except Exception as e:
        print(f"Error creating movie: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create movie: {str(e)}"
        )


@router.put("/{movie_id}")
def update_movie(movie_id: int, body: MovieUpdate, _: dict = Depends(require_admin)):
    movie = bff.update_movie(movie_id, body.model_dump(exclude_unset=True))
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movie(movie_id: int, _: dict = Depends(require_admin)):
    if not bff.delete_movie(movie_id):
        raise HTTPException(status_code=404, detail="Movie not found")
