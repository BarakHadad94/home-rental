from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, Text, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # Argon2 hash (encoded string ~90–130 chars)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to reservations
    reservations = relationship("Reservation", back_populates="user")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    guest_name = Column(String, index=True)
    email = Column(String)
    phone = Column(String)
    check_in = Column(Date)
    check_out = Column(Date)
    guest_count = Column(Integer)
    status = Column(String, default="pending")
    message = Column(String, nullable=True)
    
    # Ensure total_price is defined with a default
    total_price = Column(Float, nullable=True, default=0.0)
    special_requests = Column(String, nullable=True)
    
    # Optional user relationship (for logged-in users)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="reservations")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)  # "bathroom_01.jpg"
    description = Column(String(100), nullable=False)  # "Bathroom"
    display_order = Column(Integer, default=0)  # For ordering photos on website
    is_featured = Column(Boolean, default=False)  # Main photo for homepage/preview


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    apartment_name = Column(String(100), default="Sea View Apartment")
    description = Column(Text, nullable=True)
    price_per_night = Column(Float, nullable=False)
    max_guests = Column(Integer, default=6)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(20), nullable=True)
    check_in_time = Column(String(10), default="15:00")
    check_out_time = Column(String(10), default="11:00")
    address = Column(Text, nullable=True)
