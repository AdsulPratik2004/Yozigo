from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth import hash_password
from app.main import app

client = TestClient(app)


@pytest.fixture()
def mock_users(monkeypatch):
    store: dict[str, dict] = {}

    def user_exists(email: str) -> bool:
        return email in store

    def create_user(email, password_hash, name, role="customer"):
        row = {
            "id": len(store) + 1,
            "user_id": len(store) + 1,
            "email": email,
            "name": name,
            "role": "customer",
            "password_hash": password_hash,
        }
        store[email] = row
        store[row["id"]] = row
        return row

    def get_user_by_email(email: str):
        return store.get(email)

    def get_user_by_id(user_id: int):
        return store.get(user_id)

    monkeypatch.setattr("app.routes.auth.bff.user_exists", user_exists)
    monkeypatch.setattr("app.routes.auth.bff.create_user", create_user)
    monkeypatch.setattr("app.routes.auth.bff.get_user_by_email", get_user_by_email)
    monkeypatch.setattr("app.auth.bff.get_user_by_id", get_user_by_id)
    monkeypatch.setattr("app.main.bff.sb", MagicMock())
    return store


def test_signup_success(mock_users):
    res = client.post(
        "/auth/signup",
        json={"name": "Test User", "email": "test@example.com", "password": "secret123"},
    )
    assert res.status_code == 201
    body = res.json()
    assert "token" in body
    assert body["user"]["email"] == "test@example.com"
    assert body["user"]["role"] == "customer"


def test_signup_duplicate(mock_users):
    mock_users["dup@example.com"] = {
        "id": 1,
        "email": "dup@example.com",
        "name": "X",
        "role": "customer",
        "password_hash": "x",
    }
    res = client.post(
        "/auth/signup",
        json={"name": "Dup", "email": "dup@example.com", "password": "secret123"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "An account with this email already exists"


def test_signup_short_password(mock_users):
    res = client.post(
        "/auth/signup",
        json={"name": "Test", "email": "a@b.com", "password": "short"},
    )
    assert res.status_code == 422


def test_login_wrong_email_or_password(mock_users):
    mock_users["user@example.com"] = {
        "id": 2,
        "email": "user@example.com",
        "name": "User",
        "role": "customer",
        "password_hash": hash_password("correct12"),
    }
    missing = client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "correct12"},
    )
    wrong = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "wrongpass"},
    )
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert missing.json()["detail"] == "Invalid email or password"
    assert wrong.json()["detail"] == "Invalid email or password"


def test_me_requires_token(mock_users):
    res = client.get("/auth/me")
    assert res.status_code == 401
