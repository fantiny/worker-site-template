import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 「机械纪元」主题的全屏背景场景(NieR: Automata 美术风格):
 * 废墟都市剪影 + 沙色雾霭 + 漂浮机械残骸 + 光柱 + 飘落灰烬 + 月亮,
 * 鼠标视差 + 滚动推进。性能与降级策略同 SpaceScene:
 * DPR 限 1.75、reduced-motion 静帧、卸载完整释放、懒加载。
 */
export default function NieRScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // ---------- 天空:竖直渐变(钢蓝 → 灰 → 暖沙) ----------
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 2;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext("2d")!;
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#232830");
    grad.addColorStop(0.55, "#4c4c4e");
    grad.addColorStop(0.82, "#7a6f56");
    grad.addColorStop(1, "#b3986a");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 2, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0x6e6350, 14, 60);

    const camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      160,
    );
    camera.position.set(0, 1.5, 11);
    camera.lookAt(0, 1.2, -10);

    const disposables: { dispose(): void }[] = [];

    // ---------- 月亮(不受雾影响) ----------
    const moonGeo = new THREE.CircleGeometry(2.4, 48);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xe6e2d4,
      fog: false,
      transparent: true,
      opacity: 0.92,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-16, 11, -70);
    scene.add(moon);
    disposables.push(moonGeo, moonMat);

    // ---------- 光柱(加色混合,柔和) ----------
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfff3d6,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const rayGeo = new THREE.PlaneGeometry(4.5, 26);
    const ray1 = new THREE.Mesh(rayGeo, rayMat);
    ray1.position.set(-9, 8, -45);
    ray1.rotation.z = 0.32;
    const ray2 = new THREE.Mesh(rayGeo, rayMat);
    ray2.position.set(11, 7, -52);
    ray2.rotation.z = -0.24;
    scene.add(ray1, ray2);
    disposables.push(rayGeo, rayMat);

    // ---------- 废墟都市剪影 ----------
    const cityMat = new THREE.MeshBasicMaterial({ color: 0x16171a });
    const cityGroup = new THREE.Group();
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 46; i++) {
      const w = 2 + rand() * 4.5;
      const h = 3 + rand() * 11;
      const d = 2 + rand() * 4;
      const box = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(box, cityMat);
      mesh.position.set(
        (rand() - 0.5) * 120,
        h / 2 - 2.4,
        -24 - rand() * 55,
      );
      if (rand() > 0.72) mesh.rotation.z = (rand() - 0.5) * 0.14; // 倾颓感
      cityGroup.add(mesh);
      disposables.push(box);
    }
    scene.add(cityGroup);
    disposables.push(cityMat);

    // ---------- 沙色地面 ----------
    const groundGeo = new THREE.PlaneGeometry(240, 120);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x3f3a30 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -2.4, -30);
    scene.add(ground);
    disposables.push(groundGeo, groundMat);

    // ---------- 漂浮机械残骸(方块) ----------
    const debrisGroup = new THREE.Group();
    const debris: {
      mesh: THREE.Mesh;
      spin: number;
      bobPhase: number;
      bobSpeed: number;
      baseY: number;
    }[] = [];
    const debMat = new THREE.MeshBasicMaterial({ color: 0xd6cdb2 });
    const debGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(debGeo, debMat);
      const s = 0.14 + rand() * 0.5;
      mesh.scale.setScalar(s);
      mesh.position.set(
        (rand() - 0.5) * 26,
        0.6 + rand() * 5,
        -2 - rand() * 16,
      );
      mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      debrisGroup.add(mesh);
      debris.push({
        mesh,
        spin: 0.15 + rand() * 0.3,
        bobPhase: rand() * Math.PI * 2,
        bobSpeed: 0.3 + rand() * 0.4,
        baseY: mesh.position.y,
      });
    }
    scene.add(debrisGroup);
    disposables.push(debGeo, debMat);

    // ---------- 飘落灰烬 ----------
    const ashCount = 900;
    const ashPos = new Float32Array(ashCount * 3);
    const ashSeed = new Float32Array(ashCount);
    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3] = (Math.random() - 0.5) * 44;
      ashPos[i * 3 + 1] = Math.random() * 14 - 2;
      ashPos[i * 3 + 2] = -Math.random() * 30;
      ashSeed[i] = Math.random() * Math.PI * 2;
    }
    const ashGeo = new THREE.BufferGeometry();
    ashGeo.setAttribute("position", new THREE.BufferAttribute(ashPos, 3));
    const ashMat = new THREE.PointsMaterial({
      color: 0xd8cdb0,
      size: 0.055,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const ash = new THREE.Points(ashGeo, ashMat);
    scene.add(ash);
    disposables.push(ashGeo, ashMat);

    // ---------- 交互与渲染循环 ----------
    const mouse = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const scroll = { p: 0 };
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      scroll.p = max > 0 ? h.scrollTop / max : 0;
    };
    if (!reduced) {
      window.addEventListener("mousemove", onMouse, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let disposed = false;

    const renderFrame = (t: number) => {
      // 残骸旋转 + 漂浮
      for (const d of debris) {
        d.mesh.rotation.x = t * d.spin;
        d.mesh.rotation.y = t * d.spin * 1.4;
        d.mesh.position.y = d.baseY + Math.sin(t * d.bobSpeed + d.bobPhase) * 0.25;
      }
      // 灰烬下落 + 横向摆动
      const arr = ashGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < ashCount; i++) {
        arr[i * 3 + 1] -= 0.006 + (i % 5) * 0.001;
        arr[i * 3] += Math.sin(t * 0.5 + ashSeed[i]) * 0.002;
        if (arr[i * 3 + 1] < -2.3) arr[i * 3 + 1] = 11;
      }
      ashGeo.attributes.position.needsUpdate = true;
      // 视差 + 滚动推进(走向废墟深处)
      camera.position.x += (mouse.x * 1.6 - camera.position.x) * 0.04;
      camera.position.y += (1.5 - mouse.y * 0.6 - camera.position.y) * 0.04;
      camera.position.z = 11 - scroll.p * 3.5;
      camera.lookAt(0, 1.2, -10);
      renderer.render(scene, camera);
    };

    if (reduced) {
      renderFrame(0);
    } else {
      const loop = () => {
        if (disposed) return;
        if (!document.hidden) renderFrame(clock.getElapsedTime());
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      for (const d of disposables) d.dispose();
      skyTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 z-0 h-full w-full"
    />
  );
}
