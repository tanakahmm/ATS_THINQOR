import os
from pathlib import Path

import mysql.connector
from mysql.connector import Error

try:
    # Ensure DB_* env vars from config.env/.env are loaded
    from dotenv import load_dotenv  # type: ignore
except ImportError:  # python-dotenv is optional
    load_dotenv = None

# -------------------------------------
# Load env early so DB_* variables are available
# -------------------------------------
if load_dotenv:
    # This file is in `utils/`; config.env is in the ats_backend root
    env_file = Path(__file__).resolve().parent.parent / "config.env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file, override=True)


# -------------------------------------
# Database connection configuration
# -------------------------------------
def get_db_config():
    """
    Build DB config from environment so the password in config.env/.env
    is always used (e.g. DB_PASSWORD=5757).
    """
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", "5757"),
        "database": os.getenv("DB_NAME", "ats_system"),
    }


def get_db_connection():
    cfg = get_db_config()
    try:
        connection = mysql.connector.connect(**cfg)
        if connection.is_connected():
            # print("✅ MySQL Database connected successfully!")  # Optional: reduce noise
            return connection
    except Error as e:
        print("❌ Database connection failed:", e)
        return None


# Backwards-compatible export for existing imports in app.py
db_config = get_db_config()
