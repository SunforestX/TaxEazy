"""Seed script to initialize database with default data."""
# Run with: python -m app.seed (from backend directory)

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.company import Company
from app.utils.auth import get_password_hash


def seed():
    db = SessionLocal()
    try:
        # Create default admin user if not exists
        admin_email = "hello@sunforestx.com.au"
        existing_user = db.query(User).filter(User.email == admin_email).first()
        
        if not existing_user:
            admin_user = User(
                email=admin_email,
                name="Admin",
                role=UserRole.ADMIN,
                hashed_password=get_password_hash("SunForest2024!"),
                is_active=True
            )
            db.add(admin_user)
            print(f"Created admin user: {admin_email}")
        else:
            print(f"Admin user already exists: {admin_email}")
        
        # Create company record if not exists
        company_name = "SunForest X Therapeutics Pty. Ltd."
        existing_company = db.query(Company).first()
        
        if not existing_company:
            company = Company(
                name=company_name,
                abn="",  # Placeholder - should be updated with actual ABN
                contact_email=admin_email,
                settings={
                    "industry": "Biotechnology",
                    "gst_registered": True,
                    "rd_entity_registered": True,
                    "financial_year_start": 7  # July
                }
            )
            db.add(company)
            print(f"Created company: {company_name}")
        else:
            print(f"Company already exists: {existing_company.name}")
        
        db.commit()
        print("\nSeed completed successfully!")
        print("\nDefault credentials:")
        print(f"  Email: {admin_email}")
        print("  Password: SunForest2024!")
        print("  Note: Please change the password after first login.")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
