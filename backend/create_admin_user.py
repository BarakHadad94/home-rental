from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User
from database import DATABASE_URL

def create_admin_user():
    """
    Create admin user if it doesn't exist
    """
    # Create engine
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Check if admin user already exists
        admin_user = session.query(User).filter(User.username == "admin").first()
        
        if admin_user:
            print("Admin user already exists!")
            print(f"Username: {admin_user.username}")
            print(f"Email: {admin_user.email}")
            return
        
        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@example.com",  # You can change this
            password="admin"  # Plain text for now
        )
        
        session.add(admin_user)
        session.commit()
        print("Admin user created successfully!")
        print(f"Username: {admin_user.username}")
        print(f"Email: {admin_user.email}")
        print(f"Password: admin (change this after first login)")
    
    except Exception as e:
        session.rollback()
        print(f"Error creating admin user: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    create_admin_user()