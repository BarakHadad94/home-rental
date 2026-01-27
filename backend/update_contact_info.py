from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Settings
from database import DATABASE_URL

def update_contact_info():
    """
    Update contact email and phone in the database
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
        
        # Update contact information
        settings.contact_email = "hadadyehuda59@gmail.com"
        settings.contact_phone = "+972505547699"
        
        session.commit()
        print("Contact information updated successfully!")
        print(f"Email: {settings.contact_email}")
        print(f"Phone: {settings.contact_phone}")
    
    except Exception as e:
        session.rollback()
        print(f"Error updating contact info: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    update_contact_info()