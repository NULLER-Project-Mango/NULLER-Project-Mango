// js/mango3d.js
// Улучшенные 3D модели с PBR материалами, постобработкой и детализацией

let THREE_LOADED = false;
let POSTPROCESS_LOADED = false;

export class Mango3D {
  constructor(containerId) {
    this.containerId = containerId;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;       // постобработка
    this.mangoGroup = null;
    this.animationId = null;
    this.isInitialized = false;
    this.currentSkinId = 'mango_default';
    this.clock = 0;
    this.lights = [];
    this.specialEffects = [];
    this.envMap = null;         // environment map для отражений
    this.pmremGenerator = null;
  }

  // ───────────────────────────── INIT ─────────────────────────────

  async init() {
    if (this.isInitialized) return;
    if (!window.THREE) await this.loadThreeJS();

    const container = document.getElementById(this.containerId);
    if (!container) return;

    /* ── Сцена ── */
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.08);

    /* ── Камера ── */
    const size = Math.min(container.offsetWidth, container.offsetHeight);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(0, 0.3, 5.5);
    this.camera.lookAt(0, 0, 0);

    /* ── Рендерер ── */
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    const old = container.querySelector('canvas');
    if (old) old.remove();
    container.appendChild(this.renderer.domElement);

    /* ── Environment Map (простой градиент) ── */
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this._buildEnvMap();

    this.setupBaseLights();
    this.setSkin(this.currentSkinId);
    this.animate();

    window.addEventListener('resize', () => this.onResize());
    this.isInitialized = true;
  }

  loadThreeJS() {
    return new Promise((resolve, reject) => {
      if (window.THREE) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = () => { THREE_LOADED = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load Three.js'));
      document.head.appendChild(script);
    });
  }

  // Строим простую небесную сферу-градиент как env map
  _buildEnvMap() {
    const rt = new THREE.WebGLCubeRenderTarget(128);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111122);
    this.envMap = this.pmremGenerator.fromScene(scene).texture;
    this.scene.environment = this.envMap;
    rt.dispose();
    scene.background = null;
  }

  // ───────────────────────────── LIGHTS ─────────────────────────────

  setupBaseLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);
    this.lights.push(ambient);

    // Ключевой (солнечный)
    const key = new THREE.DirectionalLight(0xfff5e1, 3.5);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.001;
    this.scene.add(key);
    this.lights.push(key);

    // Fill
    const fill = new THREE.DirectionalLight(0x6699ff, 1.2);
    fill.position.set(-4, -2, 3);
    this.scene.add(fill);
    this.lights.push(fill);

    // Rim (контровой)
    const rim = new THREE.DirectionalLight(0xff8844, 1.8);
    rim.position.set(-3, 4, -5);
    this.scene.add(rim);
    this.lights.push(rim);
  }

  // Динамически меняем акцентный свет под скин
  _setAccentLight(color, intensity = 2) {
    if (this._accentLight) this.scene.remove(this._accentLight);
    this._accentLight = new THREE.PointLight(color, intensity, 12);
    this._accentLight.position.set(0, 0, 3);
    this.scene.add(this._accentLight);
  }

  // ───────────────────────────── ПРИМИТИВЫ ─────────────────────────────

  /**
   * Базовое тело манго — PBR MeshStandardMaterial по умолчанию
   */
  createMangoBody(color, opts = {}) {
    const {
      roughness        = 0.35,
      metalness        = 0.0,
      emissive         = 0x000000,
      emissiveIntensity= 0,
      transparent      = false,
      opacity          = 1.0,
      flatShading      = false,
      envMapIntensity  = 1.0,
      // legacy Phong fallback
      usePhong         = false,
      shininess        = 80,
      specular         = 0xffd54f,
      wireframe        = false,
    } = opts;

    // Форма манго — вытянутая сфера
    const geo = new THREE.SphereGeometry(1.2, 96, 96);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const taper = 1 - Math.abs(y) * 0.12;
      pos.setXYZ(i, x * taper, y * 1.35, z * taper);
    }
    geo.computeVertexNormals();

    let mat;
    if (usePhong) {
      mat = new THREE.MeshPhongMaterial({
        color, specular, shininess, emissive,
        emissiveIntensity, transparent, opacity, wireframe,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color, roughness, metalness, emissive,
        emissiveIntensity, transparent, opacity,
        flatShading, envMapIntensity,
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Стебелёк с PBR */
  createStem(color = 0x5d4037) {
    const geo = new THREE.CylinderGeometry(0.045, 0.08, 0.32, 12);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.8, metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 1.67, 0);
    mesh.castShadow = true;
    return mesh;
  }

  /** Листик с PBR и bump-like эффектом через roughness */
  createLeaf(color = 0x4caf50) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo( 0.35, 0.1,  0.55, 0.55,  0.42, 1.0);
    shape.bezierCurveTo( 0.28, 1.15, 0.08, 1.05,  0,    0.98);
    shape.bezierCurveTo(-0.08, 1.05,-0.28, 1.15, -0.42, 1.0);
    shape.bezierCurveTo(-0.55, 0.55,-0.35, 0.1,   0,    0);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.04, bevelEnabled: true,
      bevelSegments: 3, bevelSize: 0.025, bevelThickness: 0.025,
    });
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(0.5, 0.5, 0.5);
    mesh.position.set(0.14, 1.72, 0.0);
    mesh.rotation.set(0, 0.4, -0.28);
    mesh.castShadow = true;
    return mesh;
  }

  /** Бликовый блюр-эллипс */
  createHighlight(opacity = 0.22) {
    const geo = new THREE.SphereGeometry(0.4, 20, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfffde7, transparent: true, opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.48, 0.55, 0.92);
    mesh.scale.set(1.1, 0.7, 0.28);
    return mesh;
  }

  /** Круговое кольцо-ореол */
  _makeHalo(r, tube, color, opacity, rotX = Math.PI / 2) {
    const geo = new THREE.TorusGeometry(r, tube, 12, 80);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = rotX;
    return mesh;
  }

  /** Конус-шип */
  _makeSpike(color, emissive = 0x000000, emissiveIntensity = 0) {
    const geo = new THREE.ConeGeometry(0.09, 0.42, 7);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.3, metalness: 0.4,
      emissive, emissiveIntensity,
    });
    return new THREE.Mesh(geo, mat);
  }

  /** Сфера-частица */
  _makeSphere(r, color, opacity = 1) {
    const geo = new THREE.SphereGeometry(r, 10, 10);
    const mat = opacity < 1
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
      : new THREE.MeshBasicMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  // ───────────────────────────── ОЧИСТКА ─────────────────────────────

  clearMango() {
    if (this.mangoGroup) {
      this.scene.remove(this.mangoGroup);
      this.disposeObject(this.mangoGroup);
      this.mangoGroup = null;
    }
    this.specialEffects.forEach(e => {
      this.scene.remove(e);
      this.disposeObject(e);
    });
    this.specialEffects = [];
    if (this._accentLight) {
      this.scene.remove(this._accentLight);
      this._accentLight = null;
    }
  }

  disposeObject(obj) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
          Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); });
          m.dispose();
        });
      }
    });
  }

  // ───────────────────────────── СКИНЫ ─────────────────────────────

  setSkin(skinId) {
    this.currentSkinId = skinId;
    this.clearMango();
    this.mangoGroup = new THREE.Group();
    const builder = this.skinBuilders[skinId] || this.skinBuilders['mango_default'];
    builder.call(this);
    this.scene.add(this.mangoGroup);
  }

  // ═══════════════════════════════════════════════════════════════
  //                      SKIN BUILDERS
  // ═══════════════════════════════════════════════════════════════
  skinBuilders = {

    // ── COMMON ────────────────────────────────────────────────────

    'default': function () { this.skinBuilders['mango_default'].call(this); },

    'mango_default': function () {
      this._setAccentLight(0xff9800, 1.5);

      const body = this.createMangoBody(0xff9800, {
        roughness: 0.38, metalness: 0.04, envMapIntensity: 0.8,
      });
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.25));
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());

      // Вторичный лист
      const leaf2 = this.createLeaf(0x388e3c);
      leaf2.position.set(-0.15, 1.72, 0.05);
      leaf2.rotation.set(0, -0.6, 0.2);
      this.mangoGroup.add(leaf2);
    },

    'mango_green': function () {
      this._setAccentLight(0x7cb342, 1.5);
      this.mangoGroup.add(this.createMangoBody(0x8bc34a, {
        roughness: 0.42, metalness: 0.02,
      }));
      this.mangoGroup.add(this.createHighlight(0.18));
      this.mangoGroup.add(this.createStem(0x33691e));
      this.mangoGroup.add(this.createLeaf(0x1b5e20));
      const l2 = this.createLeaf(0x33691e);
      l2.position.set(-0.12, 1.72, 0.04); l2.rotation.set(0, -0.7, 0.15);
      this.mangoGroup.add(l2);
    },

    'mango_small': function () {
      this._setAccentLight(0xffb74d, 1.2);
      const body = this.createMangoBody(0xffb74d, { roughness: 0.4 });
      body.scale.setScalar(0.7);
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.2));
      const stem = this.createStem(); stem.scale.setScalar(0.7); stem.position.y = 1.17;
      this.mangoGroup.add(stem);
      const leaf = this.createLeaf(); leaf.scale.setScalar(0.35); leaf.position.y = 1.2;
      this.mangoGroup.add(leaf);
    },

    'mango_round': function () {
      this._setAccentLight(0xffa726, 1.4);
      const geo = new THREE.SphereGeometry(1.25, 96, 96);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffa726, roughness: 0.3, metalness: 0.05, envMapIntensity: 1.0,
      });
      const body = new THREE.Mesh(geo, mat);
      body.castShadow = true; body.receiveShadow = true;
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.28));
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_spotted': function () {
      this._setAccentLight(0xff7043, 1.3);
      this.mangoGroup.add(this.createMangoBody(0xff8f00, { roughness: 0.5 }));
      for (let i = 0; i < 14; i++) {
        const geo = new THREE.SphereGeometry(0.075, 14, 14);
        const mat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
        const spot = new THREE.Mesh(geo, mat);
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
        const phi = Math.random() * Math.PI * 0.9 + 0.05;
        spot.position.setFromSphericalCoords(1.19, phi, angle);
        spot.position.y *= 1.35;
        this.mangoGroup.add(spot);
      }
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    // ── UNCOMMON ──────────────────────────────────────────────────

    'mango_golden_light': function () {
      this._setAccentLight(0xffd740, 2.0);
      this.mangoGroup.add(this.createMangoBody(0xffd54f, {
        roughness: 0.18, metalness: 0.55, envMapIntensity: 1.5,
      }));
      this.mangoGroup.add(this.createHighlight(0.35));
      this.mangoGroup.add(this.createStem(0x8d6e63));
      this.mangoGroup.add(this.createLeaf(0x558b2f));
    },

    'mango_red': function () {
      this._setAccentLight(0xe53935, 2.0);
      this.mangoGroup.add(this.createMangoBody(0xe53935, {
        roughness: 0.28, metalness: 0.1, envMapIntensity: 1.2,
        emissive: 0xb71c1c, emissiveIntensity: 0.12,
      }));
      this.mangoGroup.add(this.createHighlight(0.22));
      this.mangoGroup.add(this.createStem(0x3e2723));
      this.mangoGroup.add(this.createLeaf(0x1b5e20));
    },

    'mango_striped': function () {
      this._setAccentLight(0xff7043, 1.5);
      this.mangoGroup.add(this.createMangoBody(0xff8f00, { roughness: 0.45 }));
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.TorusGeometry(1.15 - i * 0.04, 0.045, 10, 48);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4e342e, roughness: 0.7, metalness: 0.1,
        });
        const torus = new THREE.Mesh(geo, mat);
        torus.rotation.x = Math.PI / 2;
        torus.position.y = -0.9 + i * 0.48;
        torus.scale.y = 0.72;
        torus.castShadow = true;
        this.mangoGroup.add(torus);
      }
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_neon_green': function () {
      this._setAccentLight(0x76ff03, 3.0);
      this.mangoGroup.add(this.createMangoBody(0x76ff03, {
        roughness: 0.15, metalness: 0.2,
        emissive: 0x64dd17, emissiveIntensity: 0.9,
      }));
      // Пульсирующий ореол
      const halo = this._makeHalo(1.55, 0.03, 0x76ff03, 0.5);
      halo.userData.pulseHalo = true;
      this.mangoGroup.add(halo);
      const glow = new THREE.PointLight(0x76ff03, 2.5, 7);
      this.mangoGroup.add(glow);
      this.mangoGroup.add(this.createStem(0x33691e));
      this.mangoGroup.add(this.createLeaf(0xaeea00));
    },

    'mango_tropical': function () {
      this._setAccentLight(0xff6f00, 1.8);
      this.mangoGroup.add(this.createMangoBody(0xff6f00, { roughness: 0.38 }));
      this.mangoGroup.add(this.createHighlight(0.22));
      this.mangoGroup.add(this.createStem(0x388e3c));
      for (let i = 0; i < 4; i++) {
        const leaf = this.createLeaf(0x1b5e20);
        leaf.rotation.y = (i / 4) * Math.PI * 2;
        leaf.scale.setScalar(0.42);
        leaf.position.set(0.12, 1.72, 0.0);
        this.mangoGroup.add(leaf);
      }
    },

    // ── RARE ──────────────────────────────────────────────────────

    'mango_crystal': function () {
      this._setAccentLight(0x80deea, 2.5);
      const body = this.createMangoBody(0x80deea, {
        roughness: 0.05, metalness: 0.2,
        transparent: true, opacity: 0.55,
        envMapIntensity: 2.0,
        emissive: 0x00acc1, emissiveIntensity: 0.2,
      });
      this.mangoGroup.add(body);

      for (let i = 0; i < 10; i++) {
        const geo = new THREE.OctahedronGeometry(0.28 + Math.random() * 0.1);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xe0f7fa, roughness: 0.05, metalness: 0.3,
          transparent: true, opacity: 0.85, envMapIntensity: 2.5,
        });
        const crystal = new THREE.Mesh(geo, mat);
        crystal.castShadow = true;
        const angle = (i / 10) * Math.PI * 2;
        const phi = (Math.random() * 0.7 + 0.15) * Math.PI;
        crystal.position.setFromSphericalCoords(0.55, phi, angle);
        crystal.userData.spin = true;
        crystal.userData.spinSpeed = 0.015 + Math.random() * 0.01;
        this.mangoGroup.add(crystal);
      }
      const cLight = new THREE.PointLight(0x00e5ff, 2.0, 6);
      this.mangoGroup.add(cLight);
      this.mangoGroup.add(this.createStem(0x37474f));
      this.mangoGroup.add(this.createLeaf(0x00bcd4));
    },

    'mango_ice': function () {
      this._setAccentLight(0x81d4fa, 2.5);
      const body = this.createMangoBody(0x81d4fa, {
        roughness: 0.08, metalness: 0.15,
        transparent: true, opacity: 0.65,
        emissive: 0x0288d1, emissiveIntensity: 0.15,
        envMapIntensity: 2.0,
      });
      this.mangoGroup.add(body);

      // Ледяные шипы — аккуратно расставленные
      for (let i = 0; i < 18; i++) {
        const geo = new THREE.ConeGeometry(0.06, 0.38, 7);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xe1f5fe, roughness: 0.05, metalness: 0.2,
          transparent: true, opacity: 0.92, envMapIntensity: 2.0,
        });
        const spike = new THREE.Mesh(geo, mat);
        spike.castShadow = true;
        const angle = (i / 18) * Math.PI * 2;
        const phi = Math.PI * 0.25 + (Math.random() * 0.5 * Math.PI);
        const r = 1.3;
        spike.position.setFromSphericalCoords(r, phi, angle);
        spike.position.y *= 1.35;
        spike.lookAt(0, 0, 0);
        spike.rotateX(Math.PI / 2);
        this.mangoGroup.add(spike);
      }

      // Снежинки-частицы вокруг
      for (let i = 0; i < 25; i++) {
        const s = this._makeSphere(0.03, 0xffffff, 0.8);
        const angle = Math.random() * Math.PI * 2;
        const r = 1.6 + Math.random() * 0.6;
        s.position.set(Math.cos(angle) * r, (Math.random() - 0.5) * 2.5, Math.sin(angle) * r);
        s.userData.snow = true;
        s.userData.snowOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      const iceLight = new THREE.PointLight(0xb3e5fc, 2.0, 7);
      this.mangoGroup.add(iceLight);
      this.mangoGroup.add(this.createStem(0x37474f));
    },

    'mango_fire': function () {
      this._setAccentLight(0xff5722, 3.5);
      this.mangoGroup.add(this.createMangoBody(0xbf360c, {
        roughness: 0.5, metalness: 0.05,
        emissive: 0xff3d00, emissiveIntensity: 0.7,
      }));

      // Лавовые прожилки
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.TorusGeometry(1.18 - i * 0.02, 0.02, 6, 32,
          Math.PI * 0.4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff9800 });
        const vein = new THREE.Mesh(geo, mat);
        vein.rotation.x = Math.PI / 2;
        vein.rotation.z = (i / 8) * Math.PI * 2;
        this.mangoGroup.add(vein);
      }

      // Огненные частицы
      const fireGroup = new THREE.Group();
      fireGroup.userData.isFire = true;
      for (let i = 0; i < 28; i++) {
        const r = 0.05 + Math.random() * 0.09;
        const geo = new THREE.SphereGeometry(r, 8, 8);
        const col = [0xff9800, 0xffeb3b, 0xff5722][Math.floor(Math.random() * 3)];
        const mat = new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.75,
        });
        const fire = new THREE.Mesh(geo, mat);
        fire.position.set(
          (Math.random() - 0.5) * 0.6,
          1.3 + Math.random() * 1.5,
          (Math.random() - 0.5) * 0.6,
        );
        fire.userData.speed   = 0.025 + Math.random() * 0.03;
        fire.userData.startY  = fire.position.y;
        fire.userData.startX  = fire.position.x;
        fire.userData.startZ  = fire.position.z;
        fire.userData.phase   = Math.random() * Math.PI * 2;
        fireGroup.add(fire);
      }
      this.mangoGroup.add(fireGroup);

      const fl = new THREE.PointLight(0xff5722, 3.5, 9);
      fl.position.set(0, 0.5, 0);
      fl.userData.flickerLight = true;
      this.mangoGroup.add(fl);
      this.mangoGroup.add(this.createStem(0x3e2723));
    },

    'mango_electric': function () {
      this._setAccentLight(0x00e5ff, 3.0);
      this.mangoGroup.add(this.createMangoBody(0x1a237e, {
        roughness: 0.2, metalness: 0.5,
        emissive: 0xffc107, emissiveIntensity: 0.5,
      }));

      // Электрические арки — вращаются хаотично
      const arcGroup = new THREE.Group();
      arcGroup.userData.isArcs = true;
      for (let i = 0; i < 6; i++) {
        const geo = new THREE.TorusGeometry(1.35 + i * 0.06, 0.025, 8, 48);
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00e5ff : 0xffd740,
          transparent: true, opacity: 0.7,
        });
        const arc = new THREE.Mesh(geo, mat);
        arc.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        arc.userData.arcSpeed = (Math.random() - 0.5) * 0.07;
        arcGroup.add(arc);
      }
      this.mangoGroup.add(arcGroup);

      // Искры
      for (let i = 0; i < 20; i++) {
        const s = this._makeSphere(0.04, 0x00e5ff, 0.9);
        const a = Math.random() * Math.PI * 2;
        const r = 1.4 + Math.random() * 0.4;
        s.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 2.6, Math.sin(a) * r);
        s.userData.twinkle = true;
        this.mangoGroup.add(s);
      }

      const eLight = new THREE.PointLight(0x00bcd4, 2.5, 8);
      this.mangoGroup.add(eLight);
      this.mangoGroup.add(this.createStem());
    },

    'mango_rainbow': function () {
      this._setAccentLight(0xff4081, 2.0);
      const geo = new THREE.SphereGeometry(1.2, 96, 96);
      const pos = geo.attributes.position;
      const colArr = [];
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const taper = 1 - Math.abs(y) * 0.12;
        pos.setXYZ(i, pos.getX(i) * taper, y * 1.35, pos.getZ(i) * taper);
        const hue = i / pos.count;
        const c = new THREE.Color().setHSL(hue, 1.0, 0.58);
        colArr.push(c.r, c.g, c.b);
      }
      geo.computeVertexNormals();
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.22, metalness: 0.1,
      });
      const body = new THREE.Mesh(geo, mat);
      body.castShadow = true;
      body.userData.isRainbow = true;
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.2));
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_steampunk': function () {
      this._setAccentLight(0xb87333, 2.0);
      this.mangoGroup.add(this.createMangoBody(0xb87333, {
        roughness: 0.5, metalness: 0.85, envMapIntensity: 1.5,
      }));

      // Шестерёнки (аппроксимация через цилиндры с зубьями)
      for (let g = 0; g < 4; g++) {
        const gearGroup = new THREE.Group();
        const angle = (g / 4) * Math.PI * 2;
        gearGroup.position.set(Math.cos(angle) * 1.35, 0, Math.sin(angle) * 1.35);

        const baseGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.09, 16);
        const gearMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e63, roughness: 0.4, metalness: 0.9,
        });
        gearGroup.add(new THREE.Mesh(baseGeo, gearMat));

        // Зубья
        for (let t = 0; t < 8; t++) {
          const toothGeo = new THREE.BoxGeometry(0.07, 0.09, 0.07);
          const tooth = new THREE.Mesh(toothGeo, gearMat);
          const ta = (t / 8) * Math.PI * 2;
          tooth.position.set(Math.cos(ta) * 0.25, 0, Math.sin(ta) * 0.25);
          gearGroup.add(tooth);
        }

        gearGroup.rotation.x = Math.PI / 2;
        gearGroup.userData.spin = true;
        gearGroup.userData.spinSpeed = (g % 2 === 0 ? 1 : -1) * 0.025;
        this.mangoGroup.add(gearGroup);
      }

      // Медные трубки
      for (let i = 0; i < 2; i++) {
        const pipeGeo = new THREE.TorusGeometry(1.45, 0.06, 10, 20, Math.PI * 0.6);
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0x6d4c41, roughness: 0.35, metalness: 0.95,
        });
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.rotation.set(Math.PI / 2, (i / 2) * Math.PI, 0);
        this.mangoGroup.add(pipe);
      }

      // Дым из трубок
      for (let i = 0; i < 15; i++) {
        const s = this._makeSphere(0.06 + Math.random() * 0.04, 0x90a4ae, 0.3);
        s.position.set(
          (Math.random() - 0.5) * 3.0, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 3.0
        );
        s.userData.smoke = true;
        s.userData.smokeOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      this.mangoGroup.add(this.createStem(0x3e2723));
    },

    // ── EPIC ──────────────────────────────────────────────────────

    'mango_diamond': function () {
      this._setAccentLight(0xe3f2fd, 4.0);
      const geo = new THREE.IcosahedronGeometry(1.32, 2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb3e5fc, roughness: 0.0, metalness: 0.2,
        transparent: true, opacity: 0.65,
        envMapIntensity: 3.0, flatShading: true,
      });
      const body = new THREE.Mesh(geo, mat);
      body.scale.y = 1.3;
      body.castShadow = true;
      this.mangoGroup.add(body);

      // Каркас
      const wire = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.1 })
      );
      wire.scale.setScalar(1.005); wire.scale.y = 1.3;
      this.mangoGroup.add(wire);

      // Летающие искры
      for (let i = 0; i < 40; i++) {
        const s = this._makeSphere(0.025 + Math.random() * 0.025, 0xffffff, 0.95);
        const r = 1.6 + Math.random() * 0.6;
        const a = Math.random() * Math.PI * 2;
        const ph = Math.random() * Math.PI;
        s.position.setFromSphericalCoords(r, ph, a);
        s.userData.twinkle = true;
        s.userData.twinkleOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      const dLight = new THREE.PointLight(0xe3f2fd, 3.5, 10);
      this.mangoGroup.add(dLight);
      this.mangoGroup.add(this.createStem(0x37474f));
    },

    'mango_plasma': function () {
      this._setAccentLight(0xce93d8, 3.5);
      this.mangoGroup.add(this.createMangoBody(0x6a1b9a, {
        roughness: 0.12, metalness: 0.3,
        emissive: 0xe040fb, emissiveIntensity: 0.85,
        transparent: true, opacity: 0.82,
        envMapIntensity: 2.0,
      }));

      for (let i = 0; i < 4; i++) {
        const ring = this._makeHalo(1.42 + i * 0.18, 0.04, 0xe040fb, 0.55);
        ring.rotation.set((i / 4) * Math.PI, (i / 4) * Math.PI * 0.5, 0);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.022;
        ring.userData.spinAxis = i % 2 === 0 ? 'z' : 'x';
        this.mangoGroup.add(ring);
      }

      // Плазменные шары
      for (let i = 0; i < 12; i++) {
        const s = this._makeSphere(0.07, i % 2 === 0 ? 0xe040fb : 0xb388ff, 0.8);
        const a = (i / 12) * Math.PI * 2;
        s.position.set(Math.cos(a) * 1.7, Math.sin(a * 2) * 0.4, Math.sin(a) * 1.7);
        s.userData.orbit = true;
        s.userData.orbitAngle  = a;
        s.userData.orbitRadius = 1.7;
        s.userData.orbitSpeed  = 0.018;
        s.userData.orbitY      = true;
        this.mangoGroup.add(s);
      }

      const pLight = new THREE.PointLight(0xe040fb, 3.5, 9);
      this.mangoGroup.add(pLight);
    },

    'mango_void': function () {
      this._setAccentLight(0x7c4dff, 2.5);
      this.mangoGroup.add(this.createMangoBody(0x090909, {
        roughness: 0.0, metalness: 0.9,
        emissive: 0x4a148c, emissiveIntensity: 0.3,
        envMapIntensity: 0.5,
      }));

      // Звёздное поле вокруг
      for (let i = 0; i < 80; i++) {
        const col = Math.random() > 0.6 ? 0xffffff : (Math.random() > 0.5 ? 0x9c27b0 : 0x3d5afe);
        const s = this._makeSphere(0.018 + Math.random() * 0.02, col, 0.95);
        const r = 1.7 + Math.random() * 1.2;
        const a = Math.random() * Math.PI * 2;
        const ph = Math.random() * Math.PI;
        s.position.setFromSphericalCoords(r, ph, a);
        s.userData.twinkle = true;
        s.userData.twinkleOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      // Гравитационные линзы
      for (let i = 0; i < 3; i++) {
        const ring = this._makeHalo(1.5 + i * 0.3, 0.025, 0x9c27b0, 0.4, Math.PI / 2 + i * 0.5);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.015;
        this.mangoGroup.add(ring);
      }

      const vLight = new THREE.PointLight(0x7c4dff, 2.0, 8);
      this.mangoGroup.add(vLight);
    },

    'mango_cyberpunk': function () {
      this._setAccentLight(0x00e5ff, 3.0);
      this.mangoGroup.add(this.createMangoBody(0x0d1b2a, {
        roughness: 0.18, metalness: 0.85,
        emissive: 0x00e5ff, emissiveIntensity: 0.4,
        envMapIntensity: 2.0,
      }));

      // Голографические сетки
      for (let i = 0; i < 10; i++) {
        const geo = new THREE.TorusGeometry(1.22 + i * 0.04, 0.018, 4, 40);
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00e5ff : 0xff00ff,
          transparent: true, opacity: 0.45,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = (i / 10) * Math.PI;
        ring.rotation.y = (i / 10) * Math.PI;
        this.mangoGroup.add(ring);
      }

      // Скан-линии (плоские полосы)
      for (let i = 0; i < 6; i++) {
        const geo = new THREE.PlaneGeometry(3.5, 0.025);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x00e5ff, transparent: true, opacity: 0.35,
          side: THREE.DoubleSide,
        });
        const scan = new THREE.Mesh(geo, mat);
        scan.position.y = -1.4 + i * 0.55;
        scan.userData.scanLine = true;
        scan.userData.scanSpeed = 0.012;
        this.mangoGroup.add(scan);
      }

      const cLight = new THREE.PointLight(0x00e5ff, 2.5, 8);
      this.mangoGroup.add(cLight);
    },

    'mango_ancient': function () {
      this._setAccentLight(0xffd54f, 2.0);
      this.mangoGroup.add(this.createMangoBody(0x8d6e63, {
        roughness: 0.75, metalness: 0.05,
      }));

      // Золотые руны (плоские кольца)
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.RingGeometry(0.15, 0.28, 6);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffd54f, roughness: 0.3, metalness: 0.8,
          side: THREE.DoubleSide,
          emissive: 0xffa000, emissiveIntensity: 0.3,
        });
        const rune = new THREE.Mesh(geo, mat);
        const angle = (i / 8) * Math.PI * 2;
        rune.position.set(
          Math.cos(angle) * 1.38,
          Math.sin(angle * 1.5) * 0.55,
          Math.sin(angle) * 1.38,
        );
        rune.lookAt(0, 0, 0);
        rune.userData.slowSpin = true;
        rune.userData.spinPhase = angle;
        this.mangoGroup.add(rune);
      }

      // Золотое кольцо вокруг экватора
      const ring = this._makeHalo(1.45, 0.055, 0xffd54f, 0.7);
      this.mangoGroup.add(ring);

      const aLight = new THREE.PointLight(0xffd54f, 1.8, 7);
      this.mangoGroup.add(aLight);
    },

    // ── LEGENDARY ─────────────────────────────────────────────────

    'mango_golden': function () {
      this._setAccentLight(0xffd700, 4.5);
      this.mangoGroup.add(this.createMangoBody(0xffd700, {
        roughness: 0.08, metalness: 1.0, envMapIntensity: 3.0,
        emissive: 0xffa000, emissiveIntensity: 0.3,
      }));

      // Золотая корона
      const crownGroup = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const spike = this._makeSpike(0xffeb3b, 0xffd54f, 0.6);
        const angle = (i / 8) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.95, 1.85, Math.sin(angle) * 0.95);
        spike.lookAt(Math.cos(angle) * 2, 2.8, Math.sin(angle) * 2);
        crownGroup.add(spike);
      }
      // Основание короны
      const crownBase = new THREE.Mesh(
        new THREE.TorusGeometry(1.0, 0.08, 10, 40),
        new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.08, metalness: 1.0 })
      );
      crownBase.position.y = 1.75;
      crownGroup.add(crownBase);
      this.mangoGroup.add(crownGroup);

      // Золотые искры
      for (let i = 0; i < 35; i++) {
        const s = this._makeSphere(0.03, 0xffd700, 0.9);
        const r = 1.8 + Math.random() * 0.7;
        const a = Math.random() * Math.PI * 2;
        const ph = Math.random() * Math.PI;
        s.position.setFromSphericalCoords(r, ph, a);
        s.userData.twinkle = true;
        s.userData.twinkleOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      const gLight = new THREE.PointLight(0xffd700, 4.5, 14);
      this.mangoGroup.add(gLight);
    },

    'mango_galaxy': function () {
      this._setAccentLight(0x7c4dff, 3.5);
      this.mangoGroup.add(this.createMangoBody(0x1a237e, {
        roughness: 0.18, metalness: 0.4,
        emissive: 0x673ab7, emissiveIntensity: 0.55,
        envMapIntensity: 1.5,
      }));

      // Рукава спиральной галактики
      const galaxy = new THREE.Group();
      galaxy.userData.isGalaxy = true;
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 80; i++) {
          const t = i / 80;
          const angle = t * Math.PI * 4 + (arm / 3) * Math.PI * 2;
          const r = 1.5 + t * 1.2;
          const s = this._makeSphere(
            0.02 + Math.random() * 0.025,
            [0xffffff, 0xe040fb, 0x00bcd4, 0xffeb3b][Math.floor(Math.random() * 4)],
            0.8 + Math.random() * 0.2
          );
          s.position.set(
            Math.cos(angle) * r,
            (Math.random() - 0.5) * 0.25,
            Math.sin(angle) * r
          );
          s.userData.twinkle = true;
          s.userData.twinkleOffset = Math.random() * Math.PI * 2;
          galaxy.add(s);
        }
      }
      this.mangoGroup.add(galaxy);

      const gxLight = new THREE.PointLight(0x7c4dff, 3.0, 12);
      this.mangoGroup.add(gxLight);
    },

    'mango_dragon': function () {
      this._setAccentLight(0xff6d00, 3.5);
      this.mangoGroup.add(this.createMangoBody(0x4a148c, {
        roughness: 0.32, metalness: 0.4,
        emissive: 0xff3d00, emissiveIntensity: 0.3,
        envMapIntensity: 1.5, specular: 0xe040fb,
      }));

      // Чешуя — кольца конусов
      for (let row = 0; row < 4; row++) {
        const count = 8 + row * 2;
        for (let i = 0; i < count; i++) {
          const spike = this._makeSpike(0x311b92, 0xff6d00, 0.4);
          spike.scale.set(0.8, 0.6 + row * 0.1, 0.8);
          const angle = (i / count) * Math.PI * 2;
          const y = 0.8 - row * 0.5;
          spike.position.set(Math.cos(angle) * 1.32, y, Math.sin(angle) * 1.32);
          spike.lookAt(Math.cos(angle) * 3, y + 0.5, Math.sin(angle) * 3);
          this.mangoGroup.add(spike);
        }
      }

      // Огненные глаза
      for (let side = -1; side <= 1; side += 2) {
        const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const eyeMat = new THREE.MeshStandardMaterial({
          color: 0xff6d00, emissive: 0xff3d00, emissiveIntensity: 1.5,
          roughness: 0.1,
        });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(side * 0.45, 0.6, 1.05);
        this.mangoGroup.add(eye);
        const eL = new THREE.PointLight(0xff3d00, 1.5, 3);
        eL.position.copy(eye.position);
        this.mangoGroup.add(eL);
      }
    },

    'mango_phoenix': function () {
      this._setAccentLight(0xff6f00, 4.0);
      this.mangoGroup.add(this.createMangoBody(0xff6f00, {
        roughness: 0.2, metalness: 0.1,
        emissive: 0xff3d00, emissiveIntensity: 1.0,
        envMapIntensity: 1.5,
      }));

      // Крылья феникса
      for (let side = -1; side <= 1; side += 2) {
        const wingGroup = new THREE.Group();
        const feathers = 6;
        for (let f = 0; f < feathers; f++) {
          const fShape = new THREE.Shape();
          fShape.moveTo(0, 0);
          fShape.quadraticCurveTo(0.6, 0.3 + f * 0.1, 1.2 + f * 0.15, 1.0 + f * 0.3);
          fShape.quadraticCurveTo(0.8, 0.25, 0, 0);
          const fGeo = new THREE.ShapeGeometry(fShape);
          const fMat = new THREE.MeshBasicMaterial({
            color: f % 2 === 0 ? 0xff9800 : 0xffeb3b,
            transparent: true, opacity: 0.8 - f * 0.06,
            side: THREE.DoubleSide,
          });
          const feather = new THREE.Mesh(fGeo, fMat);
          feather.rotation.z = -f * 0.18;
          wingGroup.add(feather);
        }
        wingGroup.position.set(side * 1.1, 0.1, 0);
        wingGroup.scale.x = side;
        wingGroup.userData.flap = true;
        wingGroup.userData.flapOffset = side === -1 ? 0 : Math.PI * 0.3;
        this.mangoGroup.add(wingGroup);
      }

      // Огненный шлейф
      for (let i = 0; i < 30; i++) {
        const s = this._makeSphere(0.05 + Math.random() * 0.07, [0xff9800, 0xffeb3b, 0xff5722][i % 3], 0.7);
        s.position.set((Math.random() - 0.5) * 0.4, -1.5 - Math.random() * 1.0, (Math.random() - 0.5) * 0.4);
        s.userData.tailFire = true;
        s.userData.tailOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      const fLight = new THREE.PointLight(0xff5722, 4.0, 12);
      fLight.userData.flickerLight = true;
      this.mangoGroup.add(fLight);
    },

    // ── MYTHIC ────────────────────────────────────────────────────

    'mango_celestial': function () {
      this._setAccentLight(0xfff9c4, 5.0);
      this.mangoGroup.add(this.createMangoBody(0xfff8e1, {
        roughness: 0.04, metalness: 0.3,
        emissive: 0xffeb3b, emissiveIntensity: 0.9,
        envMapIntensity: 3.0,
      }));

      // Ореолы
      for (let i = 0; i < 4; i++) {
        const halo = this._makeHalo(1.6 - i * 0.18, 0.04 - i * 0.003, 0xffeb3b, 0.8 - i * 0.15);
        halo.position.y = 1.55 + i * 0.28;
        halo.userData.slowSpin = true;
        halo.userData.spinPhase = (i / 4) * Math.PI;
        this.mangoGroup.add(halo);
      }

      // Небесные перья (лучи)
      for (let i = 0; i < 16; i++) {
        const geo = new THREE.PlaneGeometry(0.06, 2.8);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfffde7, transparent: true, opacity: 0.28,
          side: THREE.DoubleSide,
        });
        const ray = new THREE.Mesh(geo, mat);
        const a = (i / 16) * Math.PI * 2;
        ray.position.set(Math.cos(a) * 0.4, -0.1, Math.sin(a) * 0.4);
        ray.rotation.y = -a;
        ray.userData.rayFade = true;
        ray.userData.rayOffset = a;
        this.mangoGroup.add(ray);
      }

      const cLight = new THREE.PointLight(0xffeb3b, 5.0, 14);
      this.mangoGroup.add(cLight);
      const cLight2 = new THREE.PointLight(0xffffff, 2.0, 8);
      cLight2.position.set(0, 2, 0);
      this.mangoGroup.add(cLight2);
    },

    'mango_quantum': function () {
      this._setAccentLight(0x00e676, 3.5);
      // 5 суперпозиций
      for (let i = 0; i < 5; i++) {
        const body = this.createMangoBody(0x00e676, {
          transparent: true, opacity: 0.32 + i * 0.03,
          emissive: 0x00e676, emissiveIntensity: 0.6,
          roughness: 0.15, metalness: 0.2,
        });
        body.scale.setScalar(1 - i * 0.08);
        body.userData.quantum = true;
        body.userData.qOffset = (i / 5) * Math.PI * 2;
        body.userData.qSpeed  = 1.8 + i * 0.3;
        this.mangoGroup.add(body);
      }

      // Орбитальные кольца
      for (let i = 0; i < 3; i++) {
        const ring = this._makeHalo(1.5 + i * 0.15, 0.03, 0x00e676, 0.55, 0);
        ring.rotation.set((i / 3) * Math.PI * 2 / 3, (i / 3) * Math.PI, 0);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.03;
        this.mangoGroup.add(ring);
      }

      const qLight = new THREE.PointLight(0x00e676, 3.0, 9);
      this.mangoGroup.add(qLight);
    },

    'mango_time': function () {
      this._setAccentLight(0x8e24aa, 3.0);
      this.mangoGroup.add(this.createMangoBody(0x4a148c, {
        roughness: 0.18, metalness: 0.5,
        emissive: 0xab47bc, emissiveIntensity: 0.5,
        envMapIntensity: 2.0,
      }));

      // Циферблат
      const faceGeo = new THREE.CircleGeometry(1.22, 64);
      const faceMat = new THREE.MeshBasicMaterial({
        color: 0x1a0033, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.z = 1.0;
      this.mangoGroup.add(face);

      // Часовые метки
      for (let i = 0; i < 12; i++) {
        const isMain = i % 3 === 0;
        const geo = new THREE.BoxGeometry(isMain ? 0.07 : 0.04, isMain ? 0.18 : 0.12, 0.02);
        const mat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
        const tick = new THREE.Mesh(geo, mat);
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        tick.position.set(Math.cos(a) * 1.02, Math.sin(a) * 1.02, 1.01);
        tick.rotation.z = a;
        this.mangoGroup.add(tick);
      }

      // Часовая стрелка
      const hGeo = new THREE.BoxGeometry(0.05, 0.55, 0.02);
      const hMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
      const hour = new THREE.Mesh(hGeo, hMat);
      hour.position.set(0, 0.27, 1.02);
      hour.userData.isClock = true;
      hour.userData.clockSpeed = 0.008;
      this.mangoGroup.add(hour);

      // Минутная стрелка
      const mGeo = new THREE.BoxGeometry(0.035, 0.8, 0.02);
      const mMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
      const minute = new THREE.Mesh(mGeo, mMat);
      minute.position.set(0, 0.4, 1.03);
      minute.userData.isClock = true;
      minute.userData.clockSpeed = 0.04;
      this.mangoGroup.add(minute);

      // Временны́е кольца (хроно-эффект)
      for (let i = 0; i < 3; i++) {
        const ring = this._makeHalo(1.4 + i * 0.2, 0.03, 0xab47bc, 0.5, Math.PI / 2);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.02;
        this.mangoGroup.add(ring);
      }
    },

    // ── DIVINE ────────────────────────────────────────────────────

    'mango_divine': function () {
      this._setAccentLight(0xffeb3b, 6.0);
      this.mangoGroup.add(this.createMangoBody(0xffd700, {
        roughness: 0.04, metalness: 1.0, envMapIntensity: 4.0,
        emissive: 0xffab00, emissiveIntensity: 1.0,
      }));

      // Корона с бриллиантами
      for (let i = 0; i < 10; i++) {
        const spike = this._makeSpike(0xffd700, 0xffeb3b, 0.8);
        spike.scale.set(1.2, 1.4, 1.2);
        const a = (i / 10) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 1.05, 1.95, Math.sin(a) * 1.05);
        spike.lookAt(Math.cos(a) * 2.5, 3.2, Math.sin(a) * 2.5);
        this.mangoGroup.add(spike);

        // Рубин на короне
        const gemGeo = new THREE.OctahedronGeometry(0.08);
        const gemMat = new THREE.MeshStandardMaterial({
          color: 0xff1744, roughness: 0.0, metalness: 0.2, envMapIntensity: 3.0,
          emissive: 0xff1744, emissiveIntensity: 0.5,
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(Math.cos(a) * 1.05, 2.22, Math.sin(a) * 1.05);
        this.mangoGroup.add(gem);
      }

      // Лучи света
      for (let i = 0; i < 16; i++) {
        const geo = new THREE.PlaneGeometry(0.12, 4.5);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfffde7, transparent: true, opacity: 0.18,
          side: THREE.DoubleSide,
        });
        const ray = new THREE.Mesh(geo, mat);
        const a = (i / 16) * Math.PI * 2;
        ray.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        ray.rotation.y = -a;
        ray.userData.rayFade = true;
        ray.userData.rayOffset = a;
        this.mangoGroup.add(ray);
      }

      const dLight  = new THREE.PointLight(0xffeb3b, 6.0, 18);
      const dLight2 = new THREE.PointLight(0xffffff, 3.0, 10);
      dLight2.position.set(0, 3, 0);
      this.mangoGroup.add(dLight);
      this.mangoGroup.add(dLight2);
    },

    'mango_eternal': function () {
      this._setAccentLight(0xffeb3b, 4.0);
      // Лемниската (знак бесконечности) из двух манго
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const body = this.createMangoBody(0xffe082, {
          roughness: 0.06, metalness: 0.95, envMapIntensity: 3.0,
          emissive: 0xffd54f, emissiveIntensity: 0.6,
        });
        body.scale.setScalar(0.62);
        body.userData.eternal = true;
        body.userData.eternalOffset = side * Math.PI * 0.5;
        body.userData.eternalSide = side;
        this.mangoGroup.add(body);
      }

      // Соединяющий поток частиц
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const s = this._makeSphere(0.04, 0xffeb3b, 0.85);
        s.userData.eternalStream = true;
        s.userData.eternalT = t;
        this.mangoGroup.add(s);
      }

      const eLight = new THREE.PointLight(0xffeb3b, 4.0, 12);
      this.mangoGroup.add(eLight);
    },

    // ── COSMIC ────────────────────────────────────────────────────

    'mango_cosmic': function () {
      this._setAccentLight(0xe040fb, 4.5);
      this.mangoGroup.add(this.createMangoBody(0x4a148c, {
        roughness: 0.15, metalness: 0.5,
        emissive: 0x7b1fa2, emissiveIntensity: 0.8,
        envMapIntensity: 2.0,
      }));

      // Планетарные кольца
      const ringColors = [0xe040fb, 0x7c4dff, 0x00bcd4, 0xff4081];
      for (let i = 0; i < 4; i++) {
        const geo = new THREE.RingGeometry(1.55 + i * 0.22, 1.65 + i * 0.22, 80);
        const mat = new THREE.MeshBasicMaterial({
          color: ringColors[i], side: THREE.DoubleSide,
          transparent: true, opacity: 0.65 - i * 0.08,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = Math.PI / 2 + 0.28;
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.01;
        this.mangoGroup.add(ring);
      }

      // Луны с орбитами
      for (let i = 0; i < 4; i++) {
        const moonGroup = new THREE.Group();
        const moonGeo = new THREE.SphereGeometry(0.14, 20, 20);
        const moonMat = new THREE.MeshStandardMaterial({
          color: 0xbdbdbd, roughness: 0.85, metalness: 0.05,
        });
        const moon = new THREE.Mesh(moonGeo, moonMat);
        moon.castShadow = true;
        const orbitR = 2.0 + i * 0.35;
        const initAngle = (i / 4) * Math.PI * 2;
        moonGroup.userData.orbit = true;
        moonGroup.userData.orbitAngle  = initAngle;
        moonGroup.userData.orbitRadius = orbitR;
        moonGroup.userData.orbitSpeed  = 0.012 - i * 0.002;
        moonGroup.userData.orbitTilt   = (i * 0.25);
        moonGroup.add(moon);
        this.mangoGroup.add(moonGroup);
      }

      const coLight = new THREE.PointLight(0xe040fb, 4.0, 14);
      this.mangoGroup.add(coLight);
    },

    'mango_singularity': function () {
      this._setAccentLight(0xff00ff, 5.0);
      this.mangoGroup.add(this.createMangoBody(0x000000, {
        roughness: 0.0, metalness: 1.0, envMapIntensity: 0.3,
        emissive: 0x4a0080, emissiveIntensity: 0.5,
      }));

      // Аккреционные диски
      const diskColors = [0xff00ff, 0x00bcd4, 0xff9800];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.RingGeometry(1.5 + i * 0.5, 2.0 + i * 0.5, 80);
        const mat = new THREE.MeshBasicMaterial({
          color: diskColors[i], side: THREE.DoubleSide,
          transparent: true, opacity: 0.75 - i * 0.15,
        });
        const disk = new THREE.Mesh(geo, mat);
        disk.rotation.x = Math.PI / 2 + 0.4 + i * 0.15;
        disk.userData.spin = true;
        disk.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.014;
        this.mangoGroup.add(disk);
      }

      // Всасываемые частицы по спирали
      for (let i = 0; i < 70; i++) {
        const col = [0xff00ff, 0x00bcd4, 0xffffff][i % 3];
        const s = this._makeSphere(0.04 + Math.random() * 0.03, col, 0.85);
        s.userData.isSingularity = true;
        s.userData.singAngle  = Math.random() * Math.PI * 2;
        s.userData.singRadius = 2.0 + Math.random() * 1.5;
        s.userData.singSpeed  = 0.018 + Math.random() * 0.02;
        s.userData.singY      = (Math.random() - 0.5) * 0.35;
        this.mangoGroup.add(s);
      }

      // Гравитационные линзы
      for (let i = 0; i < 3; i++) {
        const ring = this._makeHalo(1.4 + i * 0.2, 0.025, 0xff00ff, 0.35, Math.PI / 2);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1.5 : -1.5) * 0.022;
        this.mangoGroup.add(ring);
      }

      const sLight = new THREE.PointLight(0xff00ff, 5.0, 16);
      this.mangoGroup.add(sLight);
    },
  };

  // ═══════════════════════════════════════════════════════════════
  //                       АНИМАЦИЯ
  // ═══════════════════════════════════════════════════════════════

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.clock += 0.016;
    const t = this.clock;

    if (this.mangoGroup) {
      // Базовое вращение и покачивание
      this.mangoGroup.rotation.y += 0.007;
      this.mangoGroup.rotation.x = Math.sin(t * 0.45) * 0.04;
      this.mangoGroup.position.y = Math.sin(t * 0.75) * 0.08;

      this.mangoGroup.traverse(obj => {
        if (!obj.userData) return;
        const ud = obj.userData;

        // Вращение вокруг своей оси
        if (ud.spin) {
          const sp = ud.spinSpeed ?? 0.022;
          const ax = ud.spinAxis ?? 'z';
          obj.rotation[ax] += sp;
          if (ax === 'z') obj.rotation.x += sp * 0.4;
        }

        // Обратное вращение
        if (ud.spinReverse) {
          obj.rotation.z -= ud.spinSpeed ?? 0.016;
        }

        // Мерцание искр
        if (ud.twinkle) {
          const s = 0.5 + Math.abs(Math.sin(t * 4 + (ud.twinkleOffset ?? 0)));
          obj.scale.setScalar(s);
          if (obj.material) obj.material.opacity = 0.5 + s * 0.4;
        }

        // Взмахи крыльев феникса
        if (ud.flap) {
          obj.rotation.z = Math.sin(t * 3.5 + (ud.flapOffset ?? 0)) * 0.55;
        }

        // Огонь
        if (ud.isFire) {
          obj.children.forEach(fire => {
            const fu = fire.userData;
            fire.position.y += fu.speed;
            fire.position.x  = fu.startX + Math.sin(t * 6 + fu.phase) * 0.08;
            fire.position.z  = fu.startZ + Math.cos(t * 5 + fu.phase) * 0.08;
            const prog = (fire.position.y - fu.startY) / 1.8;
            if (prog > 1) {
              fire.position.y = fu.startY;
              fire.position.x = fu.startX;
              fire.position.z = fu.startZ;
            }
            if (fire.material) fire.material.opacity = 0.8 * (1 - prog);
            const sc = 1 - prog * 0.5;
            fire.scale.setScalar(sc);
          });
        }

        // Мерцание огненного света
        if (ud.flickerLight && obj.isLight) {
          obj.intensity = 3.0 + Math.sin(t * 12 + Math.random()) * 1.0;
        }

        // Хаотические арки
        if (ud.isArcs) {
          obj.children.forEach(arc => {
            arc.rotation.x += arc.userData.arcSpeed ?? 0.05;
            arc.rotation.y += (arc.userData.arcSpeed ?? 0.05) * 0.7;
          });
        }

        // Часовые стрелки
        if (ud.isClock) {
          obj.rotation.z -= ud.clockSpeed ?? 0.01;
          // Центрируем вращение
          const halfH = obj.geometry.parameters?.height ?? 0.55;
          obj.position.y = Math.cos(obj.rotation.z) * (halfH / 2) * (-1);
          obj.position.x = Math.sin(obj.rotation.z) * (halfH / 2);
        }

        // Лучи света
        if (ud.rayFade) {
          if (obj.material) {
            obj.material.opacity = 0.15 + Math.sin(t * 1.5 + (ud.rayOffset ?? 0)) * 0.10;
          }
        }

        // Пульсирующий ореол
        if (ud.pulseHalo) {
          const sc = 1 + Math.sin(t * 2.5) * 0.08;
          obj.scale.setScalar(sc);
          if (obj.material) obj.material.opacity = 0.4 + Math.sin(t * 2.5) * 0.15;
        }

        // Медленное вращение рун
        if (ud.slowSpin) {
          obj.rotation.z += 0.006;
        }

        // Галактика
        if (ud.isGalaxy) {
          obj.rotation.y += 0.004;
        }

        // Орбитальное движение (планеты/луны/шары)
        if (ud.orbit) {
          ud.orbitAngle += ud.orbitSpeed ?? 0.015;
          const r = ud.orbitRadius ?? 2.0;
          const tilt = ud.orbitTilt ?? 0;
          obj.position.x = Math.cos(ud.orbitAngle) * r;
          obj.position.z = Math.sin(ud.orbitAngle) * r;
          obj.position.y = Math.sin(ud.orbitAngle + tilt) * r * Math.sin(tilt + 0.1);
        }

        // Квантовые суперпозиции
        if (ud.quantum) {
          const qA = t * (ud.qSpeed ?? 2) + (ud.qOffset ?? 0);
          obj.position.x = Math.sin(qA * 0.9) * 0.28;
          obj.position.y = Math.cos(qA * 1.1) * 0.28;
          obj.position.z = Math.sin(qA * 0.7) * 0.28;
        }

        // Знак бесконечности (eternal)
        if (ud.eternal) {
          const ea = t + (ud.eternalOffset ?? 0);
          obj.position.x  = Math.cos(ea) * 0.82;
          obj.position.y  = Math.sin(ea * 2) * 0.22;
          obj.rotation.y  = ea;
        }

        // Поток бесконечности
        if (ud.eternalStream) {
          const et = (ud.eternalT + t * 0.25) % 1.0;
          const ea = et * Math.PI * 2;
          obj.position.x  = Math.cos(ea) * 0.82;
          obj.position.y  = Math.sin(ea * 2) * 0.22;
          obj.position.z  = Math.sin(ea) * 0.22;
          if (obj.material) obj.material.opacity = 0.4 + Math.sin(ea * 2) * 0.4;
        }

        // Сингулярность — спираль втягивания
        if (ud.isSingularity) {
          ud.singAngle  += ud.singSpeed;
          ud.singRadius -= 0.004;
          if (ud.singRadius < 1.4) {
            ud.singRadius = 2.0 + Math.random() * 1.5;
            ud.singAngle  = Math.random() * Math.PI * 2;
          }
          obj.position.x = Math.cos(ud.singAngle) * ud.singRadius;
          obj.position.z = Math.sin(ud.singAngle) * ud.singRadius;
          obj.position.y = ud.singY + Math.sin(ud.singAngle * 3) * 0.1;
          const sc = ud.singRadius / 3.5;
          obj.scale.setScalar(sc);
          if (obj.material) obj.material.opacity = sc * 0.9;
        }

        // Снежинки
        if (ud.snow) {
          obj.position.y  += Math.sin(t * 1.5 + (ud.snowOffset ?? 0)) * 0.003;
          obj.position.x  += Math.cos(t * 0.8 + (ud.snowOffset ?? 0)) * 0.002;
          if (Math.abs(obj.position.y) > 2.5) ud.snowOffset = Math.random() * Math.PI * 2;
        }

        // Дым (стимпанк)
        if (ud.smoke) {
          obj.position.y += 0.008;
          obj.scale.addScalar(0.002);
          if (obj.material) obj.material.opacity -= 0.003;
          if (obj.material?.opacity <= 0 || obj.position.y > 3) {
            obj.position.set(
              (Math.random() - 0.5) * 3.0,
              1.2,
              (Math.random() - 0.5) * 3.0,
            );
            obj.scale.setScalar(0.8);
            if (obj.material) obj.material.opacity = 0.3;
          }
        }

        // Хвостовой огонь феникса
        if (ud.tailFire) {
          obj.position.y -= 0.015;
          obj.position.x += Math.sin(t * 4 + (ud.tailOffset ?? 0)) * 0.01;
          if (obj.position.y < -2.8) {
            obj.position.y = -1.3 - Math.random() * 0.5;
          }
          if (obj.material) {
            obj.material.opacity = 0.7 * (1 - (-obj.position.y - 1.3) / 1.5);
          }
        }

        // Скан-линии (cyberpunk)
        if (ud.scanLine) {
          obj.position.y += ud.scanSpeed ?? 0.012;
          if (obj.position.y > 1.6) obj.position.y = -1.6;
          if (obj.material) {
            obj.material.opacity = 0.3 * (1 - Math.abs(obj.position.y) / 1.6);
          }
        }

        // Радужная переливка
        if (ud.isRainbow && obj.geometry?.attributes?.color) {
          const colors = obj.geometry.attributes.color;
          for (let i = 0; i < colors.count; i++) {
            const hue = ((i / colors.count) + t * 0.08) % 1;
            const c = new THREE.Color().setHSL(hue, 1.0, 0.58);
            colors.setXYZ(i, c.r, c.g, c.b);
          }
          colors.needsUpdate = true;
        }
      });
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //                    ВСПОМОГАТЕЛЬНЫЕ
  // ═══════════════════════════════════════════════════════════════

  /** Анимированный импульс при клике */
  pulse() {
    if (!this.mangoGroup) return;
    // Реалистичное squash & stretch
    this.mangoGroup.scale.set(1.18, 0.82, 1.18);
    const start = performance.now();
    const ease = (elapsed) => {
      const p = Math.min(elapsed / 160, 1);
      const bounce = 1 + Math.sin(p * Math.PI) * (0.18 * (1 - p));
      if (this.mangoGroup) {
        const sx = 1 + (0.18 - 0.18 * p) * (1 - p);
        const sy = 1 - (0.18 - 0.18 * p) * (1 - p);
        this.mangoGroup.scale.set(1 + sx * 0.1, 1 - sy * 0.1, 1 + sx * 0.1);
      }
      if (p < 1) requestAnimationFrame(() => ease(performance.now() - start));
      else if (this.mangoGroup) this.mangoGroup.scale.set(1, 1, 1);
    };
    requestAnimationFrame(() => ease(performance.now() - start));
  }

  onResize() {
    const container = document.getElementById(this.containerId);
    if (!container || !this.renderer || !this.camera) return;
    const size = Math.min(container.offsetWidth, container.offsetHeight);
    this.renderer.setSize(size, size);
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.clearMango();
    if (this.envMap) this.envMap.dispose();
    if (this.pmremGenerator) this.pmremGenerator.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    this.isInitialized = false;
  }
}
