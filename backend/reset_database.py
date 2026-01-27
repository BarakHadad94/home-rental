from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
from database import DATABASE_URL

def reset_database():
    """
    Completely reset the database by dropping all tables and recreating them
    """
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    try:
        # Drop all existing tables
        Base.metadata.drop_all(bind=engine)
        print("All tables dropped successfully.")
        
        # Recreate all tables
        Base.metadata.create_all(bind=engine)
        print("All tables recreated successfully.")
    
    except Exception as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    reset_database()
