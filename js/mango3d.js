// js/mango3d.js
// Настоящее 3D с уникальными моделями для каждого скина

let THREE_LOADED = false;

export class Mango3D {
  constructor(containerId) {
    this.containerId = containerId;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mangoGroup = null;
    this.particles = null;
    this.animationId = null;
    this.isInitialized = false;
    this.currentSkinId = 'mango_default';
    this.clock = 0;
    this.lights = [];
    this.specialEffects = []; // массив для огня, льда и т.д.
  }

  async init() {
    if (this.isInitialized) return;

    if (!window.THREE) {
      await this.loadThreeJS();
    }

    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.scene = new THREE.Scene();

    const size = Math.min(container.offsetWidth, container.offsetHeight);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    // Очищаем контейнер от старого canvas
    const oldCanvas = container.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();

    container.appendChild(this.renderer.domElement);

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

  setupBaseLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    this.lights.push(ambient);

    const main = new THREE.DirectionalLight(0xffffff, 1.0);
    main.position.set(3, 5, 3);
    this.scene.add(main);
    this.lights.push(main);

    const fill = new THREE.DirectionalLight(0xffaa55, 0.5);
    fill.position.set(-2, -2, 1);
    this.scene.add(fill);
    this.lights.push(fill);

    const rim = new THREE.DirectionalLight(0xff6d00, 0.6);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);
    this.lights.push(rim);
  }

  // ===== БАЗОВАЯ ФОРМА МАНГО =====
  createMangoBody(color, options = {}) {
    const {
      shininess = 60,
      specular = 0xffd54f,
      emissive = 0x000000,
      emissiveIntensity = 0,
      metalness = false,
      transparent = false,
      opacity = 1.0,
      wireframe = false
    } = options;

    const geometry = new THREE.SphereGeometry(1.2, 64, 64);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const newY = y * 1.3;
      const taper = 1 - Math.abs(y) * 0.15;
      positions.setX(i, x * taper);
      positions.setZ(i, z * taper);
      positions.setY(i, newY);
    }
    geometry.computeVertexNormals();

    let material;
    if (metalness) {
      material = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.9,
        roughness: 0.2,
        emissive: emissive,
        emissiveIntensity: emissiveIntensity,
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        color: color,
        specular: specular,
        shininess: shininess,
        emissive: emissive,
        emissiveIntensity: emissiveIntensity,
        transparent: transparent,
        opacity: opacity,
        wireframe: wireframe,
      });
    }

    return new THREE.Mesh(geometry, material);
  }

  // ===== СТЕБЕЛЁК =====
  createStem(color = 0x5d4037) {
    const geometry = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8);
    const material = new THREE.MeshPhongMaterial({ color, shininess: 10 });
    const stem = new THREE.Mesh(geometry, material);
    stem.position.set(0, 1.65, 0);
    return stem;
  }

  // ===== ЛИСТИК =====
  createLeaf(color = 0x4caf50) {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.3, 0.1, 0.5, 0.5, 0.4, 0.9);
    leafShape.bezierCurveTo(0.3, 1.1, 0.1, 1.0, 0, 0.95);
    leafShape.bezierCurveTo(-0.1, 1.0, -0.3, 1.1, -0.4, 0.9);
    leafShape.bezierCurveTo(-0.5, 0.5, -0.3, 0.1, 0, 0);

    const geometry = new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.05, bevelEnabled: true, bevelSegments: 2,
      bevelSize: 0.02, bevelThickness: 0.02,
    });

    const material = new THREE.MeshPhongMaterial({
      color, shininess: 40, side: THREE.DoubleSide,
    });

    const leaf = new THREE.Mesh(geometry, material);
    leaf.scale.set(0.5, 0.5, 0.5);
    leaf.position.set(0.15, 1.7, 0);
    leaf.rotation.z = -0.3;
    leaf.rotation.y = 0.5;
    return leaf;
  }

  // ===== БЛИК =====
  createHighlight() {
    const geometry = new THREE.SphereGeometry(0.35, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xfff9c4, transparent: true, opacity: 0.3,
    });
    const highlight = new THREE.Mesh(geometry, material);
    highlight.position.set(-0.5, 0.5, 0.9);
    highlight.scale.set(1.2, 0.8, 0.3);
    return highlight;
  }

  // ===== ОЧИСТКА СЦЕНЫ =====
  clearMango() {
    if (this.mangoGroup) {
      this.scene.remove(this.mangoGroup);
      this.disposeObject(this.mangoGroup);
    }
    this.specialEffects.forEach(eff => {
      this.scene.remove(eff);
      this.disposeObject(eff);
    });
    this.specialEffects = [];
  }

  disposeObject(obj) {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // ===== УСТАНОВКА СКИНА =====
  setSkin(skinId) {
    this.currentSkinId = skinId;
    this.clearMango();
    this.mangoGroup = new THREE.Group();

    // Определяем какой скин показать
    const builder = this.skinBuilders[skinId] || this.skinBuilders['default'];
    builder.call(this);

    this.scene.add(this.mangoGroup);
  }

  // ===== БИЛДЕРЫ СКИНОВ =====
  skinBuilders = {
    // === COMMON ===
    'default': function() {
      this.mangoGroup.add(this.createMangoBody(0xffa726));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_default': function() {
      this.mangoGroup.add(this.createMangoBody(0xffa726));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_green': function() {
      this.mangoGroup.add(this.createMangoBody(0x9ccc65));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf(0x33691e));
    },

    'mango_small': function() {
      const body = this.createMangoBody(0xffb74d);
      body.scale.set(0.7, 0.7, 0.7);
      this.mangoGroup.add(body);
      this.mangoGroup.add(this.createHighlight());
      const stem = this.createStem();
      stem.scale.set(0.7, 0.7, 0.7);
      stem.position.y *= 0.7;
      this.mangoGroup.add(stem);
      const leaf = this.createLeaf();
      leaf.scale.set(0.35, 0.35, 0.35);
      leaf.position.y *= 0.7;
      this.mangoGroup.add(leaf);
    },

    'mango_round': function() {
      const geo = new THREE.SphereGeometry(1.2, 64, 64);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffa726, specular: 0xffd54f, shininess: 60,
      });
      this.mangoGroup.add(new THREE.Mesh(geo, mat));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_spotted': function() {
      this.mangoGroup.add(this.createMangoBody(0xff9800));
      // Добавляем пятнышки
      for (let i = 0; i < 12; i++) {
        const spotGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const spotMat = new THREE.MeshPhongMaterial({ color: 0x6d4c41 });
        const spot = new THREE.Mesh(spotGeo, spotMat);
        const angle = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 1.18;
        spot.position.set(
          r * Math.sin(phi) * Math.cos(angle),
          (r * Math.cos(phi)) * 1.3,
          r * Math.sin(phi) * Math.sin(angle)
        );
        this.mangoGroup.add(spot);
      }
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    // === UNCOMMON ===
    'mango_golden_light': function() {
      this.mangoGroup.add(this.createMangoBody(0xffd54f, {
        shininess: 100, specular: 0xfff9c4,
      }));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_red': function() {
      this.mangoGroup.add(this.createMangoBody(0xe53935, {
        shininess: 80, specular: 0xff8a80,
      }));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_striped': function() {
      this.mangoGroup.add(this.createMangoBody(0xff9800));
      // Полоски через торы
      for (let i = 0; i < 4; i++) {
        const torusGeo = new THREE.TorusGeometry(1.0, 0.05, 8, 32);
        const torusMat = new THREE.MeshPhongMaterial({ color: 0x4e342e });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        torus.rotation.x = Math.PI / 2;
        torus.position.y = -0.8 + i * 0.5;
        torus.scale.y = 0.8;
        this.mangoGroup.add(torus);
      }
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_neon_green': function() {
      this.mangoGroup.add(this.createMangoBody(0x76ff03, {
        emissive: 0x33ff00, emissiveIntensity: 0.5,
        shininess: 100,
      }));
      // Свечение
      const glowLight = new THREE.PointLight(0x76ff03, 1, 5);
      glowLight.position.set(0, 0, 0);
      this.mangoGroup.add(glowLight);
      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf(0xaeea00));
    },

    'mango_tropical': function() {
      this.mangoGroup.add(this.createMangoBody(0xff6f00, {
        shininess: 80,
      }));
      this.mangoGroup.add(this.createHighlight());
      this.mangoGroup.add(this.createStem(0x4caf50));
      // Несколько листьев (как пальма)
      for (let i = 0; i < 3; i++) {
        const leaf = this.createLeaf(0x2e7d32);
        leaf.rotation.y = (i / 3) * Math.PI * 2;
        leaf.scale.set(0.4, 0.4, 0.4);
        this.mangoGroup.add(leaf);
      }
    },

    // === RARE ===
    'mango_crystal': function() {
      const body = this.createMangoBody(0x80deea, {
        transparent: true, opacity: 0.6,
        shininess: 200, specular: 0xffffff,
      });
      this.mangoGroup.add(body);
      // Кристальные грани внутри
      for (let i = 0; i < 8; i++) {
        const crystalGeo = new THREE.OctahedronGeometry(0.3);
        const crystalMat = new THREE.MeshPhongMaterial({
          color: 0xb3e5fc, transparent: true, opacity: 0.8,
          shininess: 200,
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(
          Math.cos(i / 8 * Math.PI * 2) * 0.5,
          Math.sin(i / 8 * Math.PI) * 0.5,
          Math.sin(i / 8 * Math.PI * 2) * 0.5
        );
        crystal.userData.spin = true;
        this.mangoGroup.add(crystal);
      }
      this.mangoGroup.add(this.createStem(0x37474f));
      this.mangoGroup.add(this.createLeaf(0x00bcd4));
    },

    'mango_ice': function() {
      const body = this.createMangoBody(0x81d4fa, {
        transparent: true, opacity: 0.7,
        shininess: 150, specular: 0xffffff,
      });
      this.mangoGroup.add(body);

      // Ледяные шипы
      for (let i = 0; i < 15; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.08, 0.4, 6);
        const spikeMat = new THREE.MeshPhongMaterial({
          color: 0xe0f7fa, transparent: true, opacity: 0.9,
          shininess: 200,
        });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 1.3;
        spike.position.set(
          r * Math.sin(phi) * Math.cos(angle),
          (r * Math.cos(phi)) * 1.3,
          r * Math.sin(phi) * Math.sin(angle)
        );
        spike.lookAt(0, 0, 0);
        spike.rotateX(Math.PI / 2);
        this.mangoGroup.add(spike);
      }
      this.mangoGroup.add(this.createStem(0x37474f));
    },

    'mango_fire': function() {
      this.mangoGroup.add(this.createMangoBody(0xff5722, {
        emissive: 0xff3d00, emissiveIntensity: 0.6,
        shininess: 100,
      }));

      // Огненные частицы
      const fireParticles = new THREE.Group();
      for (let i = 0; i < 20; i++) {
        const fireGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const fireMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xff9800 : 0xffeb3b,
          transparent: true, opacity: 0.7,
        });
        const fire = new THREE.Mesh(fireGeo, fireMat);
        fire.position.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 0.5
        );
        fire.userData.speed = 0.02 + Math.random() * 0.03;
        fire.userData.startY = fire.position.y;
        fireParticles.add(fire);
      }
      fireParticles.userData.isFire = true;
      this.mangoGroup.add(fireParticles);

      // Огненное освещение
      const fireLight = new THREE.PointLight(0xff5722, 2, 8);
      fireLight.position.set(0, 0.5, 0);
      this.mangoGroup.add(fireLight);
      this.specialEffects.push(fireLight);

      this.mangoGroup.add(this.createStem(0x3e2723));
    },

    'mango_electric': function() {
      this.mangoGroup.add(this.createMangoBody(0xffeb3b, {
        emissive: 0xffc107, emissiveIntensity: 0.4,
        shininess: 150,
      }));

      // Электрические дуги
      const arcsGroup = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const arcGeo = new THREE.TorusGeometry(1.3 + i * 0.1, 0.03, 8, 32);
        const arcMat = new THREE.MeshBasicMaterial({
          color: 0x00bcd4, transparent: true, opacity: 0.6,
        });
        const arc = new THREE.Mesh(arcGeo, arcMat);
        arc.rotation.x = Math.random() * Math.PI;
        arc.rotation.y = Math.random() * Math.PI;
        arc.userData.spin = true;
        arcsGroup.add(arc);
      }
      arcsGroup.userData.isArcs = true;
      this.mangoGroup.add(arcsGroup);

      const elecLight = new THREE.PointLight(0x00bcd4, 1.5, 6);
      this.mangoGroup.add(elecLight);
      this.mangoGroup.add(this.createStem());
    },

    'mango_rainbow': function() {
      // Манго с радужным шейдером
      const geometry = new THREE.SphereGeometry(1.2, 64, 64);
      const positions = geometry.attributes.position;
      const colors = [];
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        const newY = y * 1.3;
        const taper = 1 - Math.abs(y) * 0.15;
        positions.setX(i, positions.getX(i) * taper);
        positions.setZ(i, positions.getZ(i) * taper);
        positions.setY(i, newY);

        // Радужный цвет
        const hue = (i / positions.count);
        const color = new THREE.Color().setHSL(hue, 1, 0.6);
        colors.push(color.r, color.g, color.b);
      }
      geometry.computeVertexNormals();
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.MeshPhongMaterial({
        vertexColors: true, shininess: 100,
      });
      const body = new THREE.Mesh(geometry, material);
      body.userData.isRainbow = true;
      this.mangoGroup.add(body);

      this.mangoGroup.add(this.createStem());
      this.mangoGroup.add(this.createLeaf());
    },

    'mango_steampunk': function() {
      this.mangoGroup.add(this.createMangoBody(0xb87333, {
        metalness: true, shininess: 100,
      }));

      // Шестерёнки
      for (let i = 0; i < 4; i++) {
        const gearGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8);
        const gearMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e63, metalness: 0.8, roughness: 0.3,
        });
        const gear = new THREE.Mesh(gearGeo, gearMat);
        const angle = (i / 4) * Math.PI * 2;
        gear.position.set(Math.cos(angle) * 1.3, 0, Math.sin(angle) * 1.3);
        gear.rotation.x = Math.PI / 2;
        gear.userData.spin = true;
        this.mangoGroup.add(gear);
      }

      // Трубки
      const pipeGeo = new THREE.TorusGeometry(1.4, 0.08, 8, 16, Math.PI);
      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x6d4c41, metalness: 0.9, roughness: 0.2,
      });
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.rotation.z = Math.PI / 2;
      this.mangoGroup.add(pipe);

      this.mangoGroup.add(this.createStem(0x3e2723));
    },

    // === EPIC ===
    'mango_diamond': function() {
      // Гранёное манго (икосаэдр)
      const geo = new THREE.IcosahedronGeometry(1.3, 1);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xb3e5fc, transparent: true, opacity: 0.7,
        shininess: 200, specular: 0xffffff,
        flatShading: true,
      });
      const body = new THREE.Mesh(geo, mat);
      body.scale.y = 1.3;
      this.mangoGroup.add(body);

      // Сияющие искры
      for (let i = 0; i < 30; i++) {
        const sparkGeo = new THREE.SphereGeometry(0.03, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.9,
        });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        const r = 1.5 + Math.random() * 0.5;
        const angle = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        spark.position.set(
          r * Math.sin(phi) * Math.cos(angle),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(angle)
        );
        spark.userData.twinkle = true;
        spark.userData.baseScale = 1;
        this.mangoGroup.add(spark);
      }
      this.mangoGroup.add(this.createStem(0x37474f));
    },

    'mango_plasma': function() {
      this.mangoGroup.add(this.createMangoBody(0xab47bc, {
        emissive: 0xe040fb, emissiveIntensity: 0.7,
        transparent: true, opacity: 0.8,
        shininess: 200,
      }));
      // Плазменные кольца
      for (let i = 0; i < 3; i++) {
        const ringGeo = new THREE.TorusGeometry(1.4 + i * 0.2, 0.05, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe040fb, transparent: true, opacity: 0.5,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = (i / 3) * Math.PI;
        ring.userData.spin = true;
        this.mangoGroup.add(ring);
      }
      const plasmaLight = new THREE.PointLight(0xe040fb, 2, 6);
      this.mangoGroup.add(plasmaLight);
    },

    'mango_void': function() {
      this.mangoGroup.add(this.createMangoBody(0x000000, {
        shininess: 100, specular: 0x9c27b0,
      }));
      // Звёзды внутри
      for (let i = 0; i < 50; i++) {
        const starGeo = new THREE.SphereGeometry(0.02, 4, 4);
        const starMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xffffff : 0x9c27b0,
        });
        const star = new THREE.Mesh(starGeo, starMat);
        const r = 1 + Math.random() * 0.3;
        const angle = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        star.position.set(
          r * Math.sin(phi) * Math.cos(angle),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(angle)
        );
        star.userData.twinkle = true;
        this.mangoGroup.add(star);
      }
    },

    'mango_cyberpunk': function() {
      this.mangoGroup.add(this.createMangoBody(0x1a237e, {
        metalness: true, shininess: 150,
        emissive: 0x00e5ff, emissiveIntensity: 0.3,
      }));
      // Неоновые линии
      for (let i = 0; i < 8; i++) {
        const lineGeo = new THREE.TorusGeometry(1.2, 0.02, 4, 32);
        const lineMat = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x00e5ff : 0xff00ff,
        });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = (i / 8) * Math.PI;
        line.rotation.y = (i / 8) * Math.PI;
        this.mangoGroup.add(line);
      }
      const cyberLight = new THREE.PointLight(0x00e5ff, 1.5, 5);
      this.mangoGroup.add(cyberLight);
    },

    'mango_ancient': function() {
      this.mangoGroup.add(this.createMangoBody(0x8d6e63, {
        shininess: 30,
      }));
      // Древние руны (кольца)
      for (let i = 0; i < 6; i++) {
        const runeGeo = new THREE.RingGeometry(0.2, 0.3, 6);
        const runeMat = new THREE.MeshBasicMaterial({
          color: 0xffd54f,
          side: THREE.DoubleSide,
          transparent: true, opacity: 0.7,
        });
        const rune = new THREE.Mesh(runeGeo, runeMat);
        const angle = (i / 6) * Math.PI * 2;
        rune.position.set(
          Math.cos(angle) * 1.3,
          Math.sin(angle * 2) * 0.5,
          Math.sin(angle) * 1.3
        );
        rune.lookAt(0, 0, 0);
        this.mangoGroup.add(rune);
      }
    },

    // === LEGENDARY ===
    'mango_golden': function() {
      this.mangoGroup.add(this.createMangoBody(0xffd700, {
        metalness: true, shininess: 300,
      }));
      // Золотая корона из звёзд
      for (let i = 0; i < 8; i++) {
        const starGeo = new THREE.ConeGeometry(0.1, 0.3, 5);
        const starMat = new THREE.MeshStandardMaterial({
          color: 0xffeb3b, metalness: 0.9, roughness: 0.1,
          emissive: 0xffd54f, emissiveIntensity: 0.5,
        });
        const star = new THREE.Mesh(starGeo, starMat);
        const angle = (i / 8) * Math.PI * 2;
        star.position.set(Math.cos(angle) * 1.5, 1.8, Math.sin(angle) * 1.5);
        star.lookAt(0, 0, 0);
        star.rotateX(Math.PI / 2);
        this.mangoGroup.add(star);
      }
      const goldLight = new THREE.PointLight(0xffd700, 2, 8);
      this.mangoGroup.add(goldLight);
    },

    'mango_galaxy': function() {
      this.mangoGroup.add(this.createMangoBody(0x1a237e, {
        shininess: 200,
        emissive: 0x673ab7, emissiveIntensity: 0.4,
      }));

      // Спиральная галактика вокруг
      const galaxyGroup = new THREE.Group();
      for (let i = 0; i < 100; i++) {
        const starGeo = new THREE.SphereGeometry(0.03, 4, 4);
        const starMat = new THREE.MeshBasicMaterial({
          color: [0xffffff, 0xe040fb, 0x00bcd4, 0xffeb3b][Math.floor(Math.random() * 4)],
        });
        const star = new THREE.Mesh(starGeo, starMat);
        const angle = (i / 100) * Math.PI * 8;
        const radius = 1.5 + (i / 100) * 1;
        star.position.set(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 0.3,
          Math.sin(angle) * radius
        );
        galaxyGroup.add(star);
      }
      galaxyGroup.userData.isGalaxy = true;
      this.mangoGroup.add(galaxyGroup);
    },

    'mango_dragon': function() {
      this.mangoGroup.add(this.createMangoBody(0x4a148c, {
        shininess: 150,
        emissive: 0x6a1b9a, emissiveIntensity: 0.3,
        specular: 0xe040fb,
      }));
      // Драконьи шипы
      for (let i = 0; i < 10; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.1, 0.4, 5);
        const spikeMat = new THREE.MeshPhongMaterial({
          color: 0x311b92, shininess: 200,
          emissive: 0xff5722, emissiveIntensity: 0.5,
        });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = (i / 10) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 1.3, 0.3, Math.sin(angle) * 1.3);
        spike.lookAt(0, 1, 0);
        spike.rotateX(-Math.PI / 4);
        this.mangoGroup.add(spike);
      }
    },

    'mango_phoenix': function() {
      this.mangoGroup.add(this.createMangoBody(0xff6f00, {
        emissive: 0xff3d00, emissiveIntensity: 0.8,
        shininess: 200,
      }));
      // Крылья феникса
      for (let side = -1; side <= 1; side += 2) {
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.quadraticCurveTo(1.5, 0.5, 2, 1.5);
        wingShape.quadraticCurveTo(1.5, 0.3, 0, 0);
        const wingGeo = new THREE.ShapeGeometry(wingShape);
        const wingMat = new THREE.MeshBasicMaterial({
          color: 0xff9800, transparent: true, opacity: 0.7,
          side: THREE.DoubleSide,
        });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(side * 1.2, 0, 0);
        wing.scale.x = side;
        wing.userData.flap = true;
        this.mangoGroup.add(wing);
      }
      const fireLight = new THREE.PointLight(0xff5722, 3, 10);
      this.mangoGroup.add(fireLight);
    },

    // === MYTHIC ===
    'mango_celestial': function() {
      this.mangoGroup.add(this.createMangoBody(0xfff9c4, {
        emissive: 0xffeb3b, emissiveIntensity: 0.6,
        shininess: 300, specular: 0xffffff,
      }));
      // Ангельские кольца
      for (let i = 0; i < 3; i++) {
        const haloGeo = new THREE.TorusGeometry(1.6 - i * 0.2, 0.04, 8, 64);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xffeb3b, transparent: true, opacity: 0.8 - i * 0.2,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 1.5 + i * 0.3;
        this.mangoGroup.add(halo);
      }
      const celestLight = new THREE.PointLight(0xffeb3b, 3, 10);
      this.mangoGroup.add(celestLight);
    },

    'mango_quantum': function() {
      // Квантовое - множество перекрывающихся манго
      for (let i = 0; i < 5; i++) {
        const body = this.createMangoBody(0x00e676, {
          transparent: true, opacity: 0.4,
          emissive: 0x00e676, emissiveIntensity: 0.5,
        });
        body.scale.set(1 - i * 0.1, 1 - i * 0.1, 1 - i * 0.1);
        body.position.set(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3
        );
        body.userData.quantum = true;
        body.userData.offset = Math.random() * Math.PI * 2;
        this.mangoGroup.add(body);
      }
      const quantLight = new THREE.PointLight(0x00e676, 2, 8);
      this.mangoGroup.add(quantLight);
    },

    'mango_time': function() {
      this.mangoGroup.add(this.createMangoBody(0x8e24aa, {
        shininess: 200,
        emissive: 0xab47bc, emissiveIntensity: 0.4,
      }));
      // Часовые стрелки и циферблат
      for (let i = 0; i < 12; i++) {
        const tickGeo = new THREE.BoxGeometry(0.05, 0.15, 0.02);
        const tickMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
        const tick = new THREE.Mesh(tickGeo, tickMat);
        const angle = (i / 12) * Math.PI * 2;
        tick.position.set(Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, 0);
        this.mangoGroup.add(tick);
      }
      // Стрелка
      const handGeo = new THREE.BoxGeometry(0.04, 1.0, 0.02);
      const handMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
      const hand = new THREE.Mesh(handGeo, handMat);
      hand.position.y = 0.5;
      hand.userData.isClock = true;
      this.mangoGroup.add(hand);
    },

    // === DIVINE ===
    'mango_divine': function() {
      this.mangoGroup.add(this.createMangoBody(0xffeb3b, {
        metalness: true, shininess: 400,
        emissive: 0xffd700, emissiveIntensity: 0.8,
      }));
      // Корона
      const crownGroup = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.1, 0.5, 4);
        const spikeMat = new THREE.MeshStandardMaterial({
          color: 0xffd700, metalness: 1.0, roughness: 0.1,
          emissive: 0xffeb3b, emissiveIntensity: 0.6,
        });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = (i / 8) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 1.0, 1.8, Math.sin(angle) * 1.0);
        crownGroup.add(spike);
      }
      this.mangoGroup.add(crownGroup);

      // Божественное свечение
      const divineLight = new THREE.PointLight(0xffeb3b, 4, 12);
      this.mangoGroup.add(divineLight);

      // Лучи света
      for (let i = 0; i < 12; i++) {
        const rayGeo = new THREE.PlaneGeometry(0.1, 3);
        const rayMat = new THREE.MeshBasicMaterial({
          color: 0xfff9c4, transparent: true, opacity: 0.3,
          side: THREE.DoubleSide,
        });
        const ray = new THREE.Mesh(rayGeo, rayMat);
        const angle = (i / 12) * Math.PI * 2;
        ray.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
        ray.lookAt(0, 0, 0);
        ray.userData.isRay = true;
        this.mangoGroup.add(ray);
      }
    },

    'mango_eternal': function() {
      // Бесконечный символ - два манго
      for (let i = -1; i <= 1; i += 2) {
        const body = this.createMangoBody(0xffe082, {
          metalness: true, shininess: 300,
          emissive: 0xffd54f, emissiveIntensity: 0.5,
        });
        body.scale.set(0.6, 0.6, 0.6);
        body.position.x = i * 0.8;
        body.userData.eternal = true;
        body.userData.offset = i * Math.PI;
        this.mangoGroup.add(body);
      }
      const eternalLight = new THREE.PointLight(0xffeb3b, 3, 10);
      this.mangoGroup.add(eternalLight);
    },

    // === COSMIC ===
    'mango_cosmic': function() {
      // Космическое - планета с кольцами
      this.mangoGroup.add(this.createMangoBody(0x6a1b9a, {
        shininess: 200,
        emissive: 0xe040fb, emissiveIntensity: 0.6,
      }));

      // Кольца как у Сатурна
      for (let i = 0; i < 4; i++) {
        const ringGeo = new THREE.RingGeometry(1.5 + i * 0.2, 1.6 + i * 0.2, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: [0xe040fb, 0x7c4dff, 0x00bcd4, 0xff4081][i],
          side: THREE.DoubleSide,
          transparent: true, opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2 + 0.3;
        ring.userData.spin = true;
        this.mangoGroup.add(ring);
      }

      // Луны
      for (let i = 0; i < 3; i++) {
        const moonGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const moonMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, metalness: 0.3, roughness: 0.8,
        });
        const moon = new THREE.Mesh(moonGeo, moonMat);
        const angle = (i / 3) * Math.PI * 2;
        moon.position.set(Math.cos(angle) * 2, 0, Math.sin(angle) * 2);
        moon.userData.orbit = true;
        moon.userData.orbitAngle = angle;
        moon.userData.orbitRadius = 2;
        this.mangoGroup.add(moon);
      }

      const cosmicLight = new THREE.PointLight(0xe040fb, 3, 12);
      this.mangoGroup.add(cosmicLight);
    },

    'mango_singularity': function() {
      // Чёрная дыра - сингулярность
      this.mangoGroup.add(this.createMangoBody(0x000000, {
        shininess: 0,
        emissive: 0xff00ff, emissiveIntensity: 0.2,
      }));

      // Аккреционный диск
      const diskGeo = new THREE.RingGeometry(1.5, 2.5, 64);
      const diskMat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        side: THREE.DoubleSide,
        transparent: true, opacity: 0.8,
      });
      const disk = new THREE.Mesh(diskGeo, diskMat);
      disk.rotation.x = Math.PI / 2 + 0.5;
      disk.userData.spin = true;
      this.mangoGroup.add(disk);

      // Внешний диск
      const outerDiskGeo = new THREE.RingGeometry(2.5, 3, 64);
      const outerDiskMat = new THREE.MeshBasicMaterial({
        color: 0x00bcd4,
        side: THREE.DoubleSide,
        transparent: true, opacity: 0.5,
      });
      const outerDisk = new THREE.Mesh(outerDiskGeo, outerDiskMat);
      outerDisk.rotation.x = Math.PI / 2 + 0.5;
      outerDisk.userData.spinReverse = true;
      this.mangoGroup.add(outerDisk);

      // Втягиваемые частицы
      for (let i = 0; i < 50; i++) {
        const partGeo = new THREE.SphereGeometry(0.05, 4, 4);
        const partMat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xff00ff : 0x00bcd4,
        });
        const part = new THREE.Mesh(partGeo, partMat);
        const angle = Math.random() * Math.PI * 2;
        const radius = 2 + Math.random() * 1;
        part.position.set(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 0.3,
          Math.sin(angle) * radius
        );
        part.userData.isSingularity = true;
        part.userData.angle = angle;
        part.userData.radius = radius;
        part.userData.speed = 0.02 + Math.random() * 0.02;
        this.mangoGroup.add(part);
      }
    },
  };

  // ===== АНИМАЦИЯ =====
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.clock += 0.016;

    if (this.mangoGroup) {
      this.mangoGroup.rotation.y += 0.008;
      this.mangoGroup.rotation.x = Math.sin(this.clock * 0.5) * 0.05;
      this.mangoGroup.position.y = Math.sin(this.clock * 0.8) * 0.1;

      // Анимация специальных эффектов
      this.mangoGroup.traverse((obj) => {
        if (!obj.userData) return;

        if (obj.userData.spin) {
          obj.rotation.z += 0.02;
          obj.rotation.x += 0.01;
        }
        if (obj.userData.spinReverse) {
          obj.rotation.z -= 0.015;
        }
        if (obj.userData.twinkle) {
          const s = 1 + Math.sin(this.clock * 5 + obj.position.x) * 0.5;
          obj.scale.setScalar(s);
        }
        if (obj.userData.flap) {
          obj.rotation.z = Math.sin(this.clock * 3) * 0.5;
        }
        if (obj.userData.isFire) {
          obj.children.forEach(fire => {
            fire.position.y += fire.userData.speed;
            if (fire.position.y > fire.userData.startY + 1.5) {
              fire.position.y = fire.userData.startY;
            }
            fire.material.opacity = 0.7 * (1 - (fire.position.y - fire.userData.startY) / 1.5);
          });
        }
        if (obj.userData.isArcs) {
          obj.rotation.x += 0.05;
          obj.rotation.y += 0.03;
        }
        if (obj.userData.isClock) {
          obj.rotation.z = -this.clock * 0.5;
        }
        if (obj.userData.isRay) {
          obj.rotation.y += 0.005;
          obj.material.opacity = 0.2 + Math.sin(this.clock * 2) * 0.1;
        }
        if (obj.userData.isGalaxy) {
          obj.rotation.y += 0.005;
        }
        if (obj.userData.eternal) {
          const r = 0.8;
          obj.position.x = Math.cos(this.clock + obj.userData.offset) * r;
          obj.position.y = Math.sin(this.clock * 2 + obj.userData.offset) * 0.3;
        }
        if (obj.userData.orbit) {
          obj.userData.orbitAngle += 0.015;
          obj.position.x = Math.cos(obj.userData.orbitAngle) * obj.userData.orbitRadius;
          obj.position.z = Math.sin(obj.userData.orbitAngle) * obj.userData.orbitRadius;
        }
        if (obj.userData.quantum) {
          obj.position.x = Math.sin(this.clock * 2 + obj.userData.offset) * 0.3;
          obj.position.y = Math.cos(this.clock * 3 + obj.userData.offset) * 0.3;
          obj.position.z = Math.sin(this.clock * 2.5 + obj.userData.offset) * 0.3;
        }
        if (obj.userData.isSingularity) {
          obj.userData.angle += obj.userData.speed;
          obj.userData.radius -= 0.005;
          if (obj.userData.radius < 1.5) obj.userData.radius = 3;
          obj.position.x = Math.cos(obj.userData.angle) * obj.userData.radius;
          obj.position.z = Math.sin(obj.userData.angle) * obj.userData.radius;
        }
        if (obj.userData.isRainbow && obj.geometry && obj.geometry.attributes.color) {
          const colors = obj.geometry.attributes.color;
          for (let i = 0; i < colors.count; i++) {
            const hue = ((i / colors.count) + this.clock * 0.1) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.6);
            colors.setXYZ(i, color.r, color.g, color.b);
          }
          colors.needsUpdate = true;
        }
      });
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ===== ИМПУЛЬС ПРИ КЛИКЕ =====
  pulse() {
    if (!this.mangoGroup) return;
    this.mangoGroup.scale.set(1.15, 0.85, 1.15);
    setTimeout(() => {
      if (this.mangoGroup) {
        this.mangoGroup.scale.set(1, 1, 1);
      }
    }, 100);
  }

  onResize() {
    const container = document.getElementById(this.containerId);
    if (!container || !this.renderer) return;
    const size = Math.min(container.offsetWidth, container.offsetHeight);
    this.renderer.setSize(size, size);
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.clearMango();
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.isInitialized = false;
  }
}
