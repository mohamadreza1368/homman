import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { setViewerHandle } from "./viewerBridge";

export interface ViewerSyncBridgeProps {
  centres: Map<string, THREE.Vector3>;
  offsets: Map<string, THREE.Vector3>;
  geometryRevision: number;
}

export function ViewerSyncBridge({
  centres,
  offsets,
  geometryRevision,
}: ViewerSyncBridgeProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null;

  useEffect(() => {
    setViewerHandle({ gl, scene, camera, centres, offsets, controls, geometryRevision });
    return () => setViewerHandle(null);
  }, [gl, scene, camera, centres, offsets, controls, geometryRevision]);

  return null;
}
