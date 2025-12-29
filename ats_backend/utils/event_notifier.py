import os
import json
import requests

N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "http://localhost:5678/webhook/ba1721b9-f7f4-4e7e-9bc3-93b4067c6fc1",  # your current webhook
)

def notify_event(event_name: str, payload: dict) -> None:
    """
    Sends an event + payload to n8n webhook asynchronously.
    """
    if not N8N_WEBHOOK_URL:
        # print(f"❌ N8N_WEBHOOK_URL not set, skipping event {event_name}")
        return

    def _send():
        body = {
            "event": event_name,
            "payload": payload,
        }
        try:
            requests.post(
                N8N_WEBHOOK_URL,
                headers={"Content-Type": "application/json"},
                data=json.dumps(body),
                timeout=2,
            )
        except Exception:
            pass # Fail silently in background

    import threading
    threading.Thread(target=_send, daemon=True).start()
