import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const STATIC_FILM = matchMedia("(max-width: 768px), (hover: none), (prefers-reduced-motion: reduce)");

const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// in-page links go through Lenis so the smooth scroll stays in charge
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const target = document.querySelector(a.getAttribute("href"));
  if (!target) return;
  e.preventDefault();
  lenis.scrollTo(target, { offset: 0 });
}));

// ---- the 3D stage loads after the page text, so the poster and copy paint first ----
import("./stage.js").then(({ initStage }) => initStage({
  modelUrl: import.meta.env.BASE_URL + "model/product.glb",
  lenis,
  modelYaw: -1.57,
  backdrop: true,
  beats: [
    { pos: [2.3, 0.95, 3.2], look: [-0.8, 0.55, 0], yaw: 0.1 },      // 1 hero three-quarter, bike right
    { pos: [0.35, 0.5, 1.35], look: [0.38, 0.38, 0], yaw: 1.1 },     // 2 macro on the mid-drive motor, bike left
    { pos: [0, 0.75, 5.6], look: [-0.95, 0.55, 0], yaw: 0 },          // 3 clean side profile, bike right
    { pos: [4.6, 2.2, 4.6], look: [1.1, 0.45, 0], yaw: 0.4 },         // 4 wide from above, bike left
    { pos: [3.2, 1.0, 3.0], look: [-1.1, 0.5, 0], yaw: 1.27 },        // 5 rest, bike right
  ],
  hotspots: [                       // surface points found by raycasting the model in a side view
    { id: "motor", at: [-0.049, 0.359, 0.073], normal: [0, -0.08, 1] },
    { id: "bateria", at: [0.143, 0.649, 0.054], normal: [0.02, 0.01, 1] },
    { id: "horquilla", at: [0.528, 0.595, 0.097], normal: [0.42, 0.2, 0.89] },
    { id: "display", at: [0.31, 1.08, -0.05], normal: [0, 1, 0.6] },
    { id: "freno", at: [0.708, 0.423, -0.03], normal: [0.07, 0.06, 1] },
  ],
  lightModes: {
    amanecer: { exposure: 1.0, key: 1.6, rim: 60, fog: "#0A0E0C", backdrop: "brightness(.42) saturate(.9)" },
    horaazul: { exposure: 0.85, key: 0.5, rim: 120, fog: "#070B10", backdrop: "brightness(.26) saturate(1.1) hue-rotate(8deg)" },
    cresta:   { exposure: 1.2, key: 2.6, rim: 30, fog: "#141A14", backdrop: "brightness(.6) saturate(.8)" },
  },
}));

// ---- hotspots on touch screens: tap a dot to read its label ----
document.querySelectorAll(".hotspot").forEach((h) => h.addEventListener("click", () => {
  const open = !h.classList.contains("is-open");
  document.querySelectorAll(".hotspot.is-open").forEach((o) => o.classList.remove("is-open"));
  h.classList.toggle("is-open", open);
}));

// ---- terrain film: pinned, scrubbed by scroll, with the terrain meter ----
const terrain = document.querySelector("#terreno");
const video = terrain.querySelector(".terrain__video");
const stops = [...terrain.querySelectorAll(".meter__stop")];
const meter = terrain.querySelector(".meter");
let seekBusy = false, pendingTime = null, lastVideoT = -1;
function requestSeek(t) {
  if (!video.duration) return;
  if (Math.abs(t - lastVideoT) < 0.008) return;
  if (seekBusy) { pendingTime = t; return; }
  seekBusy = true; lastVideoT = t; video.currentTime = t;
}
video.addEventListener("seeked", () => {
  seekBusy = false;
  if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
});
video.addEventListener("error", () => { seekBusy = false; pendingTime = null; terrain.classList.remove("video-ready"); });

const STOP_AT = [0, 0.3, 0.58, 0.86];      // where each surface appears in the film
function setProgress(p) {
  meter.style.setProperty("--p", p.toFixed(4));
  stops.forEach((s, i) => s.classList.toggle("is-active", p >= STOP_AT[i] - 0.001 && (i === stops.length - 1 || p < STOP_AT[i + 1])));
  requestSeek(p * Math.max(0, video.duration - 0.05));
}

if (!STATIC_FILM.matches) {
  ScrollTrigger.create({
    trigger: terrain, start: "top top", end: () => "+=" + innerHeight * 2.6,
    pin: ".terrain__pin", scrub: true,
    onUpdate: (self) => setProgress(self.progress),
  });
  (async () => {
    try {
      const res = await fetch(import.meta.env.BASE_URL + "film.mp4");
      if (!res.ok) throw new Error(res.status);
      video.src = URL.createObjectURL(await res.blob());
      video.load();
      video.addEventListener("loadedmetadata", () => { terrain.classList.add("video-ready"); requestSeek(0); }, { once: true });
    } catch { /* the poster frame stays */ }
  })();
}

// ---- reveals ----
if (!REDUCED) {
  gsap.utils.toArray(".reveal").forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 88%" } }));
} else {
  document.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
}

// ---- 3D tilt on the material image (desktop only) ----
if (matchMedia("(hover: hover) and (min-width: 769px)").matches && !REDUCED) {
  document.querySelectorAll(".tilt").forEach((wrap) => {
    const img = wrap.querySelector("img");
    wrap.addEventListener("pointermove", (e) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      img.style.transform = `rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    });
    wrap.addEventListener("pointerleave", () => { img.style.transform = ""; });
  });
}

// ---- reservation form: contact details are placeholders, so this is a local success state ----
const form = document.getElementById("reserve-form");
const note = form.querySelector(".cta__note");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = form.nombre, email = form.email;
  const okName = name.value.trim().length > 1;
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  name.setAttribute("aria-invalid", String(!okName));
  email.setAttribute("aria-invalid", String(!okEmail));
  note.classList.remove("is-ok", "is-error");
  if (!okName || !okEmail) {
    note.textContent = !okName ? "Escribe tu nombre para reservar." : "Revisa tu correo, parece incompleto.";
    note.classList.add("is-error");
    return;
  }
  const tipo = form.tipo.value === "prepedido" ? "tu pre-pedido" : "tu prueba de manejo";
  note.textContent = `Listo, ${name.value.trim().split(" ")[0]}. Recibimos ${tipo}. Te escribimos a ${email.value.trim()} en menos de 24 horas.`;
  note.classList.add("is-ok");
  form.querySelector("button[type=submit]").disabled = true;
});

addEventListener("load", () => ScrollTrigger.refresh());
if (import.meta.env.DEV) { window.__lenis = lenis; window.__ST = ScrollTrigger; window.__bgv = video; }
