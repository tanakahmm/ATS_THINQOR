import React, { useState, useEffect } from "react";
import { sendMessage } from "../hooks/useChat";
import { useSelector } from "react-redux";
import { PaperAirplaneIcon, MicrophoneIcon, StopIcon } from "@heroicons/react/24/solid";
import { useSpeechToText } from "../hooks/useSpeechToText";

export default function ChatPanel({ onStateChange, onResponse, onUserMessage }) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const user = useSelector((state) => state.auth.user);

    // STT Hook
    const stt = useSpeechToText(
        (transcript) => {
            setInput(transcript);
            // Optionally auto-send:
            // handleSend(null, transcript);
            setIsListening(false);
        },
        (error) => {
            console.error("Mic Error:", error);
            setIsListening(false);
            alert("Microphone error. Please ensure permissions are granted.");
        }
    );

    const toggleMic = () => {
        if (isListening) {
            stt.stop();
            setIsListening(false);
        } else {
            stt.start();
            setIsListening(true);
        }
    };

    async function handleSend(e, overrideInput) {
        if (e) e.preventDefault();
        const textToSend = overrideInput || input;

        if (!textToSend.trim()) return;

        // Callback to show user message immediately in chat list
        if (onUserMessage) onUserMessage(textToSend);

        setLoading(true);
        onStateChange("think");

        try {
            const res = await sendMessage(textToSend, user);
            onResponse(res.text, res.emotion);
        } catch (err) {
            onResponse("Something went wrong.", "SAD");
            onStateChange("idle");
        } finally {
            setLoading(false);
            setInput("");
        }
    }

    return (
        <div className="relative w-full">
            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 bg-white border border-gray-300 p-2 rounded-full shadow-sm focus-within:shadow-md transition-shadow"
            >
                <button
                    type="button"
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-colors ${isListening
                            ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                        }`}
                    title="Toggle Microphone"
                >
                    {isListening ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
                </button>

                <input
                    className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-gray-800 placeholder-gray-400"
                    placeholder={isListening ? "Listening..." : "Ask Luffy anything..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                />

                <button
                    type="submit"
                    disabled={loading || (!input.trim() && !isListening)}
                    className={`p-3 rounded-full text-white transition-all ${loading || (!input.trim() && !isListening)
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 shadow-md"
                        }`}
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                        <PaperAirplaneIcon className="w-5 h-5" />
                    )}
                </button>
            </form>
            {isListening && (
                <div className="absolute -top-8 left-0 pl-4 text-xs text-red-500 font-semibold animate-pulse">
                    Mic Active - Speak now...
                </div>
            )}
        </div>
    );
}
