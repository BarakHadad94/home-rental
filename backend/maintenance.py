from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date
from models import Base, Reservation
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Database URL - will use SQLite for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./home_rental.db")

# Create engine
engine = create_engine(DATABASE_URL)

# Create SessionLocal
SessionLocal = sessionmaker(bind=engine)

def clear_future_reservations():
    """Delete all future reservations"""
    db = SessionLocal()
    today = date.today()
    
    # Delete reservations with check_out date in the future
    deleted_count = db.query(Reservation).filter(Reservation.check_out >= today).delete()
    
    db.commit()
    print(f"Deleted {deleted_count} future reservations.")
    db.close()

if __name__ == "__main__":
    clear_future_reservations()
