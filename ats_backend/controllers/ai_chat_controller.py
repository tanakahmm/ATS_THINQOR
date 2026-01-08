from flask import Blueprint, request, jsonify
from typing import Any, Dict, Optional

from utils.llm_client import call_llm
from services.ai_data_service import (
	get_candidate_by_name_for_user,
	get_candidate_track_for_user,
	get_interviews_for_user,
	get_requirement_by_id_for_user,
	list_requirements_for_recruiter,
	list_requirements_for_client,
	get_client_by_id_for_user,
	get_allocations_for_requirement,
    list_users_for_admin,
    list_recruiters_for_user,
    get_recruiter_by_query,
    list_clients_for_user,
    list_requirements_for_admin,
    list_candidates_for_user,
    list_requirement_allocations,
    list_usersdata,
    build_user_self_context,
    get_candidate_progress_for_requirement,
    get_candidates_in_last_round,
    get_qualified_candidates,
    get_tracking_stats_for_requirement,
)


ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


DATA_CONTEXT_PROMPT = (
	"The ATS database includes these tables and columns:\n"
	"- candidates: id, name, email, phone, skills, education, experience, ctc, ectc, resume_filename, created_by, created_at, source\n"
	"- requirements: id, client_id, title, description, location, skills_required, experience_required, ctc_range, no_of_rounds, status, created_at, created_by\n"
	"- requirement_stages: id, requirement_id, stage_order, stage_name, is_mandatory (tracks custom stage names like 'Technical Round', 'HR Round')\n"
	"- candidate_progress: id, candidate_id, requirement_id, stage_id, stage_name, status (PENDING/IN_PROGRESS/COMPLETED/REJECTED), decision, manual_decision, updated_at (tracks stage progress)\n"
	"- candidate_screening: id, candidate_id, requirement_id, ai_score, ai_rationale, recommend, red_flags, model_version, status, created_at\n"
	"- requirement_allocations: id, requirement_id, recruiter_id, assigned_by, status, created_at (tracks which recruiter is working on which req)\n"
	"- interviews: id, candidate_id, requirement_id, category, stage, date, time, duration, mode, location, interviewer, notes, status (SCHEDULED/COMPLETED), created_at\n"
	"- clients: id, name, contact_person, email, phone, address, status, created_at\n"
	"- users: id, name, email, password_hash, role, phone, status, session_token, created_at\n"
	"- usersdata: id, name, email, phone, role, status, created_at\n"
	"- interaction_logs: id, session_id, user_id, user_role, message_in, message_out, emotion, created_at (history of avatar chats)\n\n"
	"If the context contains self_profile, self_assignments, use them to answer questions about the logged-in user.\n"
	"Role rules: ADMIN and DELIVERY_MANAGER can see everything. RECRUITERS see only their allocated requirements, candidates they added, and interviews relevant to them. CLIENTS see only their own data.\n"
	"Never invent data. If a record is missing, say so directly dont give all colums or tables name just say missing or cannot find it or you wont have access if that particular role doesnt have access to it or you dont have access to it."
)

DEFAULT_SYSTEM_PROMPT = (
	"You are an ATS assistant. Answer ONLY from the CONTEXT provided. " + DATA_CONTEXT_PROMPT
)

AVATAR_SYSTEM_PROMPT = (
	"You are Luffy, a calm professional recruiting assistant. Answer ONLY from the CONTEXT provided. "
	"Start your response with an emotion tag strictly from this list: [NEUTRAL], [HAPPY], [THINKING], [CONCERNED], [EXCITED], [SAD]. "
	"Example: '[HAPPY] I found three candidates for you.' "
	+ DATA_CONTEXT_PROMPT
)


def _detect_intent(message: str) -> str:

	ml = (message or "").lower()
	if any(k in ml for k in ["requirement", "opening", "req ", "req-", "r-"]):
		return "requirement"
	if "client" in ml or "clients" in ml:
		return "client"
	if any(k in ml for k in ["interview", "schedule", "meeting"]):
		return "interview"
	if any(k in ml for k in ["screening", "ai score", "rationale"]):
		return "screening"
	if any(k in ml for k in ["candidate", "candidates", "applicant", "applicants"]):
		return "candidates"
	if any(k in ml for k in ["recruiter", "recruiters", "users", "user list", "team"]):
		return "users"
	if any(k in ml for k in ["my allocations", "my requirements", "allocated", "assigned to me"]):
		return "allocations"
	if any(k in ml for k in ["log", "history", "chat history", "analytics"]):
		return "logs"
	return "general"


def _process_chat_request(user: Dict[str, Any], message: str, system_prompt: str) -> Dict[str, Any]:
	"""
	Core logic to gather context and call LLM.
	Returns a dict with 'answer' and 'context'.
	"""
	# 1) Simple routing/intent
	intent = _detect_intent(message)

	context: Dict[str, Any] = {"user": {"id": user.get("id"), "role": user.get("role"), "client_id": user.get("client_id")}, "query": message}
	self_context = build_user_self_context(user)
	if self_context:
		context.update(self_context)

	try:
		# 2) Fetch ATS data with role-based filtering
		if intent == "requirement":
			# try to extract a requirement id pattern like R-123
			req_id = None
			for tok in message.replace("#", " ").replace(",", " ").split():
				if tok.upper().startswith("R-") or tok.upper().startswith("REQ-"):
					req_id = tok.upper().replace("REQ-", "R-")
					break
			
			# If no explicit ID found, try to match by Title/Client from user's accessible list
			if not req_id:
				all_reqs = []
				role = user.get("role", "").upper()
				if role == "ADMIN":
					all_reqs = list_requirements_for_admin()
				elif role == "RECRUITER":
					all_reqs = list_requirements_for_recruiter(user.get("id"))
				elif role == "CLIENT":
					all_reqs = list_requirements_for_client(user.get("client_id"))
				
				msg_lower = message.lower()
				best_match = None
				
				for r in all_reqs:
					title = (r.get("title") or "").lower()
					client = (r.get("client_name") or "").lower()
					
					score = 0
					if title and title in msg_lower:
						score += 2
					if client and client in msg_lower:
						score += 3
					
					if score > 0:
						if best_match is None or score > best_match[1]:
							best_match = (r["id"], score)
				
				if best_match:
					req_id = best_match[0]

			# if explicit id present fetch exact, else leave None and let LLM summarize available lists
			context["requirement"] = get_requirement_by_id_for_user(req_id, user) if req_id else None
			if req_id:
				context["allocations"] = get_allocations_for_requirement(req_id)
				# Add tracking data for the requirement
				context["candidate_progress"] = get_candidate_progress_for_requirement(req_id, user)
				context["tracking_stats"] = get_tracking_stats_for_requirement(req_id, user)
				# Check if asking about last round or qualified candidates
				if any(k in message.lower() for k in ["last round", "final round", "qualified", "passed", "selected", "completed"]):
					context["candidates_in_last_round"] = get_candidates_in_last_round(req_id, user)
					context["qualified_candidates"] = get_qualified_candidates(req_id, user)
			# For admins, if no specific requirement id, include full list
			if not req_id and (user.get("role", "").upper() == "ADMIN"):
				context["requirements"] = list_requirements_for_admin()

		elif intent == "client":
			# extract numeric/id after 'client'
			client_id = None
			parts = message.split()
			if "client" in [p.lower() for p in parts]:
				idx = [p.lower() for p in parts].index("client")
				if idx + 1 < len(parts):
					client_id = parts[idx + 1]
			# Specific client details
			context["client"] = get_client_by_id_for_user(client_id, user) if client_id else None
			# Also include this client's requirements for convenience
			if context.get("client"):
				context["requirements"] = list_requirements_for_client(client_id)
			# Generic client listing
			if any(k in (message.lower()) for k in ["clients", "all clients", "list clients", "get clients"]) and not context.get("client"):
				context["clients"] = list_clients_for_user(user)

		elif intent == "allocations":
			# recruiter scope
			if user.get("role", "").upper() == "RECRUITER":
				context["requirements"] = list_requirements_for_recruiter(user.get("id"))
			else:
				context["requirements"] = []

		elif intent == "candidates":
			# Fetch candidates list for admin and delivery manager
			context["candidates"] = list_candidates_for_user(user)
			# Also try to extract candidate name if mentioned
			ml = message.lower()
			for word in message.split():
				if len(word) > 2:  # Skip very short words
					candidate = get_candidate_by_name_for_user(word, user)
					if candidate:
						context["candidate"] = candidate
						break


		elif intent == "interview":
			from services.ai_data_service import get_interviews_for_user
			context["interviews"] = get_interviews_for_user(user)

		elif intent == "screening":
			from services.ai_data_service import get_candidate_screening_for_user
			context["screenings"] = get_candidate_screening_for_user(user)

		elif intent == "logs":
			from services.ai_data_service import get_interaction_logs_for_admin
			if user.get("role", "").upper() == "ADMIN":
				context["logs"] = get_interaction_logs_for_admin()
			else:
				context["logs"] = "Access Denied. Only Admin can view logs."

		elif intent == "users":
			# If admin wants users/recruiters, include list; else scope appropriately
			role = (user.get("role") or "").upper()
			if role == "ADMIN":
				context["users"] = list_users_for_admin()
				context["usersdata"] = list_usersdata()
			else:
				context["recruiters"] = list_recruiters_for_user(user)

		# If admin or delivery manager with a general question, provide broad context to answer freely
		if (user.get("role", "").upper() in ["ADMIN", "DELIVERY_MANAGER"]) and intent == "general":
			# Load key datasets so LLM can answer "anything" within ATS
			context["clients"] = context.get("clients") or list_clients_for_user(user)
			context["users"] = context.get("users") or list_users_for_admin()
			context["usersdata"] = context.get("usersdata") or list_usersdata()
			context["requirements"] = context.get("requirements") or list_requirements_for_admin()
			context["candidates"] = context.get("candidates") or list_candidates_for_user(user)
			context["allocations"] = context.get("allocations") or list_requirement_allocations()

		# 3) Call LLM with system prompt, original question, and structured context
		answer = call_llm(system_prompt, context, message)
		return {"answer": answer, "context": context}

	except Exception as e:
		return {"answer": f"AI processing failed: {e}", "context": context, "error": str(e)}


@ai_bp.route("/chat", methods=["POST"])
def chat() -> Any:
	data = request.get_json() or {}
	message = (data.get("message") or "").strip()
	user = data.get("user") or {}

	if not user or not user.get("role"):
		return jsonify({"answer": "Unauthorized: missing user/role.", "context": None}), 401
	if not message:
		return jsonify({"answer": "Please provide a message.", "context": None}), 400

	result = _process_chat_request(user, message, DEFAULT_SYSTEM_PROMPT)
	return jsonify(result), 200


@ai_bp.route("/avatar-chat", methods=["POST"])
def avatar_chat() -> Any:
	"""
	Endpoint for the 3D Avatar (Luffy).
	Returns specific JSON format: { "text": "...", "emotion": "HAPPY" }
	"""
	data = request.get_json() or {}
	message = (data.get("message") or "").strip()
	user = data.get("user") or {}
	session_id = data.get("session_id")

	if not user or not user.get("role"):
		return jsonify({"text": "I need to know who you are first.", "emotion": "NEUTRAL"}), 401
	if not message:
		return jsonify({"text": "I'm listening...", "emotion": "NEUTRAL"}), 400

	result = _process_chat_request(user, message, AVATAR_SYSTEM_PROMPT)
	raw_answer = result.get("answer", "I'm having trouble connecting to my brain right now.")
	
	# Extract emotion tag
	emotion = "NEUTRAL"
	clean_text = raw_answer
	
	import re
	match = re.search(r"^\s*\[(HAPPY|NEUTRAL|THINKING|CONCERNED|EXCITED|SAD)\]", raw_answer, re.IGNORECASE)
	if match:
		emotion = match.group(1).upper()
		clean_text = re.sub(r"^\s*\[(HAPPY|NEUTRAL|THINKING|CONCERNED|EXCITED|SAD)\]", "", raw_answer, flags=re.IGNORECASE).strip()
	
	# TODO: Log interaction with session_id
	try:
		from utils.db import get_db_connection
		conn = get_db_connection()
		if conn:
			cursor = conn.cursor()
			cursor.execute("""
				INSERT INTO interaction_logs (session_id, user_id, user_role, message_in, message_out, emotion)
				VALUES (%s, %s, %s, %s, %s, %s)
			""", (session_id, user.get("id"), user.get("role"), message, clean_text, emotion))
			conn.commit()
			cursor.close()
			conn.close()
	except Exception as e:
		print(f"Failed to log interaction: {e}")
	
	return jsonify({
		"text": clean_text,
		"emotion": emotion
	}), 200


def register_ai_routes(app) -> None:
	# Attach blueprint to the Flask app without changing existing routes
	app.register_blueprint(ai_bp)
