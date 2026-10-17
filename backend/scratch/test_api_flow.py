import urllib.request
import urllib.error
import json

BASE = "http://127.0.0.1:8000"

def req(path, method="GET", data=None, token=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as res:
            resp_body = res.read().decode("utf-8")
            return res.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"raw": err_body}

def main():
    print("1. Testing GET /movies")
    s, movies = req("/movies")
    print(f"Status: {s}, Count: {len(movies)}")
    assert s == 200 and len(movies) > 0, "Failed /movies"
    movie_id = movies[0]["id"]

    print(f"\n2. Testing GET /movies/{movie_id}")
    s, movie = req(f"/movies/{movie_id}")
    assert s == 200, "Failed /movies/{id}"
    shows_groups = movie.get("shows", [])
    assert len(shows_groups) > 0, "No shows found"
    show_id = shows_groups[0]["showtimes"][0]["id"]
    print(f"Movie: {movie['title']}, Testing Show #{show_id}")

    print("\n3. Testing POST /auth/login for user@test.com")
    s, auth = req("/auth/login", method="POST", data={"email": "user@test.com", "password": "User1234"})
    assert s == 200 and "token" in auth, f"Failed login: {auth}"
    token = auth["token"]
    user_id = auth["user"]["id"]
    print(f"Logged in user id: {user_id}")

    print(f"\n4. Testing GET /shows/{show_id}/seats")
    s, seats = req(f"/shows/{show_id}/seats", token=token)
    print(f"Status: {s}, Total seats: {len(seats)}")
    assert s == 200 and len(seats) == 80, f"Expected 80 seats, got {len(seats)}"

    print(f"\n5. Testing POST /shows/{show_id}/hold for seat A1")
    s, hold = req(f"/shows/{show_id}/hold", method="POST", data={"seats": ["A1"]}, token=token)
    print(f"Status: {s}, Hold resp: {hold}")
    assert s == 200, f"Failed hold: {hold}"

    print(f"\n6. Testing POST /shows/{show_id}/pay")
    s, pay = req(f"/shows/{show_id}/pay", method="POST", data={"result": "success"}, token=token)
    print(f"Status: {s}, Pay resp: {pay}")
    assert s == 200 and "id" in pay, f"Failed pay: {pay}"
    booking_id = pay["id"]

    print(f"\n7. Testing GET /bookings")
    s, bookings = req("/bookings", token=token)
    print(f"Status: {s}, Bookings count: {len(bookings)}")
    assert s == 200 and len(bookings) > 0, "Failed /bookings"
    found = next((b for b in bookings if b["id"] == booking_id), None)
    assert found is not None, f"Booking #{booking_id} not in list"
    print(f"Found booking #{booking_id}: seats={found['seats']}, amount={found['amount']}, status={found['status']}")
    assert len(found["seats"]) > 0, f"Seats empty for booking #{booking_id}!"

    print(f"\n8. Testing GET /bookings/{booking_id}")
    s, single_b = req(f"/bookings/{booking_id}", token=token)
    print(f"Status: {s}, Single booking movie={single_b.get('movie_title')}, seats={single_b.get('seats')}")
    assert s == 200 and len(single_b.get("seats", [])) > 0

    print("\n=============================================")
    print("ALL API FLOWS (MOVIES -> SHOWS -> SEATS -> HOLD -> PAY -> BOOKINGS) VERIFIED!")
    print("=============================================")

if __name__ == "__main__":
    main()
