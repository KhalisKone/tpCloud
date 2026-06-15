from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, func

from app.db import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True)
    applicant_name = Column(String(255), nullable=True)
    features = Column(JSON, nullable=False)
    prediction = Column(String(50), nullable=False)
    score = Column(Integer, nullable=True)  # 0-1000 (normalisé depuis proba)
    proba = Column(JSON, nullable=True)
    amount = Column(Float, nullable=True)
    duration_months = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
