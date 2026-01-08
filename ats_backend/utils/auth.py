# ats_backend/utils/auth.py
from flask import request, session
import pymysql
import os
from utils.db import get_db_connection


def get_current_user():
    """
    Returns a dict like {"id": ..., "name": ..., "role": ..., "client_id": ...}
    Prioritizes secure session_token from Authorization header.
    """
    # 1. Check Authorization Header (Bearer Token)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            conn = get_db_connection()
            if not conn:
                return None
            cursor = conn.cursor(pymysql.cursors.DictCursor)
            cursor.execute("SELECT id, name, email, role, phone, status FROM users WHERE session_token = %s", (token,))
            user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if user:
                return user
        except Exception as e:
            print("Session token validation error:", e)

    # 2. Flask session fallback
    if isinstance(session.get("user"), dict):
        return session["user"]

    # 3. Body fallback (Legacy/Insecure - Keeping for compatibility but deprecated for critical actions)
    # WARNING: This allows spoofing. RBAC critical actions should fail if this is the only source.
    try:
        body = request.get_json(silent=True) or {}
        if isinstance(body.get("user"), dict):
            # Log warning or potentially ignore for sensitive routes
            return body["user"]
    except Exception:
        pass

    return None
