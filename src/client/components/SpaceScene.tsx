import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 「3D 深空」主题的全屏背景场景 v2:
 * 旋涡星系粒子盘 + 星云辉光精灵 + 柔光行星 + 三层星field,
 * 鼠标视差 + 滚动推拉。性能与降级:限 DPR、隐藏暂停、
 * reduced-motion 静帧、卸载完整释放。懒加载(three.js 独立 chunk)。
 */
export default function SpaceScene() {
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#02030a");

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      300,
    );
    camera.position.set(0, 2.2, 13);

    const disposables: { dispose(): void }[] = [];

    // ---------- 远景星field(三层深度,视差更丰富) ----------
    const makeStars = (count: number, rMin: number, rMax: number, size: number, color: number, opacity: number) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = rMin + Math.random() * (rMax - rMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      disposables.push(geo, mat);
      return pts;
    };
    const starsFar = makeStars(1400, 40, 90, 0.09, 0x8fa3d9, 0.8);
    const starsMid = makeStars(700, 24, 60, 0.13, 0xc7d2fe, 0.9);
    const starsNear = makeStars(260, 14, 44, 0.2, 0xffffff, 0.95);

    // ---------- 旋涡星系粒子盘(美术核心) ----------
    // 对数螺旋臂分布:黄白核心 → 紫蓝旋臂 → 外缘青色尘埃
    const galaxy = new THREE.Group();
    galaxy.rotation.x = -0.42; // 微俯视
    galaxy.position.set(-2, 1.8, -21);
    const GALAXY_R = 21;
    const ARMS = 2;
    const gCount = 5200;
    const gPos = new Float32Array(gCount * 3);
    const gCol = new Float32Array(gCount * 3);
    const cCore = new THREE.Color("#fff3d6");
    const cMid = new THREE.Color("#a78bfa");
    const cEdge = new THREE.Color("#38bdf8");
    for (let i = 0; i < gCount; i++) {
      const t = Math.pow(Math.random(), 1.4); // 中心密、外缘疏
      const r = 0.3 + t * GALAXY_R;
      const armIdx = i % ARMS;
      const armAngle = (armIdx / ARMS) * Math.PI * 2;
      const spread = (0.25 + t * 0.9) * 0.45;
      const angle =
        armAngle + r * 0.32 + (Math.random() - 0.5) * spread * (Math.random() < 0.5 ? 1 : -1);
      const jitter = (Math.random() - 0.5) * 0.9;
      gPos[i * 3] = Math.cos(angle) * (r + jitter * 0.4);
      gPos[i * 3 + 1] = (Math.random() - 0.5) * (0.5 - t * 0.32);
      gPos[i * 3 + 2] = Math.sin(angle) * (r + jitter * 0.4);
      const c =
        t < 0.22
          ? cCore.clone().lerp(cMid, t / 0.22)
          : cMid.clone().lerp(cEdge, (t - 0.22) / 0.78);
      const dim = 0.45 + Math.random() * 0.55;
      gCol[i * 3] = c.r * dim;
      gCol[i * 3 + 1] = c.g * dim;
      gCol[i * 3 + 2] = c.b * dim;
    }
    const galaxyGeo = new THREE.BufferGeometry();
    galaxyGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3));
    galaxyGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3));
    const galaxyMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const galaxyPts = new THREE.Points(galaxyGeo, galaxyMat);
    galaxy.add(galaxyPts);
    // 星系核心辉光
    const coreTex = makeGlowTexture("#fff8e7");
    const coreMat = new THREE.SpriteMaterial({
      map: coreTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(7);
    galaxy.add(core);
    scene.add(galaxy);
    disposables.push(galaxyGeo, galaxyMat, coreMat, coreTex);

    // ---------- 星云辉光精灵(紫/青两团,深层空间) ----------
    const nebulaTexPurple = makeGlowTexture("#7c6cf0");
    const nebulaTexCyan = makeGlowTexture("#1d7fa8");
    const mkNebula = (tex: THREE.Texture, x: number, y: number, z: number, s: number, o: number) => {
      const m = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: o,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.setScalar(s);
      scene.add(sp);
      disposables.push(m);
      return sp;
    };
    mkNebula(nebulaTexPurple, -26, 8, -70, 46, 0.16);
    mkNebula(nebulaTexCyan, 30, -4, -80, 52, 0.13);
    disposables.push(nebulaTexPurple, nebulaTexCyan);

    // ---------- 柔光行星(前景右上,径向渐变球面) ----------
    const planetCanvas = document.createElement("canvas");
    planetCanvas.width = 256;
    planetCanvas.height = 256;
    const pctx = planetCanvas.getContext("2d")!;
    const pgrad = pctx.createRadialGradient(92, 88, 8, 128, 128, 120);
    pgrad.addColorStop(0, "#b8c8ff");
    pgrad.addColorStop(0.55, "#5b6bb8");
    pgrad.addColorStop(0.85, "#1d2350");
    pgrad.addColorStop(1, "#0a0c20");
    pctx.fillStyle = pgrad;
    pctx.beginPath();
    pctx.arc(128, 128, 118, 0, Math.PI * 2);
    pctx.fill();
    const planetTex = new THREE.CanvasTexture(planetCanvas);
    planetTex.colorSpace = THREE.SRGBColorSpace;
    const planetMat = new THREE.SpriteMaterial({
      map: planetTex,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    const planet = new THREE.Sprite(planetMat);
    planet.position.set(16, 5.2, -34);
    planet.scale.setScalar(7.5);
    scene.add(planet);
    disposables.push(planetMat, planetTex);

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
      galaxyPts.rotation.y = t * 0.02;
      core.material.rotation = t * 0.01;
      starsFar.rotation.y = t * 0.004;
      starsMid.rotation.y = -t * 0.006;
      planet.position.y = 5.2 + Math.sin(t * 0.4) * 0.18;
      camera.position.x += (mouse.x * 1.6 - camera.position.x) * 0.04;
      camera.position.y += (2.2 - mouse.y * 1.0 - camera.position.y) * 0.04;
      camera.position.z = 13 - scroll.p * 4.5;
      camera.lookAt(0, 1.6, -14);
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

/** 径向辉光纹理(星系核心 / 星云共用) */
function makeGlowTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color + "66");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
