from flask import Blueprint, request, jsonify
from utils.gemini import run_gemini_screening
from services.ai_data_service import get_db_connection
import requests
import json

screening_bp = Blueprint('screening', __name__, url_prefix="/api")


@screening_bp.route("/screen-candidate", methods=["POST"])
def screen_candidate():
    try:
        body = request.json or {}
        candidate_id = body.get("candidate_id")
        requirement_ref = body.get("requirement_id") or body.get("requirement_ref")

        if not candidate_id:
            return jsonify({"error": "candidate_id is required"}), 400
        if not requirement_ref:
            return jsonify({"error": "requirement identifier is required"}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        # PyMySQL DictCursor is already set in get_db_connection
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM candidates WHERE id = %s", (candidate_id,))
        candidate = cursor.fetchone()

        requirement = _resolve_requirement(cursor, requirement_ref)

        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404
        if not requirement:
            return jsonify({"error": "Requirement not found"}), 404

        # --- AI Screening ---
        ai_success = False
        ai_error_msg = None
        normalized_output = {}

        try:
            ai_output = run_gemini_screening(candidate, requirement)
            normalized_output, normalize_error = _normalize_ai_output(ai_output)
            if normalize_error:
                ai_error_msg = normalize_error
            else:
                ai_success = True
        except Exception as ai_e:
            ai_error_msg = str(ai_e)
            print(f"⚠️ Gemini screening failed: {ai_e}")

        # --- Tracker / Progress Update (RUNS EVEN IF AI FAILS) ---
        
        # 1. Insert Screening Record (only if success, or maybe partial?)
        # For now, we only insert screening record if AI succeeded, 
        # but we ALWAYS update candidate_progress to avoid "hanging" state.
        
        if ai_success:
            cursor.execute("""
                INSERT INTO candidate_screening
                (candidate_id, requirement_id, ai_score, ai_rationale, recommend, red_flags, model_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                candidate_id,
                requirement["id"],
                normalized_output["score"],
                json.dumps(normalized_output["rationale"]),
                normalized_output["recommend"],
                json.dumps(normalized_output["red_flags"]),
                "gemini-2.5"
            ))
            
            # Update progress for success case
            _touch_candidate_progress(
                cursor,
                candidate_id,
                requirement["id"],
                requirement.get("category", "IT"),
                stage="Manual Review",
                status="REVIEW_REQUIRED",
                decision="NONE"
            )
            
            # Queue for assessment
            cursor.execute("SHOW TABLES LIKE 'assesment_queue'")
            if cursor.fetchone():
                cursor.execute("""
                    INSERT INTO assesment_queue (candidate_id, requirement_id, status)
                    VALUES (%s, %s, 'PENDING')
                """, (candidate_id, requirement["id"]))
                
        else:
            # AI Failed Case - Update tracker to indicate failure/manual need
            print(f"⚠️ Updating tracker for failed screening: {ai_error_msg}")
            _touch_candidate_progress(
                cursor,
                candidate_id,
                requirement["id"],
                requirement.get("category", "IT"),
                stage="Screening Failed", 
                status="REVIEW_REQUIRED",  # Valid ENUM
                decision="HOLD"            # Valid ENUM (instead of RETRY_NEEDED)
            )

        conn.commit()
        
        # Webhook Notification (Best Effort)
        if ai_success:
            try:
                requests.post(
                    "http://localhost:5678/webhook/screen_complete",
                    json={
                        "candidate_id": candidate_id,
                        "requirement_id": requirement["id"],
                        "ai_score": normalized_output.get("score"),
                        "recommend": normalized_output.get("recommend")
                    },
                    timeout=3
                )
            except requests.RequestException:
                print("⚠️ Could not send event to n8n (server offline).")

        cursor.close()
        conn.close()

        if ai_success:
            return jsonify({
                "message": "✅ Candidate screened successfully!",
                "result": normalized_output
            }), 200
        else:
            # Return success (200) even if AI failed, because we successfully created a manual tracker entry.
            # This allows the frontend to refresh and show the "Screening Failed" status in the tracker.
            return jsonify({
                "message": f"⚠️ AI Screening failed ({ai_error_msg}), but tracker was created for manual review.",
                "result": {"score": 0, "recommend": "MANUAL_REVIEW"} 
            }), 200

    except Exception as e:
        print("❌ Screening error:", e)
        return jsonify({"error": str(e)}), 500


@screening_bp.route("/create-interview", methods=["POST"])
def create_interview():
    try:
        data = request.json or {}
        required_fields = [
            "candidate_id",
            "requirement_id",
            "category",
            "stage",
            "date",
            "time",
            "duration",
            "mode",
            "interviewer",
        ]
        missing = [field for field in required_fields if not data.get(field)]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        # Removed _ensure_screening_tables(cursor)

        cursor.execute("""
            INSERT INTO interviews
            (candidate_id, requirement_id, category, stage, date, time, duration, mode, location, interviewer, notes, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            data["candidate_id"],
            data["requirement_id"],
            data["category"],
            data["stage"],
            data["date"],
            data["time"],
            data["duration"],
            data["mode"],
            data.get("location", ""),
            data["interviewer"],
            data.get("notes", ""),
            data.get("status", "Scheduled")
        ))
        _touch_candidate_progress(
            cursor,
            data["candidate_id"],
            data["requirement_id"],
            data["category"],
            data["stage"],
            status="IN_PROGRESS",
            decision="MOVE_NEXT"
        )
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"status": "success"}), 201

    except Exception as e:
        print("❌ create_interview error:", e)
        return jsonify({"error": str(e)}), 500


@screening_bp.route("/interviews", methods=["GET"])
def get_interviews():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        # Removed _ensure_screening_tables(cursor)

        cursor.execute("""
            SELECT
                i.*,
                c.name AS candidate_name,
                c.email AS candidate_email,
                r.title AS requirement_title
            FROM interviews i
            LEFT JOIN candidates c ON c.id = i.candidate_id
            LEFT JOIN requirements r ON r.id = i.requirement_id
            WHERE i.status != 'Cancelled'
            ORDER BY i.date DESC, i.time DESC
        """)

        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        print("❌ get_interviews error:", e)
        return jsonify({"error": str(e)}), 500


@screening_bp.route("/update-stage", methods=["PUT"])
def update_stage():
    try:
        data = request.json or {}
        required_fields = ["interview_id", "stage", "candidate_id", "requirement_id"]
        missing = [field for field in required_fields if not data.get(field)]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        # Removed _ensure_screening_tables(cursor)

        cursor.execute(
            "UPDATE interviews SET stage=%s WHERE id=%s",
            (data["stage"], data["interview_id"])
        )
        conn.commit()

        _touch_candidate_progress(
            cursor,
            data["candidate_id"],
            data["requirement_id"],
            data.get("category", "IT"),
            data["stage"],
            status="IN_PROGRESS",
            decision="MOVE_NEXT"
        )
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"status": "success"}), 200
    except Exception as e:
        print("❌ update_stage error:", e)
        return jsonify({"error": str(e)}), 500


# ---------- MERGED Recruiter Decision (replaces /progress-decision & old /recruiter-decision_n8n) ----------
@screening_bp.route("/recruiter-decision", methods=["POST"])
def recruiter_decision():
    try:
        body = request.json or {}

        candidate_id = body.get("candidate_id")
        requirement_ref = body.get("requirement_id")
        decision = (body.get("decision") or "").upper()
        next_stage = body.get("next_stage")
        recruiter = body.get("recruiter")  # optional metadata

        if not candidate_id or not requirement_ref or decision not in {"MOVE_NEXT", "HOLD", "REJECT"}:
            return jsonify({"error": "candidate_id, requirement_id, and valid decision (MOVE_NEXT/HOLD/REJECT) are required"}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        # Removed _ensure_screening_tables(cursor)

        requirement = _resolve_requirement(cursor, requirement_ref)
        if not requirement:
            return jsonify({"error": "Requirement not found"}), 404

        req_id = requirement["id"]
        category = requirement.get("category", "IT")

        # Apply decision updates
        if decision == "REJECT":
            cursor.execute("""
                UPDATE candidate_progress
                SET status='REJECTED', manual_decision='REJECT', stage_name='Rejected'
                WHERE candidate_id=%s AND requirement_id=%s
            """, (candidate_id, req_id))

        elif decision == "HOLD":
            cursor.execute("""
                UPDATE candidate_progress
                SET status='PENDING', manual_decision='HOLD', stage_name='On Hold'
                WHERE candidate_id=%s AND requirement_id=%s
            """, (candidate_id, req_id))

        elif decision == "MOVE_NEXT":
            if not next_stage:
                return jsonify({"error": "next_stage required for MOVE_NEXT"}), 400

            cursor.execute("""
                UPDATE candidate_progress
                SET status='IN_PROGRESS', manual_decision='MOVE_NEXT', stage_name=%s
                WHERE candidate_id=%s AND requirement_id=%s
            """, (next_stage, candidate_id, req_id))

            cursor.execute("""
                INSERT INTO interviews (candidate_id, requirement_id, category, stage, status)
                VALUES (%s, %s, %s, %s, 'Scheduled')
            """, (candidate_id, req_id, category, next_stage))

        conn.commit()
        cursor.close()
        conn.close()

        # Trigger n8n webhook (best-effort)
        try:
            webhook_url = "http://localhost:5678/webhook-test/recruiter_decision"
            resp = requests.post(
                webhook_url,
                json={
                    "candidate_id": candidate_id,
                    "requirement_id": req_id,
                    "decision": decision,
                    "next_stage": next_stage,
                    "recruiter": recruiter
                },
                headers={"X-AUTOMATION-SECRET": "yoursecret123"},
                timeout=3
            )
            print("Webhook response:", resp.status_code)
        except Exception as e:
            print("⚠️ Could not notify n8n:", e)

        return jsonify({"status": "updated", "decision": decision}), 200

    except Exception as e:
        print("❌ recruiter_decision error:", e)
        return jsonify({"error": str(e)}), 500


@screening_bp.route("/assign-candidate", methods=["POST"])
def assign_candidate():
    try:
        data = request.json or {}
        candidate_id = data.get("candidate_id")
        requirement_ref = data.get("requirement_id")

        if not candidate_id or not requirement_ref:
            return jsonify({"error": "candidate_id and requirement_id are required"}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        requirement = _resolve_requirement(cursor, requirement_ref)
        if not requirement:
            cursor.close()
            conn.close()
            return jsonify({"error": "Requirement not found"}), 404

        # check if already exists to avoid overwriting existing progress if somehow called duplicately
        # But _touch_candidate_progress handles updates. We want to initialize it.
        # If it exists, we might not want to reset it unless user explicit. 
        # For now, we'll just ensure it exists.
        
        _touch_candidate_progress(
            cursor,
            candidate_id,
            requirement["id"],
            requirement.get("category", "IT"),
            stage="Manual Assignment",
            status="PENDING",
            decision="NONE"
        )
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "✅ Candidate manually assigned to requirement!"}), 200

    except Exception as e:
        print("❌ assign_candidate error:", e)
        return jsonify({"error": str(e)}), 500


@screening_bp.route("/candidate-progress/<int:candidate_id>/<req_ref>", methods=["GET"])
def get_candidate_progress(candidate_id, req_ref):
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()

        # Removed _ensure_screening_tables(cursor)

        cursor.execute("SELECT * FROM candidates WHERE id=%s", (candidate_id,))
        candidate = cursor.fetchone()
        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404

        requirement = _resolve_requirement(cursor, req_ref)
        if not requirement:
            return jsonify({"error": "Requirement not found"}), 404

        cursor.execute("""
            SELECT *
            FROM candidate_progress
            WHERE candidate_id=%s AND requirement_id=%s
        """, (candidate_id, requirement["id"]))
        progress = cursor.fetchone()

        cursor.execute("""
            SELECT *
            FROM candidate_screening
            WHERE candidate_id=%s AND requirement_id=%s
            ORDER BY created_at DESC
            LIMIT 1
        """, (candidate_id, requirement["id"]))
        screening = cursor.fetchone()

        cursor.execute("""
            SELECT *
            FROM interviews
            WHERE candidate_id=%s AND requirement_id=%s
            ORDER BY date DESC, time DESC
        """, (candidate_id, requirement["id"]))
        interviews = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "candidate": {
                "id": candidate["id"],
                "name": candidate.get("name"),
                "email": candidate.get("email"),
                "phone": candidate.get("phone"),
                "skills": candidate.get("skills"),
                "experience": candidate.get("experience"),
            },
            "requirement": {
                "id": requirement["id"],
                "title": requirement.get("title"),
                "category": requirement.get("category") or "IT",
                "location": requirement.get("location"),
            },
            "progress": progress,
            "screening": screening,
            "interviews": interviews,
        }), 200
    except Exception as e:
        print("❌ get_candidate_progress error:", e)
        return jsonify({"error": str(e)}), 500


# --------------------- Helper functions ---------------------

def _touch_candidate_progress(cursor, candidate_id, requirement_id, category, stage, status="PENDING", decision="NONE"):
    # Using stage_name instead of current_stage to match app.py schema
    cursor.execute("""
        INSERT INTO candidate_progress (candidate_id, requirement_id, category, stage_name, status, manual_decision)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            category=VALUES(category),
            stage_name=VALUES(stage_name),
            status=VALUES(status),
            manual_decision=VALUES(manual_decision)
    """, (candidate_id, requirement_id, category or "IT", stage, status, decision or "NONE"))


def _resolve_requirement(cursor, identifier):
    if not identifier:
        return None

    cursor.execute("SELECT * FROM requirements WHERE id = %s", (str(identifier),))
    row = cursor.fetchone()
    if row:
        return row

    cursor.execute(
        """
        SELECT * FROM requirements
        WHERE LOWER(title) = LOWER(%s)
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (identifier,)
    )
    row = cursor.fetchone()
    if row:
        return row

    cursor.execute(
        """
        SELECT * FROM requirements
        WHERE LOWER(CONCAT(title, ' ', COALESCE(location, ''))) LIKE %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (f"%{identifier.lower()}%",)
    )
    return cursor.fetchone()


def _normalize_ai_output(ai_output):
    if not isinstance(ai_output, dict):
        return None, "AI returned non-JSON output"

    if ai_output.get("error"):
        return None, ai_output.get("error")

    try:
        score = float(ai_output.get("score", 0))
    except (TypeError, ValueError):
        return None, "AI response missing numeric score"

    rationale = ai_output.get("rationale") or []
    if isinstance(rationale, str):
        rationale = [rationale]
    if not isinstance(rationale, list):
        rationale = [str(rationale)]

    red_flags = ai_output.get("red_flags") or []
    if isinstance(red_flags, str):
        red_flags = [red_flags]
    if not isinstance(red_flags, list):
        red_flags = [str(red_flags)]

    recommend = (ai_output.get("recommend") or "NEEDS_INTERVIEW").upper()
    if recommend not in {"SHORTLISTED", "REJECTED", "NEEDS_INTERVIEW"}:
        recommend = "NEEDS_INTERVIEW"

    return {
        "score": round(score, 2),
        "rationale": rationale,
        "red_flags": red_flags,
        "recommend": recommend
    }, None
