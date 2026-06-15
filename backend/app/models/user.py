from sqlalchemy import Column, DateTime, Integer, String, func

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    google_sub = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    picture = Column(String(512), nullable=True)
    role = Column(String(20), nullable=False, default="user")  # "user" ou "admin"
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
