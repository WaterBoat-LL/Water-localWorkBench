/* ============================================================
 * 鲸屿工作台 - 3D 海底背景（Three.js）
 * 依赖本地 vendor/three.min.js，离线可用
 * 场景：深海雾霭 + 上浮气泡粒子 + 光柱 + 漂浮水母 + 游动小鱼
 * ============================================================ */
WB.bg3d = (() => {
  let renderer = null, scene = null, camera = null;
  let bubbles = [], jellys = [], fishs = [], rays = [];
  let raf = null, clock = null;
  let W = 0, H = 0;

  function loadThree() {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve(window.THREE);
      const s = document.createElement('script');
      s.src = 'vendor/three.min.js';
      s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('THREE 加载失败')));
      s.onerror = () => reject(new Error('THREE 加载失败'));
      document.head.appendChild(s);
    });
  }

  async function start(cfg) {
    try {
      const THREE = await loadThree();
      if (!THREE) throw new Error('no THREE');
      init(THREE);
      return true;
    } catch (e) {
      console.warn('[bg3d] fallback to 2D:', e.message);
      return false;
    }
  }

  function init(THREE) {
    const container = document.createElement('div');
    container.id = 'bg3d';
    container.style.cssText = 'position:fixed;inset:0;z-index:-2;pointer-events:none;';
    document.body.prepend(container);

    W = window.innerWidth;
    H = window.innerHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x031a30, 0.012);

    camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 300);
    camera.position.set(0, 2, 14);
    camera.lookAt(0, 0, 0);

    clock = new THREE.Clock();

    makeLights(THREE);
    makeBubbles(THREE);
    makeRays(THREE);
    makeJellyfish(THREE);
    makeFish(THREE);
    makeSeafloor(THREE);

    window.addEventListener('resize', () => {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    });

    animate(THREE);
  }

  function makeLights(THREE) {
    scene.add(new THREE.AmbientLight(0x3366aa, 0.9));
    const dir = new THREE.DirectionalLight(0x88ccff, 0.8);
    dir.position.set(5, 12, 8);
    scene.add(dir);
  }

  function makeBubbles(THREE) {
    const geo = new THREE.BufferGeometry();
    const n = 90;   // 气泡减少，动态更柔和
    const pos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      sizes[i] = 0.5 + Math.random() * 1.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    // 程序化圆形粒子纹理
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(200,240,255,0.45)');
    g.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);

    const mat = new THREE.PointsMaterial({
      size: 0.6,
      map: tex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xaee4ff,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bubbles = { points, n, pos };
  }

  function makeRays(THREE) {
    // 光柱：半透明圆锥 + 加色混合
    for (let i = 0; i < 3; i++) {
      const h = 22;
      const geo = new THREE.CylinderGeometry(0.2, 2.6, h, 12, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9fd8ff,
        transparent: true,
        opacity: 0.05 + i * 0.02,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 16, 6, -4 - Math.random() * 6);
      mesh.rotation.z = (Math.random() - 0.5) * 0.35;
      mesh.rotation.x = 0.06;
      scene.add(mesh);
      rays.push({ mesh, baseX: mesh.position.x });
    }
  }

  function makeJellyfish(THREE) {
    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group();
      // 伞盖
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshPhongMaterial({ color: 0xd98cff, transparent: true, opacity: 0.55, emissive: 0x5a2a7a, emissiveIntensity: 0.5 })
      );
      // 裙边
      const skirt = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.55, 12, 1, true),
        new THREE.MeshPhongMaterial({ color: 0xc77bff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      skirt.position.y = -0.45;
      // 触手
      for (let t = 0; t < 6; t++) {
        const angle = (t / 6) * Math.PI * 2;
        const tent = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.004, 1.3 + Math.random(), 4),
          new THREE.MeshBasicMaterial({ color: 0xe6b8ff, transparent: true, opacity: 0.5 })
        );
        tent.position.set(Math.cos(angle) * 0.3, -0.8 - Math.random() * 0.4, Math.sin(angle) * 0.3);
        tent.rotation.z = Math.cos(angle) * 0.2;
        tent.rotation.x = -Math.sin(angle) * 0.2;
        group.add(tent);
      }
      group.add(dome);
      group.add(skirt);
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 14;
      group.position.set(x, y, z);
      group.scale.setScalar(0.7 + Math.random() * 0.8);
      scene.add(group);
      jellys.push({ group, baseY: y, speed: 0.2 + Math.random() * 0.3, phase: Math.random() * Math.PI * 2 });
    }
  }

  function makeFish(THREE) {
    for (let i = 0; i < 10; i++) {
      const hue = Math.random();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        new THREE.MeshPhongMaterial({ color: new THREE.Color().setHSL(hue, 0.7, 0.6) })
      );
      body.scale.set(1.4, 0.7, 0.6);
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.3, 6),
        new THREE.MeshPhongMaterial({ color: new THREE.Color().setHSL(hue, 0.7, 0.5) })
      );
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.35;
      const group = new THREE.Group();
      group.add(body);
      group.add(tail);
      group.position.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 16);
      group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
      fishs.push({ group, speed: 0.4 + Math.random() * 0.7, wob: Math.random() * Math.PI * 2 });
    }
  }

  function makeSeafloor(THREE) {
    // 海底沙地
    const geo = new THREE.PlaneGeometry(60, 40);
    const mat = new THREE.MeshPhongMaterial({ color: 0x0a2c44, transparent: true, opacity: 0.9 });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -9;
    floor.position.z = -6;
    scene.add(floor);
    // 海草
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      const len = 1 + Math.random() * 1.6;
      for (let seg = 0; seg < 4; seg++) {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.06, len / 4, 6),
          new THREE.MeshPhongMaterial({ color: 0x1d8f6e, emissive: 0x06352a, emissiveIntensity: 0.4 })
        );
        m.position.y = seg * (len / 4) + len / 8;
        g.add(m);
      }
      g.position.set((Math.random() - 0.5) * 30, -9 + 0.1, (Math.random() - 0.5) * 20 - 4);
      g.rotation.z = (Math.random() - 0.5) * 0.4;
      g.userData = { phase: Math.random() * Math.PI * 2, sway: 0.3 + Math.random() * 0.5 };
      scene.add(g);
    }
  }

  function animate(THREE) {
    const t = clock.getElapsedTime();

    // 气泡上浮（速度放缓）
    if (bubbles.points) {
      const pos = bubbles.points.geometry.attributes.position.array;
      for (let i = 0; i < bubbles.n; i++) {
        pos[i * 3 + 1] += 0.007;
        pos[i * 3] += Math.sin(t + i) * 0.0015;
        if (pos[i * 3 + 1] > 10) {
          pos[i * 3 + 1] = -8;
          pos[i * 3] = (Math.random() - 0.5) * 34;
        }
      }
      bubbles.points.geometry.attributes.position.needsUpdate = true;
      bubbles.points.material.opacity = 0.22 + Math.sin(t * 1.2) * 0.08;
    }

    // 水母浮动
    for (const j of jellys) {
      j.group.position.y = j.baseY + Math.sin(t * j.speed + j.phase) * 0.8;
      j.group.rotation.z = Math.sin(t * 0.4 + j.phase) * 0.15;
    }

    // 小鱼巡游
    for (const f of fishs) {
      f.group.position.x += Math.cos(f.group.rotation.y) * f.speed * 0.016 * 60 * 0.016 * 10;
      f.group.position.z += Math.sin(f.group.rotation.y) * f.speed * 0.016 * 60 * 0.016 * 10;
      f.wob += 0.05;
      f.group.position.y += Math.sin(f.wob) * 0.004;
      if (Math.abs(f.group.position.x) > 12 || Math.abs(f.group.position.z) > 10) {
        f.group.rotation.y += Math.PI * (0.5 + Math.random() * 0.5);
      }
    }

    // 光柱摆动
    for (const r of rays) {
      r.mesh.rotation.z = Math.sin(t * 0.25 + r.baseX) * 0.08;
      r.mesh.material.opacity = 0.045 + Math.sin(t * 0.6 + r.baseX * 3) * 0.02;
    }

    // 相机微晃
    camera.position.x = Math.sin(t * 0.2) * 0.8;
    camera.position.y = 2 + Math.sin(t * 0.13) * 0.5;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(() => animate(THREE));
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (renderer) {
      renderer.dispose();
      const el = document.getElementById('bg3d');
      if (el) el.remove();
      renderer = null;
    }
  }

  return { start, stop };
})();
