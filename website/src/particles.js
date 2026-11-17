// Shared 3D helpers: GPU particles in the brand accent, and a soft radial glow texture.
import * as THREE from "three";

export function radialTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Fine drizzle: tall thin streaks that fall, wrap, and speed up with scroll.
export function makeParticles(count, color, pixelRatio, size = 22, opacity = 0.5) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = Math.random() * 7 - 1;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    speed[i] = 0.5 + Math.random();
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size * pixelRatio }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      attribute float aSpeed;
      uniform float uTime, uBoost, uSize;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * aSpeed * (0.8 + uBoost), 7.0) - 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * aSpeed / -mv.z;
        vAlpha = smoothstep(9.0, 1.2, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float streak = smoothstep(0.5, 0.0, length(c * vec2(7.0, 1.0)));
        gl_FragColor = vec4(uColor, streak * vAlpha * uOpacity);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}
