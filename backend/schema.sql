-- ============================================================
-- Yogizo Cinema — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Users (own auth — bcrypt + JWT, NOT Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

CREATE TABLE IF NOT EXISTS movies (
    id               BIGSERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT,
    poster_url       TEXT,
    duration_minutes INT NOT NULL,
    genre            TEXT,
    rating           TEXT CHECK (rating IN ('U', 'UA', 'A')),
    language         TEXT NOT NULL DEFAULT 'English',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE movies ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'English';
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movies' AND column_name = 'rating' AND data_type != 'text'
    ) THEN
        ALTER TABLE movies ALTER COLUMN rating TYPE TEXT USING rating::TEXT;
    END IF;
END $$;
ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_rating_check;
ALTER TABLE movies ADD CONSTRAINT movies_rating_check CHECK (rating IN ('U', 'UA', 'A'));

CREATE TABLE IF NOT EXISTS shows (
    id          BIGSERIAL PRIMARY KEY,
    movie_id    BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    show_time   TIMESTAMPTZ NOT NULL,
    start_time  TIMESTAMPTZ,
    price       NUMERIC(8,2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shows ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
UPDATE shows SET start_time = show_time WHERE start_time IS NULL;

-- 80 seats per show: rows A-H (8) × numbers 1-10
CREATE TABLE IF NOT EXISTS seats (
    id      BIGSERIAL PRIMARY KEY,
    show_id BIGINT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    row     CHAR(1) NOT NULL,
    number  INT NOT NULL,
    UNIQUE (show_id, row, number)
);

CREATE TABLE IF NOT EXISTS bookings (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_id     BIGINT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    total_price NUMERIC(8,2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on seat_id = one booking per seat, enforced at DB level
CREATE TABLE IF NOT EXISTS booking_seats (
    id         BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id    BIGINT NOT NULL REFERENCES seats(id),
    UNIQUE (seat_id)
);

-- Held or booked seats for a show (hall capacity = 80)
CREATE TABLE IF NOT EXISTS seat_reservations (
    id          BIGSERIAL PRIMARY KEY,
    show_id     BIGINT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    seat_row    CHAR(1) NOT NULL,
    seat_number INT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('booked', 'held')),
    held_until  TIMESTAMPTZ,
    booking_id  BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
    UNIQUE (show_id, seat_row, seat_number)
);

ALTER TABLE seat_reservations ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- ── Row Level Security ──────────────────────────────────────
-- The FastAPI backend uses the service_role key, which bypasses RLS.
-- Disable RLS on all tables so the anon key also works during development.
ALTER TABLE users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE movies        DISABLE ROW LEVEL SECURITY;
ALTER TABLE shows         DISABLE ROW LEVEL SECURITY;
ALTER TABLE seats         DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats DISABLE ROW LEVEL SECURITY;
ALTER TABLE seat_reservations DISABLE ROW LEVEL SECURITY;

-- ── Grant PostgREST (anon / authenticated roles) full access ──
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ── Hold seats (single transaction) ──────────────────────────
CREATE OR REPLACE FUNCTION hold_seats(
    p_show_id BIGINT,
    p_user_id BIGINT,
    p_seats   TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_now         TIMESTAMPTZ := NOW();
    v_held_until  TIMESTAMPTZ := NOW() + INTERVAL '5 minutes';
    v_label       TEXT;
    v_row         CHAR(1);
    v_num         INT;
    v_taken       TEXT[] := ARRAY[]::TEXT[];
    v_conflict    RECORD;
BEGIN
    -- Clear expired holds for this show
    DELETE FROM seat_reservations
    WHERE show_id = p_show_id
      AND status = 'held'
      AND (held_until IS NULL OR held_until <= v_now);

    -- Clear this user's existing holds for this show
    DELETE FROM seat_reservations
    WHERE show_id = p_show_id
      AND user_id = p_user_id
      AND status = 'held';

    -- Detect seats already booked or actively held
    FOREACH v_label IN ARRAY p_seats LOOP
        v_row := LEFT(v_label, 1);
        v_num := CAST(SUBSTRING(v_label FROM 2) AS INT);

        SELECT seat_row, seat_number INTO v_conflict
        FROM seat_reservations
        WHERE show_id = p_show_id
          AND seat_row = v_row
          AND seat_number = v_num
          AND (
            status = 'booked'
            OR (status = 'held' AND held_until > v_now)
          )
        LIMIT 1;

        IF FOUND THEN
            v_taken := array_append(v_taken, v_label);
        END IF;
    END LOOP;

    IF array_length(v_taken, 1) IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'taken', to_jsonb(v_taken));
    END IF;

    -- Insert new holds
    FOREACH v_label IN ARRAY p_seats LOOP
        v_row := LEFT(v_label, 1);
        v_num := CAST(SUBSTRING(v_label FROM 2) AS INT);

        INSERT INTO seat_reservations (
            show_id, user_id, seat_row, seat_number, status, held_until
        ) VALUES (
            p_show_id, p_user_id, v_row, v_num, 'held', v_held_until
        );
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true,
        'held_until', v_held_until,
        'seats', to_jsonb(p_seats)
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'ok', false,
            'taken', to_jsonb(p_seats),
            'detail', 'Seat conflict'
        );
END;
$$;

-- ── Confirm payment / book held seats (single transaction) ───
CREATE OR REPLACE FUNCTION pay_held_seats(
    p_show_id BIGINT,
    p_user_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_now      TIMESTAMPTZ := NOW();
    v_price    NUMERIC(8,2);
    v_amount   NUMERIC(8,2);
    v_booking  BIGINT;
    v_movie    TEXT;
    v_start    TIMESTAMPTZ;
    v_seats    TEXT[];
    v_count    INT;
BEGIN
    SELECT COALESCE(s.start_time, s.show_time), s.price, m.title
      INTO v_start, v_price, v_movie
    FROM shows s
    JOIN movies m ON m.id = s.movie_id
    WHERE s.id = p_show_id;

    IF v_price IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'show_not_found');
    END IF;

    SELECT array_agg(seat_row || seat_number::TEXT ORDER BY seat_row, seat_number),
           COUNT(*)
      INTO v_seats, v_count
    FROM seat_reservations
    WHERE show_id = p_show_id
      AND user_id = p_user_id
      AND status = 'held'
      AND held_until > v_now;

    IF v_count IS NULL OR v_count = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'hold_expired');
    END IF;

    v_amount := v_price * v_count;

    INSERT INTO bookings (user_id, show_id, total_price)
    VALUES (p_user_id, p_show_id, v_amount)
    RETURNING id INTO v_booking;

    UPDATE seat_reservations
    SET status = 'booked',
        booking_id = v_booking,
        held_until = NULL
    WHERE show_id = p_show_id
      AND user_id = p_user_id
      AND status = 'held'
      AND held_until > v_now;

    RETURN jsonb_build_object(
        'ok', true,
        'id', v_booking,
        'movie', v_movie,
        'date', to_char(v_start AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
        'time', to_char(v_start AT TIME ZONE 'UTC', 'HH24:MI'),
        'seats', to_jsonb(v_seats),
        'amount', v_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION hold_seats(BIGINT, BIGINT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pay_held_seats(BIGINT, BIGINT) TO anon, authenticated;
