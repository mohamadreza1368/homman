import * as THREE from "three";

export function organMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIn: { value: 0 },
      uAmber: { value: new THREE.Color("#ffb347") },
      uPicked: { value: -1 },
      uPick: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float region;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vElevation;
      varying float vOrganIndex;

      void main() {
        vElevation = position.y;
        vOrganIndex = region;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIn;
      uniform vec3 uAmber;
      uniform float uPicked;
      uniform float uPick;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vElevation;
      varying float vOrganIndex;

      void main() {
        float incidence = abs(dot(normalize(vNormal), normalize(vView)));
        float rimLight = pow(1.0 - incidence, 2.2);
        float pulseRate = 0.8 + 0.2 * sin(uTime * 2.4);
        float horizontalGrid = 0.85 + 0.15 * sin(vElevation * 220.0 - uTime * 2.0);

        float baseAlpha = (0.05 + rimLight * 0.5) * pulseRate * horizontalGrid * uIn;
        float isSingledOut = 1.0 - step(0.5, abs(vOrganIndex - uPicked));
        baseAlpha *= mix(1.0, mix(0.22, 2.0, isSingledOut), uPick);

        gl_FragColor = vec4(uAmber * baseAlpha, 1.0);
      }
    `,
  });
}
