// Dev-only review page: one model, four angles, neutral light. /inspect.html?model=/model/candidate-a.glb&yaw=0
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const q = new URLSearchParams(location.search);
const url = q.get("model") || "/model/product.glb";
const yaw = parseFloat(q.get("yaw") || "0");
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d33);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.DirectionalLight(0xffffff, 1.2).translateX(3).translateY(5).translateZ(4));

const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
const model = gltf.scene;
model.rotation.y = yaw;
const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
const s = 2 / Math.max(size.x, size.y, size.z);
model.scale.setScalar(s);
model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
scene.add(model);

let tris = 0;
model.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
document.getElementById("label").textContent = `${url} · ${Math.round(tris).toLocaleString()} triangles · front / right / back / three-quarter from above`;

const views = [[0, 0.8, 4.2], [4.2, 0.8, 0], [0, 0.8, -4.2], [2.8, 2.6, 2.8]];
if (q.get("cam")) {   // single close-up view: &cam=x,y,z&look=x,y,z
  const c = q.get("cam").split(",").map(Number), l = (q.get("look") || "0,0.5,0").split(",").map(Number);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  const cc = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.02, 50);
  cc.position.set(...c); cc.lookAt(...l);
  renderer.render(scene, cc);
  document.body.dataset.ready = "1";
  throw new Error("done");
}
const cam = new THREE.PerspectiveCamera(30, (innerWidth / 2) / (innerHeight / 2), 0.05, 50);
const w = innerWidth / 2, h = innerHeight / 2;
const pull = Math.max(1, 1.3 / cam.aspect);
views.forEach((p, i) => {
  const x = (i % 2) * w, y = (i < 2 ? 1 : 0) * h;
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  cam.position.set(p[0] * pull, p[1] * pull, p[2] * pull);
  cam.lookAt(0, 0.5, 0);
  renderer.render(scene, cam);
});
document.body.dataset.ready = "1";
