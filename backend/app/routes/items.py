from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.item import Item
from app.schemas import ItemIn, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).order_by(Item.id.desc()).limit(100).all()


@router.post("", response_model=ItemOut, status_code=201)
def create_item(payload: ItemIn, db: Session = Depends(get_db)):
    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item introuvable")
    db.delete(item)
    db.commit()
