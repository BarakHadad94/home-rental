from sqlalchemy import create_engine, text
from database import DATABASE_URL

def migrate_database():
    """
    Add users table and user_id column to reservations
    """
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # Create users table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            # Create index on username
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_username ON users(username)
            """))
            
            # Create index on email
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)
            """))
            
            # Add user_id column to reservations if it doesn't exist
            try:
                conn.execute(text("""
                    ALTER TABLE reservations ADD COLUMN user_id INTEGER
                """))
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    raise
            
            # Add foreign key constraint (SQLite doesn't enforce this, but we add it for documentation)
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_reservations_user_id ON reservations(user_id)
                """))
            except:
                pass
            
            conn.commit()
            print("Migration completed successfully!")
            print("- Users table created")
            print("- user_id column added to reservations table")
            
        except Exception as e:
            conn.rollback()
            print(f"Migration error: {e}")
            raise

if __name__ == "__main__":
    migrate_database()