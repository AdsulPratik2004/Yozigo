"""
BFF (Backend for Frontend) — Supabase edition.

Single point of contact between FastAPI routes and Supabase.
All data access goes through this module; routes never touch Supabase directly.
"""
from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_url: str = os.getenv("SUPABASE_URL", "")
_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

if not _url or not _key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set in .env")

sb: Client = create_client(_url, _key)


# ── Helpers ────────────────────────────────────────────────────────────────────

HALL_CAPACITY = 80


def _f(v: Any) -> float | None:
    """Coerce Supabase NUMERIC strings → float, preserving None."""
    return float(v) if v is not None else None


def _parse_dt(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _show_start(row: dict) -> datetime | None:
    return _parse_dt(row.get("start_time") or row.get("show_time"))


def _is_occupied(reservation: dict, now: datetime) -> bool:
    status = reservation.get("status")
    if status == "booked":
        return True
    if status == "held":
        until = _parse_dt(reservation.get("held_until"))
        return until is not None and until > now
    return False


def _available_seats(reservations: list | None, now: datetime) -> int:
    taken = sum(1 for r in (reservations or []) if _is_occupied(r, now))
    return max(0, HALL_CAPACITY - taken)


# ── Auth / Users ───────────────────────────────────────────────────────────────

def user_exists(email: str) -> bool:
    res = sb.table("users").select("id").eq("email", email).execute()
    return bool(res.data)


def _user_row(row: dict, *, include_hash: bool = False) -> dict:
    user = {
        "id": row["id"],
        "user_id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row.get("role") or "customer",
    }
    if include_hash:
        user["password_hash"] = row["password_hash"]
    return user


def create_user(
    email: str, password_hash: str, name: str, role: str = "customer"
) -> dict:
    del role  # signup always persists customer
    res = (
        sb.table("users")
        .insert(
            {
                "email": email,
                "password_hash": password_hash,
                "name": name,
                "role": "customer",
            }
        )
        .execute()
    )
    return _user_row(res.data[0])


def get_user_by_email(email: str) -> dict | None:
    res = (
        sb.table("users")
        .select("id, email, name, password_hash, role")
        .eq("email", email)
        .execute()
    )
    return _user_row(res.data[0], include_hash=True) if res.data else None


def get_user_by_id(user_id: int) -> dict | None:
    res = (
        sb.table("users")
        .select("id, email, name, role")
        .eq("id", user_id)
        .execute()
    )
    return _user_row(res.data[0]) if res.data else None


# ── Movies ─────────────────────────────────────────────────────────────────────

def list_movies() -> list[dict]:
    res = sb.table("movies").select("*").order("id").execute()
    return [
        {
            **m,
            "language": m.get("language") or "English",
            "rating": m.get("rating"),
        }
        for m in res.data
    ]


def get_movie(movie_id: int) -> dict | None:
    res = sb.table("movies").select("*").eq("id", movie_id).execute()
    if not res.data:
        return None
    m = res.data[0]
    return {
        **m,
        "language": m.get("language") or "English",
        "rating": m.get("rating"),
    }


def create_movie(data: dict) -> dict:
    res = sb.table("movies").insert(data).execute()
    return get_movie(res.data[0]["id"])


def update_movie(movie_id: int, data: dict) -> dict | None:
    if not data:
        return get_movie(movie_id)
    if not get_movie(movie_id):
        return None
    sb.table("movies").update(data).eq("id", movie_id).execute()
    return get_movie(movie_id)


def delete_movie(movie_id: int) -> bool:
    if not get_movie(movie_id):
        return False
    sb.table("movies").delete().eq("id", movie_id).execute()
    return True


def get_upcoming_shows_grouped(movie_id: int) -> list[dict]:
    """Upcoming shows (start_time > now) grouped by date, with available_seats."""
    now = datetime.now(timezone.utc)
    res = (
        sb.table("shows")
        .select("id, start_time, show_time, price, seat_reservations(id, status, held_until)")
        .eq("movie_id", movie_id)
        .order("start_time")
        .execute()
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for s in res.data:
        start = _show_start(s)
        if start is None or start <= now:
            continue
        date_key = start.date().isoformat()
        grouped[date_key].append(
            {
                "id": s["id"],
                "start_time": start.isoformat(),
                "price": _f(s["price"]),
                "available_seats": _available_seats(s.get("seat_reservations"), now),
            }
        )
    return [{"date": date, "showtimes": grouped[date]} for date in sorted(grouped)]


# ── Shows ──────────────────────────────────────────────────────────────────────

def get_show(show_id: int) -> dict | None:
    """Show with parent movie info + full 80-seat map with is_booked per seat."""
    res = (
        sb.table("shows")
        .select(
            "id, start_time, show_time, price, movie_id,"
            " movies(id, title, duration_minutes, genre, rating, poster_url),"
            " seats(id, row, number, booking_seats(id))"
        )
        .eq("id", show_id)
        .execute()
    )
    if not res.data:
        return None
    s = res.data[0]
    movie: dict = s.pop("movies") or {}
    seats_raw: list = s.pop("seats", []) or []
    start = _show_start(s)

    seats = sorted(
        [
            {
                "id": seat["id"],
                "row": seat["row"],
                "number": seat["number"],
                "is_booked": bool(seat.get("booking_seats")),
            }
            for seat in seats_raw
        ],
        key=lambda x: (x["row"], x["number"]),
    )

    start_iso = start.isoformat() if start else s.get("show_time")
    return {
        "id": s["id"],
        "movie_id": s.get("movie_id"),
        "start_time": start_iso,
        "show_time": start_iso,
        "price": _f(s["price"]),
        "movie": {
            "id": movie.get("id"),
            "title": movie.get("title"),
            "duration_minutes": movie.get("duration_minutes"),
            "genre": movie.get("genre"),
            "rating": _f(movie.get("rating")),
            "poster_url": movie.get("poster_url"),
        },
        "seats": seats,
    }


def get_show_lite(show_id: int) -> dict | None:
    res = (
        sb.table("shows")
        .select("id, movie_id, start_time, show_time, price")
        .eq("id", show_id)
        .execute()
    )
    return res.data[0] if res.data else None


def show_overlaps(
    start_time: datetime, duration_minutes: int, *, exclude_show_id: int | None = None
) -> bool:
    new_start = _parse_dt(start_time)
    if new_start is None:
        return False
    new_end = new_start + timedelta(minutes=duration_minutes)

    res = (
        sb.table("shows")
        .select("id, start_time, show_time, movies(duration_minutes)")
        .execute()
    )
    for row in res.data:
        if exclude_show_id is not None and row["id"] == exclude_show_id:
            continue
        other_start = _show_start(row)
        movie = row.get("movies") or {}
        other_duration = movie.get("duration_minutes") or 0
        if other_start is None or not other_duration:
            continue
        other_end = other_start + timedelta(minutes=int(other_duration))
        if new_start < other_end and new_end > other_start:
            return True
    return False


def create_show(movie_id: int, start_time: datetime, price: float) -> dict:
    start = _parse_dt(start_time)
    iso = start.isoformat() if start else start_time.isoformat()
    res = (
        sb.table("shows")
        .insert(
            {
                "movie_id": movie_id,
                "start_time": iso,
                "show_time": iso,
                "price": price,
            }
        )
        .execute()
    )
    return {
        "id": res.data[0]["id"],
        "movie_id": movie_id,
        "start_time": iso,
        "price": _f(price),
    }


def show_has_bookings(show_id: int) -> bool:
    res = sb.table("bookings").select("id").eq("show_id", show_id).limit(1).execute()
    return bool(res.data)


def delete_show(show_id: int) -> None:
    sb.table("shows").delete().eq("id", show_id).execute()


def show_has_started(show: dict) -> bool:
    start = _show_start(show)
    if start is None:
        return True
    return start <= datetime.now(timezone.utc)


# ── Seats / Holds ──────────────────────────────────────────────────────────────

ROWS = list("ABCDEFGH")
NUMBERS = list(range(1, 11))


def list_show_seats(show_id: int, user_id: int) -> list[dict]:
    """All 80 seats with status available|held|booked; mine + held_until for own holds."""
    now = datetime.now(timezone.utc)
    res = (
        sb.table("seat_reservations")
        .select("seat_row, seat_number, status, held_until, user_id")
        .eq("show_id", show_id)
        .execute()
    )
    by_label: dict[str, dict] = {}
    for r in res.data:
        label = f"{r['seat_row'].strip()}{r['seat_number']}"
        by_label[label] = r

    seats: list[dict] = []
    for row in ROWS:
        for num in NUMBERS:
            label = f"{row}{num}"
            r = by_label.get(label)
            if not r:
                seats.append({"seat": label, "status": "available", "mine": False})
                continue

            status = r["status"]
            until = _parse_dt(r.get("held_until"))
            is_mine = r.get("user_id") == user_id

            if status == "booked":
                seats.append({"seat": label, "status": "booked", "mine": False})
            elif status == "held" and until is not None and until > now:
                entry: dict[str, Any] = {
                    "seat": label,
                    "status": "held",
                    "mine": is_mine,
                }
                if is_mine:
                    entry["held_until"] = until.isoformat()
                seats.append(entry)
            else:
                # expired hold → treat as available
                seats.append({"seat": label, "status": "available", "mine": False})
    return seats


def hold_seats(show_id: int, user_id: int, seats: list[str]) -> dict:
    """Hold seats in one DB transaction via Postgres RPC."""
    res = sb.rpc(
        "hold_seats",
        {"p_show_id": show_id, "p_user_id": user_id, "p_seats": seats},
    ).execute()
    return res.data if isinstance(res.data, dict) else {"ok": False, "taken": seats}


def get_active_user_holds(show_id: int, user_id: int) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    res = (
        sb.table("seat_reservations")
        .select("id, seat_row, seat_number, held_until")
        .eq("show_id", show_id)
        .eq("user_id", user_id)
        .eq("status", "held")
        .gt("held_until", now)
        .execute()
    )
    return res.data or []


def pay_held_seats(show_id: int, user_id: int) -> dict:
    """Convert active holds to a booking in one DB transaction via Postgres RPC."""
    res = sb.rpc(
        "pay_held_seats",
        {"p_show_id": show_id, "p_user_id": user_id},
    ).execute()
    return res.data if isinstance(res.data, dict) else {"ok": False, "error": "unknown"}


# ── Bookings ───────────────────────────────────────────────────────────────────

def check_seats_available(show_id: int, seat_ids: list[int]) -> list[dict]:
    """
    Returns the subset of seat_ids that are valid for this show AND not yet booked.
    Caller should verify len(result) == len(seat_ids).
    """
    res = (
        sb.table("seats")
        .select("id, row, number, booking_seats(id)")
        .in_("id", seat_ids)
        .eq("show_id", show_id)
        .execute()
    )
    # booking_seats is [] when not booked, [{"id": ...}] when booked
    return [s for s in res.data if not s.get("booking_seats")]


def get_show_price(show_id: int) -> float | None:
    res = sb.table("shows").select("price").eq("id", show_id).execute()
    return _f(res.data[0]["price"]) if res.data else None


def insert_booking(user_id: int, show_id: int, total_price: float) -> int:
    res = (
        sb.table("bookings")
        .insert({"user_id": user_id, "show_id": show_id, "total_price": total_price})
        .execute()
    )
    return res.data[0]["id"]


def insert_booking_seats(booking_id: int, seat_ids: list[int]) -> None:
    records = [{"booking_id": booking_id, "seat_id": sid} for sid in seat_ids]
    sb.table("booking_seats").insert(records).execute()


def list_user_bookings(user_id: int) -> list[dict]:
    """
    Return all bookings for *user_id* with the fields required by the spec:
    id, movie_title, show_start (ISO-8601), seats, amount, status.
    Sorted: upcoming first (ascending by show_start), then past (descending).
    """
    now = datetime.now(timezone.utc)
    res = (
        sb.table("bookings")
        .select(
            "id, show_id, total_price, created_at,"
            " shows(start_time, show_time, movies(title, poster_url)),"
            " seat_reservations(seat_row, seat_number),"
            " booking_seats(seats(row, number))"
        )
        .eq("user_id", user_id)
        .execute()
    )

    upcoming: list[dict] = []
    past: list[dict] = []

    for b in res.data:
        show: dict = b.pop("shows") or {}
        movie: dict = show.get("movies") or {}
        sr: list = b.pop("seat_reservations", []) or []
        bs: list = b.pop("booking_seats", []) or []
        seats = [
            {"row": r["seat_row"].strip(), "number": r["seat_number"]}
            for r in sr
            if r.get("seat_row") is not None
        ]
        if not seats:
            seats = [
                {"row": entry["seats"]["row"].strip(), "number": entry["seats"]["number"]}
                for entry in bs
                if entry.get("seats")
            ]
        raw_start = show.get("start_time") or show.get("show_time")
        show_start_dt = _parse_dt(raw_start)
        show_start_iso = show_start_dt.isoformat() if show_start_dt else raw_start
        is_upcoming = show_start_dt is not None and show_start_dt > now
        row = {
            "id": b["id"],
            "movie_title": movie.get("title"),
            "poster_url": movie.get("poster_url"),
            "show_start": show_start_iso,
            "seats": seats,
            "amount": _f(b["total_price"]),
            "status": "upcoming" if is_upcoming else "past",
        }
        if is_upcoming:
            upcoming.append(row)
        else:
            past.append(row)

    upcoming.sort(key=lambda x: x["show_start"] or "")
    past.sort(key=lambda x: x["show_start"] or "", reverse=True)
    return upcoming + past


def get_booking(booking_id: int, user_id: int) -> dict | None:
    """
    Fetch a single booking that belongs to *user_id*.
    Returns None (→ 404 in the route) if the booking doesn't exist
    or belongs to a different user.
    """
    now = datetime.now(timezone.utc)
    res = (
        sb.table("bookings")
        .select(
            "id, show_id, total_price, created_at,"
            " shows(start_time, show_time, movies(title, poster_url)),"
            " seat_reservations(seat_row, seat_number),"
            " booking_seats(seats(row, number))"
        )
        .eq("id", booking_id)
        .eq("user_id", user_id)  # ownership enforced here — wrong owner → empty result → 404
        .execute()
    )
    if not res.data:
        return None
    b = res.data[0]
    show: dict = b.pop("shows") or {}
    movie: dict = show.get("movies") or {}
    sr: list = b.pop("seat_reservations", []) or []
    bs: list = b.pop("booking_seats", []) or []
    seats = [
        {"row": r["seat_row"].strip(), "number": r["seat_number"]}
        for r in sr
        if r.get("seat_row") is not None
    ]
    if not seats:
        seats = [
            {"row": entry["seats"]["row"].strip(), "number": entry["seats"]["number"]}
            for entry in bs
            if entry.get("seats")
        ]
    raw_start = show.get("start_time") or show.get("show_time")
    show_start_dt = _parse_dt(raw_start)
    show_start_iso = show_start_dt.isoformat() if show_start_dt else raw_start
    is_upcoming = show_start_dt is not None and show_start_dt > now
    return {
        "id": b["id"],
        "movie_title": movie.get("title"),
        "poster_url": movie.get("poster_url"),
        "show_start": show_start_iso,
        "seats": seats,
        "amount": _f(b["total_price"]),
        "status": "upcoming" if is_upcoming else "past",
    }


def cancel_booking(booking_id: int, user_id: int) -> bool:
    """
    Cancel a booking and release the seats.
    Returns True if cancelled, False if booking not found or cannot be cancelled (past show).
    """
    now = datetime.now(timezone.utc)
    
    # Fetch booking with show time to check if it's upcoming
    res = (
        sb.table("bookings")
        .select("id, show_id, shows(start_time, show_time)")
        .eq("id", booking_id)
        .eq("user_id", user_id)
        .execute()
    )
    
    if not res.data:
        return False
    
    booking = res.data[0]
    show = booking.get("shows") or {}
    raw_start = show.get("start_time") or show.get("show_time")
    show_start_dt = _parse_dt(raw_start)
    
    # Cannot cancel past shows
    if show_start_dt and show_start_dt <= now:
        return False
    
    # Delete booking_seats records (releases seats)
    sb.table("booking_seats").delete().eq("booking_id", booking_id).execute()
    
    # Delete seat_reservations records for this booking
    sb.table("seat_reservations").delete().eq("booking_id", booking_id).execute()
    
    # Delete the booking itself
    sb.table("bookings").delete().eq("id", booking_id).execute()
    
    return True

