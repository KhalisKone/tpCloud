"""Routes d'authentification : connexion Google et profil courant."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import (
    create_jwt,
    get_current_user,
    role_for_email,
    verify_google_token,
)
from app.db import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginIn(BaseModel):
    credential: str  # l'ID token renvoyé par Google Identity Services


class UserOut(BaseModel):
    id: int
    email: str
    name: str | None
    picture: str | None
    role: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


@router.post("/google", response_model=LoginOut)
def login_google(payload: GoogleLoginIn, db: Session = Depends(get_db)) -> LoginOut:
    claims = verify_google_token(payload.credential)

    google_sub = claims["sub"]
    email = claims["email"]

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if user is None:
        user = db.query(User).filter(User.email == email).first()

    if user is None:
        user = User(
            google_sub=google_sub,
            email=email,
            name=claims.get("name"),
            picture=claims.get("picture"),
            role=role_for_email(email),
        )
        db.add(user)
    else:
        # Met à jour le profil, le sub Google réel, et recalcule le rôle.
        user.google_sub = google_sub
        user.email = email
        user.name = claims.get("name")
        user.picture = claims.get("picture")
        user.role = role_for_email(email)

    db.commit()
    db.refresh(user)

    return LoginOut(
        token=create_jwt(user),
        user=UserOut(
            id=user.id,
            email=user.email,
            name=user.name,
            picture=user.picture,
            role=user.role,
        ),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
    )
