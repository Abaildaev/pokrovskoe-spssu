/* ==========================================================================
   Покровский СПССУ — Интерактивный 3D-тур (Three.js WebGL)
   ========================================================================== */

(function () {
  "use strict";

  function initTour3D() {
    const wrap = document.getElementById("tour3d-canvas-wrap");
    const pinsLayer = document.getElementById("tour3d-pins");
    const infoBox = document.getElementById("tour3d-info");
    const sceneButtons = Array.from(document.querySelectorAll("[data-tour-scene]"));
    const viewButtons = Array.from(document.querySelectorAll("[data-tour-view]"));
    const lightButtons = Array.from(document.querySelectorAll("[data-tour-light]"));
    const zoomButtons = Array.from(document.querySelectorAll("[data-tour-zoom]"));
    const touchLockBtn = document.querySelector("[data-tour-touchlock]");
    const resetBtn = document.querySelector("[data-tour-reset]");

    if (!wrap || !pinsLayer || !infoBox || typeof window.THREE === "undefined") {
      if (wrap) {
        wrap.innerHTML =
          '<div style="padding:2rem;text-align:center;color:#4c5d75;">3D-просмотрщик недоступен: не загружен модуль WebGL.</div>';
      }
      return;
    }

    const THREE = window.THREE;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      wrap.innerHTML =
        '<div style="padding:2rem;text-align:center;color:#4c5d75;">WebGL не поддерживается данным браузером. Используйте поэтажные чертежи ниже.</div>';
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    wrap.insertBefore(renderer.domElement, pinsLayer);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9eef4);

    const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 120);

    // Lighting Setup
    const hemiLight = new THREE.HemisphereLight(0xf7fbff, 0x8d8578, 0.92);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff6ea, 1.35);
    sunLight.position.set(11, 16, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 45;
    sunLight.shadow.camera.left = -12;
    sunLight.shadow.camera.right = 12;
    sunLight.shadow.camera.top = 12;
    sunLight.shadow.camera.bottom = -12;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xd9e8f8, 0.42);
    fillLight.position.set(-10, 8, -8);
    scene.add(fillLight);

    // Interior warm lights (brighten in evening mode)
    const interiorLights = [];
    function addRoomLight(x, y, z, intensity = 0.55) {
      const pt = new THREE.PointLight(0xffdfb0, intensity, 10, 1.6);
      pt.position.set(x, y, z);
      scene.add(pt);
      interiorLights.push(pt);
      return pt;
    }

    // Shared Materials (Architectural Limestone, Oak, Navy, Terracotta, Glass)
    const M = {
      plinth: new THREE.MeshStandardMaterial({ color: 0xd3cec3, roughness: 0.9 }),
      oakFloor: new THREE.MeshStandardMaterial({ color: 0xcfa97e, roughness: 0.65 }),
      tileFloor: new THREE.MeshStandardMaterial({ color: 0xe6ecf0, roughness: 0.45 }),
      terraceWood: new THREE.MeshStandardMaterial({ color: 0xa47952, roughness: 0.78 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85 }),
      wallInner: new THREE.MeshStandardMaterial({ color: 0xfaf8f3, roughness: 0.85 }),
      wallAccent: new THREE.MeshStandardMaterial({ color: 0xdde6ef, roughness: 0.82 }),
      navy: new THREE.MeshStandardMaterial({ color: 0x1b324b, roughness: 0.6 }),
      slate: new THREE.MeshStandardMaterial({ color: 0x4e6e94, roughness: 0.55 }),
      sage: new THREE.MeshStandardMaterial({ color: 0x6f8c7a, roughness: 0.75 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0xb05b3c, roughness: 0.7 }),
      oakWood: new THREE.MeshStandardMaterial({ color: 0x9c724b, roughness: 0.62 }),
      darkWood: new THREE.MeshStandardMaterial({ color: 0x5c422c, roughness: 0.65 }),
      linen: new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.9 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xc2cbd4, metalness: 0.7, roughness: 0.28 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x222930, metalness: 0.45, roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0xa8cde8,
        transparent: true,
        opacity: 0.38,
        roughness: 0.15,
        metalness: 0.1
      }),
      lampGlow: new THREE.MeshStandardMaterial({
        color: 0xfff3d4,
        emissive: 0xffc978,
        emissiveIntensity: 0.65,
        roughness: 0.3
      }),
      induction: new THREE.MeshStandardMaterial({
        color: 0x181c20,
        emissive: 0xd94826,
        emissiveIntensity: 0.45,
        roughness: 0.25
      }),
      plantLeaf: new THREE.MeshStandardMaterial({ color: 0x4b7f52, roughness: 0.72 }),
      medWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }),
      medTeal: new THREE.MeshStandardMaterial({ color: 0x2d6d7e, roughness: 0.55 }),
      pingPongBlue: new THREE.MeshStandardMaterial({ color: 0x27578a, roughness: 0.5 })
    };

    // Geometry Helpers
    function box(w, h, d, mat, x, y, z, parent) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function cyl(rTop, rBot, h, seg, mat, x, y, z, parent) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addBed(x, z, rotY, blanketMat, parent) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      // Oak frame + headboard
      box(0.95, 0.28, 2.0, M.oakWood, 0, 0.14, 0, g);
      box(0.95, 0.72, 0.08, M.oakWood, 0, 0.36, -0.96, g);
      // Mattress
      box(0.88, 0.16, 1.9, M.linen, 0, 0.34, 0.02, g);
      // Folded blanket
      box(0.9, 0.08, 1.15, blanketMat, 0, 0.43, 0.35, g);
      // Pillow
      box(0.62, 0.11, 0.38, M.linen, 0, 0.46, -0.68, g);
      parent.add(g);
    }

    function addWardrobe(x, z, rotY, parent) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      box(0.95, 1.9, 0.55, M.oakWood, 0, 0.95, 0, g);
      box(0.02, 1.82, 0.02, M.darkWood, 0, 0.95, 0.28, g);
      parent.add(g);
    }

    function addNightstandLamp(x, z, parent) {
      box(0.45, 0.48, 0.42, M.oakWood, x, 0.24, z, parent);
      cyl(0.03, 0.05, 0.16, 10, M.darkWood, x, 0.56, z, parent);
      cyl(0.11, 0.15, 0.18, 14, M.lampGlow, x, 0.7, z, parent);
    }

    function addPlant(x, z, parent) {
      cyl(0.18, 0.14, 0.32, 12, M.terracotta, x, 0.16, z, parent);
      const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), M.plantLeaf);
      leaves.position.set(x, 0.5, z);
      leaves.castShadow = true;
      parent.add(leaves);
    }

    function addWallWithWindow(x, z, len, isHorizontal, h, t, parent) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      if (!isHorizontal) g.rotation.y = Math.PI / 2;
      const sideLen = (len - 1.5) / 2;
      if (sideLen > 0.1) {
        box(sideLen, h, t, M.wall, -len / 2 + sideLen / 2, h / 2, 0, g);
        box(sideLen, h, t, M.wall, len / 2 - sideLen / 2, h / 2, 0, g);
      }
      // Sill + top header + glass
      box(1.5, 0.85, t, M.wall, 0, 0.425, 0, g);
      box(1.5, Math.max(0.25, h - 2.05), t, M.wall, 0, h - Math.max(0.25, h - 2.05) / 2, 0, g);
      box(1.46, 1.18, 0.04, M.glass, 0, 1.45, 0, g);
      parent.add(g);
    }

    // Scene Containers
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Build Model 1: 95 sq.m Typical Family House (used for dollhouse, living-360, bedroom-360)
    function buildFamilyHouse(fullCeiling) {
      rootGroup.clear();
      interiorLights.length = 0;

      const W = 11.5;
      const D = 8.5;
      const H = fullCeiling ? 2.8 : 2.35;
      const T = 0.18;

      // Ground surround & Plinth
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 42),
        new THREE.MeshStandardMaterial({ color: 0xe4e9ee, roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.08;
      ground.receiveShadow = true;
      rootGroup.add(ground);

      box(W + 0.6, 0.16, D + 0.6, M.plinth, 0, -0.02, 0, rootGroup);

      // Floors per zone
      box(3.7, 0.04, 8.3, M.oakFloor, -3.85, 0.08, 0, rootGroup); // Left bedrooms
      box(4.0, 0.04, 8.3, M.oakFloor, 0.0, 0.08, 0, rootGroup); // Center hall + entry
      box(3.6, 0.04, 5.9, M.oakFloor, 3.85, 0.08, -1.2, rootGroup); // Bedroom 3 + kitchen
      box(3.6, 0.04, 2.35, M.tileFloor, 3.85, 0.085, 3.0, rootGroup); // Bathrooms

      // Exterior Perimeter Walls (Back, Left, Right, Front with entry gap)
      addWallWithWindow(-3.8, -D / 2, 3.8, true, H, T, rootGroup);
      addWallWithWindow(0.0, -D / 2, 3.9, true, H, T, rootGroup);
      addWallWithWindow(3.8, -D / 2, 3.8, true, H, T, rootGroup);

      addWallWithWindow(-W / 2, -2.1, 4.2, false, H, T, rootGroup);
      addWallWithWindow(-W / 2, 2.1, 4.2, false, H, T, rootGroup);

      addWallWithWindow(W / 2, -2.1, 4.2, false, H, T, rootGroup);
      box(T, H, 4.25, M.wall, W / 2, H / 2, 2.12, rootGroup);

      // Front wall (with wide barrier-free doorway centered at x=0)
      addWallWithWindow(-3.8, D / 2, 3.8, true, H, T, rootGroup);
      box(1.3, H, T, M.wall, -1.35, H / 2, D / 2, rootGroup);
      box(1.3, H, T, M.wall, 1.35, H / 2, D / 2, rootGroup);
      box(1.4, 0.45, T, M.wall, 0, H - 0.225, D / 2, rootGroup); // Door lintel
      addWallWithWindow(3.8, D / 2, 3.8, true, H, T, rootGroup);

      // Interior Partitions (with doorway openings)
      // Left partition x = -2.0
      box(0.14, H, 2.0, M.wallInner, -2.0, H / 2, -3.2, rootGroup);
      box(0.14, H, 1.8, M.wallInner, -2.0, H / 2, -0.3, rootGroup);
      box(0.14, H, 2.0, M.wallInner, -2.0, H / 2, 3.2, rootGroup);
      // Divider between Bedroom 1 & Bedroom 2
      box(3.6, H, 0.14, M.wallInner, -3.85, H / 2, 0.0, rootGroup);

      // Right partition x = 2.0 (Bedroom 3, Open Kitchen, Bathrooms)
      box(0.14, H, 1.8, M.wallInner, 2.0, H / 2, -3.25, rootGroup);
      box(0.14, H, 1.6, M.wallInner, 2.0, H / 2, 2.6, rootGroup);
      // Divider between Bedroom 3 & Kitchen (z = -0.8)
      box(3.6, H, 0.14, M.wallInner, 3.85, H / 2, -0.8, rootGroup);
      // Divider between Kitchen & Bathrooms (z = 1.8)
      box(3.6, H, 0.14, M.wallInner, 3.85, H / 2, 1.8, rootGroup);
      // Divider between Bathroom 1 & Bathroom 2 (x = 3.85)
      box(0.12, H, 2.35, M.wallInner, 3.85, H / 2, 3.0, rootGroup);

      // Entry Vestibule divider (z = 2.0)
      box(1.2, H, 0.14, M.wallInner, -1.4, H / 2, 2.0, rootGroup);
      box(1.2, H, 0.14, M.wallInner, 1.4, H / 2, 2.0, rootGroup);

      if (fullCeiling) {
        box(W, 0.12, D, M.wallInner, 0, H + 0.06, 0, rootGroup);
      }

      // --- Furniture: Bedroom 1 (Top-Left: x -5.5..-2.1, z -4.1..-0.1) ---
      addBed(-4.65, -2.85, 0, M.terracotta, rootGroup);
      addBed(-2.95, -2.85, 0, M.slate, rootGroup);
      addNightstandLamp(-3.8, -3.7, rootGroup);
      addWardrobe(-5.1, -0.65, Math.PI / 2, rootGroup);
      addWardrobe(-2.55, -0.65, -Math.PI / 2, rootGroup);
      box(1.0, 0.74, 0.55, M.oakWood, -3.8, 0.37, -0.45, rootGroup); // Desk

      // --- Furniture: Bedroom 2 (Bottom-Left: x -5.5..-2.1, z 0.1..4.1) ---
      addBed(-4.65, 2.85, Math.PI, M.sage, rootGroup);
      addBed(-2.95, 2.85, Math.PI, M.terracotta, rootGroup);
      addNightstandLamp(-3.8, 3.7, rootGroup);
      addWardrobe(-5.1, 0.65, Math.PI / 2, rootGroup);
      addWardrobe(-2.55, 0.65, -Math.PI / 2, rootGroup);

      // --- Furniture: Bedroom 3 (Top-Right: x 2.1..5.5, z -4.1..-0.9) ---
      addBed(2.95, -2.85, 0, M.slate, rootGroup);
      addBed(4.65, -2.85, 0, M.sage, rootGroup);
      addNightstandLamp(3.8, -3.7, rootGroup);
      addWardrobe(5.1, -1.35, -Math.PI / 2, rootGroup);

      // --- Furniture: Living & Dining Hall (Center: x -1.9..1.9, z -4.1..1.9) ---
      // Dining table for 6
      box(1.9, 0.06, 1.0, M.oakWood, 0, 0.75, -2.4, rootGroup);
      for (const cx of [-0.65, 0, 0.65]) {
        for (const cz of [-3.1, -1.7]) {
          box(0.42, 0.45, 0.42, M.oakWood, cx, 0.225, cz, rootGroup);
          box(0.42, 0.42, 0.06, M.oakWood, cx, 0.65, cz + (cz < -2.4 ? -0.18 : 0.18), rootGroup);
        }
      }
      // Rug + Sofa + Coffee Table
      box(2.5, 0.02, 2.0, M.wallAccent, -0.1, 0.11, 0.2, rootGroup);
      box(2.1, 0.42, 0.85, M.sage, -0.2, 0.3, -0.1, rootGroup);
      box(2.1, 0.38, 0.18, M.sage, -0.2, 0.62, -0.45, rootGroup);
      box(0.95, 0.05, 0.55, M.oakWood, -0.2, 0.38, 0.82, rootGroup);
      addPlant(-1.5, -3.6, rootGroup);
      addPlant(1.5, -3.6, rootGroup);

      // --- Furniture: Safe Kitchen Niche (Right-Mid: x 2.1..5.5, z -0.7..1.7) ---
      box(0.65, 0.88, 2.1, M.linen, 5.25, 0.44, 0.4, rootGroup); // Counter base
      box(0.68, 0.05, 2.12, M.plinth, 5.25, 0.9, 0.4, rootGroup); // Countertop
      // Glowing 4-zone Induction Cooktop (no open gas!)
      box(0.56, 0.03, 0.65, M.induction, 5.22, 0.93, 0.15, rootGroup);
      // Fridge
      box(0.7, 1.85, 0.7, M.chrome, 5.22, 0.925, -0.35, rootGroup);

      // --- Furniture: 2 Barrier-Free Bathrooms (Right-Front: x 2.1..5.5, z 1.9..4.1) ---
      // Bathroom 1 (Roll-in shower with glass + grab rail + toilet)
      box(1.0, 0.02, 1.0, M.medTeal, 2.65, 0.11, 3.55, rootGroup); // Drain zone
      box(0.04, 1.9, 1.0, M.glass, 3.15, 1.05, 3.55, rootGroup);
      box(0.45, 0.42, 0.55, M.medWhite, 2.5, 0.28, 2.35, rootGroup); // Toilet 1
      box(0.55, 0.14, 0.42, M.medWhite, 3.35, 0.78, 2.25, rootGroup); // Sink 1
      // Bathroom 2 + Washing Machine
      box(0.62, 0.85, 0.62, M.medWhite, 5.15, 0.44, 3.65, rootGroup); // Washer
      box(0.45, 0.42, 0.55, M.medWhite, 4.35, 0.28, 2.35, rootGroup); // Toilet 2
      box(0.55, 0.14, 0.42, M.medWhite, 5.15, 0.78, 2.25, rootGroup); // Sink 2

      // --- Front Covered Terrace + 1:20 Barrier-Free Ramp ---
      box(6.4, 0.14, 2.1, M.terraceWood, 0, 0.08, 5.3, rootGroup);
      // Terrace porch posts & benches
      for (const px of [-2.9, 2.9]) {
        box(0.14, 2.3, 0.14, M.darkWood, px, 1.2, 6.2, rootGroup);
      }
      box(1.5, 0.42, 0.45, M.oakWood, -1.8, 0.28, 5.6, rootGroup);
      box(1.5, 0.42, 0.45, M.oakWood, 1.8, 0.28, 5.6, rootGroup);
      // Gentle Ramp 1:20
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 2.6), M.plinth);
      ramp.position.set(0, -0.02, 7.55);
      ramp.rotation.x = 0.065;
      ramp.receiveShadow = true;
      rootGroup.add(ramp);
      // Ramp safety railings
      box(0.05, 0.85, 2.5, M.chrome, -0.82, 0.42, 7.5, rootGroup);
      box(0.05, 0.85, 2.5, M.chrome, 0.82, 0.42, 7.5, rootGroup);

      // Room Lights
      addRoomLight(0, H - 0.2, -1.2, 0.7);
      addRoomLight(-3.8, H - 0.2, -2.1, 0.5);
      addRoomLight(-3.8, H - 0.2, 2.1, 0.45);
      addRoomLight(3.8, H - 0.2, -2.2, 0.5);
      addRoomLight(3.8, H - 0.2, 0.6, 0.5);
    }

    // Build Model 2: Dormitory Block 1 (Litera A, 1st floor: Medpoint Left Wing + Rehab/LFK)
    function buildBlock1() {
      rootGroup.clear();
      interiorLights.length = 0;

      const W = 13.0;
      const D = 7.4;
      const H = 2.45;
      const T = 0.2;

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 42),
        new THREE.MeshStandardMaterial({ color: 0xe4e9ee, roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.08;
      ground.receiveShadow = true;
      rootGroup.add(ground);

      box(W + 0.5, 0.16, D + 0.5, M.plinth, 0, -0.02, 0, rootGroup);
      // Floors: Left Wing Medpoint (tile), Right Wing Rehab/LFK (oak)
      box(6.4, 0.04, D - 0.2, M.tileFloor, -3.2, 0.08, 0, rootGroup);
      box(6.4, 0.04, D - 0.2, M.oakFloor, 3.2, 0.08, 0, rootGroup);

      // Exterior Cutaway Walls
      addWallWithWindow(-3.2, -D / 2, 6.4, true, H, T, rootGroup);
      addWallWithWindow(3.2, -D / 2, 6.4, true, H, T, rootGroup);
      addWallWithWindow(-W / 2, 0, D, false, H, T, rootGroup);
      addWallWithWindow(W / 2, 0, D, false, H, T, rootGroup);
      box(5.6, H, T, M.wall, -3.6, H / 2, D / 2, rootGroup);
      box(5.6, H, T, M.wall, 3.6, H / 2, D / 2, rootGroup);

      // Divider between Left Wing (Medpoint) and Rehab/LFK
      box(0.16, H, 2.5, M.wallInner, 0, H / 2, -2.35, rootGroup);
      box(0.16, H, 2.5, M.wallInner, 0, H / 2, 2.35, rootGroup);
      // Sub-partitions inside Medpoint (Procedure Room vs Isolator vs Doctor Office)
      box(6.3, H, 0.14, M.wallInner, -3.25, H / 2, 0, rootGroup);
      box(0.14, H, 3.5, M.wallInner, -3.2, H / 2, -1.8, rootGroup);

      // --- Left Wing: Medpoint ---
      // 1. Procedure Room (top-left)
      box(2.0, 0.65, 0.85, M.medWhite, -5.0, 0.35, -2.2, rootGroup); // Exam couch
      box(2.0, 0.12, 0.85, M.medTeal, -5.0, 0.72, -2.2, rootGroup);
      box(1.1, 1.7, 0.45, M.medWhite, -4.4, 0.85, -3.25, rootGroup); // Sterile cabinet
      box(0.7, 0.8, 0.5, M.chrome, -3.8, 0.4, -2.2, rootGroup); // Medical trolley

      // 2. Isolator (top-center-left)
      addBed(-1.7, -2.2, 0, M.medTeal, rootGroup);
      addNightstandLamp(-2.55, -3.0, rootGroup);

      // 3. Doctor / Psychiatrist Offices (bottom-left)
      box(1.5, 0.74, 0.8, M.oakWood, -3.5, 0.37, 2.0, rootGroup);
      box(0.55, 0.48, 0.55, M.navy, -3.5, 0.24, 2.8, rootGroup);
      box(0.55, 0.48, 0.55, M.slate, -3.5, 0.24, 1.2, rootGroup);
      addPlant(-5.8, 2.9, rootGroup);

      // --- Right Wing: Rehabilitation Center & LFK Fitness ---
      // Wooden Wall Bars along back wall
      for (const wx of [1.8, 3.0, 4.2]) {
        box(0.9, 2.2, 0.12, M.oakWood, wx, 1.15, -3.42, rootGroup);
      }
      // Exercise Bikes (2x)
      for (const bx of [2.0, 3.8]) {
        box(0.55, 0.12, 1.25, M.darkMetal, bx, 0.14, -1.2, rootGroup);
        cyl(0.32, 0.32, 0.08, 16, M.darkMetal, bx, 0.45, -1.4, rootGroup);
        box(0.12, 0.95, 0.12, M.chrome, bx, 0.65, -0.75, rootGroup);
        box(0.28, 0.1, 0.28, M.navy, bx, 0.82, -1.45, rootGroup);
      }
      // Treadmill & Verticalizer
      box(0.9, 0.18, 1.9, M.darkMetal, 5.2, 0.14, -1.2, rootGroup);
      box(0.9, 1.1, 0.12, M.chrome, 5.2, 0.65, -2.05, rootGroup);
      // Exercise Mats & Therapy Balls
      box(1.2, 0.06, 2.0, M.medTeal, 2.3, 0.11, 1.7, rootGroup);
      box(1.2, 0.06, 2.0, M.slate, 3.8, 0.11, 1.7, rootGroup);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), M.terracotta);
      ball.position.set(5.2, 0.42, 1.8);
      ball.castShadow = true;
      rootGroup.add(ball);

      addRoomLight(-3.5, H - 0.2, -1.8, 0.65);
      addRoomLight(-3.5, H - 0.2, 1.8, 0.65);
      addRoomLight(3.4, H - 0.2, 0, 0.75);
    }

    // Build Model 3: Dormitory Block 2 (Litera A1, 1st floor: Playrooms + Social Pedagogues)
    function buildBlock2() {
      rootGroup.clear();
      interiorLights.length = 0;

      const W = 12.2;
      const D = 7.2;
      const H = 2.45;
      const T = 0.2;

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 42),
        new THREE.MeshStandardMaterial({ color: 0xe4e9ee, roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.08;
      ground.receiveShadow = true;
      rootGroup.add(ground);

      box(W + 0.5, 0.16, D + 0.5, M.plinth, 0, -0.02, 0, rootGroup);
      box(W - 0.2, 0.04, D - 0.2, M.oakFloor, 0, 0.08, 0, rootGroup);

      // Exterior Cutaway Walls
      addWallWithWindow(-3.0, -D / 2, 6.0, true, H, T, rootGroup);
      addWallWithWindow(3.0, -D / 2, 6.0, true, H, T, rootGroup);
      addWallWithWindow(-W / 2, 0, D, false, H, T, rootGroup);
      addWallWithWindow(W / 2, 0, D, false, H, T, rootGroup);
      box(5.0, H, T, M.wall, -3.5, H / 2, D / 2, rootGroup);
      box(5.0, H, T, M.wall, 3.5, H / 2, D / 2, rootGroup);

      // Divider between Playrooms/Sensory (left) & Social Pedagogues/Psychologist (right)
      box(0.16, H, 2.3, M.wallInner, 1.4, H / 2, -2.35, rootGroup);
      box(0.16, H, 2.3, M.wallInner, 1.4, H / 2, 2.35, rootGroup);

      // --- Left Zone: Playrooms, Table Tennis, Chess & Sensory Room ---
      // Table Tennis Table
      box(1.5, 0.06, 2.7, M.pingPongBlue, -3.6, 0.76, -1.4, rootGroup);
      box(0.1, 0.74, 0.1, M.darkMetal, -4.2, 0.37, -2.5, rootGroup);
      box(0.1, 0.74, 0.1, M.darkMetal, -3.0, 0.37, -2.5, rootGroup);
      box(0.1, 0.74, 0.1, M.darkMetal, -4.2, 0.37, -0.3, rootGroup);
      box(0.1, 0.74, 0.1, M.darkMetal, -3.0, 0.37, -0.3, rootGroup);
      box(1.54, 0.15, 0.03, M.linen, -3.6, 0.86, -1.4, rootGroup); // Net

      // 2 Chess / Board-game tables
      for (const tx of [-4.2, -1.8]) {
        box(1.05, 0.06, 1.05, M.oakWood, tx, 0.74, 1.75, rootGroup);
        box(0.65, 0.03, 0.65, M.darkWood, tx, 0.78, 1.75, rootGroup); // Chessboard
        box(0.42, 0.45, 0.42, M.sage, tx - 0.72, 0.24, 1.75, rootGroup);
        box(0.42, 0.45, 0.42, M.terracotta, tx + 0.72, 0.24, 1.75, rootGroup);
      }

      // Sensory Corner (soft poufs & warm floor rug)
      box(2.1, 0.03, 2.2, M.wallAccent, -0.1, 0.11, -2.1, rootGroup);
      for (const [px, pz, pm] of [
        [-0.5, -2.4, M.slate],
        [0.4, -2.3, M.terracotta],
        [0.0, -1.4, M.sage]
      ]) {
        cyl(0.38, 0.42, 0.42, 16, pm, px, 0.3, pz, rootGroup);
      }

      // --- Right Zone: Social Pedagogues & Psychologist Offices ---
      box(1.6, 0.74, 0.8, M.oakWood, 3.8, 0.37, -1.9, rootGroup); // Pedagogues desk 1
      box(1.6, 0.74, 0.8, M.oakWood, 3.8, 0.37, 0.3, rootGroup); // Pedagogues desk 2
      box(1.1, 1.85, 0.45, M.oakWood, 5.5, 0.92, -1.0, rootGroup); // Shelves
      // Psychologist + Family Visiting Lounge
      box(1.4, 0.42, 0.75, M.sage, 3.8, 0.28, 2.4, rootGroup);
      box(0.9, 0.05, 0.55, M.oakWood, 3.8, 0.38, 1.45, rootGroup);
      addPlant(5.3, 2.7, rootGroup);

      addRoomLight(-2.4, H - 0.2, 0, 0.7);
      addRoomLight(3.8, H - 0.2, 0, 0.7);
    }

    // Scene Configurations & Hotspot Pins
    const SCENES = {
      "house-dollhouse": {
        title: "Типовой дом семейного типа (95,0 м², 6 чел.)",
        badge: "3D-модель в разрезе",
        summary:
          "3 спальные комнаты по 14,5 м² (обычная домашняя мебель), общий зал 24,0 м², безопасная кухня с индукционной плитой (11,5 м²), 2 санузла (4,5 + 4,0 м²) и прихожая 7,5 м² с выходом на террасу 8,0 м².",
        build: () => buildFamilyHouse(false),
        defaultView: "orbit",
        orbitCam: { theta: 0.68, phi: 0.92, radius: 14.5, target: [0, 0.7, 0.4] },
        insideCam: { theta: 0.05, phi: 1.54, radius: 0.08, target: [0.0, 1.62, 0.4] },
        pins: [
          {
            id: "living",
            label: "Общий зал (24,0 м²)",
            pos: [-0.1, 1.35, -1.1],
            orbitTarget: [-0.1, 0.8, -1.1],
            insidePos: [0.0, 1.62, 0.3],
            insideTheta: 3.1,
            desc: "Обеденный стол на 6–8 персон, мягкая диванная группа, ТВ и пространство для совместного общения."
          },
          {
            id: "kitchen",
            label: "Кухня (11,5 м²)",
            pos: [4.5, 1.35, 0.3],
            orbitTarget: [4.2, 0.9, 0.3],
            insidePos: [3.2, 1.62, 0.3],
            insideTheta: -1.55,
            desc: "Безопасная индукционная варочная панель с таймером автоотключения (никакого газа), мойка, холодильник и микроволновка."
          },
          {
            id: "bed1",
            label: "Спальня №1 (14,5 м²)",
            pos: [-3.8, 1.35, -2.3],
            orbitTarget: [-3.8, 0.8, -2.3],
            insidePos: [-3.8, 1.58, -1.1],
            insideTheta: 3.14,
            desc: "2 обычные деревянные кровати, 2 шкафа, тумбы и широкое окно — никакой больничной атмосферы (3 спальни = 43,5 м²)."
          },
          {
            id: "baths",
            label: "2 санузла (8,5 м²)",
            pos: [3.85, 1.35, 3.0],
            orbitTarget: [3.85, 0.8, 3.0],
            insidePos: [2.8, 1.58, 2.7],
            insideTheta: -1.1,
            desc: "Санузел №1 (4,5 м² — душ без порога с поручнями) и Санузел №2 (4,0 м² — душ и стиральная машина)."
          },
          {
            id: "terrace",
            label: "Прихожая и терраса",
            pos: [0, 1.0, 5.7],
            orbitTarget: [0, 0.4, 5.7],
            insidePos: [0, 1.62, 5.4],
            insideTheta: 0.0,
            desc: "Прихожая-тамбур (7,5 м²) с гардеробом и кнопкой вызова + крытая деревянная терраса (8,0 м²) с пологим пандусом 1:20."
          }
        ]
      },
      "living-360": {
        title: "Панорама 360°: Общий зал (24,0 м²) и кухня (11,5 м²)",
        badge: "Вид изнутри 360°",
        summary:
          "Осмотрите гостиную-столовую и семейную кухню глазами жителя дома: тяните мышкой или пальцем на 360°, чтобы оценить стол на 6–8 персон, зону отдыха и безопасную индукционную плиту.",
        build: () => buildFamilyHouse(true),
        defaultView: "inside",
        orbitCam: { theta: 0.55, phi: 0.95, radius: 13.5, target: [0.8, 0.8, -1.0] },
        insideCam: { theta: 2.55, phi: 1.56, radius: 0.08, target: [-0.2, 1.62, 0.5] },
        pins: [
          {
            id: "table",
            label: "Обеденный стол",
            pos: [0, 1.15, -2.4],
            orbitTarget: [0, 0.8, -2.4],
            insidePos: [-0.2, 1.62, 0.4],
            insideTheta: 3.1,
            desc: "Совместные обеды и ужины на 6–8 персон и занятия с социальным педагогом."
          },
          {
            id: "stove",
            label: "Индукционная плита",
            pos: [5.1, 1.25, 0.15],
            orbitTarget: [4.8, 0.9, 0.2],
            insidePos: [3.1, 1.62, 0.2],
            insideTheta: -1.55,
            desc: "Безопасное приготовление пищи без открытого огня с таймером автоотключения."
          },
          {
            id: "sofa",
            label: "Зона отдыха",
            pos: [-0.2, 1.0, -0.1],
            orbitTarget: [-0.2, 0.6, 0.0],
            insidePos: [0.5, 1.62, -2.0],
            insideTheta: 0.3,
            desc: "Мягкая угловая диванная группа, ТВ и вечерний досуг."
          }
        ]
      },
      "bedroom-360": {
        title: "Панорама 360°: Спальня на двух человек (14,5 м²)",
        badge: "Вид изнутри 360°",
        summary:
          "Типовая спальня на двух жителей (площадь 14,5 м², всего 3 спальни = 43,5 м²): две односпальные деревянные кровати, личные шкафы, 2 прикроватные тумбы и светлое окно.",
        build: () => buildFamilyHouse(true),
        defaultView: "inside",
        orbitCam: { theta: -0.65, phi: 0.95, radius: 12.0, target: [-3.8, 0.8, -2.2] },
        insideCam: { theta: 3.2, phi: 1.62, radius: 0.08, target: [-3.8, 1.55, -0.9] },
        pins: [
          {
            id: "beds",
            label: "Две обычные кровати",
            pos: [-3.8, 0.9, -2.85],
            orbitTarget: [-3.8, 0.6, -2.85],
            insidePos: [-3.8, 1.55, -0.9],
            insideTheta: 3.14,
            desc: "Деревянные кровати домашнего типа вместо металлических больничных коек."
          },
          {
            id: "wardrobes",
            label: "Личные шкафы и стол",
            pos: [-3.8, 1.15, -0.55],
            orbitTarget: [-3.8, 0.8, -0.6],
            insidePos: [-3.8, 1.55, -2.7],
            insideTheta: 0.0,
            desc: "2 индивидуальных платяных шкафа, тумбы и место для личных вещей."
          }
        ]
      },
      "block1-3d": {
        title: "Общежитие Блок 1 (Литера А): 1-й этаж — Медпункт, ЛФК и сенсорная",
        badge: "3D-разрез Блока 1",
        summary:
          "Администрация вынесена в Литеру Д (284,05 м²). На 1-м этаже Блока 1 (по середине, 453,84 м²) расположены Медпункт (процедурная, изолятор с отдельным входом, кабинеты психиатра и терапевта, физиокабинет) и Реабилитационный центр (фитнес-зал ЛФК + сенсорная комната психолога). На 2-м этаже — мужской стационар (палаты №201–205, 20 мест).",
        build: () => buildBlock1(),
        defaultView: "orbit",
        orbitCam: { theta: 0.52, phi: 0.95, radius: 15.0, target: [0, 0.7, 0] },
        insideCam: { theta: -1.1, phi: 1.56, radius: 0.08, target: [2.2, 1.6, 0.2] },
        pins: [
          {
            id: "proc",
            label: "Медпункт и врачи",
            pos: [-4.8, 1.3, -2.2],
            orbitTarget: [-4.6, 0.7, -2.2],
            insidePos: [-4.0, 1.6, -1.3],
            insideTheta: 2.3,
            desc: "Левое крыло 1-го этажа Блока 1: процедурная, прививочная/перевязочная, кабинеты психиатра, терапевта и физиокабинет."
          },
          {
            id: "isolator",
            label: "Изолятор",
            pos: [-1.7, 1.3, -2.2],
            orbitTarget: [-1.7, 0.7, -2.2],
            insidePos: [-1.7, 1.6, -1.1],
            insideTheta: 3.1,
            desc: "Изолятор с отдельным входом и санузлом для временной стабилизации при сезонных обострениях с сохранением места жителя в доме."
          },
          {
            id: "lfk",
            label: "Зал ЛФК и сенсорная",
            pos: [3.4, 1.4, -1.0],
            orbitTarget: [3.4, 0.7, -0.5],
            insidePos: [1.6, 1.6, 0.3],
            insideTheta: -1.2,
            desc: "Фитнес-кабинет и зал ЛФК (1 ставка инструктора ЛФК) + сенсорная комната психолога для снятия тревожности."
          }
        ]
      },
      "block2-3d": {
        title: "Общежитие Блок 2 (Литера А¹): 1-й этаж — Игровые, 5 соцпедагогов и 4 мастера",
        badge: "3D-разрез Блока 2",
        summary:
          "На 1-м этаже Блока 2 (нижнее крыло, 305,04 м²) размещены игровые и досуговые комнаты (настольный теннис, шахматы, шашки, медиа-клуб, библиотека, арт-терапия), кабинеты 5 социальных педагогов и методическая 4 мастеров обучения. На 2-м этаже — женский стационар (палаты №206–210, 20 мест).",
        build: () => buildBlock2(),
        defaultView: "orbit",
        orbitCam: { theta: 0.45, phi: 0.94, radius: 14.5, target: [0, 0.7, 0] },
        insideCam: { theta: 1.5, phi: 1.56, radius: 0.08, target: [-1.5, 1.6, 0.2] },
        pins: [
          {
            id: "games",
            label: "Игровые и теннис",
            pos: [-3.5, 1.35, -0.5],
            orbitTarget: [-3.4, 0.8, 0.0],
            insidePos: [-1.2, 1.6, 0.4],
            insideTheta: 1.35,
            desc: "Настольный теннис, шахматы, шашки, библиотека — социализация и вечерний досуг для жителей 10 домов."
          },
          {
            id: "sensory",
            label: "Медиа-клуб и арт-терапия",
            pos: [0.0, 1.15, -2.0],
            orbitTarget: [0.0, 0.6, -2.0],
            insidePos: [-0.2, 1.6, -0.5],
            insideTheta: 3.1,
            desc: "Медиа-клуб с киноэкраном и мягкая зона арт-терапии (сенсорная комната психолога размещена в Блоке 1)."
          },
          {
            id: "pedagogues",
            label: "Соцпедагоги (5) + мастера (4)",
            pos: [3.8, 1.35, -0.5],
            orbitTarget: [3.8, 0.7, 0.0],
            insidePos: [2.2, 1.6, 0.2],
            insideTheta: -1.5,
            desc: "Кабинеты 5 социальных педагогов (по 1 на 2 дома) и методическая 4 мастеров производственного обучения."
          }
        ]
      }
    };

    // Camera State & Smooth Lerp Targets
    let currentSceneKey = "house-dollhouse";
    let currentViewMode = "orbit";
    let currentLightMode = "day";
    let activePinId = null;

    const camState = { theta: 0.68, phi: 0.92, radius: 14.5, target: new THREE.Vector3(0, 0.7, 0.4) };
    const camGoal = { theta: 0.68, phi: 0.92, radius: 14.5, target: new THREE.Vector3(0, 0.7, 0.4) };

    function setCameraGoal(preset, immediate = false) {
      camGoal.theta = preset.theta;
      camGoal.phi = preset.phi;
      camGoal.radius = preset.radius;
      camGoal.target.set(preset.target[0], preset.target[1], preset.target[2]);
      if (immediate || reducedMotion) {
        camState.theta = camGoal.theta;
        camState.phi = camGoal.phi;
        camState.radius = camGoal.radius;
        camState.target.copy(camGoal.target);
      }
    }

    function applyCamera() {
      const sinPhi = Math.sin(camState.phi);
      camera.position.set(
        camState.target.x + camState.radius * sinPhi * Math.sin(camState.theta),
        camState.target.y + camState.radius * Math.cos(camState.phi),
        camState.target.z + camState.radius * sinPhi * Math.cos(camState.theta)
      );
      camera.lookAt(camState.target);
    }

    function updateLighting(mode) {
      currentLightMode = mode;
      lightButtons.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.getAttribute("data-tour-light") === mode))
      );
      if (mode === "evening") {
        scene.background.setHex(0x1b2735);
        hemiLight.intensity = 0.32;
        sunLight.intensity = 0.22;
        fillLight.intensity = 0.16;
        M.lampGlow.emissiveIntensity = 1.6;
        interiorLights.forEach((l) => (l.intensity = 1.85));
      } else {
        scene.background.setHex(0xe9eef4);
        hemiLight.intensity = 0.95;
        sunLight.intensity = 1.35;
        fillLight.intensity = 0.42;
        M.lampGlow.emissiveIntensity = 0.5;
        interiorLights.forEach((l) => (l.intensity = 0.55));
      }
    }

    function renderInfo(pin = null) {
      const cfg = SCENES[currentSceneKey];
      activePinId = pin ? pin.id : null;

      const pinPills = cfg.pins
        .map(
          (p) => `
          <button type="button" class="tour-room-btn" data-jump-pin="${p.id}" aria-pressed="${p.id === activePinId}">
            ${p.label}
          </button>`
        )
        .join("");

      const activeBlock = pin
        ? `<div class="tour-focus-box">
             <strong>${pin.label}</strong>
             <p>${pin.desc}</p>
           </div>`
        : `<div class="tour-focus-box">
             <strong>${cfg.title}</strong>
             <p>${cfg.summary}</p>
           </div>`;

      infoBox.innerHTML = `
        <div class="tour-meta-code">${cfg.badge}</div>
        <h3 style="font-size:1.15rem;">${cfg.title}</h3>
        <p style="font-size:0.88rem;color:var(--text-secondary);">${cfg.summary}</p>
        <div class="tour-room-grid">${pinPills}</div>
        ${activeBlock}
        <div class="tour-help">
          Управление: мышью или горизонтальным свайпом; для вертикального наклона на телефоне нажмите «Вращать 3D», масштаб — + / −.
        </div>
      `;

      infoBox.querySelectorAll("[data-jump-pin]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetPin = cfg.pins.find((p) => p.id === btn.getAttribute("data-jump-pin"));
          if (targetPin) focusPin(targetPin);
        });
      });

      pinsLayer.querySelectorAll(".tour-pin").forEach((el) => {
        el.classList.toggle("is-active", el.getAttribute("data-pin-id") === activePinId);
      });
    }

    let pinElements = [];
    function rebuildPins() {
      const cfg = SCENES[currentSceneKey];
      pinsLayer.innerHTML = "";
      pinElements = cfg.pins.map((pin) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tour-pin";
        btn.setAttribute("data-pin-id", pin.id);
        btn.textContent = pin.label;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          focusPin(pin);
        });
        pinsLayer.appendChild(btn);
        return { pin, el: btn, vec: new THREE.Vector3(pin.pos[0], pin.pos[1], pin.pos[2]) };
      });
    }

    function focusPin(pin) {
      if (currentViewMode === "inside") {
        setCameraGoal({
          theta: pin.insideTheta,
          phi: 1.56,
          radius: 0.08,
          target: pin.insidePos
        });
      } else {
        setCameraGoal({
          theta: camGoal.theta,
          phi: 0.92,
          radius: 7.4,
          target: pin.orbitTarget
        });
      }
      renderInfo(pin);
    }

    function setViewMode(mode, immediate = false) {
      currentViewMode = mode;
      const cfg = SCENES[currentSceneKey];
      viewButtons.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.getAttribute("data-tour-view") === mode))
      );
      camera.fov = mode === "inside" ? 68 : 44;
      camera.updateProjectionMatrix();
      setCameraGoal(mode === "inside" ? cfg.insideCam : cfg.orbitCam, immediate);
    }

    function loadScene(key) {
      const cfg = SCENES[key];
      if (!cfg) return;
      currentSceneKey = key;
      sceneButtons.forEach((b) =>
        b.setAttribute("aria-pressed", String(b.getAttribute("data-tour-scene") === key))
      );
      cfg.build();
      updateLighting(currentLightMode);
      rebuildPins();
      setViewMode(cfg.defaultView, true);
      renderInfo(null);
    }

    // Pointer Orbit / 360° Drag + Multi-Touch Pinch Zoom + Touch Scroll Safety
    const activePointers = new Map();
    let lastPinchDist = null;
    let isDragging = false;
    let dragEngaged = false;
    let isTouchLocked = false;
    let lastX = 0;
    let lastY = 0;

    function setTouchLocked(locked) {
      isTouchLocked = Boolean(locked);
      wrap.classList.toggle("is-touch-locked", isTouchLocked);
      if (touchLockBtn) {
        touchLockBtn.setAttribute("aria-pressed", String(isTouchLocked));
        touchLockBtn.textContent = isTouchLocked ? "Листать страницу" : "Вращать 3D";
      }
    }

    function adjustZoom(delta) {
      if (currentViewMode === "inside") {
        camera.fov = Math.max(42, Math.min(84, camera.fov + delta * 3.5));
        camera.updateProjectionMatrix();
        return;
      }
      camGoal.radius = Math.max(4.5, Math.min(22, camGoal.radius + delta));
      if (reducedMotion) camState.radius = camGoal.radius;
    }

    function getPinchDistance() {
      const pts = Array.from(activePointers.values());
      if (pts.length < 2) return null;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }

    renderer.domElement.addEventListener("pointerdown", (e) => {
      activePointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        type: e.pointerType
      });
      if (activePointers.size === 1) {
        isDragging = true;
        dragEngaged = e.pointerType === "mouse" || isTouchLocked;
        lastX = e.clientX;
        lastY = e.clientY;
        lastPinchDist = null;
        if (dragEngaged) {
          renderer.domElement.setPointerCapture(e.pointerId);
        }
      } else if (activePointers.size === 2) {
        isDragging = false;
        dragEngaged = false;
        lastPinchDist = getPinchDistance();
      }
    });

    renderer.domElement.addEventListener("pointermove", (e) => {
      const existing = activePointers.get(e.pointerId);
      if (existing) {
        existing.x = e.clientX;
        existing.y = e.clientY;
      }
      if (activePointers.size === 2) {
        const dist = getPinchDistance();
        if (dist !== null && lastPinchDist !== null) {
          adjustZoom((lastPinchDist - dist) * 0.035);
        }
        lastPinchDist = dist;
        return;
      }
      if (!isDragging || !existing) return;

      if (!dragEngaged) {
        const totalDx = Math.abs(e.clientX - existing.startX);
        const totalDy = Math.abs(e.clientY - existing.startY);
        if (totalDx < 8 && totalDy < 8) return;
        if (totalDy >= totalDx * 0.9) {
          // Yield to vertical page scroll without rotating camera
          isDragging = false;
          dragEngaged = false;
          return;
        }
        dragEngaged = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }

      const dx = e.clientX - lastX;
      const dy = e.pointerType === "mouse" || isTouchLocked ? e.clientY - lastY : 0;
      lastX = e.clientX;
      lastY = e.clientY;

      const factor = currentViewMode === "inside" ? -0.0045 : 0.007;
      camGoal.theta -= dx * factor;
      if (dy !== 0) {
        camGoal.phi = Math.max(
          currentViewMode === "inside" ? 0.85 : 0.28,
          Math.min(currentViewMode === "inside" ? 2.15 : 1.48, camGoal.phi - dy * factor)
        );
      }
      if (reducedMotion) {
        camState.theta = camGoal.theta;
        camState.phi = camGoal.phi;
      }
    });

    const endDrag = (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) lastPinchDist = null;
      if (e.type === "pointercancel" || activePointers.size !== 1) {
        isDragging = false;
        dragEngaged = false;
        return;
      }
      const [rem] = activePointers.values();
      isDragging = true;
      dragEngaged = rem.type === "mouse" || isTouchLocked;
      lastX = rem.x;
      lastY = rem.y;
    };
    renderer.domElement.addEventListener("pointerup", endDrag);
    renderer.domElement.addEventListener("pointercancel", endDrag);

    renderer.domElement.addEventListener(
      "wheel",
      (e) => {
        if (currentViewMode === "inside") return;
        e.preventDefault();
        adjustZoom(e.deltaY * 0.012);
      },
      { passive: false }
    );

    // Controls Binding
    sceneButtons.forEach((btn) =>
      btn.addEventListener("click", () => loadScene(btn.getAttribute("data-tour-scene")))
    );
    viewButtons.forEach((btn) =>
      btn.addEventListener("click", () => setViewMode(btn.getAttribute("data-tour-view")))
    );
    lightButtons.forEach((btn) =>
      btn.addEventListener("click", () => updateLighting(btn.getAttribute("data-tour-light")))
    );
    zoomButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const dir = btn.getAttribute("data-tour-zoom");
        adjustZoom(dir === "in" ? -1.8 : 1.8);
      })
    );
    if (touchLockBtn) {
      touchLockBtn.addEventListener("click", () => setTouchLocked(!isTouchLocked));
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const cfg = SCENES[currentSceneKey];
        camera.fov = cfg.defaultView === "inside" ? 68 : 44;
        camera.updateProjectionMatrix();
        setTouchLocked(false);
        setViewMode(cfg.defaultView, false);
        renderInfo(null);
      });
    }

    // Sizing via ResizeObserver
    let width = 800;
    let height = 450;
    function syncSize() {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      width = rect.width;
      height = rect.height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);
    syncSize();

    // Update 2D projected pin positions (clamped safely on narrow screens)
    const projVec = new THREE.Vector3();
    function updatePinPositions() {
      const marginX = width < 480 ? 54 : 36;
      const marginY = 22;
      for (const item of pinElements) {
        projVec.copy(item.vec).project(camera);
        const visible =
          projVec.z < 1 &&
          projVec.z > -1 &&
          projVec.x >= -1.08 &&
          projVec.x <= 1.08 &&
          projVec.y >= -1.08 &&
          projVec.y <= 1.08;
        if (!visible) {
          item.el.style.display = "none";
          continue;
        }
        const rawX = (projVec.x * 0.5 + 0.5) * width;
        const rawY = (-projVec.y * 0.5 + 0.5) * height;
        const sx = Math.max(marginX, Math.min(width - marginX, rawX));
        const sy = Math.max(marginY, Math.min(height - marginY, rawY));
        item.el.style.display = "inline-flex";
        item.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      }
    }

    // Animation loop paused when offscreen
    let isVisible = true;
    let rafId = null;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          isVisible = entries[0]?.isIntersecting ?? true;
          if (isVisible && rafId === null) loop();
        },
        { threshold: 0.05 }
      );
      io.observe(wrap);
    }

    function loop() {
      if (!isVisible) {
        rafId = null;
        return;
      }
      const ease = reducedMotion ? 1 : 0.14;
      camState.theta += (camGoal.theta - camState.theta) * ease;
      camState.phi += (camGoal.phi - camState.phi) * ease;
      camState.radius += (camGoal.radius - camState.radius) * ease;
      camState.target.lerp(camGoal.target, ease);

      applyCamera();
      renderer.render(scene, camera);
      updatePinPositions();
      rafId = requestAnimationFrame(loop);
    }

    // Boot default scene
    loadScene("house-dollhouse");
    loop();
  }

  document.addEventListener("DOMContentLoaded", initTour3D);
})();
