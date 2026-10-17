"""
Shared pytest configuration for the Yogizo Cinema test suite.

Prerequisites before running any test in this package:
  1. Apply schema.sql in Supabase: Dashboard → SQL Editor → Run schema.sql
  2. Copy backend/.env.example → backend/.env and fill in SUPABASE_URL + SUPABASE_KEY
  3. Run: pytest tests/ -v  (from the backend/ directory)
"""
