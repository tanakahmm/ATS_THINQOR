from flask import Flask, request, jsonify
import mysql.connector
from mysql.connector import Error
from flask_cors import CORS
import uuid
import os
import re
from datetime import datetime
from pathlib import Path
from werkzeug.utils import secure_filename
from utils.event_notifier import notify_event
from utils.auth import get_current_user
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


app = Flask(__name__)
CORS(app)

# -------------------------------------
# Environment loading (.env preferred; fallback to config.env for local dev)
# -------------------------------------
if load_dotenv:
    # Try .env first, then fallback to config.env
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        env_file = Path(__file__).parent / "config.env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file, override=True)
        print(f"✅ Loaded environment from: {env_file.name}")
    else:
        print("⚠️ No .env or config.env found, using defaults")
else:
    print("⚠️ python-dotenv not installed, using system environment variables")

# -------------------------------------
# Database connection configuration
# -------------------------------------
db_config = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'ats_system')
}

# Debug: Print DB config (mask password for security)
print(f"🔧 DB Config: host={db_config['host']}, user={db_config['user']}, database={db_config['database']}, password={'***' if db_config['password'] else '(empty)'}")


app.config["UPLOAD_FOLDER"] = "./uploads/resumes"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# -------------------------------------
# Create a reusable connection function
# -------------------------------------
def get_db_connection():
    try:
        connection = mysql.connector.connect(**db_config)
        if connection.is_connected():
            print("✅ MySQL Database connected successfully!")
            return connection
    except Error as e:
        print("❌ Database connection failed:", e)
        return None

# -------------------------------------
# Routes
# -------------------------------------
@app.route('/')
def home():
    return 'ATS Backend is Running! 🚀'

# @app.route('/testdb')
# def test_db():
#     try:
#         conn = get_db_connection()
#         if conn:
#             cursor = conn.cursor()
#             cursor.execute("SHOW DATABASES;")
#             databases = cursor.fetchall()
#             cursor.close()
#             conn.close()
#             return f"✅ Connected Successfully! Databases: {databases}"
#         else:
#             return "❌ Failed to connect to database."
#     except Exception as e:
#         return f"❌ Error: {str(e)}"

import hashlib

def ensure_admin_exists():
    """Check if admin exists; if not, insert Srini as Admin."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check if admin already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", ("srini@thinqorsolutions.com",))
        existing_admin = cursor.fetchone()

        if existing_admin:
            print("✅ Admin 'Srini' already exists.")
        else:
            # Hash the password
            hashed_pw = hashlib.sha256("Srini@2025".encode()).hexdigest()

            # Insert new admin
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, status)
                VALUES (%s, %s, %s, 'ADMIN', 'ACTIVE')
            """, ("Srini", "srini@thinqorsolutions.com", hashed_pw))
            conn.commit()
            print("✅ Admin 'Srini' inserted successfully.")

        cursor.close()
        conn.close()

    except Exception as e:
        print("❌ Error ensuring admin:", e)


def ensure_user_status_defaults():
    """Normalize users.status and enforce default at DB level."""
    try:
        conn = get_db_connection()
        if not conn:
            return
        cursor = conn.cursor()
        # Normalize existing rows
        cursor.execute("UPDATE users SET status = 'ACTIVE' WHERE status IS NULL OR status = ''")
        conn.commit()
        # Enforce default at schema level
        try:
            cursor.execute("ALTER TABLE users MODIFY status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'")
            conn.commit()
        except Exception:
            # Ignore if permissions or already set
            pass
        cursor.close()
        conn.close()
    except Exception as e:
        print("⚠️ Could not enforce user status defaults:", e)

@app.route("/submit-candidate", methods=["POST"])
def submit_candidate():
    try:
        # ------------------- Form Data -------------------
        name = request.form.get("name")
        email = request.form.get("email")
        phone = request.form.get("phone")
        skills = request.form.get("skills")
        education = request.form.get("education")
        experience = request.form.get("experience")
        created_by = request.form.get("created_by", type=int)  # Get created_by from form
        resume = request.files.get("resume")  # file

        if not all([name, email]):
            return jsonify({"message": "Name and email are required"}), 400

        # ------------------- Resume Upload -------------------
        filename = None
        if resume and allowed_file(resume.filename):
            filename = secure_filename(resume.filename)
            resume.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
        elif resume:
            return jsonify({"message": "Invalid file type"}), 400

        # ------------------- Insert into DB -------------------
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor()
        # Include created_by in INSERT if provided
        if created_by:
            cursor.execute("""
                INSERT INTO candidates
                (name, email, phone, skills, education, experience, resume_filename, created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (name, email, phone, skills, education, experience, filename, created_by))
        else:
            cursor.execute("""
                INSERT INTO candidates
                (name, email, phone, skills, education, experience, resume_filename)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
            """, (name, email, phone, skills, education, experience, filename))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"✅ Candidate '{name}' submitted successfully!"}), 201

    except Exception as e:
        print(e)
        return jsonify({"message": "❌ Error submitting candidate", "error": str(e)}), 500

@app.route("/get-candidates", methods=["GET"])
def get_candidates():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ------------------------------------------------
        # 1️⃣ Ensure correct database
        # ------------------------------------------------
        cursor.execute("SELECT DATABASE()")
        db_row = cursor.fetchone()
        print("🟢 Current DB check:", db_row)

        db_name = db_row.get("DATABASE()") if db_row else None

        if not db_name or db_name.lower() != "ats_system":
            print("⚠ Switching to ats_system database...")
            cursor.execute("USE ats_system")
            conn.commit()

        # ------------------------------------------------
        # 2️⃣ Create table if it does NOT exist
        # ------------------------------------------------
        cursor.execute("SHOW TABLES LIKE 'candidates'")
        if not cursor.fetchone():
            print("⚠ 'candidates' table not found — creating now...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS candidates (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL,
                    phone VARCHAR(20),
                    skills TEXT,
                    education TEXT,
                    experience TEXT,
                    resume_filename VARCHAR(255),
                    created_by INT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            """)
            conn.commit()
            print("✅ 'candidates' table created successfully!")

        # ------------------------------------------------
        # 3️⃣ Check if created_by column exists — if not, ADD it
        # ------------------------------------------------
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'ats_system'
            AND TABLE_NAME = 'candidates'
            AND COLUMN_NAME = 'created_by'
        """)

        if not cursor.fetchone():
            print("⚠ 'created_by' column missing — adding now...")
            cursor.execute("""
                ALTER TABLE candidates 
                ADD COLUMN created_by INT DEFAULT NULL,
                ADD FOREIGN KEY (created_by) REFERENCES users(id)
            """)
            conn.commit()
            print("✅ Added 'created_by' column!")

        # ------------------------------------------------
        # 4️⃣ Fetch candidates with role-based filtering
        # ------------------------------------------------
        # Get user info from query params
        user_id = request.args.get("user_id", type=int)
        user_role = request.args.get("user_role", "").upper()
        
        # Build query based on role
        if user_role == "RECRUITER" and user_id:
            # Recruiters only see their own candidates
            cursor.execute(
                "SELECT * FROM candidates WHERE created_by = %s ORDER BY id DESC",
                (user_id,)
            )
            print(f"🔍 Filtering candidates for RECRUITER (user_id={user_id})")
        elif user_role in ["ADMIN", "DELIVERY_MANAGER"]:
            # Admin and DM see all candidates
            cursor.execute("SELECT * FROM candidates ORDER BY id DESC")
            print(f"🔍 Showing all candidates for {user_role}")
        else:
            # Default: show all (for backward compatibility or guest access)
            cursor.execute("SELECT * FROM candidates ORDER BY id DESC")
            print("🔍 Showing all candidates (no role filter)")
        
        rows = cursor.fetchall()
        print(f"✅ Found {len(rows)} candidates")

        cursor.close()
        conn.close()

        return jsonify(rows), 200

    except Exception as e:
        print("❌ Error:", str(e))
        return jsonify({"error": str(e)}), 500
# --------------------------------------------------------

# Create users table if it doesn't exist

# --------------------------------------------------------

@app.route("/update-candidate/<int:id>", methods=["PUT"])
def update_candidate(id):
    try:
        name = request.form.get("name")
        email = request.form.get("email")
        phone = request.form.get("phone")
        skills = request.form.get("skills")
        education = request.form.get("education")
        experience = request.form.get("experience")
        resume = request.files.get("resume")
        new_status = request.form.get("status")

        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor()

        if resume and allowed_file(resume.filename):
            filename = secure_filename(resume.filename)
            resume.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
            cursor.execute("""
                UPDATE candidates 
                SET name=%s, email=%s, phone=%s, skills=%s, education=%s, experience=%s, resume_filename=%s
                WHERE id=%s
            """, (name, email, phone, skills, education, experience, filename, id))
        else:
            cursor.execute("""
                UPDATE candidates 
                SET name=%s, email=%s, phone=%s, skills=%s, education=%s, experience=%s
                WHERE id=%s
            """, (name, email, phone, skills, education, experience, id))

        # Get current user for notification (only if status is being updated)
        if new_status:
            current_user = get_current_user()
            notify_event("candidate_status_change", {
                "candidate_id": id,
                "status": new_status,
                "user": current_user.get("name", "Unknown"),
                "candidate_name": name,
                "candidate_email": email
            })
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "✅ Candidate updated successfully!"}), 200
    except Exception as e:
        print(e)
        return jsonify({"message": str(e)}), 500


@app.route("/delete-candidate/<int:id>", methods=["DELETE"])
def delete_candidate(id):
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor()
        cursor.execute("DELETE FROM candidates WHERE id=%s", (id,))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "🗑 Candidate deleted successfully!"}), 200
    except Exception as e:
        print(e)
        return jsonify({"message": str(e)}), 500

@app.route('/create-user', methods=['POST'])
def create_user():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        role = data.get('role', 'RECRUITER')
        password = data.get('password')

        if not all([name, email, password]):
            return jsonify({"message": "name, email, and password are required"}), 400

        # Hash the password
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert new user
        cursor.execute("""
            INSERT INTO usersdata (name, email, phone, role, password_hash)
            VALUES (%s, %s, %s, %s, %s)
        """, (name, email, phone, role, password_hash))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": f"✅ User '{name}' created successfully!"}), 201

    except mysql.connector.IntegrityError:
        return jsonify({"message": "⚠️ Email already exists!"}), 409
    except Exception as e:
        return jsonify({"message": "❌ Error creating user", "error": str(e)}), 500

# -------------------------------
# API: Get All Users (Admin view)
# -------------------------------
@app.route('/get-users', methods=['GET'])
def get_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                u.id,
                u.name,
                u.email,
                COALESCE(u.phone, ud.phone) AS phone,
                u.role,
                COALESCE(u.status, 'ACTIVE') AS status,
                u.created_at
            FROM users u
            LEFT JOIN usersdata ud ON ud.email = u.email
            ORDER BY u.created_at DESC
        """)
        users = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(users), 200
    except Exception as e:
        return jsonify({"message": "❌ Error fetching users", "error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return jsonify({"message": "❌ Email and password are required"}), 400

        hashed_pw = hashlib.sha256(password.encode()).hexdigest()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Search in 'users' table (registered users)
        cursor.execute("""
            SELECT 
                u.id, 
                u.name, 
                u.email,
                COALESCE(u.phone, ud.phone) AS phone,
                u.role, 
                COALESCE(u.status, 'ACTIVE') AS status
            FROM users u
            LEFT JOIN usersdata ud ON ud.email = u.email
            WHERE u.email = %s 
              AND u.password_hash = %s 
              AND (u.status = 'ACTIVE' OR u.status IS NULL)
        """, (email, hashed_pw))
        user = cursor.fetchone()

        cursor.close()
        conn.close()
        if user:
            return jsonify({"message": "✅ Login successful", "user": user}), 200
        else:
            return jsonify({"message": "❌ Invalid email or password"}), 401

    except Exception as e:
        return jsonify({"message": "❌ Error during login", "error": str(e)}), 500


@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')

        if not all([name, email, password]):
            return jsonify({"message": "❌ All fields (name, email, password) are required"}), 400

        hashed_pw = hashlib.sha256(password.encode()).hexdigest()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1️⃣ Check if email exists in usersdata table (created by admin)
        cursor.execute("SELECT * FROM usersdata WHERE email = %s", (email,))
        existing_user = cursor.fetchone()

        if not existing_user:
            cursor.close()
            conn.close()
            return jsonify({
                "message": "❌ Signup not allowed. Email not found in admin user list."
            }), 403

        # 2️⃣ Check if already registered in users table
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        already_registered = cursor.fetchone()

        if already_registered:
            cursor.close()
            conn.close()
            return jsonify({
                "message": "⚠️ You have already signed up."
            }), 409

        # 3️⃣ Insert into users table
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, status)
            VALUES (%s, %s, %s, %s, 'ACTIVE')
        """, (name, email, hashed_pw, existing_user['role']))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({
            "message": "✅ Signup successful! You can now log in.",
            "user": {"name": name, "email": email, "role": existing_user['role']}
        }), 201

    except Exception as e:
        return jsonify({"message": "❌ Signup error", "error": str(e)}), 500


# -------------------------------------
# Admin: Update a user's status
# -------------------------------------
@app.route('/update-user-status/<int:user_id>', methods=['PUT'])
def update_user_status(user_id: int):
    try:
        data = request.get_json() or {}
        new_status = data.get('status')
        if new_status is None:
            return jsonify({"message": "status is required"}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET status = %s WHERE id = %s", (new_status, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "✅ User status updated", "id": user_id, "status": new_status}), 200
    except Exception as e:
        return jsonify({"message": "❌ Error updating user status", "error": str(e)}), 500
    
#fix allocations schema
def fix_requirement_allocations_schema():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1️⃣ Drop all existing FKs (if they exist)
        cursor.execute("""
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'requirement_allocations'
              AND CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME LIKE 'fk_%';
        """)
        fks = cursor.fetchall()
        for (fk,) in fks:
            cursor.execute(f"ALTER TABLE requirement_allocations DROP FOREIGN KEY {fk};")

        # 2️⃣ Alter column types to match referenced tables
        cursor.execute("""
            ALTER TABLE requirement_allocations
            MODIFY COLUMN requirement_id VARCHAR(50),
            MODIFY COLUMN recruiter_id INT,
            MODIFY COLUMN assigned_by INT;
        """)

        # 3️⃣ Add correct FKs
        cursor.execute("""
            ALTER TABLE requirement_allocations
            ADD CONSTRAINT fk_requirement
              FOREIGN KEY (requirement_id)
              REFERENCES requirements(id)
              ON DELETE CASCADE ON UPDATE CASCADE,
            ADD CONSTRAINT fk_recruiter
              FOREIGN KEY (recruiter_id)
              REFERENCES users(id)
              ON DELETE CASCADE ON UPDATE CASCADE,
            ADD CONSTRAINT fk_assigned_by
              FOREIGN KEY (assigned_by)
              REFERENCES users(id)
              ON DELETE SET NULL ON UPDATE CASCADE;
        """)

        conn.commit()
        cursor.close()
        conn.close()
        return True, "✅ requirement_allocations schema fixed successfully!"

    except Error as e:
        return False, f"❌ Database error: {str(e)}"


@app.route("/fix-requirement-allocations-schema", methods=["GET"])
def fix_schema_route():
    success, message = fix_requirement_allocations_schema()
    status = 200 if success else 500
    return jsonify({"message": message}), status

# -----------------------------
#  Get All Recruiters (for dropdown)
# -----------------------------
@app.route("/get-recruiters", methods=["GET"])
def get_recruiters():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name FROM users WHERE role = 'RECRUITER'")
        data = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
@app.route("/requirements", methods=["POST"])
def create_requirement():
    try:
        data = request.get_json()
        req_id = str(uuid.uuid4())

        # Validate required fields
        required_fields = ["client_id", "title", "description", "location"]
        missing = [field for field in required_fields if not (data.get(field) or "").strip()]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        # Normalize client_id (ensure int for DB schema)
        client_id_value = data.get("client_id")
        try:
            client_id_value = int(client_id_value)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid client_id"}), 400

        # Helpers
        def _sanitize_text(value, length=None):
            try:
                text = str(value or "").strip()
            except Exception:
                text = ""
            if length:
                return text[:length]
            return text

        # Normalize and sanitize CTC fields (DB columns may be numeric or varchar; coerce to clean text)
        def _sanitize_ctc(value):
            try:
                text = str(value or "").strip()
            except Exception:
                text = ""
            # Keep only a reasonable length to fit column widths (e.g., 100)
            return text[:100]

        title_value = _sanitize_text(data.get("title"), 255)
        description_value = _sanitize_text(data.get("description"))
        location_value = _sanitize_text(data.get("location"), 100)
        skills_value = _sanitize_text(data.get("skills_required"), 255)

        # Experience required (float column) - extract first numeric value, default 0.0
        experience_raw = data.get("experience_required")
        try:
            if isinstance(experience_raw, (int, float)):
                experience_value = float(experience_raw)
            else:
                matches = re.findall(r"[\d\.]+", str(experience_raw or ""))
                experience_value = float(matches[0]) if matches else 0.0
        except (ValueError, TypeError):
            experience_value = 0.0

        ctc_range_value = _sanitize_ctc(data.get("ctc_range"))
        # Frontend may send 'ectc_range' (expected CTC); DB column is 'ecto_range'
        ecto_range_value = data.get("ecto_range")
        if not ecto_range_value:
            ecto_range_value = data.get("ectc_range")
        ecto_range_value = _sanitize_ctc(ecto_range_value)

        created_by_value = _sanitize_text(data.get("created_by"), 50).upper()

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO requirements
            (id, client_id, title, description, location, skills_required, experience_required, ctc_range, ecto_range, status, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'OPEN',%s)
        """, (
            req_id,
            client_id_value,
            title_value,
            description_value,
            location_value,
            skills_value,
            experience_value,
            ctc_range_value,
            ecto_range_value,
            created_by_value
        ))

        


        conn.commit()
        cursor.close()
        conn.close()

        # Get current user for notification
        user = get_current_user()
        # Get client name for better email context
        client_name = "Unknown Client"
        if client_id_value:
            try:
                conn2 = get_db_connection()
                if conn2:
                    cursor2 = conn2.cursor(dictionary=True)
                    cursor2.execute("SELECT name FROM clients WHERE id = %s", (client_id_value,))
                    client_row = cursor2.fetchone()
                    if client_row:
                        client_name = client_row.get("name", "Unknown Client")
                    cursor2.close()
                    conn2.close()
            except Exception:
                pass
        
        notify_event("new_requirement_created", {
            "id": req_id,
            "title": title_value,
            "description": description_value[:100] + "..." if len(description_value) > 100 else description_value,  # First 100 chars
            "location": location_value,
            "client_id": client_id_value,
            "client_name": client_name,
            "skills_required": skills_value,
            "experience_required": experience_value,
            "ctc_range": ctc_range_value,
            "created_by": user.get("name", "Unknown"),
            "created_by_id": user.get("id"),
            "created_by_role": user.get("role", "UNKNOWN"),
            "created_at": str(datetime.now())
        })
        return jsonify({"message": "Requirement created", "id": req_id}), 201

    except Exception as e:
        print("❌ Error creating requirement:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route("/assign-requirement", methods=["POST"])
def assign_requirement():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON body"}), 400

        requirement_id = data.get("requirement_id")
        recruiter_id = data.get("recruiter_id")
        assigned_by = data.get("assigned_by")
        status = data.get("status", "ASSIGNED")

        if not all([requirement_id, recruiter_id, assigned_by]):
            return jsonify({"error": "Missing required fields"}), 400

        alloc_id = str(uuid.uuid4())

        conn = get_db_connection()
        cursor = conn.cursor()

        # Ensure table exists with required columns
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_allocations (
                id VARCHAR(64) PRIMARY KEY,
                requirement_id VARCHAR(64) NOT NULL,
                recruiter_id INT NOT NULL,
                assigned_by INT NOT NULL,
                status VARCHAR(20) DEFAULT 'ASSIGNED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        # Add status column if missing (legacy tables)
        cursor.execute("SHOW COLUMNS FROM requirement_allocations LIKE 'status'")
        if cursor.fetchone() is None:
            cursor.execute("ALTER TABLE requirement_allocations ADD COLUMN status VARCHAR(20) DEFAULT 'ASSIGNED'")
            conn.commit()

        # Add created_at column if missing
        cursor.execute("SHOW COLUMNS FROM requirement_allocations LIKE 'created_at'")
        if cursor.fetchone() is None:
            cursor.execute("ALTER TABLE requirement_allocations ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            conn.commit()

        # Validate recruiter
        cursor.execute("SELECT COUNT(*) FROM users WHERE id = %s", (recruiter_id,))
        if cursor.fetchone()[0] == 0:
            return jsonify({"error": "Recruiter not found"}), 400

        # Validate assigned_by
        cursor.execute("SELECT COUNT(*) FROM users WHERE id = %s", (assigned_by,))
        if cursor.fetchone()[0] == 0:
            return jsonify({"error": "Assigned by user not found"}), 400

        # Validate requirement
        cursor.execute("SELECT COUNT(*) FROM requirements WHERE id = %s", (requirement_id,))
        if cursor.fetchone()[0] == 0:
            return jsonify({"error": "Requirement not found"}), 400

        # Insert allocation
        cursor.execute("""
            INSERT INTO requirement_allocations (id, requirement_id, recruiter_id, assigned_by, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (alloc_id, requirement_id, recruiter_id, assigned_by, status))
        conn.commit()

        # ---------- NEW PART: build payload for n8n ----------

        # Fetch recruiter info (id, name, email)
        cursor.execute(
            "SELECT id, name, email FROM users WHERE id = %s",
            (recruiter_id,),
        )
        recruiter_row = cursor.fetchone()
        recruiter_id_val = recruiter_row[0] if recruiter_row else None
        recruiter_name = recruiter_row[1] if recruiter_row else None
        recruiter_email = recruiter_row[2] if recruiter_row else None

        # Fetch assigner info (who assigned)
        cursor.execute(
            "SELECT id, name, email FROM users WHERE id = %s",
            (assigned_by,),
        )
        assigner_row = cursor.fetchone()
        assigned_by_id = assigner_row[0] if assigner_row else None
        assigned_by_name = assigner_row[1] if assigner_row else None
        assigned_by_email = assigner_row[2] if assigner_row else None

        # Fetch requirement info (id, title, client_id)
        cursor.execute(
            "SELECT id, title, client_id FROM requirements WHERE id = %s",
            (requirement_id,),
        )
        req_row = cursor.fetchone()
        req_id_val = req_row[0] if req_row else None
        req_title = req_row[1] if req_row else None
        client_id_val = req_row[2] if req_row else None

        # Fetch client name (optional)
        client_name = None
        if client_id_val:
            cursor.execute("SELECT name FROM clients WHERE id = %s", (client_id_val,))
            client_row = cursor.fetchone()
            if client_row:
                client_name = client_row[0]

        # Send event to n8n (safe even if some fields are None)
        payload = {
            "allocation_id": alloc_id,
            "requirement_id": req_id_val,
            "requirement_title": req_title,
            "client_id": client_id_val,
            "client_name": client_name,
            "recruiter_id": recruiter_id_val,
            "recruiter_name": recruiter_name,
            "recruiter_email": recruiter_email,
            "assigned_by_id": assigned_by_id,
            "assigned_by_name": assigned_by_name,
            "assigned_by_email": assigned_by_email,
            "status": status,
        }

        notify_event("requirement_assigned", payload)

        # ---------- END NEW PART ----------

        cursor.close()
        conn.close()

        return jsonify({
            "message": "Requirement assigned successfully",
            "allocation_id": alloc_id
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/requirements/<string:req_id>/allocations", methods=["GET"])
def get_requirement_allocations(req_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                ra.id,
                ra.requirement_id,
                ra.recruiter_id,
                ra.assigned_by,
                ra.created_at,
                ra.status,
                recruiter.name AS recruiter_name,
                assigner.name AS assigned_by_name,
                req.title AS requirement_title
            FROM requirement_allocations ra
            LEFT JOIN users recruiter ON recruiter.id = ra.recruiter_id
            LEFT JOIN users assigner ON assigner.id = ra.assigned_by
            LEFT JOIN requirements req ON req.id = ra.requirement_id
            WHERE ra.requirement_id = %s
            ORDER BY ra.created_at DESC
        """, (req_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/recruiter/<int:recruiter_id>/requirements", methods=["GET"])
def get_recruiter_requirements(recruiter_id):
    """Return all requirement allocations assigned to a recruiter with requirement and client details."""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                ra.id AS allocation_id,
                ra.requirement_id,
                ra.created_at AS assigned_date,
                ra.status,
                req.title,
                req.location,
                req.skills_required,
                req.experience_required,
                req.description,
                req.ctc_range,
                req.ecto_range,
                req.status AS requirement_status,
                req.created_by,
                client.name AS client_name,
                assigner.name AS assigned_by
            FROM requirement_allocations ra
            JOIN requirements req ON req.id = ra.requirement_id
            LEFT JOIN clients client ON client.id = req.client_id
            LEFT JOIN users assigner ON assigner.id = ra.assigned_by
            WHERE ra.recruiter_id = %s
            ORDER BY ra.created_at DESC
        """, (recruiter_id,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get-requirements", methods=["GET"])
def get_requirements():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM requirements ORDER BY created_at DESC")
    data = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(data)


# -----------------------------
#  Delete Requirement
# -----------------------------
@app.route('/delete-requirement/<req_id>', methods=['DELETE', 'OPTIONS'])
def delete_requirement(req_id):

    # Handle CORS preflight
    if request.method == "OPTIONS":
        return '', 200

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if requirement exists
        cursor.execute("SELECT id FROM requirements WHERE id = %s", (req_id,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"error": "Requirement not found"}), 404

        # Delete allocations related to this requirement
        cursor.execute(
            "DELETE FROM requirement_allocations WHERE requirement_id = %s",
            (req_id,)
        )

        # Delete requirement
        cursor.execute(
            "DELETE FROM requirements WHERE id = %s",
            (req_id,)
        )

        conn.commit()

        return jsonify({"message": "Requirement deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route('/create-client', methods=['POST'])
def create_client():
    data = request.get_json()
    name = data.get("name")
    contact_person = data.get("contact_person")
    email = data.get("email")
    phone = data.get("phone")
    address = data.get("address")

    if not name:
        return jsonify({"message": "Client name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO clients (name, contact_person, email, phone, address)
        VALUES (%s, %s, %s, %s, %s)
    """, (name, contact_person, email, phone, address))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Client created successfully"}), 201

@app.route('/clients', methods=['GET'])
def get_clients():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM clients ORDER BY id DESC")
        clients = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(clients), 200

    except Exception as e:
        return jsonify({"message": "Error fetching clients", "error": str(e)}), 500

@app.route("/update-client/<int:id>", methods=["PUT"])
def update_client(id):
    data = request.json
    name = data.get("name")
    email = data.get("email")
    contact_person = data.get("contact_person")
    phone = data.get("phone")
    address = data.get("address")
    status = data.get("status", "ACTIVE")  # default to ACTIVE if not provided

    if not name or not email:
        return jsonify({"message": "Name and Email are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            UPDATE clients 
            SET name=%s, email=%s, contact_person=%s, phone=%s, address=%s, status=%s 
            WHERE id=%s
        """, (name, email, contact_person, phone, address, status, id))
        conn.commit()

        return jsonify({
            "id": id,
            "name": name,
            "email": email,
            "contact_person": contact_person,
            "phone": phone,
            "address": address,
            "status": status,
            "message": "Client updated successfully"
        }), 200
    except Error as e:
        return jsonify({"message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


# ---------------- DELETE CLIENT ----------------
@app.route('/delete-client/<int:id>', methods=['DELETE'])
def delete_client(id):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1️⃣ Check if this client is linked to any requirements
        cursor.execute("SELECT COUNT(*) FROM requirements WHERE client_id = %s", (id,))
        req_count = cursor.fetchone()[0]

        if req_count > 0:
            return jsonify({
                "message": "Client cannot be deleted because it is used in one or more requirements."
            }), 400

        # 2️⃣ Safe to delete client
        cursor.execute("DELETE FROM clients WHERE id = %s", (id,))
        conn.commit()

        return jsonify({
            "id": id,
            "message": "Client deleted successfully!"
        }), 200

    except Error as e:
        return jsonify({"message": str(e)}), 500

    finally:
        cursor.close()
        conn.close()


#user management

# -------------------------------
# Get all users (recent first)
# -------------------------------
@app.route("/users-list", methods=["GET"])
def get_users_list():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, phone, role, status FROM users ORDER BY id DESC")
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(users), 200
    except Exception as e:
        print("❌ Error fetching users:", e)
        return jsonify({"message": "❌ Error fetching users", "error": str(e)}), 500


# -------------------------------
# Add a new user
# -------------------------------
@app.route("/users", methods=["POST"])
def add_user():
    try:
        data = request.json
        name = data.get("name")
        email = data.get("email")
        phone = data.get("phone")
        password = data.get("password")
        role = data.get("role", "RECRUITER")
        status = data.get("status", "ACTIVE")
    

        if not all([name, email, password]):
            return jsonify({"message": "Name, email, and password are required"}), 400

        # Hash password
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
        cursor = conn.cursor(dictionary=True)

        # Check if email exists
        cursor.execute("SELECT * FROM usersdata WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"message": "⚠ Email already exists!"}), 409

        # Insert user
        cursor.execute(
            "INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (%s,%s,%s,%s,%s,%s)",
            (name, email, phone, password_hash, role, status)
        )
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"✅ User '{name}' added successfully!"}), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"message": "❌ Error adding user", "error": str(e)}), 500


# -------------------------------
# Update a user
# -------------------------------
@app.route("/update-user/<int:id>", methods=["PUT"])
def update_user(id):
    try:
        data = request.json
        name = data.get("name")
        email = data.get("email")
        phone = data.get("phone")
        role = data.get("role")
        status = data.get("status")
        password = data.get("password")  # optional

        conn = get_db_connection()
        cursor = conn.cursor()

        if password:
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            cursor.execute(
                "UPDATE users SET name=%s, email=%s, phone=%s, role=%s, status=%s, password_hash=%s WHERE id=%s",
                (name, email, phone, role, status, password_hash, id)
            )
        else:
            cursor.execute(
                "UPDATE users SET name=%s, email=%s, phone=%s, role=%s, status=%s WHERE id=%s",
                (name, email, phone, role, status, id)
            )

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"✅ User '{name}' updated successfully!"}), 200

    except Exception as e:
        print("❌ Error updating user:", e)
        return jsonify({"message": "❌ Error updating user", "error": str(e)}), 500


# -------------------------------
# Delete a user
# -------------------------------
@app.route("/delete-user/<int:id>", methods=["DELETE"])
def delete_user(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id=%s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "🗑 User deleted successfully!"}), 200
    except Exception as e:
        print("❌ Error deleting user:", e)
        return jsonify({"message": "❌ Error deleting user", "error": str(e)}), 500



# -------------------------------------
# Run Server
# -------------------------------------
if __name__ == '__main__':
    # Import AI routes after env loading (to avoid circular import issues)
    from controllers.ai_chat_controller import register_ai_routes
    from controllers.ai_jd_controller import jd_bp
    ensure_admin_exists()
    ensure_user_status_defaults()
    # Register AI assistant routes without altering existing endpoints
    register_ai_routes(app)
    app.register_blueprint(jd_bp)
    app.run(debug=True)
