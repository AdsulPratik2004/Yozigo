import os
from contextlib import contextmanager
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    """Establish and return a psycopg database connection using DATABASE_URL from .env."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not configured in .env. "
            "Please provide DATABASE_URL=postgresql://user:password@host:port/dbname"
        )
    return psycopg.connect(db_url, row_factory=dict_row)


get_db_connection = get_connection


@contextmanager
def get_db():
    """Context manager for acquiring and safely releasing a psycopg connection."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
