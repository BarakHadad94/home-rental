from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from database import create_tables, get_db
from models import Settings, Photo, Reservation, User
from password_utils import hash_password, verify_password
import schemas
import os
import shutil
from datetime import datetime, date, timedelta
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

# Ensure database is created on startup
from database import create_tables

# Create database tables on startup
create_tables()

app = FastAPI(
    title="Home Rental API",
    description="API for managing apartment rentals and reservations",
    version="1.0.0"
)

# CORS configuration (include Docker frontend URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Ensure proper static file serving
import os
from fastapi.staticfiles import StaticFiles

# Allow override for Docker (e.g. use mounted backend folder for same data as local run)
STATIC_DIR = os.getenv("STATIC_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Ensure the static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "photos"), exist_ok=True)

# Mount static files for serving uploaded photos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.on_event("startup")
def startup_email_check():
    k = _get_resend_key()
    if k:
        print("[EMAIL] RESEND_API_KEY is set; confirmation/cancel/admin emails will be sent.")
    else:
        print("[EMAIL] RESEND_API_KEY is NOT set; no emails will be sent. Set it in backend/.env and use env_file in docker-compose.")

# Add a root endpoint for testing
@app.get("/")
def read_root():
    return {"message": "Welcome to the Home Rental API"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "home-rental-api"}

@app.get("/db-test")
def test_database(db: Session = Depends(get_db)):
    """Test endpoint to verify database connection"""
    try:
        # Try to query the database
        settings_count = db.query(Settings).count()
        reservations_count = db.query(Reservation).count()
        photos_count = db.query(Photo).count()
        
        return {
            "database_status": "connected",
            "tables": {
                "settings": settings_count,
                "reservations": reservations_count,
                "photos": photos_count
            }
        }
    except Exception as e:
        return {"database_status": "error", "error": str(e)}


# Apartment Info Endpoints
@app.get("/apartment", response_model=schemas.ApartmentInfo)
def get_apartment_info(db: Session = Depends(get_db)):
    """Get complete apartment information including settings and photos"""
    try:
        print("DEBUG: Entering get_apartment_info endpoint")
        
        # Ensure initial settings exist
        existing_settings = db.query(Settings).first()
        if not existing_settings:
            print("DEBUG: No existing settings found. Creating default settings.")
            # Create default settings if none exist
            default_settings = Settings(
                apartment_name="Sirbnb Apartment",
                description="A cozy apartment with beautiful views",
                price_per_night=500,
                contact_email="contact@sirbnb.com",
                contact_phone="+972 50-123-4567",
                address="Tel Aviv, Israel",
                check_in_time="14:00",
                check_out_time="11:00"
            )
            db.add(default_settings)
            db.commit()
            db.refresh(default_settings)
            existing_settings = default_settings
            print("DEBUG: Default settings created successfully")

        # Get all photos ordered by display_order
        photos = db.query(Photo).order_by(Photo.display_order).all()
        print(f"DEBUG: Found {len(photos)} photos in the database")
        
        # If no photos exist, create default entries
        if not photos:
            print("DEBUG: No photos found. Attempting to create default photos.")
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            static_photos_path = os.path.join(current_dir, "static", "photos")
            
            # Ensure the directory exists
            if not os.path.exists(static_photos_path):
                print(f"DEBUG: Static photos directory does not exist: {static_photos_path}")
                os.makedirs(static_photos_path)
            
            # Get photo files
            photo_files = [f for f in os.listdir(static_photos_path) 
                           if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
            
            print(f"DEBUG: Found {len(photo_files)} photo files in directory")
            
            # Predefined descriptions for known photos
            photo_descriptions = {
                "20250810_173639_Living_Room.png": "Living Room",
                "20250810_174646_Living_Room_&_Kitchen.png": "Living Room",
                "20250810_174709_Kitchen.png": "Kitchen",
                "20250810_174757_Bedroom_1.png": "Bedroom 1",
                "20250810_174826_Bedroom_2.png": "Bedroom 2",
                "20250810_174900_Bathroom.png": "Bathroom",
                "20250810_175128_Roof.png": "Roof"
            }
            
            # Create photo entries
            new_photos = []
            for idx, filename in enumerate(photo_files, 1):
                description = photo_descriptions.get(filename, f"Photo {idx}")
                photo = Photo(
                    filename=filename, 
                    description=description,
                    display_order=idx,
                    is_featured=idx == 1  # Mark first photo as featured
                )
                new_photos.append(photo)
            
            # Add and commit photos
            if new_photos:
                db.add_all(new_photos)
                db.commit()
                photos = new_photos
                print(f"DEBUG: Created {len(new_photos)} new photos")
            else:
                print("DEBUG: No photos could be created")

        # Get featured photo (first photo if none is featured)
        featured_photo = db.query(Photo).filter(Photo.is_featured == True).first()
        if not featured_photo and photos:
            featured_photo = photos[0]
            featured_photo.is_featured = True
            db.commit()
            print("DEBUG: Set first photo as featured")

        # Prepare response data
        response_data = {
            "settings": {
                "id": existing_settings.id,
                "apartment_name": existing_settings.apartment_name,
                "description": existing_settings.description,
                "price_per_night": existing_settings.price_per_night,
                "max_guests": existing_settings.max_guests,
                "contact_email": existing_settings.contact_email,
                "contact_phone": existing_settings.contact_phone,
                "check_in_time": existing_settings.check_in_time,
                "check_out_time": existing_settings.check_out_time,
                "address": existing_settings.address
            },
            "photos": [
                {
                    "id": photo.id,
                    "filename": photo.filename,
                    "description": photo.description,
                    "display_order": photo.display_order,
                    "is_featured": photo.is_featured
                } for photo in photos
            ],
            "featured_photo": {
                "id": featured_photo.id,
                "filename": featured_photo.filename,
                "description": featured_photo.description,
                "display_order": featured_photo.display_order,
                "is_featured": featured_photo.is_featured
            } if featured_photo else None
        }

        print("DEBUG: Returning apartment info successfully")
        return JSONResponse(content=response_data)
    
    except Exception as e:
        print(f"CRITICAL ERROR in get_apartment_info: {e}")
        return JSONResponse(
            status_code=500, 
            content={"detail": f"Failed to retrieve apartment info: {str(e)}"}
        )


@app.get("/apartment/settings", response_model=schemas.Settings)
def get_apartment_settings(db: Session = Depends(get_db)):
    """Get apartment settings only"""
    settings = db.query(Settings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Apartment settings not configured")
    return settings


# Predefined descriptions for known photos (module-level so endpoint stays simple)
PHOTO_DESCRIPTIONS = {
    "20250810_173639_Living_Room.png": "Living Room",
    "20250810_173801_Living_Room.png": "Living Room",
    "20250810_173830_Living_Room.png": "Living Room",
    "20250810_174646_Living_Room_&_Kitchen.png": "Living Room",
    "20250810_174709_Kitchen.png": "Kitchen",
    "20250810_174741_Kitchen.png": "Kitchen",
    "20250810_174757_Bedroom_1.png": "Bedroom 1",
    "20250810_174807_Bedroom_1.png": "Bedroom 1",
    "20250810_174826_Bedroom_2.png": "Bedroom 2",
    "20250810_174834_Bedroom_2.png": "Bedroom 2",
    "20250810_174900_Bathroom.png": "Bathroom",
    "20250810_174927_Shower.png": "Shower",
    "20250810_174952_Garden.png": "Garden",
    "20250810_175017_Garden.png": "Garden",
    "20250810_175036_Garden.png": "Garden",
    "20250810_175058_Garden.png": "Garden",
    "20250810_175128_Roof.png": "Roof",
    "20250810_175139_Roof.png": "Roof",
    "20250810_175152_Roof.png": "Roof",
}


def _photo_to_dict(p):
    """Convert Photo ORM to JSON-safe dict (no Pydantic, no serialization errors)."""
    return {
        "id": getattr(p, "id", 0),
        "filename": (p.filename or "").strip() or "image.jpg",
        "description": (p.description or "").strip() or "Photo",
        "display_order": p.display_order if p.display_order is not None else 0,
        "is_featured": bool(p.is_featured) if p.is_featured is not None else False,
    }


@app.get("/api/apartment/photos")
def get_apartment_photos(db: Session = Depends(get_db)):
    """Get all apartment photos ordered by display order. Returns plain JSON list (no schema validation)."""
    try:
        existing_photos = db.query(Photo).order_by(Photo.display_order).all()
    except Exception as e:
        print(f"get_apartment_photos: DB query failed: {e}")
        return []

    first_desc = (existing_photos[0].description or "") if existing_photos else ""
    need_rebuild = not existing_photos or str(first_desc).strip().startswith("Photo ")

    if not need_rebuild:
        return [_photo_to_dict(p) for p in existing_photos]

    try:
        db.query(Photo).delete()
        db.commit()
    except Exception as e:
        print(f"get_apartment_photos: delete/commit failed: {e}")
        db.rollback()
        return [_photo_to_dict(p) for p in existing_photos] if existing_photos else []

    static_photos_path = os.path.join(STATIC_DIR, "photos")
    try:
        if not os.path.isdir(static_photos_path):
            os.makedirs(static_photos_path, exist_ok=True)
        photo_files = [
            f for f in os.listdir(static_photos_path)
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))
        ]
        photo_files.sort()
    except OSError as e:
        print(f"get_apartment_photos: cannot read dir {static_photos_path!r}: {e}")
        return []

    new_photos = []
    for idx, filename in enumerate(photo_files, 1):
        description = PHOTO_DESCRIPTIONS.get(filename, f"Photo {idx}")
        new_photos.append(Photo(
            filename=filename,
            description=description,
            display_order=idx,
        ))
    if not new_photos:
        return []

    try:
        db.add_all(new_photos)
        db.commit()
        db.refresh()  # ensure ids are loaded
        # Re-query so we have persisted objects with ids
        ordered = db.query(Photo).order_by(Photo.display_order).all()
        return [_photo_to_dict(p) for p in ordered]
    except Exception as e:
        print(f"get_apartment_photos: add_all/commit failed: {e}")
        db.rollback()
        return []


@app.get("/api/apartment/photos-debug")
def get_photos_debug():
    """Debug: show STATIC_DIR and whether photos dir exists (for Docker path issues)."""
    photos_path = os.path.join(STATIC_DIR, "photos")
    try:
        files = [f for f in os.listdir(photos_path) if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))] if os.path.isdir(photos_path) else []
    except OSError:
        files = []
    return {
        "STATIC_DIR": STATIC_DIR,
        "photos_path": photos_path,
        "photos_dir_exists": os.path.isdir(photos_path),
        "photo_file_count": len(files),
    }


@app.get("/apartment/photos/{photo_id}/url")
def get_photo_url(photo_id: int, db: Session = Depends(get_db)):
    """Get the full URL for a specific photo"""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Return the URL where the photo can be accessed
    photo_url = f"/static/photos/{photo.filename}"
    return {"photo_id": photo_id, "url": photo_url, "filename": photo.filename}


@app.get("/apartment/featured-photo", response_model=schemas.Photo)
def get_featured_photo(db: Session = Depends(get_db)):
    """Get the featured photo for previews"""
    featured_photo = db.query(Photo).filter(Photo.is_featured == True).first()
    if not featured_photo:
        raise HTTPException(status_code=404, detail="No featured photo set")
    return featured_photo


# Settings Management Endpoints

@app.post("/apartment/settings", response_model=schemas.Settings)
def create_apartment_settings(settings: schemas.SettingsCreate, db: Session = Depends(get_db)):
    """Create apartment settings (only one record allowed)"""
    # Check if settings already exist
    existing_settings = db.query(Settings).first()
    if existing_settings:
        raise HTTPException(status_code=400, detail="Apartment settings already exist. Use PUT to update.")
    
    db_settings = Settings(**settings.dict())
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings


@app.put("/apartment/settings", response_model=schemas.Settings)
def update_apartment_settings(settings_update: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    """Update apartment settings"""
    db_settings = db.query(Settings).first()
    if not db_settings:
        raise HTTPException(status_code=404, detail="Apartment settings not found. Create them first.")
    
    # Update only provided fields
    update_data = settings_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings


# Photo Management Endpoints

@app.post("/apartment/photos", response_model=schemas.Photo)
async def add_apartment_photo(
    file: UploadFile = File(...),
    description: str = Form(...),
    display_order: int = Form(0),
    is_featured: bool = Form(False),
    db: Session = Depends(get_db)
):
    """Add a new photo to the apartment with file upload"""
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (max 5MB)
    if file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{timestamp}_{description.replace(' ', '_')}{file_extension}"
    
    # Save file to static/photos directory
    file_path = os.path.join("static", "photos", filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create photo record in database
    db_photo = Photo(
        filename=filename,
        description=description,
        display_order=display_order,
        is_featured=is_featured
    )
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    
    return db_photo


@app.get("/apartment/photos/{photo_id}", response_model=schemas.Photo)
def get_apartment_photo(photo_id: int, db: Session = Depends(get_db)):
    """Get a specific photo by ID"""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


@app.put("/apartment/photos/{photo_id}", response_model=schemas.Photo)
def update_apartment_photo(photo_id: int, photo_update: schemas.PhotoCreate, db: Session = Depends(get_db)):
    """Update a specific photo"""
    db_photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not db_photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Update photo fields
    for field, value in photo_update.dict().items():
        setattr(db_photo, field, value)
    
    db.commit()
    db.refresh(db_photo)
    return db_photo


@app.delete("/apartment/photos/{photo_id}")
def delete_apartment_photo(photo_id: int, db: Session = Depends(get_db)):
    """Delete a specific photo"""
    db_photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not db_photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    db.delete(db_photo)
    db.commit()
    return {"message": "Photo deleted successfully"}


@app.put("/apartment/photos/{photo_id}/feature")
def set_featured_photo(photo_id: int, db: Session = Depends(get_db)):
    """Set a photo as featured (unfeatures all others)"""
    # First, unfeature all photos
    db.query(Photo).update({Photo.is_featured: False})
    
    # Then feature the selected photo
    db_photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not db_photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    db_photo.is_featured = True
    db.commit()
    return {"message": f"Photo {photo_id} set as featured"}


# Availability Endpoints

@app.get("/availability/check")
def check_availability(check_in: date, check_out: date, db: Session = Depends(get_db)):
    """Check if specific dates are available for booking"""
    
    # Check for overlapping reservations (exclude checkout date)
    overlapping_reservations = db.query(Reservation).filter(
        Reservation.check_in < check_out,
        Reservation.check_out > check_in,
        Reservation.status.in_(["pending", "confirmed"])
    ).all()
    
    is_available = len(overlapping_reservations) == 0
    
    return {
        "check_in": check_in,
        "check_out": check_out,
        "is_available": is_available,
        "conflicts": {
            "reservations": [{"start": res.check_in, "end": res.check_out, "guest": res.guest_name} for res in overlapping_reservations]
        }
    }


@app.get("/availability/calendar")
def get_availability_calendar(
    year: int = datetime.now().year, 
    month: int = datetime.now().month, 
    db: Session = Depends(get_db)
):
    """Get availability for a specific month"""
    try:
        import calendar
        
        # Validate input
        if not (1 <= month <= 12):
            raise ValueError(f"Invalid month: {month}. Must be between 1 and 12.")
        
        # Get first and last day of month
        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])
        
        # Get all reservations for this month
        reservations = db.query(Reservation).filter(
            Reservation.check_in <= last_day,
            Reservation.check_out >= first_day,
            Reservation.status.in_(["pending", "confirmed"])
        ).all()
        
        # Create availability calendar
        availability = []
        current_date = first_day
        
        while current_date <= last_day:
            # Check if date is reserved (exclude checkout date)
            is_reserved = any(
                res.check_in <= current_date < res.check_out 
                for res in reservations
            )
            
            availability.append({
                "date": current_date.isoformat(),
                "is_available": not is_reserved,
                "reason": "reserved" if is_reserved else None
            })
            
            current_date += timedelta(days=1)
        
        return {
            "year": year,
            "month": month,
            "availability": availability
        }
    
    except Exception as e:
        # Log the error
        print(f"Availability calendar error: {str(e)}")
        
        # Raise an HTTP exception with details
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate availability calendar: {str(e)}"
        )


# Reservation Endpoints

@app.post("/reservations")
def create_reservation(reservation: schemas.ReservationCreate, db: Session = Depends(get_db)):
    """Create a new reservation request. Returns plain JSON (no schema validation) to avoid 500."""
    try:
        is_admin_block = getattr(reservation, 'is_admin_block', False) or (
            (reservation.guest_name or "").strip() == "admin"
            and (reservation.guest_count or 0) == 0
            and (reservation.total_price or 0) == 0
        )

        if is_admin_block:
            if reservation.check_in >= reservation.check_out:
                raise ValueError("Check-in date must be before check-out date")
            user_id = reservation.user_id
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
            db_reservation = Reservation(
                guest_name="admin",
                email="admin@example.com",
                phone="0000000000",
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                guest_count=0,
                message=None,
                total_price=0.0,
                special_requests=None,
                user_id=user_id
            )
        else:
            if not (reservation.guest_name or "").strip() or not (reservation.email or "").strip() or not (reservation.phone or "").strip():
                raise ValueError("Guest name, email, and phone are required")
            if reservation.check_in >= reservation.check_out:
                raise ValueError("Check-in date must be before check-out date")
            availability_check = check_availability(reservation.check_in, reservation.check_out, db)
            if not availability_check["is_available"]:
                conflicts = availability_check.get("conflicts", {})
                conflict_details = []
                if conflicts.get("reservations"):
                    conflict_details.extend([
                        f"Reserved by {res['guest']} from {res['start']} to {res['end']}"
                        for res in conflicts.get("reservations", [])
                    ])
                raise HTTPException(
                    status_code=400,
                    detail=f"Selected dates are not available. Conflicts: {'; '.join(conflict_details)}"
                )
            user_id = reservation.user_id
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
            db_reservation = Reservation(
                guest_name=(reservation.guest_name or "").strip(),
                email=(reservation.email or "").strip(),
                phone=(reservation.phone or "").strip(),
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                guest_count=reservation.guest_count or 1,
                message=reservation.message,
                total_price=reservation.total_price if reservation.total_price is not None else 0.0,
                special_requests=reservation.special_requests,
                status="pending",
                user_id=user_id
            )

        db.add(db_reservation)
        db.commit()
        db.refresh(db_reservation)

        if not is_admin_block:
            try:
                apartment_settings = db.query(Settings).first()
                if apartment_settings:
                    send_new_booking_notification_to_admin(db_reservation, apartment_settings)
            except Exception as email_err:
                print(f"Reservation created but email notification failed: {email_err}")

        if is_admin_block:
            db_reservation.status = "confirmed"
            db_reservation.updated_at = datetime.now()
            db.commit()
            db.refresh(db_reservation)

        return _reservation_to_dict(db_reservation)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Reservation creation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create reservation: {str(e)}")


@app.get("/reservations", response_model=List[schemas.Reservation])
def get_reservations(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all reservations, optionally filtered by status"""
    query = db.query(Reservation)
    
    if status:
        query = query.filter(Reservation.status == status)
    
    reservations = query.order_by(Reservation.created_at.desc()).all()
    return reservations


# Resend email configuration (use RESEND_API_KEY and optionally RESEND_FROM in .env)
def _get_resend_key():
    return (os.getenv("RESEND_API_KEY") or "").strip()

def _get_resend_from():
    return (os.getenv("RESEND_FROM") or "Bookings <onboarding@resend.dev>").strip()

RESEND_API_KEY = _get_resend_key()
RESEND_FROM = _get_resend_from()

def _fmt_date(d):
    """Format a date as DD/MM/YYYY for emails."""
    if d is None:
        return ""
    if hasattr(d, "strftime"):
        return d.strftime("%d/%m/%Y")
    return str(d)

def _is_guest_reservation(reservation):
    """True if this is a real guest booking (not an admin block). No email for admin blocks."""
    name = (getattr(reservation, "guest_name", None) or "").strip()
    email = (getattr(reservation, "email", None) or "").strip()
    return not (name == "admin" and email == "admin@example.com")

def _send_resend_email(to: str, subject: str, html: str) -> bool:
    """Send one email via Resend. Returns True on success."""
    api_key = _get_resend_key()
    from_addr = _get_resend_from()
    if not api_key:
        print("[EMAIL] RESEND_API_KEY not set; skipping email.")
        return False
    try:
        import resend
        resend.api_key = api_key
        resend.Emails.send({
            "from": from_addr,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        print(f"[EMAIL] Sent to {to!r}: {subject!r}")
        return True
    except Exception as e:
        print(f"[EMAIL] Resend send failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def _default_settings():
    """Minimal settings for email when none exist in DB."""
    class D:
        apartment_name = "Apartment"
        address = "To be provided"
        check_in_time = "15:00"
        check_out_time = "11:00"
        contact_email = "admin@example.com"
        contact_phone = ""
    return D()

def send_confirmation_email(reservation, apartment_settings):
    """Send a confirmation email to the guest via Resend (only for real guests)."""
    if not _is_guest_reservation(reservation):
        print("[EMAIL] Skipping confirmation email (admin block or not a guest reservation).")
        return False
    to = (getattr(reservation, "email", None) or "").strip()
    if not to:
        print("[EMAIL] Skipping confirmation email (no guest email).")
        return False
    s = apartment_settings or _default_settings()
    subject = f"Reservation Confirmed - {s.apartment_name}"
    html = f"""
<p>Dear {reservation.guest_name},</p>
<p>Great news! Your reservation has been confirmed.</p>
<p><strong>Reservation Details:</strong></p>
<ul>
<li>Check-in: {_fmt_date(getattr(reservation, 'check_in', None))}</li>
<li>Check-out: {_fmt_date(getattr(reservation, 'check_out', None))}</li>
<li>Number of Guests: {getattr(reservation, 'guest_count', 1)}</li>
<li>Total to pay: {(getattr(reservation, 'total_price', None) or 0):.0f} ILS</li>
</ul>
<p><strong>Apartment:</strong> {s.apartment_name}<br>
Address: {getattr(s, 'address', None) or 'To be provided'}<br>
Check-in: {getattr(s, 'check_in_time', '15:00')} | Check-out: {getattr(s, 'check_out_time', '11:00')}</p>
<p><strong>Payment:</strong> Payment is due in cash upon arrival (we do not accept credit cards).</p>
<p>If you have any questions, contact us at {getattr(s, 'contact_email', '')} or {getattr(s, 'contact_phone', '')}.</p>
<p>We look forward to hosting you!</p>
<p>Best regards,<br>{s.apartment_name} Team</p>
"""
    ok = _send_resend_email(to, subject, html)
    if not ok:
        print(f"[EMAIL] Confirmation email to {to!r} was not sent (check logs above).")
    return ok

def send_cancellation_email(reservation, apartment_settings):
    """Send a cancellation email to the guest via Resend (only for real guests)."""
    if not _is_guest_reservation(reservation) or not (getattr(reservation, "email", None) or "").strip():
        return False
    s = apartment_settings or _default_settings()
    to = (reservation.email or "").strip()
    subject = f"Reservation Cancelled - {s.apartment_name}"
    html = f"""
<p>Dear {reservation.guest_name},</p>
<p>We regret to inform you that your reservation has been cancelled.</p>
<p><strong>Reservation that was cancelled:</strong></p>
<ul>
<li>Check-in: {_fmt_date(getattr(reservation, 'check_in', None))}</li>
<li>Check-out: {_fmt_date(getattr(reservation, 'check_out', None))}</li>
<li>Guests: {getattr(reservation, 'guest_count', 1)}</li>
</ul>
<p>If you have any questions, please contact us at {getattr(s, 'contact_email', '')} or {getattr(s, 'contact_phone', '')}.</p>
<p>Best regards,<br>{s.apartment_name} Team</p>
"""
    return _send_resend_email(to, subject, html)

def send_new_booking_notification_to_admin(reservation, apartment_settings):
    """Send an email to the admin when a new guest booking is made. Uses contact_email or admin@example.com."""
    to = ""
    if apartment_settings:
        to = (getattr(apartment_settings, "contact_email", None) or "").strip()
    if not to:
        to = "admin@example.com"
    name = getattr(apartment_settings, "apartment_name", None) or "Apartment"
    subject = f"New reservation – {name}"
    html = f"""
<p>A new reservation has been made. Please log in to the website to confirm or cancel it.</p>
<p><strong>Reservation details:</strong></p>
<ul>
<li>Guest: {getattr(reservation, 'guest_name', '')}</li>
<li>Email: {getattr(reservation, 'email', '')}</li>
<li>Phone: {getattr(reservation, 'phone', '')}</li>
<li>Check-in: {_fmt_date(getattr(reservation, 'check_in', None))}</li>
<li>Check-out: {_fmt_date(getattr(reservation, 'check_out', None))}</li>
<li>Guests: {getattr(reservation, 'guest_count', 1)}</li>
<li>Total: {(getattr(reservation, 'total_price', None) or 0):.0f} ILS</li>
</ul>
"""
    if getattr(reservation, "special_requests", None):
        html += f"<p><strong>Special requests:</strong> {reservation.special_requests}</p>"
    html += "<p>Log in to your reservation management page to confirm or cancel this booking.</p>"
    return _send_resend_email(to, subject, html)

@app.put("/reservations/{reservation_id}/status")
def update_reservation_status(
    reservation_id: int,
    status: str,
    db: Session = Depends(get_db)
):
    """Update reservation status. Sends guest email on confirm/cancel (not for admin blocks)."""
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if status not in ["pending", "confirmed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    apartment_settings = db.query(Settings).first()
    reservation.status = status
    db.commit()
    try:
        if status == "confirmed":
            send_confirmation_email(reservation, apartment_settings)
        elif status == "cancelled":
            send_cancellation_email(reservation, apartment_settings)
    except Exception as e:
        print(f"Guest email (status update) failed: {e}")
    return {"message": f"Reservation {reservation_id} status updated to {status}"}


# Authentication Endpoints
@app.post("/auth/signup", response_model=schemas.UserResponse)
def signup(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user account"""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create new user (store hashed password only)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password=hash_password(user_data.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "is_admin": db_user.username == "admin"
    }

@app.post("/auth/login", response_model=schemas.UserResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = db.query(User).filter(User.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.username == "admin"
    }

@app.get("/auth/user/{user_id}/reservations")
def get_user_reservations(user_id: int, db: Session = Depends(get_db)):
    """Get all reservations for a specific user. Returns plain JSON (no schema validation)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        reservations = db.query(Reservation).filter(Reservation.user_id == user_id).order_by(Reservation.created_at.desc()).all()
        return [_reservation_to_dict(r) for r in reservations]
    except Exception as e:
        print(f"get_user_reservations error: {e}")
        return []

# Admin login endpoint (uses users table)
@app.post("/admin/login")
def admin_login(
    request_data: dict = None,  # Allow JSON body
    username: Optional[str] = None,  # Allow query params as fallback
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Admin login endpoint - checks users table for admin user"""
    # Check JSON body first
    if request_data:
        username = request_data.get('username')
        password = request_data.get('password')
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    # Check if user exists and is admin
    user = db.query(User).filter(User.username == username).first()
    
    # If admin user doesn't exist, create it (store hashed password)
    if not user and username == "admin":
        user = User(
            username="admin",
            email="admin@example.com",
            password=hash_password("admin"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if it's admin user
    if user.username != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify password against stored hash
    if not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "message": "Login successful",
        "access": "granted",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": True
        }
    }

def _reservation_to_dict(r):
    """Convert Reservation ORM to JSON-safe dict (no Pydantic, no serialization errors)."""
    def _date_str(d):
        if d is None:
            return None
        if hasattr(d, "isoformat"):
            return d.isoformat() if hasattr(d, "date") else str(d)
        return str(d)
    return {
        "id": getattr(r, "id", 0),
        "guest_name": r.guest_name if r.guest_name is not None else "",
        "email": r.email if r.email is not None else "",
        "phone": r.phone if r.phone is not None else "",
        "check_in": _date_str(getattr(r, "check_in", None)),
        "check_out": _date_str(getattr(r, "check_out", None)),
        "guest_count": r.guest_count if r.guest_count is not None else 1,
        "status": r.status if r.status is not None else "pending",
        "message": r.message if r.message is not None else None,
        "total_price": float(r.total_price) if r.total_price is not None else 0.0,
        "special_requests": r.special_requests if r.special_requests is not None else None,
        "user_id": r.user_id if r.user_id is not None else None,
        "created_at": _date_str(getattr(r, "created_at", None)),
        "updated_at": _date_str(getattr(r, "updated_at", None)),
    }


@app.get("/admin/reservations")
def get_all_reservations(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get all reservations with optional filtering. Returns plain JSON (no schema validation)."""
    try:
        query = db.query(Reservation)
        if status:
            query = query.filter(Reservation.status == status)
        if start_date:
            query = query.filter(Reservation.check_in >= start_date)
        if end_date:
            query = query.filter(Reservation.check_out <= end_date)
        reservations = query.order_by(Reservation.created_at.desc()).all()
        return [_reservation_to_dict(r) for r in reservations]
    except Exception as e:
        print(f"get_all_reservations error: {e}")
        import traceback
        traceback.print_exc()
        return []

@app.put("/admin/reservations/{reservation_id}/status")
def admin_update_reservation_status(
    reservation_id: int, 
    status: str, 
    db: Session = Depends(get_db)
):
    """Admin-specific reservation status update with more detailed validation"""
    # Validate status
    valid_statuses = ["pending", "confirmed", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    
    # Find the reservation
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    # If confirming a reservation (from cancelled or pending), check if dates are available
    if status == "confirmed":
        # Use the exact same availability check logic as check_availability function
        overlapping_reservations = db.query(Reservation).filter(
            Reservation.check_in < reservation.check_out,
            Reservation.check_out > reservation.check_in,
            Reservation.status.in_(["pending", "confirmed"]),
            Reservation.id != reservation_id  # Exclude the current reservation
        ).all()
        
        if overlapping_reservations:
            conflict_details = [
                f"Reserved by {res.guest_name} from {res.check_in} to {res.check_out}"
                for res in overlapping_reservations
            ]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot confirm reservation: dates are no longer available. Conflicts: {'; '.join(conflict_details)}"
            )
    
    reservation.status = status
    reservation.updated_at = datetime.now()
    db.commit()
    db.refresh(reservation)

    apartment_settings = db.query(Settings).first()
    try:
        if status == "confirmed":
            ok = send_confirmation_email(reservation, apartment_settings)
            print(f"[EMAIL] Admin confirmed reservation {reservation_id}; confirmation email sent={ok} to {getattr(reservation, 'email', '')!r}")
        elif status == "cancelled":
            ok = send_cancellation_email(reservation, apartment_settings)
            print(f"[EMAIL] Admin cancelled reservation {reservation_id}; cancellation email sent={ok} to {getattr(reservation, 'email', '')!r}")
    except Exception as e:
        print(f"[EMAIL] Guest email (admin status update) failed: {e}")
        import traceback
        traceback.print_exc()

    return {"message": f"Reservation {reservation_id} status updated to {status}"}

@app.put("/admin/reservations/{reservation_id}")
def admin_update_reservation(
    reservation_id: int, 
    reservation_update: schemas.ReservationUpdate,
    db: Session = Depends(get_db)
):
    """Admin-specific reservation details update"""
    # Find the reservation
    db_reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not db_reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    # Update only provided fields
    update_data = reservation_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_reservation, field, value)
    
    # Set updated timestamp
    db_reservation.updated_at = datetime.now()
    
    db.commit()
    db.refresh(db_reservation)
    
    return db_reservation

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)