
import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

try:
    from ats_backend.utils.db import get_db_connection
    from ats_backend.services.ai_data_service import get_db_connection as get_ai_db_connection
    print("✅ Imports successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

def test_main_db():
    try:
        conn = get_db_connection()
        if not conn:
            print("❌ Main DB connection returned None")
            return
        
        # Test cursor with dictionary compatibility
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT 1 as test")
        result = cursor.fetchone()
        print(f"✅ Main DB Connection Test: {result}")
        cursor.close()
        # conn.close() # robust connection doesn't really close but good to call
    except Exception as e:
        print(f"❌ Main DB Test Failed: {e}")

def test_ai_db():
    try:
        conn = get_ai_db_connection()
        if not conn:
            print("❌ AI DB connection returned None (check config)")
            return

        cursor = conn.cursor(cursor=None) # Default cursor logic in that file is hardcoded
        # wait, I updated it to use DictCursor explicitly in the service functions
        # let's try to mimic a service call
        
        cursor = conn.cursor() # Raw pymysql connection in ai_service
        cursor.execute("SELECT 1")
        print("✅ AI DB Raw Connection Test: Success")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"❌ AI DB Test Failed: {e}")

if __name__ == "__main__":
    print("Starting verification...")
    test_main_db()
    test_ai_db()
