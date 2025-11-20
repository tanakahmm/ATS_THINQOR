from flask import Blueprint, request, jsonify
from typing import Any, Dict

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
)


ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


SYSTEM_PROMPT = (
	"You are an ATS assistant. Answer ONLY from the CONTEXT provided. "
	"The ATS database includes these tables and columns:\n"
	"- candidates: id, name, email, phone, skills, education, experience, resume_filename, created_at\n"
	"- requirements: id, client_id, title, description, location, skills_required, experience_required, ctc_range, ecto_range, status, created_at\n"
	"- requirement_allocations: id, requirement_id, recruiter_id, assigned_by, status, created_at\n"
	"- clients: id, name, contact_person, email, phone, address, status, created_at\n"
	"- users: id, name, email, phone, role, status, created_at\n"
	"- usersdata: id, name, email, phone, role, status, created_at\n"
	"If the context contains self_profile, self_assignments, self_candidates, or self_org_stats, use them to answer "
	"questions about the logged-in user directly (e.g., “what are my assignments?”, “what’s my phone number?”). "
	"Role rules: admin and delivery manager can access everything including candidates and allocations; "
	"recruiters only see requirements allocated to them; clients only see requirements where client_id matches their id. "
	"Never invent data. If a record or access is missing, say so directly and offer available related information."
)


def _detect_intent(message: str) -> str:

	ml = (message or "").lower()
	if any(k in ml for k in ["requirement", "opening", "req ", "req-", "r-"]):
		return "requirement"
	if "client" in ml or "clients" in ml:
		return "client"
	if any(k in ml for k in ["candidate", "candidates", "applicant", "applicants"]):
		return "candidates"
	if any(k in ml for k in ["recruiter", "recruiters", "users", "user list", "team"]):
		return "users"
	if any(k in ml for k in ["my allocations", "my requirements", "allocated", "assigned to me", "recruiter"]):
		return "allocations"
	return "general"


@ai_bp.route("/chat", methods=["POST"])
def chat() -> Any:

	# 1) Read user and message. We expect frontend to include logged-in user payload
	#    since this project does not attach req.user automatically.
	data = request.get_json() or {}
	message = (data.get("message") or "").strip()
	user = data.get("user") or {}

	if not user or not user.get("role"):
		return jsonify({"answer": "Unauthorized: missing user/role.", "context": None}), 401
	if not message:
		return jsonify({"answer": "Please provide a message.", "context": None}), 400

	# 2) Simple routing/intent
	intent = _detect_intent(message)

	context: Dict[str, Any] = {"user": {"id": user.get("id"), "role": user.get("role"), "client_id": user.get("client_id")}, "query": message}
	self_context = build_user_self_context(user)
	if self_context:
		context.update(self_context)

	try:
		# 3) Fetch ATS data with role-based filtering
		if intent == "requirement":
			# try to extract a requirement id pattern like R-123
			req_id = None
			for tok in message.replace("#", " ").replace(",", " ").split():
				if tok.upper().startswith("R-") or tok.upper().startswith("REQ-"):
					req_id = tok.upper().replace("REQ-", "R-")
					break
			# if explicit id present fetch exact, else leave None and let LLM summarize available lists
			context["requirement"] = get_requirement_by_id_for_user(req_id, user) if req_id else None
			if req_id:
				context["allocations"] = get_allocations_for_requirement(req_id)
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

		# 4) Call LLM with system prompt, original question, and structured context
		answer = call_llm(SYSTEM_PROMPT, context, message)
		return jsonify({"answer": answer, "context": context}), 200

	except Exception as e:
		# Never crash; provide a safe message
		return jsonify({"answer": f"AI processing failed: {e}", "context": context}), 200


def register_ai_routes(app) -> None:

	# Attach blueprint to the Flask app without changing existing routes
	app.register_blueprint(ai_bp)


