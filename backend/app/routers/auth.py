from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenData,
    UserResponse,
    UserCreate,
    UserUpdate,
    PasswordChange
)
from app.utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    require_admin
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


@router.post("/login", response_model=TokenData)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return access tokens."""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenData(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=TokenData)
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token using a refresh token."""
    payload = decode_token(request.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenData(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user details."""
    return current_user


@router.post("/change-password")
def change_password(
    request: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password."""
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


# Admin-only user management endpoints
@router.get("/users", response_model=list[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """List all users (admin only)."""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.post("/users", response_model=UserResponse)
def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Create a new user (admin only)."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = User(
        email=request.email,
        name=request.name,
        role=request.role,
        hashed_password=get_password_hash(request.password),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get a specific user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    request: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Update a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if request.name is not None:
        user.name = request.name
    if request.email is not None:
        # Check if new email is already taken
        existing = db.query(User).filter(
            User.email == request.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        user.email = request.email
    if request.role is not None:
        user.role = request.role
    if request.is_active is not None:
        user.is_active = request.is_active
    
    db.commit()
    db.refresh(user)
    return user
