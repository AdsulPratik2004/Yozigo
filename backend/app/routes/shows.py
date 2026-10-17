from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import bff
from app.auth import require_admin

router = APIRouter(prefix="/shows", tags=["shows"])


class ShowCreate(BaseModel):
    movie_id: int
    start_time: datetime
    price: float = Field(gt=0)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_show(body: ShowCreate, _: dict = Depends(require_admin)):
    movie = bff.get_movie(body.movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    if bff.show_overlaps(body.start_time, movie["duration_minutes"]):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This show overlaps another screening in the same hall. "
                "Choose a start time that does not conflict with an existing show."
            ),
        )

    return bff.create_show(body.movie_id, body.start_time, body.price)


@router.get("/{show_id}")
def get_show(show_id: int):
    show = bff.get_show(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    return show


@router.delete("/{show_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_show(show_id: int, _: dict = Depends(require_admin)):
    show = bff.get_show_lite(show_id)
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    if bff.show_has_bookings(show_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This show cannot be deleted because it already has bookings.",
        )
    bff.delete_show(show_id)
