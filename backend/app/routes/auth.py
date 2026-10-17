from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from supabase_auth.errors import AuthApiError

from app.auth import get_current_user
from app.bff import sb

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ResendConfirmationRequest(BaseModel):
    email: EmailStr


def _public_user(user: dict, is_verified: bool = True) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "is_verified": is_verified,
    }


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    """
    POST /auth/signup
    Registers the user via Supabase Auth which sends a confirmation email.
    Creates a public user record with customer role.
    """
    email = body.email.strip().lower()

    # 1. Register with Supabase Auth to trigger confirmation email
    try:
        auth_res = sb.auth.sign_up(
            {
                "email": email,
                "password": body.password,
                "options": {
                    "data": {"name": body.name.strip()},
                },
            }
        )
    except AuthApiError as exc:
        msg = str(exc).lower()
        if "already registered" in msg or "already exists" in msg or "user already" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # 2. Check if email confirmation is required
    # Supabase returns session even if unconfirmed in some configurations
    # Check email_confirmed_at to determine if verification is needed
    is_unconfirmed = not bool(auth_res.user.email_confirmed_at)

    # 3. Create or update public user record
    # Check if user already exists in public.users
    existing_user = sb.table("users").select("*").ilike("email", email).execute()
    
    if existing_user.data:
        user_record = existing_user.data[0]
    else:
        # Create new user record
        user_insert = (
            sb.table("users")
            .insert(
                {
                    "name": body.name.strip(),
                    "email": email,
                    "role": "customer",
                }
            )
            .execute()
        )
        user_record = user_insert.data[0]

    # 4. Return Supabase session if available, otherwise indicate confirmation required
    if auth_res.session:
        return {
            "message": "Account created successfully.",
            "confirmation_required": False,
            "email": email,
            "access_token": auth_res.session.access_token,
            "refresh_token": auth_res.session.refresh_token,
            "token_type": "bearer",
            "user": _public_user(user_record, is_verified=True),
        }
    else:
        return {
            "message": "Confirmation email sent! Please check your inbox and click the verification link to activate your account.",
            "confirmation_required": True,
            "email": email,
            "user": _public_user(user_record, is_verified=False),
        }


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
def refresh_token(body: RefreshTokenRequest):
    """
    POST /auth/refresh
    Uses Supabase refresh token to get a new access token.
    """
    try:
        auth_res = sb.auth.refresh_session(body.refresh_token)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user record
    email = auth_res.user.email
    existing_user = sb.table("users").select("*").ilike("email", email).execute()
    
    if existing_user.data:
        user_record = existing_user.data[0]
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    is_verified = bool(auth_res.user.email_confirmed_at)
    return {
        "access_token": auth_res.session.access_token,
        "refresh_token": auth_res.session.refresh_token,
        "token_type": "bearer",
        "user": _public_user(user_record, is_verified=is_verified),
    }


@router.post("/login")
def login(body: LoginRequest):
    """
    POST /auth/login
    Authenticates user via Supabase Auth.
    Returns Supabase session tokens.
    """
    email = body.email.strip().lower()

    # 1. Authenticate with Supabase Auth
    try:
        auth_res = sb.auth.sign_in_with_password({
            "email": email,
            "password": body.password,
        })
    except AuthApiError as exc:
        err_msg = str(exc)
        if "invalid login credentials" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if "email not confirmed" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email not confirmed. Please check your inbox and click the confirmation link to activate your account.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    # 2. Get or create public user record
    existing_user = sb.table("users").select("*").ilike("email", email).execute()
    
    if existing_user.data:
        user_record = existing_user.data[0]
    else:
        # Create user record if it doesn't exist
        user_insert = (
            sb.table("users")
            .insert(
                {
                    "name": auth_res.user.user_metadata.get("name", "User"),
                    "email": email,
                    "role": "customer",
                }
            )
            .execute()
        )
        user_record = user_insert.data[0]

    # 3. Return Supabase session
    is_verified = bool(auth_res.user.email_confirmed_at)
    return {
        "access_token": auth_res.session.access_token,
        "refresh_token": auth_res.session.refresh_token,
        "token_type": "bearer",
        "user": _public_user(user_record, is_verified=is_verified),
    }


@router.post("/resend-confirmation")
def resend_confirmation(body: ResendConfirmationRequest):
    """
    POST /auth/resend-confirmation
    Resends the Supabase signup verification email.
    """
    email = body.email.strip().lower()
    try:
        sb.auth.resend({"type": "signup", "email": email})
    except AuthApiError as exc:
        msg = str(exc)
        if "rate limit" in msg.lower() or "only request this after" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {"message": f"Verification email resent to {email}. Please check your inbox."}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    """GET /auth/me returns the current user profile."""
    return _public_user(current_user)
