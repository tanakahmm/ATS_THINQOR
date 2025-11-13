import os
import json
import requests

N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "http://localhost:5678/webhook/ba1721b9-f7f4-4e7e-9bc3-93b4067c6fc1",  # your current webhook
)

def notify_event(event_name: str, payload: dict) -> None:
    """
    Sends an event + payload to n8n webhook.
    This should never crash your app if n8n is down.
    """
    if not N8N_WEBHOOK_URL:
        print(f"❌ N8N_WEBHOOK_URL not set, skipping event {event_name}")
        return

    body = {
        "event": event_name,
        "payload": payload,
    }

    try:
        resp = requests.post(
            N8N_WEBHOOK_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(body),
            timeout=5,
        )
        print(f"📡 Notified n8n: {event_name} (status={resp.status_code})")
    except Exception as e:
        print(f"❌ Failed to notify n8n for event {event_name}: {e}")
