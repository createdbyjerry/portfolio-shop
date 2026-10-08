// createdbyjerry: eclipsed orb background (Three.js r128, loaded before this file)
// Colours come from the theme: --orb-core, --orb-mid, --orb-edge, --orb-rim (tokens/themes/*.json → orb.*).

(() => {
  const container = document.querySelector('.orb-canvas');
  if (!container || !window.THREE) return;

  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const colors = {
    core: token('--orb-core', '#200703'),
    mid: token('--orb-mid', '#bd2418'),
    edge: token('--orb-edge', '#f25644'),
    rim: token('--orb-rim', '#f25644'),
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 3;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(1.5, 64, 64);

  const vertexShader = `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 color1; // core
    uniform vec3 color2; // mid
    uniform vec3 color3; // edge
    uniform vec3 rimColor;
    uniform vec2 u_mouse;
    uniform float u_isReflection;
    uniform float u_blurLevel;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    void main() {
      vec3 mouseDir = normalize(vec3(u_mouse.x, u_mouse.y, 1.5));
      float intensity = smoothstep(-0.5, 1.0, dot(vNormal, mouseDir));

      // edge -> mid -> core gradient
      vec3 baseColor = intensity < 0.5
        ? mix(color3, color2, intensity * 2.0)
        : mix(color2, color1, (intensity - 0.5) * 2.0);

      // crescent rim
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 8.0);
      vec3 crescentDir = (u_isReflection < 0.5) ? vec3(0.0, -1.0, 0.0) : vec3(0.0, 1.0, 0.0);
      float crescentMask = max(dot(vNormal, crescentDir), 0.0);
      vec3 finalColor = mix(baseColor, rimColor, fresnel * crescentMask * 15.0);

      // soft edge (depth of field)
      float alpha = smoothstep(0.0, u_blurLevel, dot(vNormal, viewDir));
      if (u_isReflection > 0.5) alpha *= (1.0 - vUv.y) * 0.85;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const shared = {
    color1: { value: new THREE.Color(colors.core) },
    color2: { value: new THREE.Color(colors.mid) },
    color3: { value: new THREE.Color(colors.edge) },
    rimColor: { value: new THREE.Color(colors.rim) },
  };
  const makeMaterial = (isReflection, blur) => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      ...shared,
      u_mouse: { value: new THREE.Vector2(0, 0) },
      u_isReflection: { value: isReflection },
      u_blurLevel: { value: blur },
    },
    vertexShader,
    fragmentShader,
  });

  const materialMain = makeMaterial(0.0, 0.1);
  const materialReflect = makeMaterial(1.0, 0.8);

  const baseMainY = 1.75;
  const baseReflectY = -1.75;
  const orb = new THREE.Mesh(geometry, materialMain);
  orb.position.y = baseMainY;
  scene.add(orb);

  const orbReflect = new THREE.Mesh(geometry, materialReflect);
  orbReflect.position.y = baseReflectY;
  orbReflect.rotation.x = Math.PI;
  scene.add(orbReflect);

  const mouse = new THREE.Vector2();
  const target = new THREE.Vector2();
  let halfX = window.innerWidth / 2;
  let halfY = window.innerHeight / 2;

  window.addEventListener('resize', () => {
    halfX = window.innerWidth / 2;
    halfY = window.innerHeight / 2;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (reduceMotion) renderer.render(scene, camera);
  });

  if (reduceMotion) {
    renderer.render(scene, camera);
    return;
  }

  document.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX - halfX) / halfX;
    mouse.y = -(e.clientY - halfY) / halfY;
  });

  const PUSH = 0.3; // how far the orbs drift away from the cursor
  function animate() {
    requestAnimationFrame(animate);
    target.x += (mouse.x - target.x) * 0.05;
    target.y += (mouse.y - target.y) * 0.05;

    materialMain.uniforms.u_mouse.value.set(target.x * 2.0, target.y * 2.0);
    materialReflect.uniforms.u_mouse.value.set(target.x * 2.0, -target.y * 2.0);

    const dx = -target.x * PUSH;
    const dy = -target.y * PUSH;
    orb.position.set(dx, baseMainY + dy, 0);
    orbReflect.position.set(dx, baseReflectY - dy, 0);

    orb.rotation.y += 0.002;
    orb.rotation.x += 0.001;
    orbReflect.rotation.y = orb.rotation.y;
    orbReflect.rotation.x = -orb.rotation.x + Math.PI;

    renderer.render(scene, camera);
  }
  animate();
})();
