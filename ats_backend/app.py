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
from utils.db import get_db_connection, db_config
from controllers.reports_controller import reports_bp
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}}, supports_credentials=True)
app.register_blueprint(reports_bp)

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
# Moved to utils/db.py

def initialize_database():
    """Create tables if they do not exist."""
    try:
        conn = get_db_connection()
        if not conn:
            print("❌ DB connection failed")
            return

        cursor = conn.cursor()

        # ---------------------------
        # USERS TABLE
        # ---------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('ADMIN','DELIVERY_MANAGER','TEAM_LEAD','RECRUITER','CLIENT','CANDIDATE') DEFAULT 'RECRUITER',
                phone VARCHAR(20),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ---------------------------
        # USERSDATA TABLE
        # ---------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usersdata (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(150) UNIQUE,
                phone VARCHAR(20),
                role VARCHAR(50),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                password_hash VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ---------------------------
        # CLIENTS TABLE
        # ---------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                contact_person VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ---------------------------
        # REQUIREMENTS TABLE
        # ---------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirements (
                id VARCHAR(50) PRIMARY KEY,
                client_id INT,
                title VARCHAR(255),
                description TEXT,
                location VARCHAR(100),
                skills_required VARCHAR(255),
                experience_required FLOAT,
                ctc_range VARCHAR(100),
                no_of_rounds INT DEFAULT 1,
                status VARCHAR(50) DEFAULT 'OPEN',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(100),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            );
        """)

        # Check for no_of_rounds column in requirements
        cursor.execute("SHOW COLUMNS FROM requirements LIKE 'no_of_rounds'")
        if not cursor.fetchone():
            print("⚠️ Adding 'no_of_rounds' column to requirements...")
            try:
                cursor.execute("ALTER TABLE requirements ADD COLUMN no_of_rounds INT DEFAULT 1")
            except Exception as e:
                print(f"❌ Error adding no_of_rounds: {e}")

        # ---------------------------
        # REQUIREMENT_ALLOCATIONS
        # ---------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_allocations (
                id VARCHAR(50) PRIMARY KEY,
                requirement_id VARCHAR(50),
                recruiter_id INT,
                assigned_by INT,
                status VARCHAR(20) DEFAULT 'ASSIGNED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requirement_id) REFERENCES requirements(id),
                FOREIGN KEY (recruiter_id) REFERENCES users(id),
                FOREIGN KEY (assigned_by) REFERENCES users(id)
            );
        """)

        # ---------------------------
        # CANDIDATES TABLE
        # ---------------------------
        cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20),
        skills TEXT,
        education TEXT,
        experience TEXT,
        ctc VARCHAR(50),          
        ectc VARCHAR(50),         
        resume_filename VARCHAR(255),
        created_by INT,
        source VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
""")


        # ---------------------------
        # REQUIREMENT STAGES (NEW)
        # ---------------------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_stages (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                requirement_id VARCHAR(50),
                stage_order INT,
                stage_name VARCHAR(255),
                is_mandatory BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requirement_id) REFERENCES requirements(id)
            );
        """)

        # ---------------------------
        # CANDIDATE PROGRESS (UPDATED)
        # ---------------------------
        # Check if table exists to decide on creation or update
        cursor.execute("SHOW TABLES LIKE 'candidate_progress'")
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE candidate_progress (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    candidate_id INT,
                    requirement_id VARCHAR(50),
                    stage_id BIGINT,
                    stage_name VARCHAR(255),
                    status ENUM('PENDING','IN_PROGRESS','COMPLETED','REJECTED','REVIEW_REQUIRED') DEFAULT 'PENDING',
                    decision ENUM('NONE','MOVE_NEXT','HOLD','REJECT') DEFAULT 'NONE',
                    manual_decision ENUM('NONE','MOVE_NEXT','HOLD','REJECT') DEFAULT 'NONE',
                    category VARCHAR(50),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uniq_progress_stage (candidate_id, requirement_id, stage_id),
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                    FOREIGN KEY (requirement_id) REFERENCES requirements(id),
                    FOREIGN KEY (stage_id) REFERENCES requirement_stages(id)
                );
            """)
        else:
            # Table exists, attempt to add new columns if they don't exist
            print("⚠️ 'candidate_progress' exists. Checking for schema updates...")
            
            cursor.execute("SHOW COLUMNS FROM candidate_progress LIKE 'stage_id'")
            if not cursor.fetchone():
                print("   -> Adding 'stage_id' column...")
                try:
                    cursor.execute("ALTER TABLE candidate_progress ADD COLUMN stage_id BIGINT")
                    cursor.execute("ALTER TABLE candidate_progress ADD CONSTRAINT fk_cp_stage FOREIGN KEY (stage_id) REFERENCES requirement_stages(id)")
                except Exception as e:
                    print(f"   ❌ Error adding stage_id: {e}")

            cursor.execute("SHOW COLUMNS FROM candidate_progress LIKE 'stage_name'")
            if not cursor.fetchone():
                print("   -> Adding 'stage_name' column...")
                try:
                    cursor.execute("ALTER TABLE candidate_progress ADD COLUMN stage_name VARCHAR(255)")
                except Exception as e:
                    print(f"   ❌ Error adding stage_name: {e}")

            cursor.execute("SHOW COLUMNS FROM candidate_progress LIKE 'decision'")
            if not cursor.fetchone():
                print("   -> Adding 'decision' column...")
                try:
                    cursor.execute("ALTER TABLE candidate_progress ADD COLUMN decision ENUM('NONE','MOVE_NEXT','HOLD','REJECT') DEFAULT 'NONE'")
                except Exception as e:
                    print(f"   ❌ Error adding decision: {e}")

            cursor.execute("SHOW COLUMNS FROM candidate_progress LIKE 'manual_decision'")
            if not cursor.fetchone():
                print("   -> Adding 'manual_decision' column...")
                try:
                    cursor.execute("ALTER TABLE candidate_progress ADD COLUMN manual_decision ENUM('NONE','MOVE_NEXT','HOLD','REJECT') DEFAULT 'NONE'")
                except Exception as e:
                    print(f"   ❌ Error adding manual_decision: {e}")

            cursor.execute("SHOW COLUMNS FROM candidate_progress LIKE 'category'")
            if not cursor.fetchone():
                print("   -> Adding 'category' column...")
                try:
                    cursor.execute("ALTER TABLE candidate_progress ADD COLUMN category VARCHAR(50)")
                except Exception as e:
                    print(f"   ❌ Error adding category: {e}")

            # Fix Unique Key for candidate_progress
            print("   -> Checking unique key constraints...")
            try:
                # Try to drop the old unique key if it exists
                cursor.execute("ALTER TABLE candidate_progress DROP INDEX uniq_progress")
                print("   ✅ Dropped old unique key 'uniq_progress'")
            except Exception:
                pass # Key might not exist

            try:
                # Add the correct unique key
                cursor.execute("ALTER TABLE candidate_progress ADD UNIQUE KEY uniq_progress_stage (candidate_id, requirement_id, stage_id)")
                print("   ✅ Added unique key 'uniq_progress_stage'")
            except Exception as e:
                # print(f"   ℹ️ Unique key 'uniq_progress_stage' might already exist: {e}")
                pass

        # ---------------- CANDIDATE SCREENING ----------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS candidate_screening (
                id INT AUTO_INCREMENT PRIMARY KEY,
                candidate_id INT,
                requirement_id VARCHAR(64),
                ai_score FLOAT,
                ai_rationale TEXT,
                recommend VARCHAR(32),
                red_flags TEXT,
                model_version VARCHAR(50),
                status ENUM('PENDING','DONE','ERROR') DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                FOREIGN KEY (requirement_id) REFERENCES requirements(id)
            );
        """)

        # ---------------- ASSESSMENT QUEUE ----------------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS assesment_queue (
                id INT AUTO_INCREMENT PRIMARY KEY,
                candidate_id INT NOT NULL,
                requirement_id VARCHAR(64) NOT NULL,
                status VARCHAR(32) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                FOREIGN KEY (requirement_id) REFERENCES requirements(id)
            );
        """)

        conn.commit()
        cursor.close()
        conn.close()

        print("✅ All required tables checked/created successfully")

    except Exception as e:
        print("❌ Error initializing DB:", e)

# Debug: Print DB config (mask password for security)
print(f"🔧 DB Config: host={db_config['host']}, user={db_config['user']}, database={db_config['database']}, password={'***' if db_config['password'] else '(empty)'}")


app.config["UPLOAD_FOLDER"] = "./uploads/resumes"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_allowed_roles():
    import re
    conn = get_db_connection()
    if not conn:
        return []
    cursor = conn.cursor()
    cursor.execute("SHOW COLUMNS FROM users LIKE 'role'")
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return []

    # row[1] contains: "enum('ADMIN','RECRUITER',...)"
    enum_type = row[1]
    roles = re.findall(r"'(.*?)'", enum_type)
    return roles


# -------------------------------------
# Create a reusable connection function
# -------------------------------------
# Moved to utils/db.py

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


@app.route("/roles", methods=["GET"])
def roles_endpoint():
    """
    Returns JSON: { "roles": ["ADMIN","RECRUITER", ...] }
    Frontend should call this to populate role dropdowns dynamically.
    """
    try:
        roles = get_allowed_roles()
        return jsonify({"roles": roles}), 200
    except Exception as e:
        return jsonify({"roles": [], "error": str(e)}), 500



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
        created_by = request.form.get("created_by", type=int)

        # New fields
        ctc = request.form.get("ctc")
        ectc = request.form.get("ectc")

        resume = request.files.get("resume")

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

        # Insert WITH created_by
        if created_by:
            # Verify if user exists to avoid FK error
            cursor.execute("SELECT id FROM users WHERE id = %s", (created_by,))
            if cursor.fetchone():
                cursor.execute("""
                    INSERT INTO candidates
                    (name, email, phone, skills, education, experience, resume_filename,
                     created_by, ctc, ectc)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (name, email, phone, skills, education, experience,
                      filename, created_by, ctc, ectc))
            else:
                print(f"⚠️ User ID {created_by} not found. Inserting candidate without created_by.")
                cursor.execute("""
                    INSERT INTO candidates
                    (name, email, phone, skills, education, experience, resume_filename,
                     ctc, ectc)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (name, email, phone, skills, education, experience,
                      filename, ctc, ectc))
        else:
            # Insert WITHOUT created_by
            cursor.execute("""
                INSERT INTO candidates
                (name, email, phone, skills, education, experience, resume_filename,
                 ctc, ectc)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (name, email, phone, skills, education, experience,
                  filename, ctc, ectc))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"✅ Candidate '{name}' submitted successfully!"}), 201

    except Exception as e:
        print("❌ Error:", e)
        return jsonify({"message": "❌ Error submitting candidate", "error": str(e)}), 500


@app.route("/get-candidates", methods=["GET"])
def get_candidates():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1️⃣ Ensure correct database
        cursor.execute("SELECT DATABASE()")
        db_row = cursor.fetchone()
        print("🟢 Current DB check:", db_row)

        db_name = db_row.get("DATABASE()") if db_row else None

        if not db_name or db_name.lower() != "ats_system":
            print("⚠ Switching to ats database...")
            cursor.execute("USE ats_system")
            conn.commit()

        # 2️⃣ Create table if it doesn't exist
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
                    ctc VARCHAR(50),
                    ectc VARCHAR(50),
                    created_by INT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            """)
            conn.commit()
            print("✅ 'candidates' table created successfully!")

        # 3️⃣ Ensure ctc + ectc columns exist
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA='ats_system'
            AND TABLE_NAME='candidates'
        """)
        cols = [row["COLUMN_NAME"] for row in cursor.fetchall()]

        if "ctc" not in cols:
            print("⚠ Adding 'ctc' column")
            cursor.execute("ALTER TABLE candidates ADD COLUMN ctc VARCHAR(50)")
            conn.commit()

        if "ectc" not in cols:
            print("⚠ Adding 'ectc' column")
            cursor.execute("ALTER TABLE candidates ADD COLUMN ectc VARCHAR(50)")
            conn.commit()

        # 4️⃣ Role-based filtering
        user_id = request.args.get("user_id", type=int)
        user_role = request.args.get("user_role", "").upper()

        if user_role == "RECRUITER" and user_id:
            cursor.execute(
                "SELECT * FROM candidates WHERE created_by=%s ORDER BY id DESC",
                (user_id,)
            )
        elif user_role in ["ADMIN", "DELIVERY_MANAGER"]:
            cursor.execute("SELECT * FROM candidates ORDER BY id DESC")
        else:
            cursor.execute("SELECT * FROM candidates ORDER BY id DESC")

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
        ctc = request.form.get("ctc")
        ectc = request.form.get("ectc")

        resume = request.files.get("resume")

        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor()

        if resume and allowed_file(resume.filename):
            filename = secure_filename(resume.filename)
            resume.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))

            cursor.execute("""
                UPDATE candidates 
                SET name=%s, email=%s, phone=%s, skills=%s, education=%s, experience=%s,
                    ctc=%s, ectc=%s, resume_filename=%s
                WHERE id=%s
            """, (name, email, phone, skills, education, experience, ctc, ectc, filename, id))

        else:
            cursor.execute("""
                UPDATE candidates 
                SET name=%s, email=%s, phone=%s, skills=%s, education=%s, experience=%s,
                    ctc=%s, ectc=%s
                WHERE id=%s
            """, (name, email, phone, skills, education, experience, ctc, ectc, id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "✅ Candidate updated successfully!"}), 200

    except Exception as e:
        print(e)
        return jsonify({"message": str(e)}), 500


@app.route('/get-users', methods=['GET'])
def get_users():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        # Fetch users with fallback to usersdata
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

        # --- NEW: Validate roles based on ENUM ---
        allowed_roles = get_allowed_roles()

        for user in users:
            if allowed_roles and user["role"] not in allowed_roles:
                user["role_valid"] = False
                user["allowed_roles"] = allowed_roles
            else:
                user["role_valid"] = True

        return jsonify(users), 200

    except Exception as e:
        return jsonify({"message": "❌ Error fetching users", "error": str(e)}), 500



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

        # --- ADD: Validate role against ENUM ---
        allowed_roles = get_allowed_roles()
        if allowed_roles and role not in allowed_roles:
            return jsonify({
                "message": f"Invalid role. Allowed roles: {', '.join(allowed_roles)}"
            }), 400

        # Hash the password
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        conn = get_db_connection()
        cursor = conn.cursor()

        # Insert new user into usersdata
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
@app.route('/users/<int:user_id>/details', methods=['GET'])
def get_user_details(user_id):
    """
    Provide unified view: user profile, assigned requirements, created candidates,
    and organization stats for ADMINS / DELIVERY_MANAGERS.
    """
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        # ------------------------------------------------
        # 1️⃣ Base user profile (merge users + usersdata fallbacks)
        # ------------------------------------------------
        cursor.execute("""
            SELECT
                u.id,
                u.name,
                u.email,
                COALESCE(u.phone, ud.phone) AS phone,
                u.role,
                COALESCE(u.status, ud.status, 'ACTIVE') AS status,
                u.created_at
            FROM users u
            LEFT JOIN usersdata ud ON ud.email = u.email
            WHERE u.id = %s
        """, (user_id,))

        user_row = cursor.fetchone()
        if not user_row:
            cursor.close()
            conn.close()
            return jsonify({"error": "User not found"}), 404

        # --- NEW: Validate user role against ENUM ---
        allowed_roles = get_allowed_roles()
        if allowed_roles and user_row["role"] not in allowed_roles:
            return jsonify({
                "error": "Invalid role stored in database",
                "role_found": user_row["role"],
                "valid_roles": allowed_roles
            }), 400

        # ------------------------------------------------
        # 2️⃣ Requirements assigned to this recruiter
        # ------------------------------------------------
        cursor.execute("""
            SELECT
                ra.id AS allocation_id,
                ra.requirement_id,
                ra.status AS allocation_status,
                ra.created_at AS assigned_date,
                req.title,
                req.description,
                req.location,
                req.skills_required,
                req.experience_required,
                req.status AS requirement_status,
                client.name AS client_name,
                assigner.name AS assigned_by
            FROM requirement_allocations ra
            JOIN requirements req ON req.id = ra.requirement_id
            LEFT JOIN clients client ON client.id = req.client_id
            LEFT JOIN users assigner ON assigner.id = ra.assigned_by
            WHERE ra.recruiter_id = %s
            ORDER BY ra.created_at DESC
        """, (user_id,))
        assigned_requirements = cursor.fetchall()

        # ------------------------------------------------
        # 3️⃣ Candidates created by the user
        # ------------------------------------------------
        cursor.execute("""
            SELECT
                id,
                name,
                email,
                phone,
                skills,
                education,
                experience,
                resume_filename,
                created_at
            FROM candidates
            WHERE created_by = %s
            ORDER BY created_at DESC
        """, (user_id,))
        created_candidates = cursor.fetchall()

        response_payload = {
            "user": user_row,
            "allowed_roles": allowed_roles,          # ⭐ Return ENUM roles for frontend use
            "assigned_requirements": assigned_requirements,
            "assigned_requirement_count": len(assigned_requirements),
            "created_candidates": created_candidates,
            "created_candidate_count": len(created_candidates),
        }

        # ------------------------------------------------
        # 4️⃣ If ADMIN or DELIVERY_MANAGER → return org-wide summary
        # ------------------------------------------------
        if user_row["role"] in ("ADMIN", "DELIVERY_MANAGER"):
            org_stats = {}

            cursor.execute("SELECT COUNT(*) AS total_requirements FROM requirements")
            org_stats["total_requirements"] = cursor.fetchone().get("total_requirements", 0)

            cursor.execute("SELECT COUNT(*) AS open_requirements FROM requirements WHERE status = 'OPEN'")
            org_stats["open_requirements"] = cursor.fetchone().get("open_requirements", 0)

            cursor.execute("SELECT COUNT(*) AS total_candidates FROM candidates")
            org_stats["total_candidates"] = cursor.fetchone().get("total_candidates", 0)

            cursor.execute("SELECT COUNT(*) AS total_users FROM users")
            org_stats["total_users"] = cursor.fetchone().get("total_users", 0)

            cursor.execute("SELECT COUNT(*) AS total_clients FROM clients")
            org_stats["total_clients"] = cursor.fetchone().get("total_clients", 0)

            response_payload["org_stats"] = org_stats

        cursor.close()
        conn.close()

        return jsonify(response_payload), 200

    except Exception as e:
        print("❌ Error building user details:", e)
        return jsonify({"error": str(e)}), 500



@app.route("/create-screening-process", methods=["POST"])
def create_screening_process():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""CREATE TABLE IF NOT EXISTS candidate_screening (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            candidate_id INT NOT NULL,
            requirement_id VARCHAR(50) NOT NULL,
            ai_score FLOAT,
            ai_rationale TEXT,
            recommend ENUM('SCREENED','REJECTED','SHORTLISTED'),
            red_flags JSON,
            model_version VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id),
            FOREIGN KEY (requirement_id) REFERENCES requirements(id)
    );""")
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "✅ Screening process created successfully!"}), 200
    except Exception as e:
        print("❌ Error creating screening process:", e)
        return jsonify({"message": "❌ Error creating screening Table", "error": str(e)}), 500




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

        if not new_status:
            return jsonify({"message": "status is required"}), 400

        # --- NEW: Validate allowed statuses ---
        allowed_statuses = ["ACTIVE", "INACTIVE"]
        new_status = new_status.upper()

        if new_status not in allowed_statuses:
            return jsonify({
                "message": "Invalid status value",
                "allowed_statuses": allowed_statuses
            }), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        # --- NEW: Check user exists ---
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        user_exists = cursor.fetchone()

        if not user_exists:
            cursor.close()
            conn.close()
            return jsonify({"message": "User not found"}), 404

        # --- Update status ---
        cursor.execute(
            "UPDATE users SET status = %s WHERE id = %s",
            (new_status, user_id)
        )
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({
            "message": "✅ User status updated",
            "id": user_id,
            "status": new_status
        }), 200

    except Exception as e:
        return jsonify({
            "message": "❌ Error updating user status",
            "error": str(e)
        }), 500
   
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
        required_fields = ["client_id", "title", "location"]
        missing = []
        for field in required_fields:
            value = data.get(field)
            if value is None or str(value).strip() == "":
                missing.append(field)

        if missing:
            print(f"❌ create_requirement failed: Missing fields {missing}")
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        # Normalize client_id
        client_id_value = data.get("client_id")
        try:
            client_id_value = int(client_id_value)
        except (TypeError, ValueError):
            print(f"❌ create_requirement failed: Invalid client_id '{client_id_value}'")
            return jsonify({"error": "Invalid client_id"}), 400

        # Helpers
        def _sanitize_text(value, length=None):
            try:
                text = str(value or "").strip()
            except Exception:
                text = ""
            return text[:length] if length else text

        title_value = _sanitize_text(data.get("title"), 255)
        description_value = _sanitize_text(data.get("description"))
        location_value = _sanitize_text(data.get("location"), 100)
        skills_value = _sanitize_text(data.get("skills_required"), 255)

        # Experience required
        experience_raw = data.get("experience_required")
        try:
            if isinstance(experience_raw, (int, float)):
                experience_value = float(experience_raw)
            else:
                matches = re.findall(r"[\d\.]+", str(experience_raw or ""))
                experience_value = float(matches[0]) if matches else 0.0
        except:
            experience_value = 0.0

        # Only CTC exists in table now
        ctc_range_value = _sanitize_text(data.get("ctc_range"), 100)

        created_by_value = _sanitize_text(data.get("created_by"), 50).upper()
        
        # Number of Rounds
        try:
            no_of_rounds = int(data.get("no_of_rounds", 1))
        except:
            no_of_rounds = 1

        # Custom stage names (if provided)
        stage_names_list = data.get("stage_names", [])
        if not isinstance(stage_names_list, list):
            stage_names_list = []

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO requirements
            (id, client_id, title, description, location, skills_required, 
             experience_required, ctc_range, no_of_rounds, status, created_by)
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
            no_of_rounds,
            created_by_value
        ))

        # Generate Stages with custom names if provided
        for i in range(1, no_of_rounds + 1):
            # Use custom name if available, otherwise default to "Round X"
            if i <= len(stage_names_list) and stage_names_list[i-1].strip():
                stage_name = stage_names_list[i-1].strip()
            else:
                stage_name = f"Round {i}"
                
            cursor.execute("""
                INSERT INTO requirement_stages (requirement_id, stage_order, stage_name, is_mandatory)
                VALUES (%s, %s, %s, TRUE)
            """, (req_id, i, stage_name))

        conn.commit()
        cursor.close()
        conn.close()

        # Fetch client name (optional)
        client_name = "Unknown Client"
        try:
            conn2 = get_db_connection()
            cursor2 = conn2.cursor(dictionary=True)
            cursor2.execute("SELECT name FROM clients WHERE id = %s", (client_id_value,))
            row = cursor2.fetchone()
            if row:
                client_name = row["name"]
            cursor2.close()
            conn2.close()
        except:
            pass

        user = get_current_user()

        # Notify event
        notify_event("new_requirement_created", {
            "id": req_id,
            "title": title_value,
            "description": description_value[:100] + "..." if len(description_value) > 100 else description_value,
            "location": location_value,
            "client_id": client_id_value,
            "client_name": client_name,
            "skills_required": skills_value,
            "experience_required": experience_value,
            "ctc_range": ctc_range_value,
            "no_of_rounds": no_of_rounds,
            "created_by": user.get("name", "Unknown"),
            "created_by_id": user.get("id"),
            "created_by_role": user.get("role", "UNKNOWN"),
            "created_at": str(datetime.now())
        })

        return jsonify({"message": "Requirement created", "id": req_id}), 201

    except Exception as e:
        print("❌ Error creating requirement:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidate-tracker/<int:candidate_id>", methods=["GET"])
def get_candidate_tracker(candidate_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Get all requirements this candidate is associated with (via progress or screening)
        # For now, let's assume if they are in candidate_progress, they are being tracked.
        # If they are just screened, we might need to initialize progress?
        # The user said "after a candidate is screened... he should be visible in this track route".
        # So we should look for screening records too and maybe auto-initialize progress if missing.

        # Let's just fetch requirements where we have progress OR screening
        cursor.execute("""
            SELECT DISTINCT r.id, r.title, r.client_id, c.name as client_name, r.no_of_rounds
            FROM requirements r
            LEFT JOIN clients c ON c.id = r.client_id
            LEFT JOIN candidate_progress cp ON cp.requirement_id = r.id
            LEFT JOIN candidate_screening cs ON cs.requirement_id = r.id
            WHERE cp.candidate_id = %s OR cs.candidate_id = %s
        """, (candidate_id, candidate_id))
        
        requirements = cursor.fetchall()
        
        tracker_data = []
        
        for req in requirements:
            req_id = req["id"]
            
            # Get Stages
            cursor.execute("""
                SELECT id, stage_order, stage_name 
                FROM requirement_stages 
                WHERE requirement_id = %s 
                ORDER BY stage_order ASC
            """, (req_id,))
            stages = cursor.fetchall()
            
            # Get Progress for each stage
            cursor.execute("""
                SELECT stage_id, status, decision, updated_at
                FROM candidate_progress
                WHERE candidate_id = %s AND requirement_id = %s
            """, (candidate_id, req_id))
            progress_rows = cursor.fetchall()
            progress_map = {row["stage_id"]: row for row in progress_rows}
            
            stages_with_status = []
            for stage in stages:
                p = progress_map.get(stage["id"], {})
                stages_with_status.append({
                    "stage_id": stage["id"],
                    "stage_name": stage["stage_name"],
                    "stage_order": stage["stage_order"],
                    "status": p.get("status", "PENDING"),
                    "decision": p.get("decision", "NONE"),
                    "updated_at": p.get("updated_at")
                })
                
            tracker_data.append({
                "requirement": req,
                "stages": stages_with_status
            })
            
        cursor.close()
        conn.close()
        
        return jsonify(tracker_data), 200
        
    except Exception as e:
        print("❌ Error fetching tracker:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/api/update-stage-status", methods=["POST"])
def update_stage_status():
    try:
        data = request.get_json()
        candidate_id = data.get("candidate_id")
        requirement_id = data.get("requirement_id")
        stage_id = data.get("stage_id")
        status = data.get("status") # PENDING, IN_PROGRESS, COMPLETED, REJECTED
        decision = data.get("decision") # NONE, MOVE_NEXT, HOLD, REJECT
        
        if not all([candidate_id, requirement_id, stage_id, status]):
            return jsonify({"error": "Missing required fields"}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get stage name
        cursor.execute("SELECT stage_name FROM requirement_stages WHERE id=%s", (stage_id,))
        s_row = cursor.fetchone()
        stage_name = s_row[0] if s_row else "Unknown"
        
        # Use INSERT ON DUPLICATE KEY UPDATE to handle both insert and update
        # Note: Using explicit column names instead of VALUES() for MySQL 8.0+ compatibility
        cursor.execute("""
            INSERT INTO candidate_progress 
            (candidate_id, requirement_id, stage_id, stage_name, status, decision)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                status = %s,
                decision = %s,
                updated_at = CURRENT_TIMESTAMP
        """, (candidate_id, requirement_id, stage_id, stage_name, status, decision or 'NONE',
              status, decision or 'NONE'))  # Repeat status and decision for UPDATE clause
            
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"message": "Status updated"}), 200
        
    except Exception as e:
        print(f"❌ Error updating status: {e}")
        print(f"   Details: candidate_id={candidate_id}, requirement_id={requirement_id}, stage_id={stage_id}, status={status}")
        import traceback
        traceback.print_exc()
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

        # Delete related records in the correct order (child tables first)
        
        # 1. Delete from candidate_progress (references requirement_id and stage_id)
        cursor.execute(
            "DELETE FROM candidate_progress WHERE requirement_id = %s",
            (req_id,)
        )
        
        # 2. Delete from candidate_screening (references requirement_id)
        cursor.execute(
            "DELETE FROM candidate_screening WHERE requirement_id = %s",
            (req_id,)
        )
        
        # 3. Delete from assesment_queue (references requirement_id)
        cursor.execute(
            "DELETE FROM assesment_queue WHERE requirement_id = %s",
            (req_id,)
        )
        
        # 4. Delete from interviews (references requirement_id)
        cursor.execute(
            "DELETE FROM interviews WHERE requirement_id = %s",
            (req_id,)
        )
        
        # 5. Delete from requirement_stages (references requirement_id)
        cursor.execute(
            "DELETE FROM requirement_stages WHERE requirement_id = %s",
            (req_id,)
        )
        
        # 6. Delete from requirement_allocations (references requirement_id)
        cursor.execute(
            "DELETE FROM requirement_allocations WHERE requirement_id = %s",
            (req_id,)
        )

        # 7. Finally, delete the requirement itself
        cursor.execute(
            "DELETE FROM requirements WHERE id = %s",
            (req_id,)
        )

        conn.commit()

        return jsonify({"message": "Requirement and all related records deleted successfully"}), 200

    except Exception as e:
        conn.rollback()
        print(f"❌ Error deleting requirement: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@app.route("/recent-requirements", methods=["GET"])
def recent_requirements():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Ensure correct DB
        cursor.execute("USE ats_system")

        # Ensure table exists
        cursor.execute("SHOW TABLES LIKE 'requirements'")
        if not cursor.fetchone():
            return jsonify([]), 200

        # Fetch latest 5 requirements
        cursor.execute("""
            SELECT 
                id,
                title,
                status,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS date
            FROM requirements
            ORDER BY created_at DESC
            LIMIT 5
        """)

        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(rows), 200

    except Exception as e:
        print("❌ Error fetching recent requirements:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/dashboard-stats', methods=['GET'])
def dashboard_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Use your database
        cursor.execute("USE ats_system")

        # Total requirements
        cursor.execute("SELECT COUNT(*) AS total FROM requirements")
        total = cursor.fetchone()['total'] or 0

        # Open requirements
        cursor.execute("SELECT COUNT(*) AS open_count FROM requirements WHERE status = 'Open'")
        open_req = cursor.fetchone()['open_count'] or 0

        # Closed requirements
        cursor.execute("SELECT COUNT(*) AS closed_count FROM requirements WHERE status = 'Closed'")
        closed_req = cursor.fetchone()['closed_count'] or 0

        # Assigned requirements
        cursor.execute("SELECT COUNT(*) AS assigned_count FROM requirement_allocations")
        assigned_req = cursor.fetchone()['assigned_count'] or 0

        # Urgent requirements (example: open and no_of_rounds > 5)
        cursor.execute("SELECT COUNT(*) AS urgent_count FROM requirements WHERE status = 'Open' AND no_of_rounds > 5")
        urgent_req = cursor.fetchone()['urgent_count'] or 0

        # Pending review
        cursor.execute("SELECT COUNT(*) AS pending_review FROM requirement_allocations WHERE status = 'Pending'")
        pending_review = cursor.fetchone()['pending_review'] or 0

        # Closed growth percent (closed this month / total)
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        cursor.execute(
            "SELECT COUNT(*) AS closed_this_month FROM requirements "
            "WHERE status = 'Closed' AND created_at >= %s",
            (start_of_month,)
        )
        closed_this_month = cursor.fetchone()['closed_this_month'] or 0
        closed_growth_percent = round((closed_this_month / total) * 100, 2) if total else 0

        cursor.close()
        conn.close()

        stats = {
            "totalRequirements": total,
            "openRequirements": open_req,
            "closedRequirements": closed_req,
            "assignedRequirements": assigned_req,
            "urgent": urgent_req,
            "pendingReview": pending_review,
            "closedGrowthPercent": closed_growth_percent
        }

        return jsonify({"stats": stats})

    except Exception as e:
        print("❌ Error fetching dashboard stats:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/update-requirement/<req_id>", methods=["PUT"])
def update_requirement(req_id):
    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM requirements WHERE id = %s", (req_id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Requirement not found"}), 404

    cursor = conn.cursor()  # non-dict cursor for update

    cursor.execute("""
        UPDATE requirements
        SET title=%s, location=%s, experience_required=%s,
            skills_required=%s, ctc_range=%s, client_id=%s, status=%s
        WHERE id=%s
    """, (
        data["title"],
        data["location"],
        data["experience_required"],
        data["skills_required"],
        data["ctc_range"],
        data["client_id"],
        data["status"],
        req_id
    ))

    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Requirement updated"})












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
        password = data.get("password")  # optional

        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT name, email, phone, role, COALESCE(status,'ACTIVE') AS status FROM users WHERE id=%s",
            (id,)
        )
        existing = cursor.fetchone()
        if not existing:
            cursor.close()
            conn.close()
            return jsonify({"message": "User not found"}), 404

        name = data.get("name", existing["name"])
        email = data.get("email", existing["email"])
        phone = data.get("phone", existing["phone"])
        role = data.get("role", existing["role"])
        status = data.get("status", existing["status"] or "ACTIVE")

        # basic validation
        if not all([name, email]):
            cursor.close()
            conn.close()
            return jsonify({"message": "Name and email are required"}), 400

        update_values = [name, email, phone, role, status, id]

        if password:
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            cursor.execute(
                "UPDATE users SET name=%s, email=%s, phone=%s, role=%s, status=%s, password_hash=%s WHERE id=%s",
                (name, email, phone, role, status, password_hash, id)
            )
        else:
            cursor.execute(
                "UPDATE users SET name=%s, email=%s, phone=%s, role=%s, status=%s WHERE id=%s",
                update_values
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
# Reports & Analytics
# -------------------------------------
@app.route("/api/reports/stats", methods=["GET"])
def get_reports_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Requirements Stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_reqs,
                SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_reqs
            FROM requirements
        """)
        req_stats = cursor.fetchone()

        # 2. Candidate Stats
        cursor.execute("SELECT COUNT(*) as total FROM candidates")
        total_candidates = cursor.fetchone()['total']

        # 3. Selections (Qualified Candidates)
        # Candidates who have status='COMPLETED' in the LAST round of any requirement
        cursor.execute("""
            SELECT 
                c.name as candidate_name,
                r.title as requirement_title,
                cl.name as client_name,
                cp.updated_at as selection_date
            FROM candidate_progress cp
            JOIN candidates c ON c.id = cp.candidate_id
            JOIN requirements r ON r.id = cp.requirement_id
            JOIN requirement_stages rs ON rs.id = cp.stage_id
            LEFT JOIN clients cl ON cl.id = r.client_id
            WHERE rs.stage_order = r.no_of_rounds 
              AND cp.status = 'COMPLETED'
            ORDER BY cp.updated_at DESC
        """)
        selections = cursor.fetchall()

        # 4. Requirements by Client
        cursor.execute("""
            SELECT 
                c.name as client_name,
                COUNT(r.id) as req_count
            FROM requirements r
            LEFT JOIN clients c ON c.id = r.client_id
            GROUP BY c.name
        """)
        client_stats = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "requirements": req_stats,
            "candidates": {"total": total_candidates},
            "selections": selections,
            "client_stats": client_stats
        }), 200

    except Exception as e:
        print(f"❌ Error fetching report stats: {e}")
        return jsonify({"error": str(e)}), 500



@app.route("/api/candidate_progress", methods=["GET"])
def get_candidate_progress():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT cp.id, cp.candidate_id, cp.requirement_id, cp.stage_name,
                   cp.status, c.name AS candidate_name,
                   rs.stage_name
            FROM candidate_progress cp
            LEFT JOIN candidates c ON cp.candidate_id = c.id
            LEFT JOIN requirement_stages rs ON cp.stage_id = rs.id
            WHERE cp.id IN (
                SELECT MAX(id)
                FROM candidate_progress
                GROUP BY candidate_id
            )
            ORDER BY cp.id
        """

        cursor.execute(sql)
        rows = cursor.fetchall()
        return jsonify(rows), 200

    except Exception as e:
        print("Error fetching candidate progress:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

# -------------------------------------
# Run Server
# -------------------------------------
if __name__ == '__main__':
    # Import AI routes after env loading (to avoid circular import issues)
    from controllers.ai_chat_controller import register_ai_routes
    from controllers.ai_jd_controller import jd_bp
    from controllers.ai_screening import screening_bp
    initialize_database()
    ensure_admin_exists()
    ensure_user_status_defaults()
    # Register AI assistant routes without altering existing endpoints
    register_ai_routes(app)
    app.register_blueprint(jd_bp)
    app.register_blueprint(screening_bp)
    app.run(debug=True, port=5001)
