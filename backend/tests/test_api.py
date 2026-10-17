"""
Integration tests for the Yogizo Cinema API.

These tests hit the REAL Supabase database — no mocks.
Run from the backend/ directory:

    pytest tests/test_api.py -v

Requirements
------------
* backend/.env must contain valid SUPABASE_URL, SUPABASE_KEY, and JWT_SECRET.
* The schema.sql must already have been applied.

Isolation strategy
------------------
Every test that writes data uses the `live_show` fixture (session-scoped) which
creates a dedicated movie + show + 80 seats and tears them all down afterwards.
Users created during tests are cleaned up by each fixture/test that created them.
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import bff

# ---------------------------------------------------------------------------
# Shared test client
# ---------------------------------------------------------------------------

client = TestClient(app)

# ---------------------------------------------------------------------------
# Session-level DB warm-up
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def warmup_db():
    """
    Verifies the database is reachable and the schema has been applied.

    PostgREST (Supabase) returns PGRST205 when a table doesn't exist in its
    schema cache — most commonly because schema.sql hasn't been run yet.

    This fixture runs before any other test and skips the entire session with
    a clear message if the DB isn't ready, rather than failing every test with
    a cryptic API error.
    """
    REQUIRED_TABLES = (
        "users", "movies", "shows", "seats",
        "seat_reservations", "bookings", "booking_seats",
    )
    missing: list[str] = []
    for table in REQUIRED_TABLES:
        try:
            bff.sb.table(table).select("id").limit(1).execute()
        except Exception as exc:
            code = getattr(exc, "code", "") or ""
            if "PGRST205" in str(code) or "schema cache" in str(exc).lower():
                missing.append(table)
            # Other errors (network, auth) are re-raised
            else:
                pytest.fail(
                    f"Unexpected error accessing table '{table}': {exc}\n\n"
                    "Make sure SUPABASE_URL and SUPABASE_KEY in backend/.env are correct."
                )

    if missing:
        pytest.skip(
            f"\n\nDatabase schema not applied — table(s) not found: {', '.join(missing)}\n\n"
            "Run the following steps before executing the integration tests:\n"
            "  1. Open Supabase Dashboard → SQL Editor\n"
            "  2. Paste and run the contents of backend/schema.sql\n"
            "  3. Re-run: pytest tests/test_api.py -v\n",
            allow_module_level=True,
        )

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ROWS = list("ABCDEFGH")
_NUMBERS = list(range(1, 11))


def _unique_email(prefix: str = "test") -> str:
    """Generate a unique email so parallel runs don't collide."""
    return f"{prefix}+{uuid.uuid4().hex[:8]}@yogizo-test.example.com"


def _signup(email: str, password: str = "TestPass1!", name: str = "Test User") -> dict:
    """Sign up and return the parsed response body (includes 'token')."""
    res = client.post(
        "/auth/signup",
        json={"name": name, "email": email, "password": password},
    )
    assert res.status_code == 201, f"signup failed: {res.text}"
    return res.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _delete_user(user_id: int) -> None:
    """Hard-delete a test user directly via Supabase (cascades bookings etc.)."""
    try:
        bff.sb.table("users").delete().eq("id", user_id).execute()
    except Exception:
        pass  # best-effort cleanup


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def live_show():
    """
    Session-scoped fixture: creates one movie + one show starting 48 h from now
    (safely in the future) with 80 seats, then tears everything down.

    Uses bff helper functions (which share the already-warmed Supabase client)
    rather than raw SDK calls to avoid PostgREST schema-cache cold-start errors.

    Yields a dict:
        {
            "movie_id": int,
            "show_id":  int,
            "price":    float,
            "seats":    list[str],   # all 80 seat labels "A1" … "H10"
        }
    """
    # ── Create movie via bff (reuses warm client) ──────────────────────────
    movie = bff.create_movie(
        {
            "title": f"[TEST] Fixture Movie {uuid.uuid4().hex[:6]}",
            "description": "Ephemeral integration-test movie",
            "duration_minutes": 120,
            "genre": "Test",
            "rating": 7.0,
        }
    )
    movie_id: int = movie["id"]

    # ── Create show 48 h in the future ────────────────────────────────────
    start_time = datetime.now(timezone.utc) + timedelta(hours=48)
    show = bff.create_show(movie_id, start_time, 250.00)
    show_id: int = show["id"]

    # ── Create 80 seats via bff.sb (same client, now definitely warm) ──────
    seat_records = [
        {"show_id": show_id, "row": row, "number": num}
        for row in _ROWS
        for num in _NUMBERS
    ]
    bff.sb.table("seats").insert(seat_records).execute()

    all_seat_labels = [f"{row}{num}" for row in _ROWS for num in _NUMBERS]

    yield {
        "movie_id": movie_id,
        "show_id": show_id,
        "price": 250.00,
        "seats": all_seat_labels,
    }

    # ── Teardown (cascade FK order) ────────────────────────────────────────
    try:
        bff.sb.table("seat_reservations").delete().eq("show_id", show_id).execute()
        existing_bookings = (
            bff.sb.table("bookings")
            .select("id")
            .eq("show_id", show_id)
            .execute()
            .data
            or []
        )
        booking_ids = [r["id"] for r in existing_bookings]
        if booking_ids:
            bff.sb.table("booking_seats").delete().in_(
                "booking_id", booking_ids
            ).execute()
            bff.sb.table("bookings").delete().eq("show_id", show_id).execute()
        bff.sb.table("seats").delete().eq("show_id", show_id).execute()
        bff.sb.table("shows").delete().eq("id", show_id).execute()
        bff.sb.table("movies").delete().eq("id", movie_id).execute()
    except Exception:
        pass  # best-effort


@pytest.fixture()
def customer_a(live_show):  # noqa: ARG001  (live_show keeps DB alive)
    """A freshly-signed-up customer. Cleaned up after the test."""
    email = _unique_email("cust_a")
    data = _signup(email)
    user_id: int = data["user"]["id"]
    token: str = data["token"]
    yield {"id": user_id, "email": email, "token": token}
    _delete_user(user_id)


@pytest.fixture()
def customer_b(live_show):  # noqa: ARG001
    """A second freshly-signed-up customer. Cleaned up after the test."""
    email = _unique_email("cust_b")
    data = _signup(email)
    user_id: int = data["user"]["id"]
    token: str = data["token"]
    yield {"id": user_id, "email": email, "token": token}
    _delete_user(user_id)


# ---------------------------------------------------------------------------
# 1. Duplicate-email signup → 409
# ---------------------------------------------------------------------------


def test_signup_duplicate_email_returns_409():
    """Signing up with an already-registered email must return 409."""
    email = _unique_email("dup")
    first = _signup(email)
    user_id = first["user"]["id"]
    try:
        res = client.post(
            "/auth/signup",
            json={"name": "Dup", "email": email, "password": "TestPass1!"},
        )
        assert res.status_code == 409
        assert "already exists" in res.json()["detail"].lower()
    finally:
        _delete_user(user_id)


# ---------------------------------------------------------------------------
# 2. Protected routes return 401 without a token
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET",  "/auth/me"),
        ("GET",  "/bookings"),
        ("GET",  "/bookings/1"),
        ("POST", "/shows/1/hold"),
        ("POST", "/shows/1/pay"),
        ("GET",  "/shows/1/seats"),
    ],
)
def test_protected_route_returns_401_without_token(method, path):
    """Every authenticated endpoint must reject requests with no Bearer token."""
    res = client.request(method, path)
    assert res.status_code == 401, (
        f"{method} {path} returned {res.status_code}, expected 401"
    )


# ---------------------------------------------------------------------------
# 3. Customer gets 403 on admin routes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method, path, body",
    [
        (
            "POST",
            "/movies",
            {"title": "Hack", "duration_minutes": 90},
        ),
        (
            "PUT",
            "/movies/1",
            {"title": "Hack"},
        ),
        (
            "DELETE",
            "/movies/1",
            None,
        ),
        (
            "POST",
            "/shows",
            {
                "movie_id": 1,
                "start_time": "2099-01-01T10:00:00Z",
                "price": 100,
            },
        ),
        (
            "DELETE",
            "/shows/1",
            None,
        ),
    ],
)
def test_customer_gets_403_on_admin_route(method, path, body, customer_a):
    """A customer JWT must be rejected with 403 on every admin-only endpoint."""
    headers = _auth_header(customer_a["token"])
    res = client.request(method, path, json=body, headers=headers)
    assert res.status_code == 403, (
        f"{method} {path} returned {res.status_code}, expected 403"
    )


# ---------------------------------------------------------------------------
# 4. Double booking: two users race for the same seat — exactly one wins
# ---------------------------------------------------------------------------


def test_double_booking_one_succeeds_one_conflicts(live_show, customer_a, customer_b):
    """
    Two users simultaneously hold the same seat.
    The Postgres hold_seats() RPC uses a unique constraint on (show_id, seat_row,
    seat_number) so exactly one hold must succeed (200) and the other must fail
    (409 Conflict).
    """
    show_id = live_show["show_id"]
    contested_seat = "A1"  # both users want this exact seat

    results: list[int] = []
    lock = threading.Lock()

    def attempt_hold(token: str) -> None:
        res = client.post(
            f"/shows/{show_id}/hold",
            json={"seats": [contested_seat]},
            headers=_auth_header(token),
        )
        with lock:
            results.append(res.status_code)

    t1 = threading.Thread(target=attempt_hold, args=(customer_a["token"],))
    t2 = threading.Thread(target=attempt_hold, args=(customer_b["token"],))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert sorted(results) == [200, 409], (
        f"Expected exactly one 200 and one 409, got: {results}"
    )


# ---------------------------------------------------------------------------
# 5. Paying after hold expiry returns 410
# ---------------------------------------------------------------------------


def test_pay_after_hold_expiry_returns_410(live_show, customer_a):
    """
    If a user tries to pay but has no active hold (or it already expired),
    the /pay endpoint must return 410 Gone.
    """
    show_id = live_show["show_id"]
    headers = _auth_header(customer_a["token"])

    # Attempt to pay without ever holding → no active hold → 410
    res = client.post(
        f"/shows/{show_id}/pay",
        json={"result": "success"},
        headers=headers,
    )
    assert res.status_code == 410, (
        f"Expected 410 when paying with no hold, got {res.status_code}: {res.text}"
    )

    # Now simulate an expired hold: insert a hold that is already past held_until
    expired_at = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    bff.sb.table("seat_reservations").insert(
        {
            "show_id": show_id,
            "user_id": customer_a["id"],
            "seat_row": "B",
            "seat_number": 1,
            "status": "held",
            "held_until": expired_at,
        }
    ).execute()

    try:
        res2 = client.post(
            f"/shows/{show_id}/pay",
            json={"result": "success"},
            headers=headers,
        )
        assert res2.status_code == 410, (
            f"Expected 410 for expired hold, got {res2.status_code}: {res2.text}"
        )
    finally:
        # Clean up the artificially inserted reservation
        bff.sb.table("seat_reservations").delete().eq("show_id", show_id).eq(
            "user_id", customer_a["id"]
        ).execute()


# ---------------------------------------------------------------------------
# 6. A user cannot read another user's booking
# ---------------------------------------------------------------------------


def test_user_cannot_read_another_users_booking(live_show, customer_a, customer_b):
    """
    After customer_a books a seat:
    - GET /bookings/{id} with customer_b's token must return 404.
    - GET /bookings with customer_b's token must NOT include customer_a's booking.
    """
    show_id = live_show["show_id"]

    # ── Step 1: customer_a holds and pays for a seat ──────────────────────
    hold_res = client.post(
        f"/shows/{show_id}/hold",
        json={"seats": ["C5"]},
        headers=_auth_header(customer_a["token"]),
    )
    assert hold_res.status_code == 200, f"Hold failed: {hold_res.text}"

    pay_res = client.post(
        f"/shows/{show_id}/pay",
        json={"result": "success"},
        headers=_auth_header(customer_a["token"]),
    )
    assert pay_res.status_code == 200, f"Pay failed: {pay_res.text}"
    booking_id: int = pay_res.json()["id"]

    try:
        # ── Step 2: customer_b tries to read customer_a's booking directly ─
        get_res = client.get(
            f"/bookings/{booking_id}",
            headers=_auth_header(customer_b["token"]),
        )
        assert get_res.status_code == 404, (
            f"Expected 404 when reading another user's booking, "
            f"got {get_res.status_code}: {get_res.text}"
        )

        # ── Step 3: customer_b's booking list must not contain the booking ─
        list_res = client.get(
            "/bookings",
            headers=_auth_header(customer_b["token"]),
        )
        assert list_res.status_code == 200
        booking_ids_in_list = [b["id"] for b in list_res.json()]
        assert booking_id not in booking_ids_in_list, (
            f"Booking {booking_id} (owned by customer_a) appeared in customer_b's list"
        )

        # ── Step 4: customer_a CAN read their own booking ─────────────────
        own_res = client.get(
            f"/bookings/{booking_id}",
            headers=_auth_header(customer_a["token"]),
        )
        assert own_res.status_code == 200
        body = own_res.json()
        assert body["id"] == booking_id
        assert "movie_title" in body
        assert "show_start" in body
        assert "seats" in body
        assert "amount" in body
        assert "status" in body

    finally:
        # ── Teardown: remove the booking so the show fixture teardown is clean
        try:
            bff.sb.table("seat_reservations").delete().eq("show_id", show_id).eq(
                "status", "booked"
            ).execute()
            booking_seats = (
                bff.sb.table("booking_seats")
                .select("id")
                .eq("booking_id", booking_id)
                .execute()
                .data
                or []
            )
            if booking_seats:
                bff.sb.table("booking_seats").delete().eq(
                    "booking_id", booking_id
                ).execute()
            bff.sb.table("bookings").delete().eq("id", booking_id).execute()
        except Exception:
            pass
