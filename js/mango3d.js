// js/mango3d.js
let THREE_LOADED = false;

export class Mango3D {
  constructor(containerId) {
    this.containerId = containerId;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mangoGroup = null;
    this.animationId = null;
    this.isInitialized = false;
    this.currentSkinId = 'mango_default';
    this.clock = 0;
    this.lights = [];
    this.specialEffects = [];
    this._accentLight = null;
  }

  // ───────────────────────── INIT ─────────────────────────

  async init() {
    if (this.isInitialized) return;
    if (!window.THREE) await this.loadThreeJS();

    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.scene = new THREE.Scene();

    const size = Math.min(container.offsetWidth, container.offsetHeight);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 0.3, 7.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ИСПРАВЛЕНИЕ: без physicallyCorrectLights — интенсивность
    // работает интуитивно, картинка яркая
    this.renderer.physicallyCorrectLights = false;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // ИСПРАВЛЕНИЕ: ReinhardToneMapping мягче, не затемняет
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.8;

    const old = container.querySelector('canvas');
    if (old) old.remove();
    container.appendChild(this.renderer.domElement);

    // ИСПРАВЛЕНИЕ: нормальный environment map через CubeCamera
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

  // ИСПРАВЛЕНИЕ: строим богатый env map из градиента цветов
  _buildEnvMap() {
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
      format: THREE.RGBFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });

    // Рисуем градиентное небо как env map вручную через 6 граней
    const size = 256;
    const envScene = new THREE.Scene();

    // Градиентный фон — оранжево-золотой снизу, синий сверху
    const envGeo = new THREE.SphereGeometry(50, 32, 32);
    const canvas2d = document.createElement('canvas');
    canvas2d.width = canvas2d.height = 512;
    const ctx = canvas2d.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#1a237e');
    grad.addColorStop(0.4, '#4a148c');
    grad.addColorStop(0.7, '#bf360c');
    grad.addColorStop(1.0, '#ff6f00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const envTex = new THREE.CanvasTexture(canvas2d);
    const envMat = new THREE.MeshBasicMaterial({
      map: envTex, side: THREE.BackSide,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));

    // Яркие точечные источники в env map
    const envLights = [
      { color: 0xffffff, intensity: 5, pos: [10, 10, 10] },
      { color: 0xff8800, intensity: 3, pos: [-10, 5, -10] },
      { color: 0x4488ff, intensity: 2, pos: [0, -10, 5] },
    ];
    envLights.forEach(l => {
      const light = new THREE.PointLight(l.color, l.intensity);
      light.position.set(...l.pos);
      envScene.add(light);
    });

    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRT);
    envScene.add(cubeCamera);
    cubeCamera.update(this.renderer, envScene);

    this.envMap = cubeRT.texture;
    this.scene.environment = this.envMap;
  }

  // ───────────────────────── LIGHTS ─────────────────────────

  setupBaseLights() {
    // ИСПРАВЛЕНИЕ: высокая интенсивность для ярких материалов
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    this.lights.push(ambient);

    // Ключевой свет сверху-спереди
    const key = new THREE.DirectionalLight(0xfff5e1, 2.5);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.001;
    key.shadow.radius = 3;
    this.scene.add(key);
    this.lights.push(key);

    // Заполняющий свет слева
    const fill = new THREE.DirectionalLight(0x6699ff, 1.2);
    fill.position.set(-5, 2, 3);
    this.scene.add(fill);
    this.lights.push(fill);

    // Контровой свет сзади
    const rim = new THREE.DirectionalLight(0xff9944, 1.5);
    rim.position.set(-2, 5, -6);
    this.scene.add(rim);
    this.lights.push(rim);

    // Нижний отражённый свет (имитация пола)
    const bottom = new THREE.DirectionalLight(0xffa726, 0.4);
    bottom.position.set(0, -5, 2);
    this.scene.add(bottom);
    this.lights.push(bottom);
  }

  _setAccentLight(color, intensity = 2.5) {
    if (this._accentLight) {
      this.scene.remove(this._accentLight);
      this._accentLight = null;
    }
    this._accentLight = new THREE.PointLight(color, intensity, 15);
    this._accentLight.position.set(0, 0, 4);
    this.scene.add(this._accentLight);
  }

  // ───────────────────────── ПРИМИТИВЫ ─────────────────────────

  /**
   * Тело манго — Phong для яркости, Standard для металлика
   * ИСПРАВЛЕНИЕ: MeshPhongMaterial даёт сочные яркие цвета без PBR затемнения
   */
  createMangoBody(color, opts = {}) {
    const {
      usePBR            = false,
      roughness         = 0.35,
      metalness         = 0.0,
      shininess         = 120,
      specular          = 0xffd54f,
      emissive          = 0x000000,
      emissiveIntensity = 0,
      transparent       = false,
      opacity           = 1.0,
      flatShading       = false,
    } = opts;

    // Форма манго — вытянутая сфера с сужением
    const geo = new THREE.SphereGeometry(1.2, 96, 96);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Форма: вытягиваем по Y, сужаем к полюсам
      const taper = 1 - Math.abs(y) * 0.13;
      // Небольшая асимметрия — манго не идеально круглое
      const asymX = 1 + Math.sin(y * 1.5) * 0.04;
      pos.setXYZ(i, x * taper * asymX, y * 1.35, z * taper);
    }
    geo.computeVertexNormals();

    let mat;
    if (usePBR) {
      // PBR для металлических скинов
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive: new THREE.Color(emissive),
        emissiveIntensity,
        transparent,
        opacity,
        flatShading,
        envMap: this.envMap,
        envMapIntensity: 2.5,
      });
    } else {
      // Phong — яркий, сочный, без затемнения PBR
      mat = new THREE.MeshPhongMaterial({
        color,
        specular: new THREE.Color(specular),
        shininess,
        emissive: new THREE.Color(emissive),
        emissiveIntensity,
        transparent,
        opacity,
        flatShading,
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Стебелёк с реалистичной формой
  createStem(color = 0x5d4037) {
    const group = new THREE.Group();

    // Основной стебель — слегка изогнутый
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08, 0.15, 0.04),
      new THREE.Vector3(0.05, 0.32, 0),
    );
    const geo = new THREE.TubeGeometry(curve, 12, 0.045, 8, false);
    const mat = new THREE.MeshPhongMaterial({
      color, shininess: 20, specular: 0x3e2723,
    });
    group.add(new THREE.Mesh(geo, mat));
    group.position.set(0, 1.55, 0);
    return group;
  }

  // Листик с прожилками
  createLeaf(color = 0x4caf50, scale = 1) {
    const group = new THREE.Group();

    // Основная пластина листа
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo( 0.32, 0.08,  0.52, 0.52,  0.40, 0.98);
    shape.bezierCurveTo( 0.26, 1.14,  0.06, 1.04,  0,    0.96);
    shape.bezierCurveTo(-0.06, 1.04, -0.26, 1.14, -0.40, 0.98);
    shape.bezierCurveTo(-0.52, 0.52, -0.32, 0.08,  0,    0);

    const geo = new THREE.ShapeGeometry(shape, 12);
    const mat = new THREE.MeshPhongMaterial({
      color,
      shininess: 60,
      specular: 0xaed581,
      side: THREE.DoubleSide,
    });
    const leaf = new THREE.Mesh(geo, mat);
    leaf.castShadow = true;
    group.add(leaf);

    // Центральная прожилка
    const veinCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.02, 0.01),
      new THREE.Vector3(0.02, 0.5, 0.01),
      new THREE.Vector3(0.01, 0.94, 0.01),
    );
    const veinGeo = new THREE.TubeGeometry(veinCurve, 8, 0.012, 4, false);
    const veinMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color).multiplyScalar(0.7),
      shininess: 30,
    });
    group.add(new THREE.Mesh(veinGeo, veinMat));

    // Боковые прожилки
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + i * 0.18;
      const sideX = i % 2 === 0 ? 0.22 : -0.22;
      const sVein = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(t * 0.04, t, 0.01),
        new THREE.Vector3(sideX * 0.6, t + 0.12, 0.01),
        new THREE.Vector3(sideX, t + 0.05, 0.01),
      );
      const sGeo = new THREE.TubeGeometry(sVein, 4, 0.007, 4, false);
      group.add(new THREE.Mesh(sGeo, veinMat));
    }

    group.scale.setScalar(scale * 0.5);
    group.position.set(0.12, 1.72, 0.02);
    group.rotation.set(0.1, 0.4, -0.25);
    return group;
  }

  // Блик
  createHighlight(opacity = 0.28) {
    const geo = new THREE.SphereGeometry(0.38, 20, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfffde7, transparent: true, opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.46, 0.58, 0.94);
    mesh.scale.set(1.1, 0.65, 0.26);
    return mesh;
  }

  // Вспомогательные методы
  _makeHalo(r, tube, color, opacity, rotX = Math.PI / 2) {
    const geo = new THREE.TorusGeometry(r, tube, 16, 100);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = rotX;
    return mesh;
  }

  _makeSpike(color, emissiveColor = 0x000000, emissiveIntensity = 0) {
    const geo = new THREE.ConeGeometry(0.08, 0.44, 7);
    const mat = new THREE.MeshPhongMaterial({
      color,
      shininess: 80,
      specular: 0xffffff,
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity,
    });
    return new THREE.Mesh(geo, mat);
  }

  _makeSphere(r, color, opacity = 1) {
    const geo = new THREE.SphereGeometry(r, 10, 10);
    const mat = opacity < 1
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
      : new THREE.MeshBasicMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  // Частицы вокруг манго (общий метод)
  _makeParticleCloud(count, radius, colors, sizeRange, userData = {}) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const r = radius.min + Math.random() * (radius.max - radius.min);
      const angle = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const col = colors[Math.floor(Math.random() * colors.length)];
      const size = sizeRange.min + Math.random() * (sizeRange.max - sizeRange.min);
      const s = this._makeSphere(size, col, 0.8 + Math.random() * 0.2);
      s.position.setFromSphericalCoords(r, phi, angle);
      Object.assign(s.userData, userData, {
        particleOffset: Math.random() * Math.PI * 2,
      });
      group.add(s);
    }
    return group;
  }

  // ───────────────────────── ОЧИСТКА ─────────────────────────

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
        const mats = Array.isArray(child.material)
          ? child.material : [child.material];
        mats.forEach(m => {
          Object.values(m).forEach(v => {
            if (v && v.isTexture) v.dispose();
          });
          m.dispose();
        });
      }
    });
  }

  // ───────────────────────── СКИНЫ ─────────────────────────

  setSkin(skinId) {
    this.currentSkinId = skinId;
    this.clearMango();
    this.mangoGroup = new THREE.Group();
    const builder = this.skinBuilders[skinId]
      || this.skinBuilders['mango_default'];
    builder.call(this);
    this.scene.add(this.mangoGroup);
  }

  // ═══════════════════════════════════════════════════════════
  //                    SKIN BUILDERS
  // ═══════════════════════════════════════════════════════════

  skinBuilders = {

    // ── COMMON ─────────────────────────────────────────────

    'default': function () {
      this.skinBuilders['mango_default'].call(this);
    },

    'mango_default': function () {
      this._setAccentLight(0xff9800, 2.0);

      // Основное тело — сочный оранжевый
      const body = this.createMangoBody(0xff9800, {
        shininess: 130,
        specular: 0xffe0b2,
      });
      this.mangoGroup.add(body);

      // Зеленовато-красный градиент у основания (имитация через второй слой)
      const blush = this.createMangoBody(0xe53935, {
        transparent: true, opacity: 0.18, shininess: 40,
      });
      blush.scale.set(1.001, 0.5, 1.001);
      blush.position.y = -0.55;
      this.mangoGroup.add(blush);

      this.mangoGroup.add(this.createHighlight(0.28));
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf(0x4caf50));

      // Второй листик
      const leaf2 = this.createLeaf(0x388e3c);
      leaf2.position.set(-0.14, 1.72, 0.05);
      leaf2.rotation.set(0.05, -0.65, 0.18);
      this.mangoGroup.add(leaf2);
    },

    'mango_green': function () {
      this._setAccentLight(0x7cb342, 2.0);
      const body = this.createMangoBody(0x8bc34a, { shininess: 110, specular: 0xdcedc8 });
      this.mangoGroup.add(body);

      // Жёлтый переход у хвостика
      const tip = this.createMangoBody(0xfdd835, { transparent: true, opacity: 0.22 });
      tip.scale.set(1.001, 0.3, 1.001);
      tip.position.y = 0.8;
      this.mangoGroup.add(tip);

      this.mangoGroup.add(this.createHighlight(0.2));
      this.mangoGroup.add(this.createStem(0x33691e));
      this.mangoGroup.add(this.createLeaf(0x1b5e20));
      const l2 = this.createLeaf(0x33691e);
      l2.position.set(-0.13, 1.72, 0.04);
      l2.rotation.set(0, -0.7, 0.15);
      this.mangoGroup.add(l2);
    },

    'mango_small': function () {
      this._setAccentLight(0xffb74d, 1.8);
      const body = this.createMangoBody(0xffb74d, { shininess: 120 });
      body.scale.setScalar(0.72);
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.22));
      const stem = this.createStem();
      stem.scale.setScalar(0.72);
      stem.position.y = -0.35;
      this.mangoGroup.add(stem);
      const leaf = this.createLeaf(0x4caf50, 0.72);
      leaf.position.y = 1.15;
      this.mangoGroup.add(leaf);
    },

    'mango_round': function () {
      this._setAccentLight(0xffa726, 2.0);
      // Идеально круглый — обычная сфера
      const geo = new THREE.SphereGeometry(1.28, 96, 96);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffa726, shininess: 140, specular: 0xffe082,
      });
      const body = new THREE.Mesh(geo, mat);
      body.castShadow = true;
      body.receiveShadow = true;
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.3));
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_spotted': function () {
      this._setAccentLight(0xff7043, 2.0);
      this.mangoGroup.add(this.createMangoBody(0xff8f00, { shininess: 80 }));
      // Пятна — выпуклые, как настоящие
      for (let i = 0; i < 14; i++) {
        const geo = new THREE.SphereGeometry(0.072, 14, 14);
        const mat = new THREE.MeshPhongMaterial({
          color: 0x4e342e, shininess: 50,
        });
        const spot = new THREE.Mesh(geo, mat);
        spot.castShadow = true;
        const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
        const phi = Math.PI * 0.18 + (i % 4) * (Math.PI * 0.65 / 4);
        spot.position.setFromSphericalCoords(1.18, phi, angle);
        spot.position.y *= 1.35;
        this.mangoGroup.add(spot);
      }
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    // ── UNCOMMON ────────────────────────────────────────────

    'mango_golden_light': function () {
      this._setAccentLight(0xffd740, 3.0);
      // PBR для металлика — золото должно блестеть
      this.mangoGroup.add(this.createMangoBody(0xffd54f, {
        usePBR: true, roughness: 0.15, metalness: 0.7,
      }));
      this.mangoGroup.add(this.createHighlight(0.38));
      this.mangoGroup.add(this.createStem(0x8d6e63));
      this.mangoGroup.add(this.createLeaf(0x558b2f));

      // Золотое свечение
      const glow = new THREE.PointLight(0xffd700, 1.5, 5);
      this.mangoGroup.add(glow);
    },

    'mango_red': function () {
      this._setAccentLight(0xe53935, 2.5);
      this.mangoGroup.add(this.createMangoBody(0xe53935, {
        shininess: 150,
        specular: 0xff8a80,
        emissive: 0xb71c1c,
        emissiveIntensity: 0.12,
      }));

      // Тёмные прожилки
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.TorusGeometry(0.9 - i * 0.04, 0.018, 6, 24, Math.PI * 0.3);
        const mat = new THREE.MeshBasicMaterial({ color: 0x7f0000 });
        const vein = new THREE.Mesh(geo, mat);
        vein.rotation.z = (i / 5) * Math.PI * 2;
        vein.rotation.x = Math.PI / 2 + i * 0.3;
        this.mangoGroup.add(vein);
      }

      this.mangoGroup.add(this.createHighlight(0.22));
      this.mangoGroup.add(this.createStem(0x3e2723));
      this.mangoGroup.add(this.createLeaf(0x1b5e20));
    },

    'mango_striped': function () {
      this._setAccentLight(0xff7043, 2.0);
      this.mangoGroup.add(this.createMangoBody(0xff8f00, { shininess: 100 }));
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.TorusGeometry(
          1.14 - i * 0.03, 0.048, 12, 60,
        );
        const mat = new THREE.MeshPhongMaterial({
          color: 0x4e342e, shininess: 60,
        });
        const stripe = new THREE.Mesh(geo, mat);
        stripe.rotation.x = Math.PI / 2;
        stripe.position.y = -0.9 + i * 0.48;
        stripe.scale.y = 0.7;
        stripe.castShadow = true;
        this.mangoGroup.add(stripe);
      }
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_neon_green': function () {
      this._setAccentLight(0x76ff03, 4.0);
      this.mangoGroup.add(this.createMangoBody(0x76ff03, {
        shininess: 200,
        specular: 0xccff90,
        emissive: 0x33691e,
        emissiveIntensity: 0.8,
      }));

      // Пульсирующие концентрические ореолы
      for (let i = 0; i < 3; i++) {
        const halo = this._makeHalo(1.45 + i * 0.15, 0.025, 0x76ff03, 0.5 - i * 0.12);
        halo.userData.pulseHalo = true;
        halo.userData.pulseOffset = (i / 3) * Math.PI;
        this.mangoGroup.add(halo);
      }

      const glow = new THREE.PointLight(0x76ff03, 3.0, 8);
      this.mangoGroup.add(glow);
      this.mangoGroup.add(this.createStem(0x33691e));
      this.mangoGroup.add(this.createLeaf(0xaeea00));
    },

    'mango_tropical': function () {
      this._setAccentLight(0xff6f00, 2.2);
      this.mangoGroup.add(this.createMangoBody(0xff6f00, { shininess: 110 }));
      this.mangoGroup.add(this.createHighlight(0.25));
      this.mangoGroup.add(this.createStem(0x388e3c));
      // 4 листа — как тропическая пальма
      for (let i = 0; i < 4; i++) {
        const leaf = this.createLeaf(0x1b5e20, 0.9);
        leaf.rotation.y = (i / 4) * Math.PI * 2;
        leaf.position.set(
          Math.cos((i / 4) * Math.PI * 2) * 0.08,
          1.62,
          Math.sin((i / 4) * Math.PI * 2) * 0.08,
        );
        this.mangoGroup.add(leaf);
      }
    },

    // ── RARE ────────────────────────────────────────────────

    'mango_crystal': function () {
      this._setAccentLight(0x80deea, 3.5);

      // Полупрозрачное тело — PBR для правильного преломления
      const body = this.createMangoBody(0x80deea, {
        usePBR: true,
        roughness: 0.04,
        metalness: 0.15,
        transparent: true,
        opacity: 0.55,
      });
      this.mangoGroup.add(body);

      // Внутреннее свечение
      const inner = this.createMangoBody(0x00e5ff, {
        transparent: true, opacity: 0.25,
        emissive: 0x00e5ff, emissiveIntensity: 0.8,
      });
      inner.scale.setScalar(0.85);
      this.mangoGroup.add(inner);

      // Кристаллы — октаэдры разных размеров
      for (let i = 0; i < 12; i++) {
        const size = 0.22 + Math.random() * 0.14;
        const geo = new THREE.OctahedronGeometry(size);
        const mat = new THREE.MeshPhongMaterial({
          color: [0xe0f7fa, 0xb2ebf2, 0x80deea, 0x4dd0e1][i % 4],
          shininess: 220,
          specular: 0xffffff,
          transparent: true,
          opacity: 0.82,
        });
        const crystal = new THREE.Mesh(geo, mat);
        crystal.castShadow = true;
        const angle = (i / 12) * Math.PI * 2;
        const phi = (0.2 + (i % 4) * 0.18) * Math.PI;
        const r = 0.5 + Math.random() * 0.15;
        crystal.position.setFromSphericalCoords(r, phi, angle);
        crystal.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI, 0,
        );
        crystal.userData.spin = true;
        crystal.userData.spinSpeed = 0.01 + Math.random() * 0.008;
        this.mangoGroup.add(crystal);
      }

      const cLight = new THREE.PointLight(0x00e5ff, 3.0, 8);
      this.mangoGroup.add(cLight);
      this.mangoGroup.add(this.createStem(0x37474f));
      this.mangoGroup.add(this.createLeaf(0x00bcd4));
    },

    'mango_ice': function () {
      this._setAccentLight(0x81d4fa, 3.0);

      const body = this.createMangoBody(0xe1f5fe, {
        usePBR: true, roughness: 0.06, metalness: 0.1,
        transparent: true, opacity: 0.68,
      });
      this.mangoGroup.add(body);

      // Морозный узор — кольца
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.TorusGeometry(
          0.5 + i * 0.22, 0.012, 8, 40, Math.PI * (0.6 + i * 0.15),
        );
        const mat = new THREE.MeshBasicMaterial({
          color: 0xb3e5fc, transparent: true, opacity: 0.7,
        });
        const frost = new THREE.Mesh(geo, mat);
        frost.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI, 0,
        );
        this.mangoGroup.add(frost);
      }

      // Ледяные шипы
      for (let i = 0; i < 20; i++) {
        const geo = new THREE.ConeGeometry(0.055, 0.42, 7);
        const mat = new THREE.MeshPhongMaterial({
          color: 0xe1f5fe, shininess: 220, specular: 0xffffff,
          transparent: true, opacity: 0.9,
        });
        const spike = new THREE.Mesh(geo, mat);
        spike.castShadow = true;
        const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.2;
        const phi = Math.PI * 0.2 + (i % 5) * (Math.PI * 0.62 / 5);
        spike.position.setFromSphericalCoords(1.3, phi, angle);
        spike.position.y *= 1.35;
        spike.lookAt(0, 0, 0);
        spike.rotateX(Math.PI / 2);
        this.mangoGroup.add(spike);
      }

      // Снежинки
      for (let i = 0; i < 30; i++) {
        const s = this._makeSphere(0.028, 0xffffff, 0.85);
        const a = Math.random() * Math.PI * 2;
        const r = 1.65 + Math.random() * 0.55;
        s.position.set(
          Math.cos(a) * r,
          (Math.random() - 0.5) * 2.8,
          Math.sin(a) * r,
        );
        s.userData.snow = true;
        s.userData.snowOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      const iceLight = new THREE.PointLight(0xb3e5fc, 2.5, 9);
      this.mangoGroup.add(iceLight);
      this.mangoGroup.add(this.createStem(0x37474f));
    },

    'mango_fire': function () {
      this._setAccentLight(0xff5722, 4.0);

      // Тёмное лавовое тело с яркими прожилками
      this.mangoGroup.add(this.createMangoBody(0xbf360c, {
        shininess: 60,
        specular: 0xff6d00,
        emissive: 0xff3d00,
        emissiveIntensity: 0.55,
      }));

      // Лавовые трещины-прожилки
      for (let i = 0; i < 10; i++) {
        const geo = new THREE.TorusGeometry(
          1.16 - i * 0.01, 0.018, 6, 30, Math.PI * (0.3 + Math.random() * 0.3),
        );
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xff9800 : 0xffeb3b,
        });
        const crack = new THREE.Mesh(geo, mat);
        crack.rotation.set(
          Math.random() * Math.PI, (i / 10) * Math.PI * 2, 0,
        );
        this.mangoGroup.add(crack);
      }

      // Огненные языки
      const fireGroup = new THREE.Group();
      fireGroup.userData.isFire = true;
      for (let i = 0; i < 32; i++) {
        const r = 0.06 + Math.random() * 0.1;
        const geo = new THREE.SphereGeometry(r, 8, 8);
        const colors = [0xff9800, 0xffeb3b, 0xff5722, 0xff6d00];
        const mat = new THREE.MeshBasicMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          transparent: true, opacity: 0.8,
        });
        const fire = new THREE.Mesh(geo, mat);
        fire.position.set(
          (Math.random() - 0.5) * 0.7,
          1.25 + Math.random() * 1.8,
          (Math.random() - 0.5) * 0.7,
        );
        fire.userData.speed  = 0.02 + Math.random() * 0.035;
        fire.userData.startY = fire.position.y;
        fire.userData.startX = fire.position.x;
        fire.userData.startZ = fire.position.z;
        fire.userData.phase  = Math.random() * Math.PI * 2;
        fireGroup.add(fire);
      }
      this.mangoGroup.add(fireGroup);

      // Мерцающий огненный свет
      const fl = new THREE.PointLight(0xff5722, 4.0, 10);
      fl.position.set(0, 0.5, 0);
      fl.userData.flickerLight = true;
      this.mangoGroup.add(fl);

      this.mangoGroup.add(this.createStem(0x3e2723));
    },

    'mango_electric': function () {
      this._setAccentLight(0x00e5ff, 3.5);
      this.mangoGroup.add(this.createMangoBody(0x1565c0, {
        shininess: 200,
        specular: 0x80d8ff,
        emissive: 0x0d47a1,
        emissiveIntensity: 0.4,
      }));

      // Электрические арки
      const arcGroup = new THREE.Group();
      arcGroup.userData.isArcs = true;
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.TorusGeometry(
          1.32 + i * 0.05, 0.022, 8, 50,
        );
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00e5ff : 0xffd740,
          transparent: true, opacity: 0.75,
        });
        const arc = new THREE.Mesh(geo, mat);
        arc.rotation.set(
          Math.random() * Math.PI, Math.random() * Math.PI, 0,
        );
        arc.userData.arcSpeed = (Math.random() - 0.5) * 0.08;
        arcGroup.add(arc);
      }
      this.mangoGroup.add(arcGroup);

      // Электрические искры
      const sparks = this._makeParticleCloud(
        25, { min: 1.38, max: 1.8 },
        [0x00e5ff, 0xffd740, 0xffffff],
        { min: 0.035, max: 0.055 },
        { twinkle: true },
      );
      this.mangoGroup.add(sparks);

      const eLight = new THREE.PointLight(0x00bcd4, 3.0, 9);
      this.mangoGroup.add(eLight);
      this.mangoGroup.add(this.createStem());
    },

    'mango_rainbow': function () {
      this._setAccentLight(0xff4081, 2.5);
      // Радужный градиент по вершинам
      const geo = new THREE.SphereGeometry(1.2, 96, 96);
      const pos = geo.attributes.position;
      const colArr = [];
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const taper = 1 - Math.abs(y) * 0.13;
        const asymX = 1 + Math.sin(y * 1.5) * 0.04;
        pos.setXYZ(i, pos.getX(i) * taper * asymX, y * 1.35, pos.getZ(i) * taper);
        const hue = i / pos.count;
        const c = new THREE.Color().setHSL(hue, 1.0, 0.60);
        colArr.push(c.r, c.g, c.b);
      }
      geo.computeVertexNormals();
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      const mat = new THREE.MeshPhongMaterial({
        vertexColors: true, shininess: 160, specular: 0xffffff,
      });
      const body = new THREE.Mesh(geo, mat);
      body.castShadow = true;
      body.userData.isRainbow = true;
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight(0.22));
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_steampunk': function () {
      this._setAccentLight(0xb87333, 2.5);
      this.mangoGroup.add(this.createMangoBody(0xb87333, {
        usePBR: true, roughness: 0.45, metalness: 0.88,
      }));

      // Шестерёнки с зубьями
      for (let g = 0; g < 4; g++) {
        const gGroup = new THREE.Group();
        const angle = (g / 4) * Math.PI * 2;
        gGroup.position.set(
          Math.cos(angle) * 1.38, (g % 2 === 0 ? 0.2 : -0.2), Math.sin(angle) * 1.38,
        );

        // Диск шестерёнки
        const diskGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.1, 18);
        const diskMat = new THREE.MeshPhongMaterial({
          color: 0x8d6e63, shininess: 120, specular: 0xd7ccc8,
        });
        gGroup.add(new THREE.Mesh(diskGeo, diskMat));

        // Зубья
        for (let t = 0; t < 10; t++) {
          const toothGeo = new THREE.BoxGeometry(0.06, 0.1, 0.065);
          const tooth = new THREE.Mesh(toothGeo, diskMat);
          const ta = (t / 10) * Math.PI * 2;
          tooth.position.set(Math.cos(ta) * 0.26, 0, Math.sin(ta) * 0.26);
          tooth.rotation.y = ta;
          gGroup.add(tooth);
        }

        // Центральное отверстие (болт)
        const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8);
        const boltMat = new THREE.MeshPhongMaterial({
          color: 0x37474f, shininess: 200,
        });
        gGroup.add(new THREE.Mesh(boltGeo, boltMat));

        gGroup.rotation.x = Math.PI / 2;
        gGroup.userData.spin = true;
        gGroup.userData.spinSpeed = (g % 2 === 0 ? 1 : -1) * 0.022;
        this.mangoGroup.add(gGroup);
      }

      // Медные трубки
      for (let i = 0; i < 3; i++) {
        const pipeGeo = new THREE.TorusGeometry(
          1.48, 0.065, 12, 24, Math.PI * 0.55,
        );
        const pipeMat = new THREE.MeshPhongMaterial({
          color: 0x6d4c41, shininess: 180, specular: 0xd7ccc8,
        });
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.rotation.set(
          Math.PI / 2, (i / 3) * Math.PI * 2, 0,
        );
        this.mangoGroup.add(pipe);
      }

      // Дым из трубок
      for (let i = 0; i < 18; i++) {
        const s = this._makeSphere(
          0.05 + Math.random() * 0.05, 0x90a4ae, 0.28,
        );
        s.position.set(
          (Math.random() - 0.5) * 3.2,
          1.1 + Math.random() * 1.6,
          (Math.random() - 0.5) * 3.2,
        );
        s.userData.smoke = true;
        s.userData.smokeOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      this.mangoGroup.add(this.createStem(0x3e2723));
    },

    // ── EPIC ────────────────────────────────────────────────

    'mango_diamond': function () {
      this._setAccentLight(0xe3f2fd, 5.0);

      // Гранёное тело — низкополигональный алмаз
      const geo = new THREE.IcosahedronGeometry(1.3, 2);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xb3e5fc,
        shininess: 300,
        specular: 0xffffff,
        transparent: true,
        opacity: 0.65,
        flatShading: true,
      });
      const body = new THREE.Mesh(geo, mat);
      body.scale.y = 1.3;
      body.castShadow = true;
      this.mangoGroup.add(body);

      // Каркас
      const wireGeo = geo.clone();
      wireGeo.scale(1, 1.3, 1);
      const wire = new THREE.Mesh(
        wireGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff, wireframe: true,
          transparent: true, opacity: 0.12,
        }),
      );
      this.mangoGroup.add(wire);

      // Летающие искры
      const sparks = this._makeParticleCloud(
        45, { min: 1.6, max: 2.3 },
        [0xffffff, 0xe3f2fd, 0x80d8ff],
        { min: 0.022, max: 0.04 },
        { twinkle: true },
      );
      this.mangoGroup.add(sparks);

      const dLight = new THREE.PointLight(0xe3f2fd, 4.5, 12);
      this.mangoGroup.add(dLight);
      this.mangoGroup.add(this.createStem(0x37474f));
    },

    'mango_plasma': function () {
      this._setAccentLight(0xce93d8, 4.0);
      this.mangoGroup.add(this.createMangoBody(0x6a1b9a, {
        shininess: 180,
        specular: 0xe040fb,
        emissive: 0x4a148c,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.85,
      }));

      // Плазменные кольца — разные плоскости
      for (let i = 0; i < 5; i++) {
        const ring = this._makeHalo(
          1.42 + i * 0.16, 0.038,
          i % 2 === 0 ? 0xe040fb : 0xb388ff,
          0.58 - i * 0.06,
        );
        ring.rotation.set(
          (i / 5) * Math.PI, (i / 5) * Math.PI * 0.5, 0,
        );
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.02;
        ring.userData.spinAxis = i % 2 === 0 ? 'z' : 'x';
        this.mangoGroup.add(ring);
      }

      // Плазменные шары по орбите
      for (let i = 0; i < 14; i++) {
        const s = this._makeSphere(
          0.065, i % 2 === 0 ? 0xe040fb : 0xb388ff, 0.85,
        );
        const a = (i / 14) * Math.PI * 2;
        s.userData.orbit = true;
        s.userData.orbitAngle  = a;
        s.userData.orbitRadius = 1.75;
        s.userData.orbitSpeed  = 0.018;
        s.userData.orbitYAmp   = 0.4;
        this.mangoGroup.add(s);
      }

      const pLight = new THREE.PointLight(0xe040fb, 4.0, 10);
      this.mangoGroup.add(pLight);
    },

    'mango_void': function () {
      this._setAccentLight(0x7c4dff, 3.0);
      // Абсолютно чёрное тело с лёгким фиолетовым отсветом
      this.mangoGroup.add(this.createMangoBody(0x0a0010, {
        usePBR: true, roughness: 0.02, metalness: 0.95,
      }));

      // Звёздное поле — два слоя
      const stars = this._makeParticleCloud(
        90, { min: 1.7, max: 3.0 },
        [0xffffff, 0x9c27b0, 0x3d5afe, 0xe040fb],
        { min: 0.016, max: 0.032 },
        { twinkle: true },
      );
      this.mangoGroup.add(stars);

      // Гравитационные кольца
      for (let i = 0; i < 4; i++) {
        const ring = this._makeHalo(
          1.5 + i * 0.25, 0.022, 0x9c27b0, 0.38,
          Math.PI / 2 + i * 0.45,
        );
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.012;
        this.mangoGroup.add(ring);
      }

      const vLight = new THREE.PointLight(0x7c4dff, 2.5, 10);
      this.mangoGroup.add(vLight);
    },

    'mango_cyberpunk': function () {
      this._setAccentLight(0x00e5ff, 3.5);
      this.mangoGroup.add(this.createMangoBody(0x0d1b2a, {
        usePBR: true, roughness: 0.15, metalness: 0.9,
        emissive: 0x00e5ff, emissiveIntensity: 0.35,
      }));

      // Голографические линии
      for (let i = 0; i < 12; i++) {
        const geo = new THREE.TorusGeometry(
          1.22 + i * 0.035, 0.015, 4, 48,
        );
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00e5ff : 0xff00ff,
          transparent: true, opacity: 0.48,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = (i / 12) * Math.PI;
        ring.rotation.y = (i / 12) * Math.PI;
        this.mangoGroup.add(ring);
      }

      // Скан-линии
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.PlaneGeometry(3.5, 0.022);
        const mat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00e5ff : 0xff00ff,
          transparent: true, opacity: 0.32,
          side: THREE.DoubleSide,
        });
        const scan = new THREE.Mesh(geo, mat);
        scan.position.y = -1.6 + i * 0.45;
        scan.userData.scanLine = true;
        scan.userData.scanSpeed = 0.014 + i * 0.001;
        this.mangoGroup.add(scan);
      }

      const cLight = new THREE.PointLight(0x00e5ff, 3.0, 9);
      this.mangoGroup.add(cLight);
    },

    'mango_ancient': function () {
      this._setAccentLight(0xffd54f, 2.5);
      this.mangoGroup.add(this.createMangoBody(0x8d6e63, {
        shininess: 40, specular: 0xd7ccc8,
      }));

      // Золотые руны по орбите
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.RingGeometry(0.14, 0.26, 6);
        const mat = new THREE.MeshPhongMaterial({
          color: 0xffd54f, shininess: 200,
          specular: 0xfffde7,
          side: THREE.DoubleSide,
          emissive: 0xffa000, emissiveIntensity: 0.35,
        });
        const rune = new THREE.Mesh(geo, mat);
        const angle = (i / 8) * Math.PI * 2;
        rune.position.set(
          Math.cos(angle) * 1.4,
          Math.sin(angle * 1.5) * 0.55,
          Math.sin(angle) * 1.4,
        );
        rune.lookAt(0, 0, 0);
        rune.userData.slowSpin = true;
        rune.userData.spinPhase = angle;
        this.mangoGroup.add(rune);
      }

      // Экваториальное золотое кольцо
      const ring = this._makeHalo(1.48, 0.058, 0xffd54f, 0.75);
      this.mangoGroup.add(ring);

      const aLight = new THREE.PointLight(0xffd54f, 2.0, 8);
      this.mangoGroup.add(aLight);
    },

    // ── LEGENDARY ───────────────────────────────────────────

    'mango_golden': function () {
      this._setAccentLight(0xffd700, 5.0);
      this.mangoGroup.add(this.createMangoBody(0xffd700, {
        usePBR: true, roughness: 0.06, metalness: 1.0,
        emissive: 0xffa000, emissiveIntensity: 0.28,
      }));

      // Корона с зубцами
      const crownBase = new THREE.Mesh(
        new THREE.TorusGeometry(1.02, 0.09, 14, 50),
        new THREE.MeshPhongMaterial({
          color: 0xffd700, shininess: 250, specular: 0xfffde7,
        }),
      );
      crownBase.position.y = 1.78;
      this.mangoGroup.add(crownBase);

      for (let i = 0; i < 9; i++) {
        const spike = this._makeSpike(0xffeb3b, 0xffd54f, 0.65);
        spike.scale.set(1.1, 1.5, 1.1);
        const angle = (i / 9) * Math.PI * 2;
        spike.position.set(
          Math.cos(angle) * 1.02, 2.05, Math.sin(angle) * 1.02,
        );
        spike.lookAt(Math.cos(angle) * 2.2, 3.1, Math.sin(angle) * 2.2);
        this.mangoGroup.add(spike);
      }

      // Золотые искры
      const sparks = this._makeParticleCloud(
        40, { min: 1.8, max: 2.8 },
        [0xffd700, 0xffeb3b, 0xffa000],
        { min: 0.025, max: 0.045 },
        { twinkle: true },
      );
      this.mangoGroup.add(sparks);

      const gLight = new THREE.PointLight(0xffd700, 5.0, 16);
      this.mangoGroup.add(gLight);
    },

    'mango_galaxy': function () {
      this._setAccentLight(0x7c4dff, 4.0);
      this.mangoGroup.add(this.createMangoBody(0x1a237e, {
        shininess: 200, specular: 0x9c27b0,
        emissive: 0x4a148c, emissiveIntensity: 0.5,
      }));

      // Спиральная галактика — 3 рукава
      const galaxy = new THREE.Group();
      galaxy.userData.isGalaxy = true;
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 90; i++) {
          const t = i / 90;
          const angle = t * Math.PI * 5 + (arm / 3) * Math.PI * 2;
          const r = 1.5 + t * 1.3;
          const col = [0xffffff, 0xe040fb, 0x00bcd4, 0xffeb3b][
            Math.floor(Math.random() * 4)
          ];
          const s = this._makeSphere(
            0.018 + Math.random() * 0.028, col,
            0.75 + Math.random() * 0.25,
          );
          s.position.set(
            Math.cos(angle) * r,
            (Math.random() - 0.5) * 0.28,
            Math.sin(angle) * r,
          );
          s.userData.twinkle = true;
          s.userData.twinkleOffset = Math.random() * Math.PI * 2;
          galaxy.add(s);
        }
      }
      this.mangoGroup.add(galaxy);

      const gxLight = new THREE.PointLight(0x7c4dff, 3.5, 14);
      this.mangoGroup.add(gxLight);
    },

    'mango_dragon': function () {
      this._setAccentLight(0xff6d00, 4.0);
      this.mangoGroup.add(this.createMangoBody(0x1a0030, {
        shininess: 200, specular: 0x9c27b0,
        emissive: 0x4a0000, emissiveIntensity: 0.4,
      }));

      // Чешуя — 4 ряда конусов
      for (let row = 0; row < 4; row++) {
        const count = 8 + row * 3;
        for (let i = 0; i < count; i++) {
          const geo = new THREE.ConeGeometry(
            0.072 - row * 0.008, 0.38 + row * 0.04, 6,
          );
          const mat = new THREE.MeshPhongMaterial({
            color: [0x6a0080, 0x4a148c, 0x311b92, 0x1a237e][row],
            shininess: 160,
            specular: 0xe040fb,
            emissive: 0xff3d00,
            emissiveIntensity: 0.25,
          });
          const scale = new THREE.Mesh(geo, mat);
          scale.castShadow = true;
          const angle = (i / count) * Math.PI * 2;
          const y = 0.82 - row * 0.52;
          scale.position.set(
            Math.cos(angle) * 1.3, y, Math.sin(angle) * 1.3,
          );
          scale.lookAt(Math.cos(angle) * 2.8, y + 0.5, Math.sin(angle) * 2.8);
          this.mangoGroup.add(scale);
        }
      }

      // Светящиеся глаза
      for (let side = -1; side <= 1; side += 2) {
        const eyeGeo = new THREE.SphereGeometry(0.13, 18, 18);
        const eyeMat = new THREE.MeshPhongMaterial({
          color: 0xff6d00,
          emissive: 0xff3d00,
          emissiveIntensity: 1.8,
          shininess: 200,
        });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(side * 0.44, 0.62, 1.06);
        this.mangoGroup.add(eye);
        const eL = new THREE.PointLight(0xff3d00, 2.0, 3.5);
        eL.position.copy(eye.position);
        this.mangoGroup.add(eL);
      }
    },

    'mango_phoenix': function () {
      this._setAccentLight(0xff6f00, 4.5);
      this.mangoGroup.add(this.createMangoBody(0xff6f00, {
        shininess: 180,
        specular: 0xffcc02,
        emissive: 0xff3d00,
        emissiveIntensity: 0.9,
      }));

      // Крылья
      for (let side = -1; side <= 1; side += 2) {
        const wingGroup = new THREE.Group();
        for (let f = 0; f < 7; f++) {
          const fShape = new THREE.Shape();
          fShape.moveTo(0, 0);
          fShape.quadraticCurveTo(
            0.55, 0.25 + f * 0.08, 1.1 + f * 0.12, 0.85 + f * 0.28,
          );
          fShape.quadraticCurveTo(0.7, 0.2, 0, 0);
          const fGeo = new THREE.ShapeGeometry(fShape);
          const fMat = new THREE.MeshBasicMaterial({
            color: [0xff9800, 0xffeb3b, 0xff5722][f % 3],
            transparent: true,
            opacity: 0.82 - f * 0.07,
            side: THREE.DoubleSide,
          });
          const feather = new THREE.Mesh(fGeo, fMat);
          feather.rotation.z = -f * 0.16;
          wingGroup.add(feather);
        }
        wingGroup.position.set(side * 1.15, 0.12, 0);
        wingGroup.scale.x = side;
        wingGroup.userData.flap = true;
        wingGroup.userData.flapOffset = side === -1 ? 0 : Math.PI * 0.28;
        wingGroup.userData.flapAmp = 0.58;
        this.mangoGroup.add(wingGroup);
      }

      // Огненный хвост
      for (let i = 0; i < 35; i++) {
        const s = this._makeSphere(
          0.045 + Math.random() * 0.075,
          [0xff9800, 0xffeb3b, 0xff5722][i % 3],
          0.75,
        );
        s.position.set(
          (Math.random() - 0.5) * 0.45,
          -1.4 - Math.random() * 1.1,
          (Math.random() - 0.5) * 0.45,
        );
        s.userData.tailFire = true;
        s.userData.tailOffset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(s);
      }

      const fLight = new THREE.PointLight(0xff5722, 4.5, 14);
      fLight.userData.flickerLight = true;
      this.mangoGroup.add(fLight);
    },

    // ── MYTHIC ──────────────────────────────────────────────

    'mango_celestial': function () {
      this._setAccentLight(0xfff9c4, 6.0);
      this.mangoGroup.add(this.createMangoBody(0xfff8e1, {
        shininess: 300,
        specular: 0xffffff,
        emissive: 0xffeb3b,
        emissiveIntensity: 0.95,
      }));

      // Ореолы
      for (let i = 0; i < 5; i++) {
        const halo = this._makeHalo(
          1.62 - i * 0.16, 0.04 - i * 0.002,
          0xffeb3b, 0.82 - i * 0.14,
        );
        halo.position.y = 1.55 + i * 0.28;
        halo.userData.slowSpin = true;
        halo.userData.spinPhase = (i / 5) * Math.PI;
        this.mangoGroup.add(halo);
      }

      // Лучи
      for (let i = 0; i < 18; i++) {
        const geo = new THREE.PlaneGeometry(0.065, 3.2);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfffde7, transparent: true, opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const ray = new THREE.Mesh(geo, mat);
        const a = (i / 18) * Math.PI * 2;
        ray.position.set(Math.cos(a) * 0.42, -0.1, Math.sin(a) * 0.42);
        ray.rotation.y = -a;
        ray.userData.rayFade = true;
        ray.userData.rayOffset = a;
        this.mangoGroup.add(ray);
      }

      const cLight  = new THREE.PointLight(0xffeb3b, 6.0, 16);
      const cLight2 = new THREE.PointLight(0xffffff, 2.5, 9);
      cLight2.position.set(0, 2.5, 0);
      this.mangoGroup.add(cLight);
      this.mangoGroup.add(cLight2);
    },

    'mango_quantum': function () {
      this._setAccentLight(0x00e676, 4.0);
      for (let i = 0; i < 5; i++) {
        const body = this.createMangoBody(0x00e676, {
          transparent: true, opacity: 0.30 + i * 0.04,
          emissive: 0x00c853, emissiveIntensity: 0.7,
          shininess: 160,
        });
        body.scale.setScalar(1 - i * 0.08);
        body.userData.quantum = true;
        body.userData.qOffset = (i / 5) * Math.PI * 2;
        body.userData.qSpeed  = 1.8 + i * 0.3;
        this.mangoGroup.add(body);
      }

      for (let i = 0; i < 3; i++) {
        const ring = this._makeHalo(1.52 + i * 0.14, 0.028, 0x00e676, 0.58, 0);
        ring.rotation.set((i / 3) * Math.PI * 2 / 3, (i / 3) * Math.PI, 0);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.028;
        this.mangoGroup.add(ring);
      }

      const qLight = new THREE.PointLight(0x00e676, 3.5, 10);
      this.mangoGroup.add(qLight);
    },

    'mango_time': function () {
      this._setAccentLight(0x8e24aa, 3.5);
      this.mangoGroup.add(this.createMangoBody(0x4a148c, {
        shininess: 200, specular: 0xce93d8,
        emissive: 0x6a1b9a, emissiveIntensity: 0.55,
      }));

      // Циферблат
      const faceGeo = new THREE.CircleGeometry(1.24, 80);
      const faceMat = new THREE.MeshBasicMaterial({
        color: 0x12003a, transparent: true, opacity: 0.72,
        side: THREE.DoubleSide,
      });
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.z = 1.02;
      this.mangoGroup.add(face);

      // Метки
      for (let i = 0; i < 12; i++) {
        const isMain = i % 3 === 0;
        const geo = new THREE.BoxGeometry(
          isMain ? 0.068 : 0.038,
          isMain ? 0.19 : 0.11,
          0.02,
        );
        const mat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
        const tick = new THREE.Mesh(geo, mat);
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        tick.position.set(Math.cos(a) * 1.04, Math.sin(a) * 1.04, 1.03);
        tick.rotation.z = a;
        this.mangoGroup.add(tick);
      }

      // Часовая стрелка
      const hGeo = new THREE.BoxGeometry(0.05, 0.56, 0.02);
      const hMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
      const hour = new THREE.Mesh(hGeo, hMat);
      hour.position.set(0, 0.28, 1.04);
      hour.userData.isClock = true;
      hour.userData.clockSpeed = 0.007;
      hour.userData.pivotY = 0;
      this.mangoGroup.add(hour);

      // Минутная
      const mGeo = new THREE.BoxGeometry(0.034, 0.82, 0.02);
      const mMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
      const minute = new THREE.Mesh(mGeo, mMat);
      minute.position.set(0, 0.41, 1.05);
      minute.userData.isClock = true;
      minute.userData.clockSpeed = 0.042;
      minute.userData.pivotY = 0;
      this.mangoGroup.add(minute);

      // Секундная (красная)
      const sGeo = new THREE.BoxGeometry(0.022, 0.98, 0.02);
      const sMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
      const second = new THREE.Mesh(sGeo, sMat);
      second.position.set(0, 0.49, 1.06);
      second.userData.isClock = true;
      second.userData.clockSpeed = 0.25;
      second.userData.pivotY = 0;
      this.mangoGroup.add(second);

      for (let i = 0; i < 3; i++) {
        const ring = this._makeHalo(1.42 + i * 0.18, 0.028, 0xab47bc, 0.48, Math.PI / 2);
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.018;
        this.mangoGroup.add(ring);
      }
    },

    // ── DIVINE ──────────────────────────────────────────────

    'mango_divine': function () {
      this._setAccentLight(0xffeb3b, 7.0);
      this.mangoGroup.add(this.createMangoBody(0xffd700, {
        usePBR: true, roughness: 0.04, metalness: 1.0,
        emissive: 0xffab00, emissiveIntensity: 1.0,
      }));

      // Корона
      const crownBase = new THREE.Mesh(
        new THREE.TorusGeometry(1.08, 0.095, 16, 60),
        new THREE.MeshPhongMaterial({
          color: 0xffd700, shininess: 280, specular: 0xfffde7,
        }),
      );
      crownBase.position.y = 1.82;
      this.mangoGroup.add(crownBase);

      for (let i = 0; i < 10; i++) {
        const spike = this._makeSpike(0xffd700, 0xffeb3b, 0.9);
        spike.scale.set(1.2, 1.55, 1.2);
        const angle = (i / 10) * Math.PI * 2;
        spike.position.set(
          Math.cos(angle) * 1.08, 2.1, Math.sin(angle) * 1.08,
        );
        spike.lookAt(Math.cos(angle) * 2.5, 3.4, Math.sin(angle) * 2.5);
        this.mangoGroup.add(spike);

        // Рубин на каждом зубце
        const gemGeo = new THREE.OctahedronGeometry(0.09);
        const gemMat = new THREE.MeshPhongMaterial({
          color: 0xff1744, shininess: 300, specular: 0xffffff,
          emissive: 0xff1744, emissiveIntensity: 0.6,
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(
          Math.cos(angle) * 1.08, 2.35, Math.sin(angle) * 1.08,
        );
        this.mangoGroup.add(gem);
      }

      // Лучи
      for (let i = 0; i < 18; i++) {
        const geo = new THREE.PlaneGeometry(0.13, 5.0);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xfffde7, transparent: true, opacity: 0.2,
          side: THREE.DoubleSide,
        });
        const ray = new THREE.Mesh(geo, mat);
        const a = (i / 18) * Math.PI * 2;
        ray.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        ray.rotation.y = -a;
        ray.userData.rayFade = true;
        ray.userData.rayOffset = a;
        this.mangoGroup.add(ray);
      }

      const dLight  = new THREE.PointLight(0xffeb3b, 7.0, 20);
      const dLight2 = new THREE.PointLight(0xffffff, 3.5, 12);
      dLight2.position.set(0, 3.2, 0);
      this.mangoGroup.add(dLight);
      this.mangoGroup.add(dLight2);
    },

    'mango_eternal': function () {
      this._setAccentLight(0xffeb3b, 4.5);

      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const body = this.createMangoBody(0xffe082, {
          usePBR: true, roughness: 0.06, metalness: 0.92,
          emissive: 0xffd54f, emissiveIntensity: 0.6,
        });
        body.scale.setScalar(0.62);
        body.userData.eternal = true;
        body.userData.eternalOffset = side * Math.PI * 0.5;
        body.userData.eternalSide   = side;
        this.mangoGroup.add(body);
      }

      // Поток частиц вдоль лемнискаты
      for (let i = 0; i < 50; i++) {
        const s = this._makeSphere(0.038, 0xffeb3b, 0.85);
        s.userData.eternalStream = true;
        s.userData.eternalT = i / 50;
        this.mangoGroup.add(s);
      }

      const eLight = new THREE.PointLight(0xffeb3b, 4.5, 14);
      this.mangoGroup.add(eLight);
    },

    // ── COSMIC ──────────────────────────────────────────────

    'mango_cosmic': function () {
      this._setAccentLight(0xe040fb, 5.0);
      this.mangoGroup.add(this.createMangoBody(0x4a148c, {
        shininess: 200, specular: 0xe040fb,
        emissive: 0x6a1b9a, emissiveIntensity: 0.85,
      }));

      // Кольца Сатурна
      const ringColors = [0xe040fb, 0x7c4dff, 0x00bcd4, 0xff4081, 0xffeb3b];
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.RingGeometry(
          1.55 + i * 0.22, 1.65 + i * 0.22, 100,
        );
        const mat = new THREE.MeshBasicMaterial({
          color: ringColors[i], side: THREE.DoubleSide,
          transparent: true, opacity: 0.65 - i * 0.07,
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = Math.PI / 2 + 0.28;
        ring.userData.spin = true;
        ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.009;
        this.mangoGroup.add(ring);
      }

      // Луны с орбитами
      for (let i = 0; i < 4; i++) {
        const moonGroup = new THREE.Group();
        const moonGeo = new THREE.SphereGeometry(0.14, 24, 24);
        const moonMat = new THREE.MeshPhongMaterial({
          color: 0xbdbdbd, shininess: 30,
        });
        moonGroup.add(new THREE.Mesh(moonGeo, moonMat));
        const orbitR    = 2.0 + i * 0.4;
        const initAngle = (i / 4) * Math.PI * 2;
        moonGroup.userData.orbit      = true;
        moonGroup.userData.orbitAngle = initAngle;
        moonGroup.userData.orbitRadius= orbitR;
        moonGroup.userData.orbitSpeed = 0.012 - i * 0.002;
        moonGroup.userData.orbitTilt  = i * 0.22;
        this.mangoGroup.add(moonGroup);
      }

      const coLight = new THREE.PointLight(0xe040fb, 4.5, 16);
      this.mangoGroup.add(coLight);
    },

    'mango_singularity': function () {
      this._setAccentLight(0xff00ff, 6.0);
      this.mangoGroup.add(this.createMangoBody(0x000000, {
        usePBR: true, roughness: 0.0, metalness: 1.0,
        emissive: 0x4a0080, emissiveIntensity: 0.55,
      }));

      // Аккреционные диски
      const diskColors = [0xff00ff, 0x00bcd4, 0xff9800];
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.RingGeometry(
          1.5 + i * 0.52, 2.0 + i * 0.52, 100,
        );
        const mat = new THREE.MeshBasicMaterial({
          color: diskColors[i], side: THREE.DoubleSide,
          transparent: true, opacity: 0.78 - i * 0.16,
        });
        const disk = new THREE.Mesh(geo, mat);
        disk.rotation.x = Math.PI / 2 + 0.4 + i * 0.14;
        disk.userData.spin = true;
        disk.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * 0.013;
        this.mangoGroup.add(disk);
      }

      // Спираль из засасываемых частиц
      for (let i = 0; i < 80; i++) {
        const col = [0xff00ff, 0x00bcd4, 0xffffff, 0xff9800][i % 4];
        const s = this._makeSphere(0.038 + Math.random() * 0.03, col, 0.88);
        s.userData.isSingularity = true;
        s.userData.singAngle  = Math.random() * Math.PI * 2;
        s.userData.singRadius = 2.0 + Math.random() * 1.5;
        s.userData.singSpeed  = 0.018 + Math.random() * 0.022;
        s.userData.singY      = (Math.random() - 0.5) * 0.38;
        this.mangoGroup.add(s);
      }

      const sLight = new THREE.PointLight(0xff00ff, 6.0, 18);
      this.mangoGroup.add(sLight);
    },
  };

  // ═══════════════════════════════════════════════════════════
  //                      АНИМАЦИЯ
  // ═══════════════════════════════════════════════════════════

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.clock += 0.016;
    const t = this.clock;

    if (this.mangoGroup) {
      this.mangoGroup.rotation.y += 0.007;
      this.mangoGroup.rotation.x  = Math.sin(t * 0.45) * 0.04;
      this.mangoGroup.position.y  = Math.sin(t * 0.75) * 0.08;

      this.mangoGroup.traverse(obj => {
        if (!obj.userData) return;
        const ud = obj.userData;

        if (ud.spin) {
          const sp = ud.spinSpeed ?? 0.022;
          const ax = ud.spinAxis  ?? 'z';
          obj.rotation[ax] += sp;
          if (ax === 'z') obj.rotation.x += Math.abs(sp) * 0.4;
        }

        if (ud.twinkle) {
          const s = 0.4 + Math.abs(
            Math.sin(t * 4.5 + (ud.twinkleOffset ?? 0))
          ) * 0.65;
          obj.scale.setScalar(s);
          if (obj.material) obj.material.opacity = 0.45 + s * 0.45;
        }

        if (ud.flap) {
          obj.rotation.z = Math.sin(
            t * 3.5 + (ud.flapOffset ?? 0)
          ) * (ud.flapAmp ?? 0.55);
        }

        if (ud.isFire) {
          obj.children.forEach(fire => {
            const fu = fire.userData;
            fire.position.y += fu.speed;
            fire.position.x  = fu.startX + Math.sin(t * 6 + fu.phase) * 0.09;
            fire.position.z  = fu.startZ + Math.cos(t * 5 + fu.phase) * 0.09;
            const prog = (fire.position.y - fu.startY) / 2.0;
            if (prog >= 1) {
              fire.position.y = fu.startY;
              fire.position.x = fu.startX;
              fire.position.z = fu.startZ;
            }
            if (fire.material) fire.material.opacity = 0.85 * (1 - prog);
            fire.scale.setScalar(Math.max(0.1, 1 - prog * 0.6));
          });
        }

        if (ud.flickerLight && obj.isLight) {
          obj.intensity = 3.5 + Math.sin(t * 14) * 0.8
            + Math.sin(t * 23) * 0.5;
        }

        if (ud.isArcs) {
          obj.children.forEach(arc => {
            arc.rotation.x += arc.userData.arcSpeed ?? 0.05;
            arc.rotation.y += (arc.userData.arcSpeed ?? 0.05) * 0.65;
          });
        }

        // Стрелки часов — вращение вокруг центра
        if (ud.isClock) {
          obj.rotation.z -= ud.clockSpeed ?? 0.01;
          // Смещаем центр вращения к основанию стрелки
          const h = (obj.geometry?.parameters?.height ?? 0.56) / 2;
          obj.position.x = Math.sin(obj.rotation.z) * h;
          obj.position.y = Math.cos(obj.rotation.z) * h;
        }

        if (ud.rayFade) {
          if (obj.material) {
            obj.material.opacity = 0.14 + Math.sin(
              t * 1.4 + (ud.rayOffset ?? 0)
            ) * 0.11;
          }
        }

        if (ud.pulseHalo) {
          const sc = 1 + Math.sin(t * 2.8 + (ud.pulseOffset ?? 0)) * 0.1;
          obj.scale.setScalar(sc);
          if (obj.material) {
            obj.material.opacity = 0.38 + Math.sin(
              t * 2.8 + (ud.pulseOffset ?? 0)
            ) * 0.18;
          }
        }

        if (ud.slowSpin) {
          obj.rotation.z += 0.005;
        }

        if (ud.isGalaxy) {
          obj.rotation.y += 0.0038;
        }

        if (ud.orbit) {
          ud.orbitAngle += ud.orbitSpeed ?? 0.015;
          const r    = ud.orbitRadius ?? 2.0;
          const tilt = ud.orbitTilt   ?? 0;
          obj.position.x = Math.cos(ud.orbitAngle) * r;
          obj.position.z = Math.sin(ud.orbitAngle) * r;
          obj.position.y = Math.sin(ud.orbitAngle + tilt)
            * r * Math.sin(tilt + 0.1);
        }

        if (ud.quantum) {
          const qA = t * (ud.qSpeed ?? 2) + (ud.qOffset ?? 0);
          obj.position.x = Math.sin(qA * 0.9) * 0.3;
          obj.position.y = Math.cos(qA * 1.1) * 0.3;
          obj.position.z = Math.sin(qA * 0.75) * 0.3;
        }

        if (ud.eternal) {
          const ea = t + (ud.eternalOffset ?? 0);
          obj.position.x = Math.cos(ea) * 0.84;
          obj.position.y = Math.sin(ea * 2) * 0.24;
          obj.rotation.y = ea;
        }

        if (ud.eternalStream) {
          const et  = (ud.eternalT + t * 0.22) % 1.0;
          const ea  = et * Math.PI * 2;
          obj.position.x = Math.cos(ea) * 0.84;
          obj.position.y = Math.sin(ea * 2) * 0.24;
          obj.position.z = Math.sin(ea) * 0.24;
          if (obj.material) {
            obj.material.opacity = 0.35 + Math.abs(Math.sin(ea * 2)) * 0.5;
          }
        }

        if (ud.isSingularity) {
          ud.singAngle  += ud.singSpeed;
          ud.singRadius -= 0.0045;
          if (ud.singRadius < 1.42) {
            ud.singRadius = 2.0 + Math.random() * 1.5;
            ud.singAngle  = Math.random() * Math.PI * 2;
          }
          obj.position.x = Math.cos(ud.singAngle) * ud.singRadius;
          obj.position.z = Math.sin(ud.singAngle) * ud.singRadius;
          obj.position.y = ud.singY;
          const sc = Math.max(0.1, ud.singRadius / 3.5);
          obj.scale.setScalar(sc);
          if (obj.material) obj.material.opacity = Math.min(0.9, sc * 1.1);
        }

        if (ud.snow) {
          obj.position.y += Math.sin(t * 1.4 + (ud.snowOffset ?? 0)) * 0.003;
          obj.position.x += Math.cos(t * 0.8 + (ud.snowOffset ?? 0)) * 0.0018;
        }

        if (ud.smoke) {
          obj.position.y += 0.009;
          obj.scale.addScalar(0.0018);
          if (obj.material) obj.material.opacity -= 0.0028;
          if ((obj.material?.opacity ?? 0) <= 0 || obj.position.y > 3.2) {
            obj.position.set(
              (Math.random() - 0.5) * 3.2, 1.1, (Math.random() - 0.5) * 3.2,
            );
            obj.scale.setScalar(0.8);
            if (obj.material) obj.material.opacity = 0.28;
          }
        }

        if (ud.tailFire) {
          obj.position.y -= 0.016;
          obj.position.x += Math.sin(t * 4.5 + (ud.tailOffset ?? 0)) * 0.01;
          if (obj.position.y < -3.0) {
            obj.position.y = -1.35 - Math.random() * 0.55;
          }
          if (obj.material) {
            const prog = Math.max(0, (-obj.position.y - 1.35) / 1.65);
            obj.material.opacity = Math.max(0, 0.75 * (1 - prog));
          }
        }

        if (ud.scanLine) {
          obj.position.y += ud.scanSpeed ?? 0.013;
          if (obj.position.y > 1.65) obj.position.y = -1.65;
          if (obj.material) {
            obj.material.opacity = 0.28 * (
              1 - Math.abs(obj.position.y) / 1.65
            );
          }
        }

        if (ud.isRainbow && obj.geometry?.attributes?.color) {
          const cols = obj.geometry.attributes.color;
          for (let i = 0; i < cols.count; i++) {
            const hue = ((i / cols.count) + t * 0.07) % 1;
            const c = new THREE.Color().setHSL(hue, 1.0, 0.60);
            cols.setXYZ(i, c.r, c.g, c.b);
          }
          cols.needsUpdate = true;
        }
      });
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //                  ВСПОМОГАТЕЛЬНЫЕ
  // ═══════════════════════════════════════════════════════════

  pulse() {
    if (!this.mangoGroup) return;
    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(elapsed / 180, 1);
      // Squash & Stretch
      const squeeze = Math.sin(p * Math.PI);
      if (this.mangoGroup) {
        this.mangoGroup.scale.set(
          1 + squeeze * 0.16,
          1 - squeeze * 0.16,
          1 + squeeze * 0.16,
        );
      }
      if (p < 1) requestAnimationFrame(animate);
      else if (this.mangoGroup) this.mangoGroup.scale.set(1, 1, 1);
    };
    requestAnimationFrame(animate);
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
    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    this.isInitialized = false;
  }
}
