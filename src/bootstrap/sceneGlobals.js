import { extend } from "@react-three/fiber";
import { geometry } from "maath";
import { MeshStandardMaterial } from "three";

extend(geometry);
extend({ MeshStandardMaterial });
