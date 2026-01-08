export function useSpeechToText(onResult, onError) {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.error("SpeechRecognition not supported");
        return { start: () => { }, stop: () => { }, isSupported: false };
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };

    recognition.onerror = (event) => {
        console.error("STT error:", event.error);
        if (onError) onError(event.error);
    };

    return {
        start: () => recognition.start(),
        stop: () => recognition.stop(),
        isSupported: true
    };
}
