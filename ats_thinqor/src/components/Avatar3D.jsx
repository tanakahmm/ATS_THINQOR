/* eslint-disable react/no-unknown-property */
import React, { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Avatar3D({ state, emotion, isSpeaking }) {
    const { scene, nodes } = useGLTF("/avatar.glb");
    const headRef = useRef();

    // Find the mesh with morph targets (usually Wolf3D_Head or Wolf3D_Avatar)
    const morphMesh = Object.values(nodes).find(
        (node) => node.morphTargetDictionary && node.morphTargetInfluences
    );

    useEffect(() => {
        if (morphMesh) {
            console.log("Morph Targets Available:", Object.keys(morphMesh.morphTargetDictionary));
        } else {
            console.warn("No morph targets found on avatar!");
        }
    }, [morphMesh]);

    useFrame((state) => {
        if (!morphMesh) return;

        const t = state.clock.getElapsedTime();
        const dictionary = morphMesh.morphTargetDictionary;
        const influences = morphMesh.morphTargetInfluences;

        // --- LIP SYNC (Simulated) ---
        // If speaking, modulate mouth opening with a composite sine wave
        if (isSpeaking) {
            // Use different frequencies to make it look random
            const openAmount = (Math.sin(t * 15) * 0.5 + 0.5) * (Math.sin(t * 5) * 0.5 + 0.5);

            // Try common mouth open keys
            const mouthKeys = ["viseme_aa", "mouthOpen", "jawOpen", "viseme_O"];
            mouthKeys.forEach(key => {
                if (dictionary[key] !== undefined) {
                    influences[dictionary[key]] = THREE.MathUtils.lerp(influences[dictionary[key]], openAmount, 0.5);
                }
            });
        } else {
            // Close mouth if not speaking
            const mouthKeys = ["viseme_aa", "mouthOpen", "jawOpen", "viseme_O"];
            mouthKeys.forEach(key => {
                if (dictionary[key] !== undefined) {
                    influences[dictionary[key]] = THREE.MathUtils.lerp(influences[dictionary[key]], 0, 0.2);
                }
            });
        }

        // --- EMOTION (Simple Mapping) ---
        // Reset emotions first
        const emotionKeys = ["browInnerUp", "mouthSmile", "mouthFrown", "browDownLeft", "browDownRight"];

        // Default Idle
        let targetSmile = 0.1;
        let targetBrowUp = 0;
        let targetFrown = 0;

        if (emotion === "HAPPY" || emotion === "EXCITED") {
            targetSmile = 0.8;
        } else if (emotion === "SAD" || emotion === "CONCERNED") {
            targetFrown = 0.6;
            targetBrowUp = 0.6;
            targetSmile = 0;
        } else if (emotion === "THINKING") {
            targetBrowUp = 0.3;
            targetSmile = 0;
        }

        if (dictionary["mouthSmile"] !== undefined) influences[dictionary["mouthSmile"]] = THREE.MathUtils.lerp(influences[dictionary["mouthSmile"]], targetSmile, 0.1);
        if (dictionary["browInnerUp"] !== undefined) influences[dictionary["browInnerUp"]] = THREE.MathUtils.lerp(influences[dictionary["browInnerUp"]], targetBrowUp, 0.1);
        if (dictionary["mouthFrownLeft"] !== undefined) influences[dictionary["mouthFrownLeft"]] = THREE.MathUtils.lerp(influences[dictionary["mouthFrownLeft"]], targetFrown, 0.1);

        // Blink Animation
        if (dictionary["eyeBlinkLeft"] !== undefined && dictionary["eyeBlinkRight"] !== undefined) {
            // Blink every 3-5 seconds
            const blink = Math.sin(t * 2) > 0.98 ? 1 : 0; // Simple periodic blink
            influences[dictionary["eyeBlinkLeft"]] = THREE.MathUtils.lerp(influences[dictionary["eyeBlinkLeft"]], blink, 0.3);
            influences[dictionary["eyeBlinkRight"]] = THREE.MathUtils.lerp(influences[dictionary["eyeBlinkRight"]], blink, 0.3);
        }
    });

    return <primitive object={scene} scale={1.2} position={[0, -1.8, 0]} />;
}
