"""
seed_dev_accounts.py — Create dev-tier accounts for Michael and Thomas Zeller.

Run once from inside the backend container:
    MICHAEL_PW=yourpassword THOMAS_PW=yourpassword python seed_dev_accounts.py

Both accounts get tier='dev' (unlimited AlphaBot usage).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, bcrypt, db
from app.models import User, Portfolio

DEV_ACCOUNTS = [
    {
        "username": "mrzeller",
        "email": "michaelzllr1@gmail.com",
        "password": os.environ.get("MICHAEL_PW"),
    },
    {
        "username": "Tjzeller12",
        "email": "Tjzeller12@gmail.com",
        "password": os.environ.get("THOMAS_PW"),
    },
]

def seed():
    missing = [a["username"] for a in DEV_ACCOUNTS if not a["password"]]
    if missing:
        print(f"ERROR: Missing password env vars for: {', '.join(missing)}")
        print("Usage: MICHAEL_PW=... THOMAS_PW=... python seed_dev_accounts.py")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        for account in DEV_ACCOUNTS:
            existing = User.query.filter_by(email=account["email"]).first()
            if existing:
                existing.tier = 'dev'
                db.session.commit()
                print(f"[UPDATED] {account['username']} — set to dev tier.")
                continue

            pw_hash = bcrypt.generate_password_hash(account["password"]).decode("utf-8")
            user = User(
                username=account["username"],
                email=account["email"],
                password_hash=pw_hash,
                tier="dev",
            )
            db.session.add(user)
            db.session.flush()

            portfolio = Portfolio(owner=user)
            db.session.add(portfolio)
            db.session.commit()
            print(f"[CREATED] {account['username']} ({account['email']}) — dev tier")

        print("\nDone.")

if __name__ == "__main__":
    seed()
