// The live 3D stage: one fixed full-screen WebGL canvas behind the whole page.
// Scroll flies the camera through the story beats, the cursor moves a light,
// the Explore section lets visitors drag to spin the bike.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { makeParticles, radialTexture } from "./particles.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const LITE = matchMedia("(max-width: 768px), (hover: none)").matches;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

export async function initStage({ modelUrl, beats, hotspots = [], lightModes, modelYaw = 0, lenis, backdrop = false }) {
  const canvas = document.getElementById("stage");
  const fail = () => document.body.classList.add("stage-failed");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !LITE, alpha: backdrop, powerPreference: "high-performance" });
  } catch { fail(); return null; }
  let dpr = Math.min(devicePixelRatio, LITE ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail(); });

  // ---- scene, fog, reflections ----
  const bg = new THREE.Color(css("--bg"));
  const scene = new THREE.Scene();
  scene.background = backdrop ? null : bg;   // with a backdrop, the photo behind the canvas shows through
  if (backdrop) renderer.setClearColor(0x000000, 0);
  scene.fog = new THREE.FogExp2(bg, 0.07);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 60);

  // ---- lights: soft key, two accent rims behind the bike, a cursor light ----
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const rimA = new THREE.SpotLight(css("--accent"), 60, 20, 0.55, 0.8);
  rimA.position.set(-3.5, 2.2, -3);
  const rimB = new THREE.SpotLight(css("--accent-2") || css("--accent"), 40, 20, 0.55, 0.8);
  rimB.position.set(3.8, 1.2, -2.6);
  const cursorLight = new THREE.PointLight(0xffffff, 0, 6, 1.6);
  scene.add(key, rimA, rimB, cursorLight);

  // ---- floor: catches the shadow, fades into the fog ----
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: radialTexture(css("--accent")), transparent: true, opacity: 0.22, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.002;
  scene.add(glow);

  // ---- the bike: centered, longest side = 2 units, sitting on the floor ----
  const rig = new THREE.Group();
  scene.add(rig);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(modelUrl, (e) => {
      const p = e.total ? e.loaded / e.total : 0;
      document.documentElement.style.setProperty("--load", p.toFixed(3));
    });
  } catch { fail(); return null; }
  const model = gltf.scene;
  model.rotation.y = modelYaw;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 2 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(s);
  model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rig.add(model);
  key.target = rig;
  rimA.target = rig;
  rimB.target = rig;

  // ---- atmosphere: fine drizzle in the accent color ----
  const particles = makeParticles(LITE ? 500 : 1600, css("--accent"), renderer.getPixelRatio());
  if (!REDUCED) scene.add(particles);

  // ---- post: gentle bloom on desktop only ----
  let composer = null;
  if (!LITE) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.4, 0.92));
    composer.addPass(new OutputPass());
  }

  // ---- scroll story: one camera keyframe per beat, scrubbed across #story ----
  // pull back on tall screens: the bike is long, so narrow phones need the most room
  const fit = () => (camera.aspect < 0.6 ? 2.45 : camera.aspect < 1 ? 1.8 : camera.aspect < 1.3 ? 1.25 : 1);
  const st = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, yaw: 0 };
  const setBeat = (b) => Object.assign(st, { px: b.pos[0], py: b.pos[1], pz: b.pos[2], lx: b.look[0], ly: b.look[1], lz: b.look[2], yaw: b.yaw });
  setBeat(beats[0]);
  if (!REDUCED) {
    const tl = gsap.timeline({ defaults: { ease: "power1.inOut", duration: 1 } });
    beats.slice(1).forEach((b) => tl.to(st, { px: b.pos[0], py: b.pos[1], pz: b.pos[2], lx: b.look[0], ly: b.look[1], lz: b.look[2], yaw: b.yaw }));
    ScrollTrigger.create({ trigger: "#story", start: "top top", end: "bottom bottom", scrub: 1, animation: tl });
  }

  // ---- after the story the stage dims behind the content sections ----
  gsap.to(".stage-dim", { opacity: 0.86, ease: "none",
    scrollTrigger: { trigger: "#story", start: "bottom 90%", end: "bottom 40%", scrub: true } });

  // ---- Explore: stage undims, drag to spin, hotspots show ----
  let exploring = false, dragYaw = 0, dragVel = 0, dragging = false, lastX = 0;
  ScrollTrigger.create({ trigger: "#explore", start: "top 60%", end: "bottom 40%",
    onToggle: (self) => {
      exploring = self.isActive;
      document.body.classList.toggle("exploring", exploring);
    } });
  const dragZone = document.querySelector("#explore .explore__drag");
  dragZone?.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; dragZone.setPointerCapture?.(e.pointerId); });
  dragZone?.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragVel = (e.clientX - lastX) * 0.008;
    dragYaw += dragVel;
    lastX = e.clientX;
  });
  const endDrag = () => { dragging = false; };
  dragZone?.addEventListener("pointerup", endDrag);
  dragZone?.addEventListener("pointercancel", endDrag);

  // ---- light modes ----
  function setLightMode(name) {
    const m = lightModes[name];
    if (!m) return;
    gsap.to(renderer, { toneMappingExposure: m.exposure, duration: 0.8 });
    gsap.to(key, { intensity: m.key, duration: 0.8 });
    gsap.to(rimA, { intensity: m.rim, duration: 0.8 });
    gsap.to(rimB, { intensity: m.rim * 0.7, duration: 0.8 });
    const c = new THREE.Color(m.fog);
    gsap.to(scene.fog.color, { r: c.r, g: c.g, b: c.b, duration: 0.8 });
    if (scene.background) gsap.to(scene.background, { r: c.r, g: c.g, b: c.b, duration: 0.8 });
    if (m.backdrop) document.documentElement.style.setProperty("--backdrop-filter", m.backdrop);
    document.querySelectorAll("[data-light]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.light === name)));
  }
  document.querySelectorAll("[data-light]").forEach((b) => b.addEventListener("click", () => setLightMode(b.dataset.light)));

  // ---- hotspots: points on the bike, projected to HTML labels every frame ----
  const hs = hotspots.map((h) => ({ ...h, el: document.querySelector(`[data-hotspot="${h.id}"]`),
    p: new THREE.Vector3(...h.at), n: new THREE.Vector3(...h.normal).normalize() }));
  const tmp = new THREE.Vector3(), nW = new THREE.Vector3(), toCam = new THREE.Vector3();

  // ---- cursor ----
  const pointer = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });

  // ---- resize ----
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setSize(innerWidth, innerHeight);
  }
  addEventListener("resize", resize);
  resize();

  // ---- render loop with adaptive quality and pause when hidden or covered ----
  let frames = 0, acc = 0, last = performance.now(), fps = 60;
  const covers = [...document.querySelectorAll(".stage-cover")];
  const covered = () => covers.some((c) => { const r = c.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight; });
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  const clock = new THREE.Clock();

  function tick() {
    const now = performance.now(), dt = now - last;
    last = now;
    if (document.hidden || covered()) return;
    const t = clock.getElapsedTime();

    acc += dt; frames++;
    if (frames === 90) {
      fps = 1000 / (acc / frames);
      if (fps < 42 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      frames = 0; acc = 0;
    }

    const k = fit(), portrait = camera.aspect < 1;
    camera.position.set(st.px * k, st.py, st.pz * k);
    camera.lookAt(portrait ? 0 : st.lx, st.ly + (portrait ? (camera.aspect < 0.6 ? 0.62 : 0.45) : 0), portrait ? 0 : st.lz);

    if (!dragging) { dragVel *= 0.94; dragYaw += dragVel; }
    const idle = REDUCED ? 0 : Math.sin(t * 0.25) * 0.06;
    rig.rotation.y = st.yaw + dragYaw + idle;
    rig.rotation.x += ((REDUCED ? 0 : pointer.y * 0.05) - rig.rotation.x) * 0.05;
    rig.updateMatrixWorld();

    if (!LITE) {
      cursorLight.intensity += ((exploring ? 5 : 2.5) - cursorLight.intensity) * 0.05;
      cursorLight.position.set(pointer.x * 2.2, 1 + pointer.y * 1.2, 2.2);
    }

    particles.material.uniforms.uTime.value = t;
    particles.material.uniforms.uBoost.value = Math.min(2, Math.abs(lenis?.velocity || 0) * 0.02);

    for (const h of hs) {
      if (!h.el) continue;
      tmp.copy(h.p).applyMatrix4(rig.matrixWorld);
      nW.copy(h.n).transformDirection(rig.matrixWorld);
      toCam.copy(camera.position).sub(tmp).normalize();
      const facing = nW.dot(toCam) > 0.15;
      tmp.project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * innerWidth;
      h.el.style.transform = `translate(${sx}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px)`;
      h.el.classList.toggle("is-left", sx > innerWidth - 240);   // labels that would run off the right edge open to the left
      h.el.classList.toggle("is-hidden", !exploring || !facing);
    }

    composer ? composer.render() : renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(tick);
  tick();
  document.body.classList.add("stage-ready");
  const api = { renderer, scene, camera, rig, model, st, setLightMode, get fps() { return fps; }, get dpr() { return dpr; }, get dragYaw() { return dragYaw; } };
  if (import.meta.env.DEV) { window.__stage = api; window.__THREE = THREE; }
  return api;
}
