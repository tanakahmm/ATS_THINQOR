import { useGLTF } from "@react-three/drei";

export default function Avatar3D() {
  const { scene } = useGLTF("/avatar.glb");
  return <primitive object={scene} scale={1.5} />;
}
