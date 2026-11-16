/* ==========================================================================
   Покровский СПССУ — 3D-модель малого дома (Three.js r160, UMD-сборка)
   Планировка соответствует плану дома: 3 спальни сзади; спереди санузел,
   прихожая, общий зал, второй санузел и кухня; терраса с пандусом слева спереди.
   Оси: x — слева направо (11,5 м), z — от задней стены к фасаду (8,5 м).
   ========================================================================== */

(function () {
  "use strict";

  const root = document.getElementById("house3d");
  if (!root) return;

  const stage = root.querySelector(".house3d-stage");
  const labelsLayer = root.querySelector(".house3d-labels");
  const hint = root.querySelector(".house3d-hint");
  const caption = root.querySelector(".house3d-caption");
  const viewButtons = Array.from(root.querySelectorAll("[data-view]"));
  const zoomButtons = Array.from(root.querySelectorAll("[data-zoom]"));

  function fallback(message) {
    stage.innerHTML = '<p class="house3d-fallback">' + message + "</p>";
    root.classList.add("is-fallback");
  }

  /* Three.js (670 КБ) грузим только когда блок близко к экрану */
  function loadThree(cb) {
    if (window.THREE) return cb();
    const s = document.createElement("script");
    s.src = "scripts/vendor/three.min.js";
    s.onload = cb;
    s.onerror = () => fallback("3D-модель не загрузилась. План и описание дома приведены ниже.");
    document.head.appendChild(s);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          loadThree(init);
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(root);
  } else {
    loadThree(init);
  }

  function init() {
    const THREE = window.THREE;
    if (!THREE) return fallback("3D-модель не загрузилась. План и описание дома приведены ниже.");

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      return fallback("Этот браузер не показывает 3D. План и описание дома приведены ниже.");
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.prepend(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    /* ---------------- Сцена, окружение, свет ---------------- */
    const BG = 0xf1efea;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 34, 70);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(buildEnvScene(), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xfbf8f2, 0xc9c1b1, 0.55);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeedb, 3.1);
    sun.position.set(-10, 13, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);

    function buildEnvScene() {
      const env = new THREE.Scene();
      const room = new THREE.Mesh(
        new THREE.BoxGeometry(24, 14, 24),
        new THREE.MeshBasicMaterial({ color: 0x8a867e, side: THREE.BackSide })
      );
      room.position.y = 6;
      env.add(room);
      function panel(w, h, x, y, z, rx, ry, k) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.98, k * 0.94), side: THREE.DoubleSide })
        );
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, 0);
        env.add(m);
      }
      panel(14, 14, 0, 12.9, 0, Math.PI / 2, 0, 3.2);
      panel(8, 5, -11.9, 6, 0, 0, Math.PI / 2, 2.0);
      panel(8, 5, 11.9, 6, 3, 0, -Math.PI / 2, 1.3);
      panel(10, 5, 0, 6, 11.9, 0, Math.PI, 1.6);
      return env;
    }

    /* ---------------- Материалы и процедурные текстуры ---------------- */
    function seeded(seed) {
      return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function canvasTexture(size, draw) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      draw(c.getContext("2d"), size);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      return t;
    }

    function shade(hex, k) {
      const c = new THREE.Color(hex);
      c.offsetHSL(0, 0, k);
      return "#" + c.getHexString();
    }

    // Паркетная доска: текстура покрывает 2 × 2 м, доска 0,2 м
    function planks(baseHex, plankW, gapHex, seed) {
      return canvasTexture(1024, (ctx, S) => {
        const rnd = seeded(seed);
        const rows = Math.round(2 / plankW);
        const rowH = S / rows;
        for (let r = 0; r < rows; r++) {
          let x = -rnd() * S * 0.5;
          while (x < S) {
            const len = S * (0.35 + rnd() * 0.45);
            ctx.fillStyle = shade(baseHex, (rnd() - 0.5) * 0.07);
            ctx.fillRect(x, r * rowH, len, rowH);
            ctx.globalAlpha = 0.08;
            for (let g = 0; g < 5; g++) {
              ctx.fillStyle = shade(baseHex, -0.12);
              ctx.fillRect(x, r * rowH + rnd() * rowH, len, 1);
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = gapHex;
            ctx.fillRect(x, r * rowH, 2, rowH);
            x += len;
          }
          ctx.fillStyle = gapHex;
          ctx.fillRect(0, r * rowH, S, 2);
        }
      });
    }

    // Плитка: текстура покрывает 1,2 × 1,2 м, плитка 0,3 м
    function tiles(baseHex, groutHex) {
      return canvasTexture(512, (ctx, S) => {
        const rnd = seeded(7);
        const n = 4;
        const step = S / n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            ctx.fillStyle = shade(baseHex, (rnd() - 0.5) * 0.02);
            ctx.fillRect(i * step, j * step, step, step);
          }
        }
        ctx.fillStyle = groutHex;
        for (let i = 0; i <= n; i++) {
          ctx.fillRect(i * step - 1, 0, 3, S);
          ctx.fillRect(0, i * step - 1, S, 3);
        }
      });
    }

    const TEX = {
      oak: planks("#d9c3a1", 0.2, "#b9a07c", 11),
      deck: planks("#b99572", 0.14, "#7d6247", 23),
      tile: tiles("#e9ecea", "#cfd4d2"),
      tileDark: tiles("#c9d3d4", "#aab6b8")
    };

    const std = (color, roughness = 0.85, extra = {}) =>
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra));

    const M = {
      wall: std(0xf4f1ea, 0.93),
      cut: std(0x3e4145, 0.8),
      plinth: std(0xdcd7cc, 0.95),
      oakFloor: std(0xffffff, 0.7, { map: TEX.oak }),
      deck: std(0xffffff, 0.8, { map: TEX.deck }),
      tile: std(0xffffff, 0.45, { map: TEX.tile }),
      tileDark: std(0xffffff, 0.45, { map: TEX.tileDark }),
      ground: std(0xe9e6df, 1),
      lawn: std(0xc3ceb0, 1),
      paving: std(0xe2ddd3, 0.95),
      oak: std(0xcfb48f, 0.6),
      oakDark: std(0x9d7f5e, 0.6),
      linen: std(0xf4f1ea, 0.95),
      white: std(0xfbfbfa, 0.35),
      fronts: std(0xebe7df, 0.6),
      counter: std(0x6f6b65, 0.45),
      black: std(0x1d1f22, 0.25),
      steel: std(0xc9ccce, 0.3, { metalness: 0.8 }),
      frame: std(0x55534f, 0.55),
      sofa: std(0x8d9c8e, 0.95),
      cushion: std(0xa5b2a5, 0.95),
      rug: std(0xd9d2c4, 1),
      rugBlue: std(0x9fb0b8, 1),
      blanketBlue: std(0x9fb2c1, 0.95),
      blanketSand: std(0xcdae8e, 0.95),
      blanketSage: std(0xa9b79c, 0.95),
      lampShade: std(0xfff6e3, 0.6, { emissive: 0xffe2b0, emissiveIntensity: 0.35 }),
      leaf: std(0x8fa77f, 0.9, { flatShading: true }),
      leafDark: std(0x7d9670, 0.9, { flatShading: true }),
      trunk: std(0x8b7764, 0.9),
      pot: std(0xc9b8a2, 0.85),
      mirror: std(0xdfe7ea, 0.08, { metalness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0xd2e3ea,
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      }),
      showerGlass: new THREE.MeshStandardMaterial({
        color: 0xe4eef1,
        roughness: 0.05,
        transparent: true,
        opacity: 0.25,
        depthWrite: false
      }),
      edge: new THREE.LineBasicMaterial({ color: 0x7a756c, transparent: true, opacity: 0.45 })
    };

    /* ---------------- Геометрия ---------------- */
    const geoCache = new Map();
    function cached(key, make) {
      if (!geoCache.has(key)) geoCache.set(key, make());
      return geoCache.get(key);
    }
    const boxGeo = (w, h, d) => cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));

    // Брусок со скруглёнными рёбрами
    function softGeo(w, h, d, r, s = 3) {
      return cached(`s${w}|${h}|${d}|${r}`, () => {
        const rad = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
        const eps = 0.00001;
        const rr = rad - eps;
        const shape = new THREE.Shape();
        shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
        shape.absarc(eps, h - rr * 2, eps, Math.PI, Math.PI / 2, true);
        shape.absarc(w - rr * 2, h - rr * 2, eps, Math.PI / 2, 0, true);
        shape.absarc(w - rr * 2, eps, eps, 0, -Math.PI / 2, true);
        const g = new THREE.ExtrudeGeometry(shape, {
          depth: d - rad * 2,
          bevelEnabled: true,
          bevelSegments: s * 2,
          steps: 1,
          bevelSize: rr,
          bevelThickness: rad,
          curveSegments: s
        });
        g.center();
        return g;
      });
    }

    const house = new THREE.Group();
    scene.add(house);

    function mesh(geo, mat, x, y, z, parent = house, shadows = true) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadows;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    const box = (w, h, d, mat, x, y, z, parent) => mesh(boxGeo(w, h, d), mat, x, y, z, parent);
    const soft = (w, h, d, r, mat, x, y, z, parent) => mesh(softGeo(w, h, d, r), mat, x, y, z, parent);
    const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 20) =>
      mesh(cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat, x, y, z, parent);

    function group(x, z, rotY = 0, parent = house) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      parent.add(g);
      return g;
    }

    // Горизонтальная поверхность с текстурой в метрах
    function floorPlane(w, d, mat, metersPerTile, x, y, z) {
      const geo = new THREE.PlaneGeometry(w, d);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (uv.getX(i) * w) / metersPerTile + x / metersPerTile, (uv.getY(i) * d) / metersPerTile + z / metersPerTile);
      }
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      house.add(m);
      return m;
    }

    /* ---------------- Габариты ---------------- */
    const X0 = -5.75, X1 = 5.75, Z0 = -4.25, Z1 = 4.25;
    const FL = 0.12; // отметка чистого пола
    const H = 2.3; // высота стен в разрезе (без кровли)
    const TE = 0.3; // наружные стены
    const TI = 0.12; // перегородки
    const zB = -0.3; // линия спален
    const xL = -2.89; // санузел 1 / прихожая | зал
    const zM = 1.86; // санузел 1 | прихожая; зал | санузел 2
    const xB2 = 0.86; // зал | санузел 2
    const xK = 2.89; // зал, санузел 2 | кухня

    /* ---------------- Стены с проёмами ---------------- */
    function wallPiece(axis, fixed, a, b, y0, y1, t) {
      const len = b - a;
      const h = y1 - y0;
      if (len <= 0.001 || h <= 0.001) return;
      const mid = (a + b) / 2;
      const w = axis === "x" ? len : t;
      const d = axis === "x" ? t : len;
      const x = axis === "x" ? mid : fixed;
      const z = axis === "x" ? fixed : mid;
      const geo = boxGeo(+w.toFixed(3), +h.toFixed(3), +d.toFixed(3));
      mesh(geo, M.wall, x, FL + y0 + h / 2, z);
      // тёмный «срез» по верху стены, как на архитектурном макете
      if (Math.abs(y1 - H) < 0.001) {
        mesh(boxGeo(+w.toFixed(3), 0.012, +d.toFixed(3)), M.cut, x, FL + H + 0.006, z, house, false);
      }
      const edges = new THREE.LineSegments(
        cached(`e${geo.uuid}`, () => new THREE.EdgesGeometry(geo)),
        M.edge
      );
      edges.position.set(x, FL + y0 + h / 2, z);
      house.add(edges);
    }

    function windowFill(axis, fixed, a, b, y0, y1, t) {
      const len = b - a;
      const h = y1 - y0;
      const mid = (a + b) / 2;
      const along = (l, thick, depth) => (axis === "x" ? [l, thick, depth] : [depth, thick, l]);
      const pos = (u, y) => (axis === "x" ? [u, FL + y, fixed] : [fixed, FL + y, u]);
      // стекло
      const [gw, gh, gd] = along(len - 0.06, h - 0.06, 0.02);
      mesh(boxGeo(gw, gh, gd), M.glass, ...pos(mid, y0 + h / 2), house, false);
      // рама
      const f = 0.05;
      const fd = t * 0.45;
      let s = along(len, f, fd);
      mesh(boxGeo(...s), M.frame, ...pos(mid, y0 + f / 2));
      mesh(boxGeo(...s), M.frame, ...pos(mid, y1 - f / 2));
      s = axis === "x" ? [f, h, fd] : [fd, h, f];
      mesh(boxGeo(...s), M.frame, ...pos(a + f / 2, y0 + h / 2));
      mesh(boxGeo(...s), M.frame, ...pos(b - f / 2, y0 + h / 2));
      if (len > 1.3) mesh(boxGeo(...s), M.frame, ...pos(mid, y0 + h / 2));
      // подоконник
      s = along(len + 0.1, 0.04, t + 0.08);
      mesh(boxGeo(...s), M.white, ...pos(mid, y0 - 0.02));
    }

    // axis "x": стена вдоль оси x на z = fixed; "z": вдоль оси z на x = fixed
    function wall(axis, fixed, from, to, t, openings = []) {
      let cur = from;
      openings
        .slice()
        .sort((p, q) => p.c - q.c)
        .forEach((op) => {
          const a = op.c - op.w / 2;
          const b = op.c + op.w / 2;
          wallPiece(axis, fixed, cur, a, 0, H, t);
          if (op.sill > 0) wallPiece(axis, fixed, a, b, 0, op.sill, t);
          const top = op.top ?? 2.05;
          if (top < H) wallPiece(axis, fixed, a, b, top, H, t);
          if (op.glass) windowFill(axis, fixed, a, b, op.sill, top, t);
          cur = b;
        });
      wallPiece(axis, fixed, cur, to, 0, H, t);
    }

    const win = (c, w, sill = 0.85, top = 2.05) => ({ c, w, sill, top, glass: true });
    const door = (c, w = 0.9) => ({ c, w, sill: 0, top: 2.05 });

    /* ---------------- Участок ---------------- */
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), M.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const lawnShape = new THREE.Shape();
    (function roundedRect(s, x, y, w, h, r) {
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y);
      s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r);
      s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h);
      s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
    })(lawnShape, -11, -8.5, 22, 19.5, 1.2);
    const lawn = new THREE.Mesh(new THREE.ShapeGeometry(lawnShape, 6), M.lawn);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.0;
    lawn.receiveShadow = true;
    scene.add(lawn);

    // дорожка от пандуса
    floorPlane(1.6, 3.4, M.paving, 1, -3.7, 0.012, 9.6);
    // отмостка вокруг дома
    box(X1 - X0 + 0.9, 0.05, Z1 - Z0 + 0.9, M.paving, 0, 0.025, 0);
    // цоколь
    box(X1 - X0, FL, Z1 - Z0, M.plinth, 0, FL / 2, 0);

    function tree(x, z, s = 1, dark = false) {
      const g = group(x, z, 0);
      cyl(0.08 * s, 0.11 * s, 1.6 * s, M.trunk, 0, 0.8 * s, 0, g, 8);
      const crown = mesh(
        cached(`ico${s}`, () => new THREE.IcosahedronGeometry(0.95 * s, 2)),
        dark ? M.leafDark : M.leaf,
        0,
        2.35 * s,
        0,
        g
      );
      crown.scale.set(1, 1.15, 1);
      return g;
    }
    function shrub(x, z, s = 1) {
      mesh(cached(`sh${s}`, () => new THREE.IcosahedronGeometry(0.42 * s, 1)), M.leafDark, x, 0.32 * s, z);
    }
    tree(-9.2, -3.6, 1.0);
    tree(8.9, -5.2, 1.15, true);
    tree(9.3, 5.8, 0.9);
    tree(-9.4, 7.2, 0.85, true);
    tree(4.2, 9.4, 0.8);
    shrub(-0.9, 5.0);
    shrub(0.2, 5.1, 0.8);
    shrub(3.6, 5.0, 0.9);
    shrub(5.0, 5.0, 0.7);
    shrub(-6.5, 3.6, 0.8);

    /* ---------------- Полы ---------------- */
    floorPlane(X1 - X0 - 0.1, Z1 - Z0 - 0.1, M.oakFloor, 2, 0, FL + 0.001, 0);
    floorPlane(xL - X0 - 0.2, zM - zB - 0.1, M.tile, 1.2, (X0 + xL) / 2, FL + 0.003, (zB + zM) / 2); // санузел 1
    floorPlane(xL - X0 - 0.2, Z1 - zM - 0.2, M.tile, 1.2, (X0 + xL) / 2, FL + 0.003, (zM + Z1) / 2); // прихожая
    floorPlane(xK - xB2 - 0.1, Z1 - zM - 0.2, M.tile, 1.2, (xB2 + xK) / 2, FL + 0.003, (zM + Z1) / 2); // санузел 2

    /* ---------------- Стены ---------------- */
    const zi0 = Z0 + TE / 2;
    const zi1 = Z1 - TE / 2;
    const xi0 = X0 + TE / 2;
    const xi1 = X1 - TE / 2;

    // задний фасад: окна трёх спален
    wall("x", zi0, X0, X1, TE, [win(-3.83, 1.5), win(0, 1.5), win(3.83, 1.5)]);
    // главный фасад: дверь, окно зала, окно санузла, окно кухни
    wall("x", zi1, X0, X1, TE, [door(-4.3, 1.0), win(-1.0, 2.0, 0.9), win(1.9, 0.6, 1.4), win(4.3, 1.2, 1.0)]);
    // левый и правый торцы
    wall("z", xi0, Z0 + TE, Z1 - TE, TE, [win(-2.3, 1.3), win(0.8, 0.6, 1.4), win(3.3, 0.8)]);
    wall("z", xi1, Z0 + TE, Z1 - TE, TE, [win(-2.3, 1.3), win(1.2, 1.2, 1.05)]);

    // спальни: линия дверей и две перегородки
    wall("x", zB, X0 + TE, X1 - TE, TI, [door(-2.4, 0.8), door(0.9), door(2.4, 0.8)]);
    wall("z", -1.92, Z0 + TE, zB - TI / 2, TI);
    wall("z", 1.92, Z0 + TE, zB - TI / 2, TI);
    // санузел 1 и прихожая
    wall("z", xL, zB + TI / 2, Z1 - TE, TI, [{ c: 3.05, w: 1.3, sill: 0, top: 2.05 }]);
    wall("x", zM, X0 + TE, xL - TI / 2, TI, [door(-4.0)]);
    // санузел 2
    wall("z", xB2, zM - TI / 2, Z1 - TE, TI, [door(2.75, 0.85)]);
    wall("x", zM, xB2 + TI / 2, xK - TI / 2, TI);
    // кухня: широкий проём в зал
    wall("z", xK, zB + TI / 2, Z1 - TE, TI, [{ c: 0.8, w: 1.7, sill: 0, top: 2.05 }]);

    /* ---------------- Мебель ---------------- */
    function bed(x, z, blanket, parent = house) {
      const g = group(x, z, 0, parent);
      soft(0.96, 0.28, 2.06, 0.03, M.oak, 0, FL + 0.14, 0, g);
      soft(0.9, 0.18, 1.96, 0.06, M.linen, 0, FL + 0.37, 0.02, g);
      soft(0.94, 0.07, 1.25, 0.03, blanket, 0, FL + 0.48, 0.38, g);
      soft(0.62, 0.12, 0.34, 0.05, M.linen, 0, FL + 0.52, -0.72, g);
      soft(0.96, 0.78, 0.06, 0.025, M.oak, 0, FL + 0.39, -1.02, g);
    }
    function nightstand(x, z) {
      soft(0.45, 0.5, 0.4, 0.02, M.oak, x, FL + 0.25, z);
      cyl(0.06, 0.08, 0.04, M.oakDark, x, FL + 0.52, z);
      cyl(0.012, 0.012, 0.22, M.oakDark, x, FL + 0.65, z, house, 8);
      cyl(0.09, 0.13, 0.17, M.lampShade, x, FL + 0.82, z);
    }
    function wardrobe(x, z, w, rotY = 0) {
      const g = group(x, z, rotY);
      soft(w, 2.0, 0.56, 0.02, M.oak, 0, FL + 1.0, 0, g);
      const doors = Math.round(w / 0.5);
      for (let i = 1; i < doors; i++) box(0.012, 1.9, 0.01, M.oakDark, -w / 2 + (w / doors) * i, FL + 1.0, 0.285, g);
      for (let i = 0; i < doors; i++) {
        const hx = -w / 2 + (w / doors) * (i + (i % 2 ? 0.15 : 0.85));
        box(0.02, 0.22, 0.03, M.steel, hx, FL + 1.05, 0.3, g);
      }
    }
    function rug(w, d, mat, x, z) {
      soft(w, 0.016, d, 0.008, mat, x, FL + 0.009, z);
    }
    function plant(x, z, s = 1) {
      cyl(0.16 * s, 0.12 * s, 0.34 * s, M.pot, x, FL + 0.17 * s, z);
      mesh(cached(`pl${s}`, () => new THREE.IcosahedronGeometry(0.3 * s, 1)), M.leaf, x, FL + 0.55 * s, z);
      mesh(cached(`pl2${s}`, () => new THREE.IcosahedronGeometry(0.22 * s, 1)), M.leafDark, x + 0.1 * s, FL + 0.78 * s, z - 0.05 * s);
    }
    function chair(x, z, rotY) {
      const g = group(x, z, rotY);
      soft(0.44, 0.05, 0.44, 0.015, M.oak, 0, FL + 0.46, 0, g);
      soft(0.44, 0.38, 0.04, 0.015, M.oak, 0, FL + 0.72, -0.2, g);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        cyl(0.018, 0.016, 0.44, M.oakDark, lx, FL + 0.22, lz, g, 8);
      }
    }

    function bedroom(cx, blankets) {
      const back = zi0 + TE / 2;
      bed(cx - 1.15, back + 1.08, blankets[0]);
      bed(cx + 1.15, back + 1.08, blankets[1]);
      nightstand(cx, back + 0.26);
      const oval = mesh(cached("oval", () => new THREE.CircleGeometry(0.42, 40)), M.rugBlue, cx, FL + 0.006, back + 1.35, house, false);
      oval.rotation.x = -Math.PI / 2;
      oval.scale.set(1, 1.5, 1);
    }
    // центры спален по внутренним граням стен
    bedroom(-3.715, [M.blanketSand, M.blanketBlue]);
    bedroom(0, [M.blanketSage, M.blanketSand]);
    bedroom(3.715, [M.blanketBlue, M.blanketSage]);
    const wz = zB - TI / 2 - 0.3;
    wardrobe(-4.5, wz, 1.5, Math.PI);
    wardrobe(-1.0, wz, 1.5, Math.PI);
    wardrobe(4.55, wz, 1.5, Math.PI);

    // Общий зал: обеденный стол на 6 человек
    soft(1.8, 0.05, 0.9, 0.02, M.oak, -0.75, FL + 0.74, 0.75);
    for (const [lx, lz] of [[-1.55, 0.4], [0.05, 0.4], [-1.55, 1.1], [0.05, 1.1]]) {
      cyl(0.025, 0.022, 0.72, M.oakDark, lx, FL + 0.36, lz, house, 8);
    }
    for (const cx of [-1.35, -0.75, -0.15]) {
      chair(cx, 0.1, 0);
      chair(cx, 1.4, Math.PI);
    }
    // зона отдыха
    (function sofa() {
      const g = group(-1.0, zi1 - TE / 2 - 0.47, Math.PI);
      soft(2.2, 0.42, 0.92, 0.06, M.sofa, 0, FL + 0.21, 0, g);
      soft(1.02, 0.14, 0.7, 0.06, M.cushion, -0.52, FL + 0.48, 0.08, g);
      soft(1.02, 0.14, 0.7, 0.06, M.cushion, 0.52, FL + 0.48, 0.08, g);
      soft(2.2, 0.48, 0.22, 0.08, M.sofa, 0, FL + 0.62, -0.35, g);
      soft(0.18, 0.62, 0.92, 0.06, M.sofa, -1.1, FL + 0.31, 0, g);
      soft(0.18, 0.62, 0.92, 0.06, M.sofa, 1.1, FL + 0.31, 0, g);
    })();
    rug(2.6, 1.7, M.rug, -1.0, 3.0);
    soft(1.0, 0.05, 0.55, 0.02, M.oak, -1.0, FL + 0.4, 2.75);
    soft(0.9, 0.36, 0.45, 0.02, M.oakDark, -1.0, FL + 0.19, 2.75);
    (function armchair() {
      const g = group(0.25, 2.75, -Math.PI / 2);
      soft(0.82, 0.4, 0.8, 0.06, M.cushion, 0, FL + 0.2, 0, g);
      soft(0.82, 0.45, 0.18, 0.06, M.cushion, 0, FL + 0.6, -0.31, g);
      soft(0.14, 0.55, 0.8, 0.05, M.cushion, -0.34, FL + 0.28, 0, g);
      soft(0.14, 0.55, 0.8, 0.05, M.cushion, 0.34, FL + 0.28, 0, g);
    })();
    plant(-2.55, 3.9);

    // Кухня
    (function kitchen() {
      const xr = xi1 - TE / 2; // внутренняя грань правой стены
      const cx = xr - 0.31;
      soft(0.6, 0.86, 3.0, 0.01, M.fronts, cx, FL + 0.43, 1.35);
      box(0.64, 0.04, 3.02, M.counter, cx - 0.01, FL + 0.88, 1.35);
      for (let i = 1; i < 5; i++) box(0.01, 0.78, 0.01, M.counter, cx - 0.305, FL + 0.43, 1.35 - 1.5 + i * 0.6);
      // индукционная плита
      box(0.52, 0.012, 0.56, M.black, cx - 0.02, FL + 0.906, 0.35);
      for (const [dx, dz, r] of [[-0.12, -0.12, 0.09], [0.12, -0.12, 0.07], [-0.12, 0.13, 0.07], [0.12, 0.13, 0.09]]) {
        const ring = new THREE.Mesh(cached(`ring${r}`, () => new THREE.RingGeometry(r - 0.006, r, 32)), M.steel);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx - 0.02 + dx, FL + 0.913, 0.35 + dz);
        house.add(ring);
      }
      // мойка
      box(0.4, 0.012, 0.5, M.steel, cx - 0.02, FL + 0.905, 2.0);
      cyl(0.015, 0.015, 0.26, M.steel, cx + 0.2, FL + 1.03, 2.0, house, 8);
      // холодильник
      soft(0.66, 1.85, 0.66, 0.03, M.white, cx + 0.0, FL + 0.925, 3.55);
      box(0.02, 0.5, 0.03, M.steel, cx - 0.34, FL + 1.25, 3.3);
      // столешница у фасада
      const zf = zi1 - TE / 2 - 0.31;
      soft(1.5, 0.86, 0.6, 0.01, M.fronts, 3.95, FL + 0.43, zf);
      box(1.52, 0.04, 0.64, M.counter, 3.95, FL + 0.88, zf + 0.01);
      // небольшой стол на двоих
      cyl(0.36, 0.36, 0.04, M.oak, 3.75, FL + 0.74, 1.6, house, 28);
      cyl(0.04, 0.12, 0.72, M.oakDark, 3.75, FL + 0.36, 1.6, house, 12);
      chair(3.75, 1.0, 0);
      chair(3.75, 2.2, Math.PI);
    })();

    // Санузел 1 (у прихожей): душ без порога, унитаз, раковина
    (function bath1() {
      const zb = zB + TI / 2;
      floorPlane(1.0, 1.0, M.tileDark, 1.2, xi0 + TE / 2 + 0.55, FL + 0.005, zb + 0.6);
      box(1.0, 1.9, 0.02, M.showerGlass, xi0 + TE / 2 + 0.55, FL + 0.95, zb + 1.12).castShadow = false;
      cyl(0.015, 0.015, 0.6, M.steel, xi0 + TE / 2 + 0.03, FL + 0.95, zb + 0.6, house, 8).rotation.x = Math.PI / 2;
      soft(0.38, 0.4, 0.5, 0.06, M.white, xL - TI / 2 - 0.3, FL + 0.2, zb + 0.35);
      soft(0.38, 0.32, 0.16, 0.03, M.white, xL - TI / 2 - 0.3, FL + 0.56, zb + 0.08);
      soft(0.52, 0.14, 0.42, 0.04, M.white, -3.95, FL + 0.82, zb + 0.22);
      box(0.6, 0.7, 0.02, M.mirror, -3.95, FL + 1.4, zb + 0.01);
    })();

    // Санузел 2: душ, унитаз, раковина, стиральная машина
    (function bath2() {
      const xl = xB2 + TI / 2;
      const xr = xK - TI / 2;
      const zt = zM + TI / 2;
      const zf = zi1 - TE / 2;
      floorPlane(0.95, 0.95, M.tileDark, 1.2, xr - 0.5, FL + 0.005, zf - 0.5);
      box(0.02, 1.9, 0.95, M.showerGlass, xr - 0.98, FL + 0.95, zf - 0.5).castShadow = false;
      soft(0.38, 0.4, 0.5, 0.06, M.white, xr - 0.3, FL + 0.2, zt + 0.4).rotation.y = -Math.PI / 2;
      soft(0.16, 0.32, 0.38, 0.03, M.white, xr - 0.08, FL + 0.56, zt + 0.4);
      soft(0.5, 0.14, 0.4, 0.04, M.white, xl + 0.55, FL + 0.82, zt + 0.22);
      box(0.55, 0.65, 0.02, M.mirror, xl + 0.55, FL + 1.4, zt + 0.01);
      soft(0.6, 0.85, 0.58, 0.03, M.white, xl + 0.35, FL + 0.425, zf - 0.32);
      const porthole = new THREE.Mesh(cached("port", () => new THREE.CircleGeometry(0.17, 32)), M.frame);
      porthole.position.set(xl + 0.66, FL + 0.48, zf - 0.32);
      porthole.rotation.y = Math.PI / 2;
      house.add(porthole);
    })();

    // Прихожая: шкаф и скамья
    wardrobe(-4.98, zM + TI / 2 + 0.3, 0.9, 0);
    soft(0.4, 0.45, 1.0, 0.04, M.oak, xi0 + TE / 2 + 0.22, FL + 0.225, 3.45);

    /* ---------------- Терраса и пандус ---------------- */
    const tz0 = Z1, tz1 = 6.0, tx0 = -5.68, tx1 = -1.53;
    box(tx1 - tx0, FL, tz1 - tz0, M.plinth, (tx0 + tx1) / 2, FL / 2, (tz0 + tz1) / 2);
    floorPlane(tx1 - tx0, tz1 - tz0, M.deck, 2, (tx0 + tx1) / 2, FL + 0.002, (tz0 + tz1) / 2);
    for (const px of [tx0 + 0.08, tx1 - 0.08]) box(0.12, 2.3, 0.12, M.oakDark, px, FL + 1.15, tz1 - 0.08);
    box(tx1 - tx0, 0.14, 0.1, M.oakDark, (tx0 + tx1) / 2, FL + 2.3, tz1 - 0.08);
    box(tx1 - tx0, 0.14, 0.1, M.oakDark, (tx0 + tx1) / 2, FL + 2.3, tz0 + 0.12);
    for (let x = tx0 + 0.15; x < tx1 - 0.05; x += 0.32) box(0.05, 0.1, tz1 - tz0, M.oak, x, FL + 2.42, (tz0 + tz1) / 2);
    soft(1.4, 0.42, 0.42, 0.04, M.oak, -2.45, FL + 0.21, 5.55);
    cyl(0.32, 0.32, 0.04, M.oak, -5.15, FL + 0.7, 5.25, house, 24);
    cyl(0.035, 0.035, 0.68, M.oakDark, -5.15, FL + 0.34, 5.25, house, 8);
    chair(-5.15, 4.68, 0);
    plant(-1.85, 4.55, 0.9);

    // Пандус 1:20 и поручни
    const rampLen = 2.4;
    const rampAngle = Math.atan(FL / rampLen);
    const ramp = mesh(boxGeo(1.5, 0.06, rampLen), M.paving, -3.7, FL / 2, tz1 + rampLen / 2);
    ramp.rotation.x = rampAngle;
    for (const rx of [-4.5, -2.9]) {
      for (let i = 0; i <= 3; i++) {
        const z = tz1 + 0.1 + (i * (rampLen - 0.2)) / 3;
        cyl(0.02, 0.02, 0.9, M.steel, rx, 0.45 + FL * (1 - (z - tz1) / rampLen), z, house, 8);
      }
      const rail = cyl(0.025, 0.025, rampLen, M.steel, rx, 0.9 + FL / 2, tz1 + rampLen / 2, house, 8);
      rail.rotation.x = Math.PI / 2 + rampAngle;
    }

    /* ---------------- Подписи комнат ---------------- */
    const ROOMS = [
      { name: "Спальня", area: "14,5 м²", p: [-3.72, 2.75, -2.4], rank: 6 },
      { name: "Спальня", area: "14,5 м²", p: [0, 2.75, -2.4], rank: 3 },
      { name: "Спальня", area: "14,5 м²", p: [3.72, 2.75, -2.4], rank: 7 },
      { name: "Общий зал", area: "24 м²", p: [-0.75, 2.75, 1.7], rank: 1 },
      { name: "Кухня", area: "11,5 м²", p: [4.3, 2.75, 1.4], rank: 2 },
      { name: "Санузел", area: "4,5 м²", p: [-4.3, 2.75, 0.7], rank: 8 },
      { name: "Санузел", area: "4,0 м²", p: [1.9, 2.75, 3.0], rank: 5 },
      { name: "Прихожая", area: "7,5 м²", p: [-4.3, 2.75, 3.1], rank: 9 },
      { name: "Терраса", area: "8 м²", p: [-3.6, 2.95, 5.2], rank: 4 }
    ];
    const labels = ROOMS.map((r) => {
      const el = document.createElement("span");
      el.className = "lbl";
      el.innerHTML = `<b>${r.name}</b> <span>${r.area}</span>`;
      labelsLayer.appendChild(el);
      return { el, v: new THREE.Vector3(...r.p), rank: r.rank };
    });

    /* ---------------- Камера и виды ---------------- */
    const VIEWS = {
      all: {
        theta: -0.5, phi: 0.82, radius: 17, target: [0, -0.4, 0.9],
        text: "Дом на 6 человек: три спальни на двоих, общий зал, кухня, два санузла, прихожая и терраса с пандусом."
      },
      bedroom: {
        theta: 0.28, phi: 0.66, radius: 7.4, target: [0, 0.4, -2.3],
        text: "Спальня на двоих, 14,5 м²: обычные кровати, тумбочка с лампой, шкаф и окно. Таких спален в доме три."
      },
      living: {
        theta: -0.2, phi: 0.55, radius: 10.5, target: [0.4, 0.1, 2.0],
        text: "Общий зал 24 м²: стол на 6 человек и зона отдыха. Кухня открыта в зал, плита индукционная, газа нет."
      },
      bath: {
        theta: 0.0, phi: 0.22, radius: 7.5, target: [1.7, 0.1, 2.75],
        text: "Санузел 4,0 м²: душ без порога, поручни, стиральная машина. Второй санузел, 4,5 м², находится у прихожей."
      },
      entry: {
        theta: -0.55, phi: 0.66, radius: 9.5, target: [-3.7, 0.2, 4.4],
        text: "Вход без ступеней: крытая терраса со скамьёй и пологий пандус 1:20 с поручнями. За дверью прихожая со шкафом."
      }
    };

    const cam = { theta: 0, phi: 0, radius: 0, target: new THREE.Vector3() };
    const goal = { theta: 0, phi: 0, radius: 0, target: new THREE.Vector3() };
    let currentView = "all";
    let interacted = false;

    function fitFactor() {
      const aspect = camera.aspect || 16 / 9;
      return aspect < 1.3 ? 1.22 : aspect < 1.6 ? 1.08 : 1;
    }

    function setView(key, immediate = false) {
      const v = VIEWS[key];
      if (!v) return;
      currentView = key;
      goal.theta = v.theta;
      goal.phi = v.phi;
      goal.radius = v.radius * fitFactor();
      goal.target.set(...v.target);
      if (immediate || reducedMotion) {
        cam.theta = goal.theta;
        cam.phi = goal.phi;
        cam.radius = goal.radius;
        cam.target.copy(goal.target);
      }
      viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === key)));
      if (caption) caption.textContent = v.text;
    }

    function markInteracted() {
      if (interacted) return;
      interacted = true;
      if (hint) hint.classList.add("is-hidden");
    }

    viewButtons.forEach((b) =>
      b.addEventListener("click", () => {
        markInteracted();
        setView(b.dataset.view);
      })
    );
    zoomButtons.forEach((b) =>
      b.addEventListener("click", () => {
        markInteracted();
        goal.radius = THREE.MathUtils.clamp(goal.radius * (b.dataset.zoom === "in" ? 0.8 : 1.25), 4, 32);
      })
    );

    /* ---------------- Управление мышью и пальцем ---------------- */
    const el = renderer.domElement;
    const pointers = new Map();
    let pinchDist = null;
    let dragging = false;
    let engaged = false;
    let lastX = 0;
    let lastY = 0;

    el.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });
      if (pointers.size === 1) {
        dragging = true;
        engaged = e.pointerType === "mouse";
        lastX = e.clientX;
        lastY = e.clientY;
        if (engaged) el.setPointerCapture(e.pointerId);
      } else if (pointers.size === 2) {
        dragging = false;
        const [a, b] = Array.from(pointers.values());
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });

    el.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist) goal.radius = THREE.MathUtils.clamp(goal.radius * (pinchDist / d), 4, 32);
        pinchDist = d;
        markInteracted();
        return;
      }
      if (!dragging) return;
      if (!engaged) {
        // на телефоне вертикальный жест оставляем странице (прокрутка)
        const dx = Math.abs(e.clientX - p.sx);
        const dy = Math.abs(e.clientY - p.sy);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) {
          dragging = false;
          return;
        }
        engaged = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      const dx = e.clientX - lastX;
      const dy = e.pointerType === "mouse" ? e.clientY - lastY : 0;
      lastX = e.clientX;
      lastY = e.clientY;
      goal.theta -= dx * 0.008;
      goal.phi = THREE.MathUtils.clamp(goal.phi - dy * 0.006, 0.32, 1.3);
      markInteracted();
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = null;
      if (pointers.size === 0) {
        dragging = false;
        engaged = false;
      }
    }
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", endPointer);
    el.addEventListener("lostpointercapture", endPointer);

    /* ---------------- Размер, отрисовка ---------------- */
    let W = 800;
    let Hh = 450;
    function resize() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width;
      Hh = r.height;
      renderer.setSize(W, Hh, false);
      camera.aspect = W / Hh;
      camera.updateProjectionMatrix();
      const v = VIEWS[currentView];
      goal.radius = v.radius * fitFactor();
    }
    new ResizeObserver(resize).observe(stage);
    resize();
    setView("all", true);

    const tmp = new THREE.Vector3();
    let compact = null;
    function placeLabels() {
      const wantCompact = W < 640;
      if (wantCompact !== compact) {
        compact = wantCompact;
        labels.forEach((l) => {
          l.el.classList.toggle("is-compact", compact);
          l.el.style.display = "";
          l.w = l.el.offsetWidth;
          l.h = l.el.offsetHeight;
        });
      }
      // важные подписи ставим первыми; перекрывающиеся прячем
      const placed = [];
      const items = labels
        .map((l) => {
          tmp.copy(l.v).project(camera);
          return { l, x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * Hh, z: tmp.z };
        })
        .sort((a, b) => a.l.rank - b.l.rank);
      for (const it of items) {
        const { l, x, y, z } = it;
        const halfW = l.w / 2 + 3;
        const halfH = l.h / 2 + 2;
        const outside = z > 1 || x - halfW < 2 || x + halfW > W - 2 || y - halfH < 2 || y + halfH > Hh - 2;
        const clash = placed.some((p) => Math.abs(p.x - x) < p.hw + halfW && Math.abs(p.y - y) < p.hh + halfH);
        if (outside || clash) {
          l.el.style.visibility = "hidden";
          continue;
        }
        placed.push({ x, y, hw: halfW, hh: halfH });
        l.el.style.visibility = "";
        l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      }
    }

    function applyCamera() {
      const s = Math.sin(cam.phi);
      camera.position.set(
        cam.target.x + cam.radius * s * Math.sin(cam.theta),
        cam.target.y + cam.radius * Math.cos(cam.phi),
        cam.target.z + cam.radius * s * Math.cos(cam.theta)
      );
      camera.lookAt(cam.target);
    }

    let visible = true;
    let raf = null;
    let lastT = performance.now();
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && raf === null) {
        lastT = performance.now();
        loop();
      }
    }).observe(stage);

    function loop() {
      if (!visible) {
        raf = null;
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (!interacted && !reducedMotion && currentView === "all") goal.theta += dt * 0.12;
      const k = reducedMotion ? 1 : 1 - Math.pow(0.0015, dt);
      cam.theta += (goal.theta - cam.theta) * k;
      cam.phi += (goal.phi - cam.phi) * k;
      cam.radius += (goal.radius - cam.radius) * k;
      cam.target.lerp(goal.target, k);
      applyCamera();
      renderer.render(scene, camera);
      placeLabels();
      raf = requestAnimationFrame(loop);
    }
    root.classList.add("is-ready");
    loop();
  }
})();
