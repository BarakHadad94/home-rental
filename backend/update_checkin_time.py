from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Settings
from database import DATABASE_URL

def update_checkin_time():
    """
    Update check-in time to 14:00 (2 PM)
    """
    # Create engine
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get the first settings record
        settings = session.query(Settings).first()
        
        if not settings:
            print("No settings found. Please create settings first.")
            return
        
        # Update check-in time
        settings.check_in_time = "14:00"
        
        session.commit()
        print("Check-in time updated successfully!")
        print(f"Check-in: {settings.check_in_time}")
        print(f"Check-out: {settings.check_out_time}")
    
    except Exception as e:
        session.rollback()
        print(f"Error updating check-in time: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    update_checkin_time()