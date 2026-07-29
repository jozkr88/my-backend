import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export function InitialFrameSignal({ onReady }) {
  const firedRef = useRef(false);
  const frameCountRef = useRef(0);

  useFrame(() => {
    frameCountRef.current += 1;
    if (!firedRef.current && typeof onReady === "function") {
      if (frameCountRef.current < 12) return;
      firedRef.current = true;
      onReady();
    }
  });

  return null;
}
