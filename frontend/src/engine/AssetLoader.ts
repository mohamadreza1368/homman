import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/**
 * Creates and configures the optimized Three.js GLTFLoader with:
 * 1. WebAssembly-powered DRACOLoader for decompressed 3D geometry.
 * 2. KTX2Loader with Basis Universal transcoder (KHR_texture_basisu) to keep textures on the GPU.
 */
export function createMedicalAssetLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Configure WebAssembly DRACO loader
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/wasm/draco/');
  dracoLoader.setDecoderConfig({ type: 'wasm' });

  // Configure KTX2 / Basis Universal transcoder
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('/wasm/basis/');
  ktx2Loader.detectSupport(renderer);

  // Initialize GLTF loader and register extensions
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader);

  return gltfLoader;
}
