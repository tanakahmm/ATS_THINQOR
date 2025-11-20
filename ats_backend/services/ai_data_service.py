from typing import Any, Dict, List, Optional, Tuple

# This module provides role-aware, plain-JSON data fetchers for the AI assistant.
# It reuses the existing DB connection factory from the Flask app without altering models.

import os
import mysql.connector
from mysql.connector import Error
from pathlib import Path

# Load environment variables (same as app.py)
try:
	from dotenv import load_dotenv
	env_file = Path(__file__).parent.parent / ".env"
	if not env_file.exists():
		env_file = Path(__file__).parent.parent / "config.env"
	if env_file.exists():
		load_dotenv(dotenv_path=env_file, override=True)
except ImportError:
	pass  # dotenv not available, use system env vars


def get_db_connection():

	try:
		connection = mysql.connector.connect(
			host=os.getenv('DB_HOST', 'localhost'),
			user=os.getenv('DB_USER', 'root'),
			password=os.getenv('DB_PASSWORD', ''),
			database=os.getenv('DB_NAME', 'ats_system')
		)
		if connection.is_connected():
			return connection
	except Error as e:
		print("❌ AI service DB connection failed:", e)
		return None


UserDict = Dict[str, Any]


def _fetch_one(query: str, params: Tuple[Any, ...]) -> Optional[Dict[str, Any]]:

	conn = get_db_connection()
	if not conn:
		return None
	cursor = conn.cursor(dictionary=True)
	try:
		cursor.execute(query, params)
		row = cursor.fetchone()
		return dict(row) if row else None
	finally:
		cursor.close()
		conn.close()


def _fetch_all(query: str, params: Tuple[Any, ...]) -> List[Dict[str, Any]]:

	conn = get_db_connection()
	if not conn:
		return []
	cursor = conn.cursor(dictionary=True)
	try:
		cursor.execute(query, params)
		rows = cursor.fetchall()
		return [dict(r) for r in rows] if rows else []
	finally:
		cursor.close()
		conn.close()


def _is_admin(user: UserDict) -> bool:

	return (user or {}).get("role", "").upper() == "ADMIN"


def _is_recruiter(user: UserDict) -> bool:

	return (user or {}).get("role", "").upper() == "RECRUITER"


def _is_client(user: UserDict) -> bool:

	return (user or {}).get("role", "").upper() == "CLIENT"


def get_candidate_by_name_for_user(name: str, user: UserDict) -> Optional[Dict[str, Any]]:

	# Only ADMIN and DELIVERY_MANAGER can access candidates
	if not (_is_admin(user) or (user or {}).get("role", "").upper() == "DELIVERY_MANAGER"):
		return None
	
	q = f"%{name}%"
	return _fetch_one(
		"SELECT id, name, email, phone, skills, education, experience, resume_filename FROM candidates WHERE name LIKE %s OR email LIKE %s LIMIT 1",
		(q, q),
	)


def get_candidate_track_for_user(candidate_id: str, user: UserDict) -> List[Dict[str, Any]]:

	# Current schema has no candidate_track table; return empty safely
	return []


def list_candidates_for_user(user: UserDict) -> List[Dict[str, Any]]:

	# Only ADMIN and DELIVERY_MANAGER can access candidates
	if not (_is_admin(user) or (user or {}).get("role", "").upper() == "DELIVERY_MANAGER"):
		return []
	
	return _fetch_all(
		"""
		SELECT id, name, email, phone, skills, education, experience, resume_filename
		FROM candidates
		ORDER BY id DESC
		""",
		(),
	)


def get_requirement_for_user(requirement_id: str, user: UserDict) -> Optional[Dict[str, Any]]:

	if _is_admin(user):
		return _fetch_one("SELECT * FROM requirements WHERE id = %s", (requirement_id,))

	if _is_recruiter(user):
		# requirement created by recruiter or allocated to recruiter
		return _fetch_one(
			"""
			SELECT DISTINCT r.*
			FROM requirements r
			LEFT JOIN requirement_allocations ra ON ra.requirement_id = r.id
			WHERE r.id = %s AND (r.created_by = %s OR ra.recruiter_id = %s)
			""",
			(requirement_id, user.get("id"), user.get("id")),
		)

	if _is_client(user):
		return _fetch_one(
			"SELECT * FROM requirements WHERE id = %s AND client_id = %s",
			(requirement_id, user.get("client_id")),
		)

	return None


def get_interviews_for_user(candidate_id: str, user: UserDict) -> List[Dict[str, Any]]:

	# Current schema has no interviews table; return empty safely
	return []


# New helpers aligned to current schema

def get_requirement_by_id_for_user(requirement_id: str, user: UserDict) -> Optional[Dict[str, Any]]:

	if _is_admin(user):
		return _fetch_one(
			"""
			SELECT r.*, c.name AS client_name
			FROM requirements r
			LEFT JOIN clients c ON c.id = r.client_id
			WHERE r.id = %s
			""",
			(requirement_id,),
		)

	if _is_recruiter(user):
		return _fetch_one(
			"""
			SELECT r.*, c.name AS client_name
			FROM requirements r
			JOIN requirement_allocations ra ON ra.requirement_id = r.id
			LEFT JOIN clients c ON c.id = r.client_id
			WHERE r.id = %s AND ra.recruiter_id = %s
			""",
			(requirement_id, user.get("id")),
		)

	if _is_client(user):
		return _fetch_one(
			"""
			SELECT r.*, c.name AS client_name
			FROM requirements r
			JOIN clients c ON c.id = r.client_id
			WHERE r.id = %s AND r.client_id = %s
			""",
			(requirement_id, user.get("client_id")),
		)

	return None


def list_requirements_for_recruiter(user_id: str) -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
		SELECT r.id, r.title, r.location, r.status, c.name AS client_name
		FROM requirements r
		JOIN requirement_allocations ra ON ra.requirement_id = r.id
		LEFT JOIN clients c ON c.id = r.client_id
		WHERE ra.recruiter_id = %s
		ORDER BY r.created_at DESC
		""",
		(user_id,),
	)


def list_requirements_for_client(client_id: str) -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
		SELECT r.id, r.title, r.location, r.status
		FROM requirements r
		WHERE r.client_id = %s
		ORDER BY r.created_at DESC
		""",
		(client_id,),
	)


def list_requirements_for_admin() -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
		SELECT r.id, r.title, r.location, r.status, c.name AS client_name
		FROM requirements r
		LEFT JOIN clients c ON c.id = r.client_id
		ORDER BY r.created_at DESC
		""",
		(),
	)


def list_requirement_allocations() -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
		SELECT 
			ra.id,
			ra.requirement_id,
			ra.recruiter_id,
			ra.assigned_by,
			ra.status,
			ra.created_at,
			req.title AS requirement_title,
			recruiter.name AS recruiter_name,
			assigner.name AS assigned_by_name
		FROM requirement_allocations ra
		LEFT JOIN requirements req ON req.id = ra.requirement_id
		LEFT JOIN users recruiter ON recruiter.id = ra.recruiter_id
		LEFT JOIN users assigner ON assigner.id = ra.assigned_by
		ORDER BY ra.created_at DESC
		""",
		(),
	)


def get_client_by_id_for_user(client_id: str, user: UserDict) -> Optional[Dict[str, Any]]:

	if _is_admin(user):
		return _fetch_one("SELECT id, name, contact_person, email, phone FROM clients WHERE id = %s", (client_id,))

	if _is_recruiter(user):
		# Recruiter can view client if they have an allocation to any requirement of this client
		return _fetch_one(
			"""
			SELECT DISTINCT c.id, c.name, c.contact_person, c.email, c.phone
			FROM clients c
			JOIN requirements r ON r.client_id = c.id
			JOIN requirement_allocations ra ON ra.requirement_id = r.id
			WHERE c.id = %s AND ra.recruiter_id = %s
			""",
			(client_id, user.get("id")),
		)

	if _is_client(user):
		if str(user.get("client_id")) == str(client_id):
			return _fetch_one("SELECT id, name, contact_person, email, phone FROM clients WHERE id = %s", (client_id,))
		return None

	return None


def get_allocations_for_requirement(requirement_id: str) -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
		SELECT ra.recruiter_id, u.name AS recruiter_name
		FROM requirement_allocations ra
		LEFT JOIN users u ON u.id = ra.recruiter_id
		WHERE ra.requirement_id = %s
		""",
		(requirement_id,),
	)


def list_clients_for_user(user: UserDict) -> List[Dict[str, Any]]:

	# Admin → all clients with all safe fields
	if _is_admin(user):
		return _fetch_all(
			"""
			SELECT id, name, contact_person, email, phone, address, status, created_at
			FROM clients
			ORDER BY created_at DESC
			""",
			(),
		)

	# Recruiter/Client → only ACTIVE clients (adjust as needed)
	return _fetch_all(
		"""
		SELECT id, name, contact_person, email, phone, address, status, created_at
		FROM clients
		WHERE status = 'ACTIVE'
		ORDER BY created_at DESC
		""",
		(),
	)


def list_users_for_admin() -> List[Dict[str, Any]]:

	# Admin view of users
	return _fetch_all(
		"""
		SELECT id, name, email, role, phone, status, created_at
		FROM users
		ORDER BY created_at DESC
		""",
		(),
	)


def list_usersdata() -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
		SELECT id, name, email, phone, role, status, created_at
		FROM usersdata
		ORDER BY created_at DESC
		""",
		(),
	)


def list_recruiters_for_user(user: UserDict) -> List[Dict[str, Any]]:

	# Admin: all recruiters
	if _is_admin(user):
		return _fetch_all(
			"SELECT id, name, email, phone, status FROM users WHERE role = 'RECRUITER' ORDER BY created_at DESC",
			(),
		)

	# Recruiter: at least themselves; optionally peers allocated on same requirements
	if _is_recruiter(user):
		# Return self and any recruiters allocated to same requirements as the user
		return _fetch_all(
			"""
			SELECT DISTINCT u.id, u.name, u.email, u.phone, u.status
			FROM users u
			WHERE u.role = 'RECRUITER' AND (
				u.id = %s OR u.id IN (
					SELECT ra2.recruiter_id
					FROM requirement_allocations ra1
					JOIN requirement_allocations ra2 ON ra1.requirement_id = ra2.requirement_id
					WHERE ra1.recruiter_id = %s
				)
			)
			ORDER BY u.created_at DESC
			""",
			(user.get("id"), user.get("id")),
		)

	# Client: recruiters allocated to their requirements
	if _is_client(user):
		return _fetch_all(
			"""
			SELECT DISTINCT u.id, u.name, u.email, u.phone, u.status
			FROM users u
			JOIN requirement_allocations ra ON ra.recruiter_id = u.id
			JOIN requirements r ON r.id = ra.requirement_id
			WHERE u.role = 'RECRUITER' AND r.client_id = %s
			ORDER BY u.created_at DESC
			""",
			(user.get("client_id"),),
		)

	return []


def get_recruiter_by_query(query_text: str, user: UserDict) -> Optional[Dict[str, Any]]:

	q = f"%{query_text}%"

	if _is_admin(user):
		return _fetch_one(
			"SELECT id, name, email, phone, status FROM users WHERE role = 'RECRUITER' AND (id = %s OR name LIKE %s OR email LIKE %s) ORDER BY created_at DESC LIMIT 1",
			(query_text, q, q),
		)

	if _is_recruiter(user):
		# Can view self or peers on same requirements
		return _fetch_one(
			"""
			SELECT DISTINCT u.id, u.name, u.email, u.phone, u.status
			FROM users u
			LEFT JOIN requirement_allocations ra1 ON ra1.recruiter_id = u.id
			LEFT JOIN requirement_allocations ra2 ON ra2.requirement_id = ra1.requirement_id
			WHERE u.role = 'RECRUITER'
			AND (u.id = %s OR u.id = %s OR u.name LIKE %s OR u.email LIKE %s)
			AND (u.id = %s OR ra2.recruiter_id = %s)
			ORDER BY u.created_at DESC LIMIT 1
			""",
			(query_text, user.get("id"), q, q, user.get("id"), user.get("id")),
		)

	if _is_client(user):
		# Client can view recruiters allocated to their requirements
		return _fetch_one(
			"""
			SELECT DISTINCT u.id, u.name, u.email, u.phone, u.status
			FROM users u
			JOIN requirement_allocations ra ON ra.recruiter_id = u.id
			JOIN requirements r ON r.id = ra.requirement_id
			WHERE u.role = 'RECRUITER' AND r.client_id = %s AND (u.id = %s OR u.name LIKE %s OR u.email LIKE %s)
			ORDER BY u.created_at DESC LIMIT 1
			""",
			(user.get("client_id"), query_text, q, q),
		)

	return None


def get_client_for_user(client_id: str, user: UserDict) -> Optional[Dict[str, Any]]:

	if _is_admin(user):
		return _fetch_one("SELECT * FROM clients WHERE id = %s", (client_id,))

	if _is_recruiter(user):
		# Recruiters can view client if they own a requirement for that client or are allocated to it
		return _fetch_one(
			"""
			SELECT DISTINCT c.*
			FROM clients c
			JOIN requirements r ON r.client_id = c.id
			LEFT JOIN requirement_allocations ra ON ra.requirement_id = r.id
			WHERE c.id = %s AND (r.created_by = %s OR ra.recruiter_id = %s)
			""",
			(client_id, user.get("id"), user.get("id")),
		)

	if _is_client(user):
		# Client can view itself only
		if str(user.get("client_id")) == str(client_id):
			return _fetch_one("SELECT * FROM clients WHERE id = %s", (client_id,))
		return None

	return None


# ------------------------------------------------------------------
# User-centric helpers for AI chat / dashboards
# ------------------------------------------------------------------

def get_user_profile_summary(user_id: int) -> Optional[Dict[str, Any]]:

	return _fetch_one(
		"""
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
		""",
		(user_id,),
	)


def list_assignments_for_user(user_id: int) -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
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
		""",
		(user_id,),
	)


def list_candidates_created_by_user(user_id: int) -> List[Dict[str, Any]]:

	return _fetch_all(
		"""
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
		""",
		(user_id,),
	)


def get_org_stats_snapshot() -> Dict[str, int]:

	stats = {
		"total_requirements": 0,
		"open_requirements": 0,
		"total_candidates": 0,
		"total_users": 0,
		"total_clients": 0,
	}

	conn = get_db_connection()
	if not conn:
		return stats
	cursor = conn.cursor(dictionary=True)
	try:
		cursor.execute("SELECT COUNT(*) AS total_requirements FROM requirements")
		stats["total_requirements"] = cursor.fetchone().get("total_requirements", 0)

		cursor.execute("SELECT COUNT(*) AS open_requirements FROM requirements WHERE status = 'OPEN'")
		stats["open_requirements"] = cursor.fetchone().get("open_requirements", 0)

		cursor.execute("SELECT COUNT(*) AS total_candidates FROM candidates")
		stats["total_candidates"] = cursor.fetchone().get("total_candidates", 0)

		cursor.execute("SELECT COUNT(*) AS total_users FROM users")
		stats["total_users"] = cursor.fetchone().get("total_users", 0)

		cursor.execute("SELECT COUNT(*) AS total_clients FROM clients")
		stats["total_clients"] = cursor.fetchone().get("total_clients", 0)

		return stats
	finally:
		cursor.close()
		conn.close()


def build_user_self_context(user: UserDict) -> Dict[str, Any]:

	if not user or not user.get("id"):
		return {}

	user_id = user.get("id")
	role = (user.get("role") or "").upper()

	context = {
		"self_profile": get_user_profile_summary(user_id),
		"self_assignments": list_assignments_for_user(user_id),
		"self_candidates": list_candidates_created_by_user(user_id),
	}

	if role in ("ADMIN", "DELIVERY_MANAGER"):
		context["self_org_stats"] = get_org_stats_snapshot()

	return context


