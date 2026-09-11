/* Animated cover for the "Embedding Earth" atlas tile: an open-ended oval
   track of book pages, viewed from slightly above so the near pages read as
   the scroll's front and the far pages show as a darkened reverse side
   through the open top. The oval itself never rotates — its long axis
   always faces the camera — instead the pages slide along the fixed track.
   Falls back silently to the static poster image (already in the DOM) if
   WebGL or the pages fail to load, or if the visitor prefers reduced
   motion. */

const THREE_MODULE_URL = "https://unpkg.com/three@0.186.0/build/three.module.js";

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Front face (outward, textured) reads at full brightness; the back face —
// which is what the far side of the track shows through its open top — is
// darkened so it reads as the reverse of the page rather than a duplicate.
// Textures are left at their default (untagged) color space intentionally:
// tagging them sRGB triggers an extra hardware decode on top of the
// renderer's own sRGB output encode, which double-applies the gamma curve
// and makes everything look darker/higher-contrast than the source images.
const FRAGMENT_SHADER = `
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(map, vUv);
    if (gl_FrontFacing) {
      gl_FragColor = tex;
    } else {
      gl_FragColor = vec4(tex.rgb * 0.2, 1.0);
    }
  }
`;

// The poster starts hidden (see CSS) so a page load never flashes the old
// static cover before the canvas is ready — it's only revealed here, in the
// specific cases where the canvas won't be taking over after all.
const FALLBACK_REVEAL_MS = 4000;

function revealPoster(container) {
  const poster = container.querySelector(".atlas-scroll-poster");
  if (poster) poster.style.opacity = "1";
}

function initAtlasScroll(container) {
  let pages;
  try {
    pages = JSON.parse(container.dataset.pages || "[]");
  } catch {
    revealPoster(container);
    return;
  }
  if (!pages.length) {
    revealPoster(container);
    return;
  }

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealPoster(container);
    return;
  }

  // Safety net for failures buildTrack/mountAndAnimate don't explicitly
  // handle (WebGL unsupported, all textures failing to load, etc.) — if the
  // canvas hasn't taken over within a few seconds, fall back to the poster.
  const state = { ready: false };
  setTimeout(() => {
    if (!state.ready) revealPoster(container);
  }, FALLBACK_REVEAL_MS);

  import(THREE_MODULE_URL)
    .then((THREE) => buildTrack(THREE, container, pages, state))
    .catch(() => {
      revealPoster(container);
    });
}

// Fills `target` (a Float32Array sized for segments*6*3) with a curved strip
// of triangles following the fixed elliptical (x/a)^2 + (z/b)^2 = 1
// cross-section between thetaStart and thetaEnd. Called once per page on
// setup, then again every frame with a shifted theta range so the page
// slides along the ellipse without the ellipse itself ever moving.
function writePageTrianglePositions(target, thetaStart, thetaEnd, a, b, halfHeight, segments) {
  let idx = 0;
  for (let j = 0; j < segments; j++) {
    const theta0 = thetaStart + (thetaEnd - thetaStart) * (j / segments);
    const theta1 = thetaStart + (thetaEnd - thetaStart) * ((j + 1) / segments);
    const x0 = Math.sin(theta0) * a;
    const z0 = Math.cos(theta0) * b;
    const x1 = Math.sin(theta1) * a;
    const z1 = Math.cos(theta1) * b;

    // two triangles per quad, wound so the outward (away-from-axis) side is
    // front-facing: (bottom0, bottom1, top0) + (bottom1, top1, top0)
    target[idx++] = x0; target[idx++] = -halfHeight; target[idx++] = z0;
    target[idx++] = x1; target[idx++] = -halfHeight; target[idx++] = z1;
    target[idx++] = x0; target[idx++] = halfHeight; target[idx++] = z0;

    target[idx++] = x1; target[idx++] = -halfHeight; target[idx++] = z1;
    target[idx++] = x1; target[idx++] = halfHeight; target[idx++] = z1;
    target[idx++] = x0; target[idx++] = halfHeight; target[idx++] = z0;
  }
}

function buildPageUVs(segments) {
  const uvs = [];
  for (let j = 0; j < segments; j++) {
    const t0 = j / segments;
    const t1 = (j + 1) / segments;
    uvs.push(t0, 0, t1, 0, t0, 1);
    uvs.push(t1, 0, t1, 1, t0, 1);
  }
  return uvs;
}

// Source pages are square — center-crop each to its current (curved) aspect
// instead of stretching them. Re-applied every frame as a page slides: the
// physical width a fixed angular slice spans varies with where it sits on
// the ellipse (wide near the flat front, narrow near the tight sides), so a
// crop computed once and left alone would visibly warp as the page moved
// through the parts of the track it wasn't originally cropped for.
//
// Width is the sum of the same `segments` piecewise-linear chords the
// geometry itself is built from (not the single straight chord between the
// page's two endpoints) — with few, wide pages the front of the ellipse
// bulges well outside that end-to-end chord, so the chord badly
// underestimates the true curved width and the texture ends up stretched
// to fill the wider geometry it was cropped too tightly for.
function applyTextureCrop(texture, thetaStart, thetaEnd, a, b, pageHeight, segments) {
  let pageWidth = 0;
  let prevX = Math.sin(thetaStart) * a;
  let prevZ = Math.cos(thetaStart) * b;
  for (let j = 1; j <= segments; j++) {
    const theta = thetaStart + (thetaEnd - thetaStart) * (j / segments);
    const x = Math.sin(theta) * a;
    const z = Math.cos(theta) * b;
    pageWidth += Math.hypot(x - prevX, z - prevZ);
    prevX = x;
    prevZ = z;
  }
  const planeAspect = pageWidth / pageHeight;
  if (planeAspect < 1) {
    texture.repeat.set(planeAspect, 1);
    texture.offset.set((1 - planeAspect) / 2, 0);
  } else {
    texture.repeat.set(1, 1 / planeAspect);
    texture.offset.set(0, (1 - 1 / planeAspect) / 2);
  }
}

function buildTrack(THREE, container, pageUrls, state) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);

  const count = pageUrls.length;
  const semiMajor = 11.2; // horizontal (X) half-width — the oval's long side, fixed facing the camera
  const semiMinor = 2.9; // depth (Z) half-width — shallow, for a more elongated oval so more pages read face-on
  const halfPageHeight = 2.1;
  const segmentsPerPage = 8;

  camera.position.set(0, 0, 10.5);
  camera.lookAt(0, -0.35, 0);

  const loader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const loads = pageUrls.map(
    (url) =>
      new Promise((resolve) => {
        loader.load(url, (texture) => resolve(texture), undefined, () => resolve(null));
      })
  );

  Promise.all(loads).then((textures) => {
    const slots = [];

    textures.forEach((texture, i) => {
      if (!texture) return;

      texture.anisotropy = maxAnisotropy;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      const thetaStart0 = (i / count) * Math.PI * 2;
      const thetaEnd0 = ((i + 1) / count) * Math.PI * 2;

      applyTextureCrop(texture, thetaStart0, thetaEnd0, semiMajor, semiMinor, halfPageHeight * 2, segmentsPerPage);

      const positions = new Float32Array(segmentsPerPage * 6 * 3);
      writePageTrianglePositions(positions, thetaStart0, thetaEnd0, semiMajor, semiMinor, halfPageHeight, segmentsPerPage);

      const geometry = new THREE.BufferGeometry();
      const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
      positionAttribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("position", positionAttribute);
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buildPageUVs(segmentsPerPage), 2));

      const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      slots.push({ positionAttribute, texture, thetaStart0, thetaEnd0 });
    });

    if (slots.length === 0) {
      renderer.dispose();
      return;
    }

    mountAndAnimate(renderer, scene, camera, slots, semiMajor, semiMinor, halfPageHeight, segmentsPerPage, container, state);
  });
}

function mountAndAnimate(renderer, scene, camera, slots, a, b, halfHeight, segments, container, state) {
  const canvas = renderer.domElement;
  canvas.className = "atlas-scroll-canvas";
  container.appendChild(canvas);

  const poster = container.querySelector(".atlas-scroll-poster");
  requestAnimationFrame(() => {
    state.ready = true;
    canvas.style.opacity = "1";
    if (poster) poster.style.opacity = "0";
  });

  let isVisible = true;
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    });
    io.observe(container);
  }

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);
  }

  const TWO_PI = Math.PI * 2;
  const DRIFT_SPEED = -0.1; // radians/sec the pages slide along the fixed track
  let offset = 0;
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (isVisible) {
      offset = (offset + DRIFT_SPEED * dt) % TWO_PI;
      for (const slot of slots) {
        const thetaStart = slot.thetaStart0 + offset;
        const thetaEnd = slot.thetaEnd0 + offset;
        writePageTrianglePositions(slot.positionAttribute.array, thetaStart, thetaEnd, a, b, halfHeight, segments);
        slot.positionAttribute.needsUpdate = true;
        applyTextureCrop(slot.texture, thetaStart, thetaEnd, a, b, halfHeight * 2, segments);
      }
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

function scanForAtlasScrolls() {
  document.querySelectorAll(".atlas-scroll:not([data-atlas-init])").forEach((el) => {
    el.dataset.atlasInit = "1";
    initAtlasScroll(el);
  });
}

scanForAtlasScrolls();

const gridEl = document.getElementById("projects");
if (gridEl && window.MutationObserver) {
  new MutationObserver(scanForAtlasScrolls).observe(gridEl, { childList: true, subtree: true });
}
