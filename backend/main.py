from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from database import create_tables, get_db
from models import Settings, Photo, Reservation, DateBlock, User
import schemas
import os
import shutil
from datetime import datetime, date, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi.responses import JSONResponse

# Ensure database is created on startup
from database import create_tables

# Create database tables on startup
create_tables()

app = FastAPI(
    title="Home Rental API",
    description="API for managing apartment rentals and reservations",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Ensure proper static file serving
import os
from fastapi.staticfiles import StaticFiles

# Determine the absolute path to the static directory
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Ensure the static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "photos"), exist_ok=True)

# Mount static files for serving uploaded photos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

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
        date_blocks_count = db.query(DateBlock).count()
        
        return {
            "database_status": "connected",
            "tables": {
                "settings": settings_count,
                "reservations": reservations_count,
                "photos": photos_count,
                "date_blocks": date_blocks_count
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


# Modify photo endpoint to work with frontend
@app.get("/api/apartment/photos", response_model=List[schemas.Photo])
def get_apartment_photos(db: Session = Depends(get_db)):
    """Get all apartment photos ordered by display order"""
    try:
        # Predefined descriptions for known photos
        photo_descriptions = {
            # Living Room Photos
            "20250810_173639_Living_Room.png": "Living Room",
            "20250810_173801_Living_Room.png": "Living Room",
            "20250810_173830_Living_Room.png": "Living Room",
            "20250810_174646_Living_Room_&_Kitchen.png": "Living Room",
            
            # Kitchen Photos
            "20250810_174709_Kitchen.png": "Kitchen",
            "20250810_174741_Kitchen.png": "Kitchen",
            
            # Bedroom Photos
            "20250810_174757_Bedroom_1.png": "Bedroom 1",
            "20250810_174807_Bedroom_1.png": "Bedroom 1",
            "20250810_174826_Bedroom_2.png": "Bedroom 2",
            "20250810_174834_Bedroom_2.png": "Bedroom 2",
            
            # Bathroom Photos
            "20250810_174900_Bathroom.png": "Bathroom",
            "20250810_174927_Shower.png": "Shower",
            
            # Garden Photos
            "20250810_174952_Garden.png": "Garden",
            "20250810_175017_Garden.png": "Garden",
            "20250810_175036_Garden.png": "Garden",
            "20250810_175058_Garden.png": "Garden",
            
            # Roof Photos
            "20250810_175128_Roof.png": "Roof",
            "20250810_175139_Roof.png": "Roof",
            "20250810_175152_Roof.png": "Roof"
        }
        
        # Check existing photos in the database
        existing_photos = db.query(Photo).order_by(Photo.display_order).all()
        
        # If no photos or descriptions are generic, recreate
        if not existing_photos or existing_photos[0].description.startswith("Photo "):
            # Clear existing photos
            db.query(Photo).delete()
            
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            static_photos_path = os.path.join(current_dir, "static", "photos")
            
            # Ensure the directory exists
            if not os.path.exists(static_photos_path):
                os.makedirs(static_photos_path)
            
            # Get photo files
            photo_files = [f for f in os.listdir(static_photos_path) 
                           if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
            
            # Sort files to ensure consistent order
            photo_files.sort()
            
            # Create photo entries
            new_photos = []
            for idx, filename in enumerate(photo_files, 1):
                # Use predefined description 
                description = photo_descriptions.get(filename, f"Photo {idx}")
                
                photo = Photo(
                    filename=filename, 
                    description=description,
                    display_order=idx
                )
                new_photos.append(photo)
            
            # Add and commit photos
            if new_photos:
                db.add_all(new_photos)
                db.commit()
                existing_photos = new_photos
        
        # Return photos
        return existing_photos
    
    except Exception as e:
        print(f"CRITICAL ERROR in get_apartment_photos: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve photos: {str(e)}")


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
    
    # Check for overlapping date blocks
    overlapping_blocks = db.query(DateBlock).filter(
        DateBlock.start_date <= check_out,
        DateBlock.end_date >= check_in
    ).all()
    
    # Check for overlapping reservations (exclude checkout date)
    overlapping_reservations = db.query(Reservation).filter(
        Reservation.check_in < check_out,
        Reservation.check_out > check_in,
        Reservation.status.in_(["pending", "confirmed"])
    ).all()
    
    is_available = len(overlapping_blocks) == 0 and len(overlapping_reservations) == 0
    
    return {
        "check_in": check_in,
        "check_out": check_out,
        "is_available": is_available,
        "conflicts": {
            "date_blocks": [{"start": block.start_date, "end": block.end_date, "reason": block.reason} for block in overlapping_blocks],
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
        
        # Get all date blocks for this month
        date_blocks = db.query(DateBlock).filter(
            DateBlock.start_date <= last_day,
            DateBlock.end_date >= first_day
        ).all()
        
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
            # Check if date is blocked
            is_blocked = any(
                block.start_date <= current_date <= block.end_date 
                for block in date_blocks
            )
            
            # Check if date is reserved (exclude checkout date)
            is_reserved = any(
                res.check_in <= current_date < res.check_out 
                for res in reservations
            )
            
            availability.append({
                "date": current_date.isoformat(),
                "is_available": not (is_blocked or is_reserved),
                "reason": "blocked" if is_blocked else "reserved" if is_reserved else None
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

@app.post("/reservations", response_model=schemas.Reservation)
def create_reservation(reservation: schemas.ReservationCreate, db: Session = Depends(get_db)):
    """Create a new reservation request"""
    
    try:
        # Check if this is an admin block
        is_admin_block = getattr(reservation, 'is_admin_block', False) or (
            reservation.guest_name == "admin" and 
            reservation.guest_count == 0 and 
            reservation.total_price == 0
        )
        
        if is_admin_block:
            # Admin block: minimal validation, auto-confirmed
            if reservation.check_in >= reservation.check_out:
                raise ValueError("Check-in date must be before check-out date")
            
            # Validate user_id if provided (should be admin user)
            user_id = reservation.user_id
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
            
            # Create admin block reservation
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
            # Regular reservation: full validation
            if not reservation.guest_name or not reservation.email or not reservation.phone:
                raise ValueError("Guest name, email, and phone are required")
            
            # Check if dates are valid
            if reservation.check_in >= reservation.check_out:
                raise ValueError("Check-in date must be before check-out date")
            
            # Check if dates are available
            availability_check = check_availability(reservation.check_in, reservation.check_out, db)
            if not availability_check["is_available"]:
                # Provide more detailed conflict information
                conflicts = availability_check.get("conflicts", {})
                conflict_details = []
                
                if conflicts.get("date_blocks"):
                    conflict_details.extend([
                        f"Blocked from {block['start']} to {block['end']} (Reason: {block.get('reason', 'Unknown')})"
                        for block in conflicts.get("date_blocks", [])
                    ])
                
                if conflicts.get("reservations"):
                    conflict_details.extend([
                        f"Reserved by {res['guest']} from {res['start']} to {res['end']}"
                        for res in conflicts.get("reservations", [])
                    ])
                
                raise HTTPException(
                    status_code=400, 
                    detail=f"Selected dates are not available. Conflicts: {'; '.join(conflict_details)}"
                )
            
            # Validate user_id if provided
            user_id = reservation.user_id
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
            
            # Create regular reservation with status="pending"
            db_reservation = Reservation(
                guest_name=reservation.guest_name,
                email=reservation.email,
                phone=reservation.phone,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                guest_count=reservation.guest_count,
                message=reservation.message,
                total_price=reservation.total_price,
                special_requests=reservation.special_requests,
                status="pending",
                user_id=user_id
            )
        
        db.add(db_reservation)
        db.commit()
        db.refresh(db_reservation)
        
        # For admin blocks: automatically confirm it (same as clicking Confirm button)
        if is_admin_block:
            db_reservation.status = "confirmed"
            db_reservation.updated_at = datetime.now()
            db.commit()
            db.refresh(db_reservation)
        
        return db_reservation
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    
    except Exception as e:
        # Rollback the transaction in case of any error
        db.rollback()
        
        # Log the full error for debugging
        print(f"Reservation creation error: {str(e)}")
        
        # Raise a more informative error
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create reservation: {str(e)}"
        )


@app.get("/reservations", response_model=List[schemas.Reservation])
def get_reservations(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all reservations, optionally filtered by status"""
    query = db.query(Reservation)
    
    if status:
        query = query.filter(Reservation.status == status)
    
    reservations = query.order_by(Reservation.created_at.desc()).all()
    return reservations


# Email configuration (replace with actual SMTP details later)
EMAIL_SENDER = "noreply@homrental.com"
SMTP_SERVER = "smtp.gmail.com"  # Placeholder
SMTP_PORT = 587  # Typical for TLS
SMTP_USERNAME = "your_email@gmail.com"  # Placeholder
SMTP_PASSWORD = "your_password"  # Placeholder

def send_confirmation_email(reservation, apartment_settings):
    """Send a confirmation email to the guest"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = reservation.email
        msg['Subject'] = f"Reservation Confirmed - {apartment_settings.apartment_name}"

        # Email body
        body = f"""
Dear {reservation.guest_name},

Great news! Your reservation has been confirmed.

Reservation Details:
- Check-in: {reservation.check_in}
- Check-out: {reservation.check_out}
- Number of Guests: {reservation.guest_count}

Apartment Information:
- Name: {apartment_settings.apartment_name}
- Address: {apartment_settings.address or 'Address details to be provided'}
- Check-in Time: {apartment_settings.check_in_time}
- Check-out Time: {apartment_settings.check_out_time}

Special Notes:
- Please arrive on time for check-in
- Bring a valid ID
- Parking information will be provided upon arrival

If you have any questions, please contact us at {apartment_settings.contact_email} or {apartment_settings.contact_phone}.

We look forward to hosting you!

Best regards,
{apartment_settings.apartment_name} Team
"""
        msg.attach(MIMEText(body, 'plain'))

        # Send email (commented out for now as we'll need real SMTP details)
        # with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        #     server.starttls()
        #     server.login(SMTP_USERNAME, SMTP_PASSWORD)
        #     server.send_message(msg)

        # For now, just print the email (we'll implement actual sending later)
        print(f"Confirmation email prepared for {reservation.email}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

# Modify the existing reservation status update endpoint
@app.put("/reservations/{reservation_id}/status")
def update_reservation_status(
    reservation_id: int, 
    status: str, 
    db: Session = Depends(get_db)
):
    """Update reservation status (pending/confirmed/cancelled)"""
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if status not in ["pending", "confirmed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get apartment settings for email
    apartment_settings = db.query(Settings).first()
    
    # Update reservation status
    reservation.status = status
    db.commit()
    
    # Send confirmation email if status is confirmed
    if status == "confirmed":
        send_confirmation_email(reservation, apartment_settings)
    
    return {"message": f"Reservation {reservation_id} status updated to {status}"}


# Date Block Management Endpoints

@app.post("/date-blocks", response_model=schemas.DateBlock)
def create_date_block(date_block: schemas.DateBlockCreate, db: Session = Depends(get_db)):
    """Create a new date block (maintenance, personal use, etc.)"""
    db_date_block = DateBlock(**date_block.dict())
    db.add(db_date_block)
    db.commit()
    db.refresh(db_date_block)
    return db_date_block


@app.delete("/date-blocks/{block_id}")
def delete_date_block(block_id: int, db: Session = Depends(get_db)):
    """Delete a date block"""
    date_block = db.query(DateBlock).filter(DateBlock.id == block_id).first()
    if not date_block:
        raise HTTPException(status_code=404, detail="Date block not found")
    
    db.delete(date_block)
    db.commit()
    return {"message": "Date block deleted successfully"}

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
    
    # Create new user
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password  # Plain text for now
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
    
    if not user or user.password != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.username == "admin"
    }

@app.get("/auth/user/{user_id}/reservations", response_model=List[schemas.Reservation])
def get_user_reservations(user_id: int, db: Session = Depends(get_db)):
    """Get all reservations for a specific user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    reservations = db.query(Reservation).filter(Reservation.user_id == user_id).all()
    return reservations

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
    
    # If admin user doesn't exist, create it
    if not user and username == "admin":
        user = User(
            username="admin",
            email="admin@example.com",
            password="admin"  # Default password - should be changed
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if it's admin user
    if user.username != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify password
    if user.password != password:
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

@app.get("/admin/reservations", response_model=List[schemas.Reservation])
def get_all_reservations(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get all reservations with optional filtering"""
    query = db.query(Reservation)
    
    # Filter by status if provided
    if status:
        query = query.filter(Reservation.status == status)
    
    # Filter by date range if provided
    if start_date:
        query = query.filter(Reservation.check_in >= start_date)
    if end_date:
        query = query.filter(Reservation.check_out <= end_date)
    
    # Order by most recent first
    reservations = query.order_by(Reservation.created_at.desc()).all()
    return reservations

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
        # Check for overlapping date blocks
        overlapping_blocks = db.query(DateBlock).filter(
            DateBlock.start_date <= reservation.check_out,
            DateBlock.end_date >= reservation.check_in
        ).all()
        
        # Check for overlapping reservations (exclude checkout date, same as check_availability)
        # Use the exact same logic: check_in < check_out and check_out > check_in
        overlapping_reservations = db.query(Reservation).filter(
            Reservation.check_in < reservation.check_out,
            Reservation.check_out > reservation.check_in,
            Reservation.status.in_(["pending", "confirmed"]),
            Reservation.id != reservation_id  # Exclude the current reservation
        ).all()
        
        # Debug: Print what we found
        print(f"DEBUG: Checking availability for reservation {reservation_id}")
        print(f"DEBUG: Reservation dates: {reservation.check_in} to {reservation.check_out}")
        print(f"DEBUG: Found {len(overlapping_blocks)} overlapping blocks")
        print(f"DEBUG: Found {len(overlapping_reservations)} overlapping reservations")
        for res in overlapping_reservations:
            print(f"DEBUG: Overlapping reservation {res.id}: {res.guest_name} from {res.check_in} to {res.check_out}, status={res.status}")
        
        # If there are conflicts, return error
        if overlapping_blocks or overlapping_reservations:
            conflict_details = []
            
            if overlapping_blocks:
                conflict_details.extend([
                    f"Blocked from {block.start_date} to {block.end_date} (Reason: {block.reason})"
                    for block in overlapping_blocks
                ])
            
            if overlapping_reservations:
                conflict_details.extend([
                    f"Reserved by {res.guest_name} from {res.check_in} to {res.check_out}"
                    for res in overlapping_reservations
                ])
            
            raise HTTPException(
                status_code=400,
                detail=f"Cannot confirm reservation: dates are no longer available. Conflicts: {'; '.join(conflict_details)}"
            )
    
    # Update status
    reservation.status = status
    reservation.updated_at = datetime.now()
    db.commit()
    db.refresh(reservation)
    
    # Send email if confirmed (reuse existing logic)
    apartment_settings = db.query(Settings).first()
    if status == "confirmed":
        send_confirmation_email(reservation, apartment_settings)
    
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