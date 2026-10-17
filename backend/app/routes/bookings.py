from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app import bff
from app.deps import get_current_user

router = APIRouter(prefix="/bookings", tags=["bookings"])


class BookingBody(BaseModel):
    show_id: int
    seat_ids: list[int]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_booking(body: BookingBody, user: dict = Depends(get_current_user)):
    if not body.seat_ids:
        raise HTTPException(status_code=400, detail="Select at least one seat")

    # Availability check: seats must belong to this show and have no booking
    available = bff.check_seats_available(body.show_id, body.seat_ids)
    if len(available) != len(body.seat_ids):
        raise HTTPException(status_code=409, detail="One or more seats are already booked")

    price = bff.get_show_price(body.show_id)
    if price is None:
        raise HTTPException(status_code=404, detail="Show not found")

    total_price = price * len(body.seat_ids)

    uid = user.get("user_id") or user.get("id")
    try:
        booking_id = bff.insert_booking(uid, body.show_id, total_price)
        bff.insert_booking_seats(booking_id, body.seat_ids)
    except Exception as exc:
        # DB unique constraint fires if a race-condition snuck through
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(status_code=409, detail="Seat conflict — please try again")
        raise

    return {
        "id": booking_id,
        "show_id": body.show_id,
        "total_price": total_price,
        "seats": [{"row": s["row"], "number": s["number"]} for s in available],
    }


@router.get("")
def list_bookings(user: dict = Depends(get_current_user)):
    """
    Return the current user's bookings.
    user_id comes exclusively from the validated JWT — never from the request.
    Sorted: upcoming first (ascending by show_start), then past (most-recent first).
    """
    uid = user.get("user_id") or user.get("id")
    return bff.list_user_bookings(uid)


@router.get("/{booking_id}")
def get_booking(booking_id: int, user: dict = Depends(get_current_user)):
    """
    Return a single booking.
    Returns 404 if the booking doesn't exist OR belongs to a different user.
    """
    uid = user.get("user_id") or user.get("id")
    booking = bff.get_booking(booking_id, uid)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_booking(booking_id: int, user: dict = Depends(get_current_user)):
    """
    Cancel a booking and release the seats.
    Returns 404 if the booking doesn't exist OR belongs to a different user.
    Returns 400 if the booking is for a past show (cannot cancel past bookings).
    """
    uid = user.get("user_id") or user.get("id")
    success = bff.cancel_booking(booking_id, uid)
    if not success:
        raise HTTPException(status_code=404, detail="Booking not found or cannot be cancelled")
    return None
