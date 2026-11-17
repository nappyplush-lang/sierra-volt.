# Nort Run NR-1, sitio web

Landing page de la e-bike Nort Run NR-1. Vite + JavaScript, three.js (la bici en 3D), GSAP + ScrollTrigger y Lenis.

## Cómo correrlo

```bash
npm install
npm run dev                    # http://localhost:5173
npm run build -- --base=./     # sitio estático en dist/
npx vite preview               # revisar dist/ por HTTP (nunca con file://)
```

## Qué hay en la página

1. **La historia (hero 3D):** la NR-1 como modelo 3D real sobre la carretera de montaña. El scroll mueve la cámara por cinco beats (`src/main.js`, `beats`). Si el 3D no carga o el navegador no tiene WebGL, se queda la foto hero (`public/img/hero.jpg`).
2. **Declaración, características.**
3. **Todo el terreno:** la película carretera a sendero, recorrida con el scroll, con el medidor de terreno. En teléfonos se muestra como cuatro fotos y nunca se descarga el video.
4. **Explora la NR-1:** arrastrar para girar, puntos con beneficios (en teléfono se tocan para leerlos) y tres luces: Amanecer, Hora azul, Cresta al sol.
5. **Materiales, Hecha para tu semana, Especificaciones, Reserva, footer.**

## Archivos clave

- `public/model/product.glb`: modelo 3D optimizado (3.5 MB).
- `public/film.mp4`: película de 10 s, sin audio, con keyframes cortos para que el scroll la recorra bien.
- `src/stage.js`: escena 3D (luces, partículas, cámara, arrastre, puntos).
- `src/main.js`: configuración de beats, puntos, luces, película y formulario.
- `inspect.html` + `src/inspect.js`: página de revisión de modelos (solo desarrollo, no entra al build).

## A dónde llega el formulario de reserva

**Hoy a ningún lado.** El correo, el teléfono y las redes de la marca son placeholders (`hola@nortrun.com`, `+52 55 0000 0000`). El formulario valida nombre y correo y muestra un mensaje de confirmación en la página, pero no envía nada.

Para recibir reservas de verdad hay que conectarlo a un correo o servicio real (por ejemplo un `mailto:` al correo definitivo, o un servicio de formularios). Cambia también los datos de contacto en el footer de `index.html`.

## Placeholders pendientes

Precio ($3,490 USD), correo, teléfono, Instagram, YouTube, ubicación del showroom y `og:url` / `og:image` (apuntan a `https://nortrun.com/`, se cambian al publicar).
