"""
Script to view all users in the database
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User
from database import DATABASE_URL
import os

def view_users():
    """
    Display all users in the database
    """
    # Check if database exists
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "home_rental.db")
    
    if not os.path.exists(db_path):
        print(f"Database file not found at: {db_path}")
        print("The database will be created when you first run the application.")
        return
    
    print(f"Database location: {db_path}\n")
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Query all users
        users = session.query(User).all()
        
        if not users:
            print("No users found in the database.")
            print("\nTo create an admin user, run: python create_admin_user.py")
        else:
            print(f"Found {len(users)} user(s) in the database:\n")
            print("-" * 80)
            print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Created At':<20}")
            print("-" * 80)
            
            for user in users:
                print(f"{user.id:<5} {user.username:<20} {user.email:<30} {str(user.created_at):<20}")
            
            print("-" * 80)
            print(f"\nTotal: {len(users)} user(s)")
    
    except Exception as e:
        print(f"Error querying users: {e}")
        print("\nThe users table might not exist yet.")
        print("Try running the application first to create the database tables.")
    finally:
        session.close()

if __name__ == "__main__":
    view_users()
