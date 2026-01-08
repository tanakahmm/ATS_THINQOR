const API_URL = "http://localhost:5001";

function getSessionId() {
    let sessionId = sessionStorage.getItem("luffy_session_id");
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("luffy_session_id", sessionId);
    }
    return sessionId;
}

export async function sendMessage(message, user) {
    // Fallback to localStorage if user not passed
    const userData = user || JSON.parse(localStorage.getItem("user"));
    const sessionId = getSessionId();

    try {
        const res = await fetch(`${API_URL}/api/ai/avatar-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, user: userData, session_id: sessionId })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.text || "Failed to talk to luffy");
        }

        return await res.json();
    } catch (error) {
        console.error("Avatar Chat Error:", error);
        return { text: "I'm having trouble connecting right now.", emotion: "SAD", state: "idle" };
    }
}
