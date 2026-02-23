from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime


# Photo Schemas (optional fields so NULL in DB doesn't cause 500)
class PhotoBase(BaseModel):
    filename: Optional[str] = ""
    description: Optional[str] = ""
    display_order: int = 0
    is_featured: bool = False

class PhotoCreate(PhotoBase):
    pass

class Photo(PhotoBase):
    id: int

    class Config:
        from_attributes = True


# Settings Schemas
class SettingsBase(BaseModel):
    apartment_name: str = "Sea View Apartment"
    description: Optional[str] = None
    price_per_night: float
    max_guests: int = 4
    contact_email: str
    contact_phone: Optional[str] = None
    check_in_time: str = "15:00"
    check_out_time: str = "11:00"
    address: Optional[str] = None

class SettingsCreate(SettingsBase):
    pass

class SettingsUpdate(BaseModel):
    apartment_name: Optional[str] = None
    description: Optional[str] = None
    price_per_night: Optional[float] = None
    max_guests: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    address: Optional[str] = None

class Settings(SettingsBase):
    id: int
    
    class Config:
        from_attributes = True


# Combined apartment info response
class ApartmentInfo(BaseModel):
    settings: Settings
    photos: List[Photo] = []
    featured_photo: Optional[Photo] = None

    class Config:
        from_attributes = True


# User Schemas
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool = False  # Check if username is "admin"
    
    class Config:
        from_attributes = True


# Reservation Schemas (optional fields so NULL in DB doesn't cause 500 on response)
class ReservationBase(BaseModel):
    guest_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    check_in: date
    check_out: date
    guest_count: Optional[int] = 1
    message: Optional[str] = None
    total_price: Optional[float] = 0.0
    special_requests: Optional[str] = None

class ReservationCreate(ReservationBase):
    user_id: Optional[int] = None  # Optional - for logged-in users
    is_admin_block: Optional[bool] = False  # For admin to block dates

class ReservationUpdate(BaseModel):
    guest_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    guest_count: Optional[int] = None
    status: Optional[str] = None
    message: Optional[str] = None
    
    # Ensure total_price is optional with default
    total_price: Optional[float] = 0.0
    special_requests: Optional[str] = None

class Reservation(ReservationBase):
    id: int
    status: Optional[str] = "pending"
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True