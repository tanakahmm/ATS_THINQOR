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
import mysql.connector
from mysql.connector import Error
import time

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
        "autocommit": False,
        "use_pure": False # Use C extension if available for performance
    }




class RobustConnection:
    """
    A wrapper around the mysql.connector connection to handle:
    1. Automatic reconnection on timeout/error.
    2. Preventing premature closure by 'with' blocks or explicit .close() calls.
    """
    def __init__(self, config):
        self.config = config
        self._conn = None
        self._connect()

    def _connect(self):
        """Establish the database connection with retries."""
        retries = 3
        while retries > 0:
            try:
                print("🔌 Connecting to Database...")
                self._conn = mysql.connector.connect(**self.config)
                print("✅ Database Connected Successfully")
                return
            except Error as e:
                print(f"❌ Database connection failed: {e}")
                retries -= 1
                if retries > 0:
                    print(f"🔄 Retrying in 2 seconds... ({retries} left)")
                    time.sleep(2)
                else:
                    print("🚨 Could not connect to database after retries.")
                    # Don't raise, just let _conn be None / broken, handled in ping

    def ping(self, reconnect=True, attempts=1, delay=0):
        """Ensure connection is alive."""
        try:
            if self._conn is None:
                self._connect()
            else:
                self._conn.ping(reconnect=reconnect, attempts=attempts, delay=delay)
        except Exception as e:
            print(f"⚠️ Ping failed, attempting reconnect: {e}")
            self._connect()

    def cursor(self, *args, **kwargs):
        """Get a cursor, ensuring connection is alive first."""
        self.ping(reconnect=True)
        # return self._conn.cursor(*args, **kwargs)
        # Override close behavior of the cursor if needed, but usually standard cursor is fine
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self.ping(reconnect=True)
        return self._conn.commit()

    def rollback(self):
        self.ping(reconnect=True)
        return self._conn.rollback()

    def close(self):
        """
        Intercept close() to keep the persistent connection alive.
        Does NOT close the actual socket.
        """
        # print("🛡️ Ignoring request to close persistent DB connection.")
        pass

    def force_close(self):
        """Actually close the connection (for app shutdown)."""
        if self._conn:
            try:
                self._conn.close()
                print("🔌 Database connection closed (force).")
            except Exception:
                pass
            self._conn = None

    def __getattr__(self, name):
        """Delegate other methods to the underlying connection object."""
        self.ping(reconnect=True)
        return getattr(self._conn, name)

# Thread-local storage for persistent connections per thread
import threading
_thread_locals = threading.local()

def get_db_connection():
    """
    Returns a thread-local RobustConnection instance.
    This ensures each thread has its own persistent connection, preventing race conditions
    while maintaining the "persistent" and "auto-reconnect" behavior.
    """
    if not hasattr(_thread_locals, 'connection'):
        _thread_locals.connection = RobustConnection(get_db_config())
    
    # Ensure it's alive on every request retrieval
    try:
        _thread_locals.connection.ping(reconnect=True)
    except Exception:
        # If ping fails violently, try re-creating the wrapper
        _thread_locals.connection = RobustConnection(get_db_config())

    return _thread_locals.connection

# Backwards-compatible export for existing imports in app.py
db_config = get_db_config()
