import { useGLTF } from "@react-three/drei";

import { appPath } from "../utils/paths";

useGLTF.setDecoderPath(appPath("/draco/gltf/"));
