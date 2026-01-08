import { useRef, useEffect, useState } from 'react';

export function useTextToSpeech() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const synth = window.speechSynthesis;
    // Keep track of the current utterance to handle cancelation correctly if needed
    const utteranceRef = useRef(null);

    function speak(text, { onStart, onEnd } = {}) {
        if (!synth) return;

        // Stop any current speech
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onstart = () => {
            setIsSpeaking(true);
            if (onStart) onStart();
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            if (onEnd) onEnd();
        };

        utterance.onerror = (e) => {
            console.error("TTS Error:", e);
            setIsSpeaking(false);
            if (onEnd) onEnd(); // Ensure state resets even on error
        };

        utteranceRef.current = utterance;
        synth.speak(utterance);
    }

    function stop() {
        if (synth) {
            synth.cancel();
            setIsSpeaking(false);
        }
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (synth) synth.cancel();
        };
    }, [synth]);

    return { speak, stop, isSpeaking };
}
