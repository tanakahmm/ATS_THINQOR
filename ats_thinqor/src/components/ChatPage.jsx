import React, { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import Avatar3D from "../components/Avatar3D";
import ChatPanel from "../components/ChatPanel";
import { useTextToSpeech } from "../hooks/useTextToSpeech";

export default function ChatPage() {
    const [avatarState, setAvatarState] = useState("idle");
    const [emotion, setEmotion] = useState("NEUTRAL");
    const [messages, setMessages] = useState([
        { type: 'bot', text: "Hello! I am Luffy, your recruiting assistant.", emotion: "HAPPY" }
    ]);
    const scrollRef = useRef(null);

    // Use our new TTS hook
    const { speak, isSpeaking, stop } = useTextToSpeech();

    // Sync avatar state with TTS
    useEffect(() => {
        if (isSpeaking) {
            setAvatarState("talk");
        } else if (avatarState === 'talk') {
            setAvatarState("idle");
        }
    }, [isSpeaking, avatarState]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleResponse = (text, emotionTag) => {
        // Add bot message
        setMessages(prev => [...prev, { type: 'bot', text, emotion: emotionTag }]);

        if (emotionTag) setEmotion(emotionTag);

        // Speak the response
        speak(text);
    };

    const handleUserMessage = (text) => {
        setMessages(prev => [...prev, { type: 'user', text }]);
    }

    return (
        <div style={{ height: "100vh", position: "relative", background: "linear-gradient(to bottom, #eef2f3, #8e9eab)" }} className="flex overflow-hidden">

            {/* LEFT SIDE: Avatar (60% width) */}
            <div className="w-3/5 h-full relative">
                <Canvas camera={{ position: [0, 1.5, 3] }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[2, 2, 2]} />
                    <Avatar3D state={avatarState} emotion={emotion} isSpeaking={isSpeaking} />
                </Canvas>

                {/* Floating Avatar Status Label */}
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-semibold tracking-wide border border-white/30">
                    {avatarState === 'think' ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Listening / Idle'}
                    {emotion && ` • ${emotion}`}
                </div>
            </div>

            {/* RIGHT SIDE: Chat Interface (40% width) */}
            <div className="w-2/5 h-full bg-white/80 backdrop-blur-xl shadow-2xl flex flex-col border-l border-white/50">

                {/* Header */}
                <div className="p-6 border-b border-gray-200/50 bg-white/50">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Chat with Luffy
                    </h2>
                    <p className="text-sm text-gray-500">Professional Recruiting Assistant</p>
                </div>

                {/* Messages Area (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[80%] px-5 py-3 rounded-2xl text-md leading-relaxed shadow-sm
                                ${msg.type === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'}
                            `}>
                                {msg.text}
                                {msg.emotion && (
                                    <div className="text-[10px] mt-1 opacity-70 uppercase tracking-wider font-bold">
                                        {msg.emotion}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {avatarState === 'think' && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-gray-100 px-5 py-3 rounded-2xl rounded-bl-none text-gray-500 animate-pulse italic">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area (Fixed at bottom) */}
                <div className="p-6 bg-white/50 border-t border-gray-200/50">
                    <ChatPanel
                        onStateChange={setAvatarState}
                        onResponse={(text, emo) => handleResponse(text, emo)}
                        onUserMessage={handleUserMessage}
                    />
                </div>
            </div>
        </div>
    );
}
