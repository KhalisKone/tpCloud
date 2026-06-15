from sqlalchemy import Column, DateTime, Float, Integer, String, func

from app.db import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    label = Column(String(255), nullable=False)
    value = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
