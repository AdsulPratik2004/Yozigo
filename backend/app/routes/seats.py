import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import bff
from app.auth import get_current_user

router = APIRouter(prefix="/shows", tags=["seats"])

SEAT_LABEL_RE = re.compile(r"^[A-H]([1-9]|10)$")
VALID_SEATS = {f"{row}{n}" for row in "ABCDEFGH" for n in range(1, 11)}


class HoldBody(BaseModel):
    seats: list[str] = Field(min_length=1, max_length=6)


class PayBody(BaseModel):
    result: str  # "success" | "failure"


def _validate_seat_labels(seats: list[str]) -> list[str]:
    if not (1 <= len(seats) <= 6):
        raise HTTPException(
            status_code=400,
            detail="Select between 1 and 6 seats",
        )
    normalized = [s.strip().upper() for s in seats]
    if len(set(normalized)) != len(normalized):
        raise HTTPException(status_code=400, detail="Duplicate seats in request")
    invalid = [s for s in normalized if s not in VALID_SEATS or not SEAT_LABEL_RE.match(s)]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid seat label(s): {', '.join(invalid)}",
        )
    return normalized


@router.get("/{show_id}/seats")
def get_seats(show_id: int, user: dict = Depends(get_current_user)):
    show = bff.get_show_lite(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    return bff.list_show_seats(show_id, user["id"])


@router.post("/{show_id}/hold")
def hold_seats(show_id: int, body: HoldBody, user: dict = Depends(get_current_user)):
    labels = _validate_seat_labels(body.seats)

    show = bff.get_show_lite(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    if bff.show_has_started(show):
        raise HTTPException(status_code=400, detail="This show has already started")

    result = bff.hold_seats(show_id, user["id"], labels)
    if not result.get("ok"):
        taken = result.get("taken") or labels
        names = ", ".join(taken)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Seat(s) already taken: {names}",
        )
    return {
        "status": "held",
        "seats": result["seats"],
        "held_until": result["held_until"],
    }


@router.post("/{show_id}/pay")
def pay_seats(show_id: int, body: PayBody, user: dict = Depends(get_current_user)):
    if body.result not in ("success", "failure"):
        raise HTTPException(
            status_code=400,
            detail='result must be "success" or "failure"',
        )

    show = bff.get_show_lite(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    holds = bff.get_active_user_holds(show_id, user["id"])
    if not holds:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Hold expired",
        )

    if body.result == "failure":
        return {"status": "failed"}

    result = bff.pay_held_seats(show_id, user["id"])
    if not result.get("ok"):
        if result.get("error") == "hold_expired":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Hold expired",
            )
        raise HTTPException(status_code=400, detail="Payment could not be completed")

    return {
        "id": result["id"],
        "movie": result["movie"],
        "date": result["date"],
        "time": result["time"],
        "seats": result["seats"],
        "amount": result["amount"],
    }
