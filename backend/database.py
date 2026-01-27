# Ensure proper database URL and connection
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

# Determine the database path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "home_rental.db")

# Create database URL
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Only for SQLite
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for declarative models
Base = declarative_base()

# Database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ensure database and tables are created
def create_tables():
    from models import Base
    Base.metadata.create_all(bind=engine)
    print(f"Database created at: {DATABASE_PATH}")

# Optional: Add migration function if needed
def migrate_database():
    """
    Perform any necessary database migrations
    """
    # Add migration logic here if needed
    pass
