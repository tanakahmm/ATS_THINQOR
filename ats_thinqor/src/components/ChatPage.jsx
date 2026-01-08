import { Canvas } from "@react-three/fiber";
import Avatar3D from "../components/Avatar3D";

export default function ChatPage() {
  return (
    <div style={{ height: "100vh" }}>
      <Canvas camera={{ position: [0, 1.5, 3] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 2]} />
        <Avatar3D />
      </Canvas>
    </div>
  );
}
