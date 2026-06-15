"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Space_Grotesk, Inter } from "next/font/google";
import { supabase } from "@/lib/supabase";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [aviso, setAviso] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        router.replace("/carrera");
      } else {
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Núcleo de partículas interactivo (Canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // Menos partículas en celular para que vaya fluido
    const esMovil = window.innerWidth < 640;
    const N = esMovil ? 600 : 1300;
    const interactivo = !esMovil; // mouse solo en PC

    const mouse = { x: -999, y: -999, active: false };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) * (W / rect.width);
      mouse.y = (e.clientY - rect.top) * (H / rect.height);
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -999;
      mouse.y = -999;
    };
    if (interactivo) {
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseleave", onLeave);
    }

    const noise = (x: number, y: number, t: number) =>
      Math.sin(x * 0.9 + t) * Math.cos(y * 0.8 - t * 0.9) +
      Math.sin((x + y) * 0.5 + t * 1.2) * 0.5;

    type P = {
      rr: number;
      baseR: number;
      a: number;
      seed: number;
      size: number;
      ox: number;
      oy: number;
      vx: number;
      vy: number;
    };
    const particles: P[] = [];
    for (let i = 0; i < N; i++) {
      const petal = Math.floor(Math.random() * 5);
      const pAng = (petal / 5) * Math.PI * 2;
      const rr = Math.pow(Math.random(), 0.5);
      const spread = Math.sin(rr * Math.PI) * 0.7;
      const a = pAng + (Math.random() - 0.5) * spread * 1.6;
      particles.push({
        rr,
        baseR: rr * 120,
        a,
        seed: Math.random() * 100,
        size: (1.5 - rr * 0.85) * (0.6 + Math.random() * 0.6),
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
      });
    }

    const colorFor = (rr: number, alpha: number) => {
      if (rr < 0.33) {
        return `rgba(255,${Math.round(70 + rr * 60)},${Math.round(70 + rr * 40)},${alpha})`;
      } else if (rr < 0.66) {
        const k = (rr - 0.33) / 0.33;
        return `rgba(${Math.round(200 - k * 80)},${Math.round(80 + k * 20)},${Math.round(180 + k * 40)},${alpha})`;
      } else {
        return `rgba(120,160,255,${alpha})`;
      }
    };

    let t = 0;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.01;
      const breathe = 1 + Math.sin(t * 1.6) * 0.05;

      const rendered: { x: number; y: number; rr: number; size: number; alpha: number }[] = [];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const flow = noise(Math.cos(p.a) * p.rr * 1.4, Math.sin(p.a) * p.rr * 1.4, t + p.seed * 0.1);
        const aF = p.a + flow * 0.3 + t * 0.1;
        const rF = (p.baseR + flow * 16) * breathe;
        const tx = cx + Math.cos(aF) * rF;
        const ty = cy + Math.sin(aF) * rF * 0.9;

        if (interactivo && mouse.active) {
          const dx = tx - mouse.x;
          const dy = ty - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 6400) {
            const d = Math.sqrt(d2) || 1;
            const force = ((80 - d) / 80) * 14;
            p.vx += (dx / d) * force * 0.15;
            p.vy += (dy / d) * force * 0.15;
          }
        }
        p.vx *= 0.88;
        p.vy *= 0.88;
        p.ox += p.vx;
        p.oy += p.vy;
        p.ox *= 0.9;
        p.oy *= 0.9;

        const x = tx + p.ox;
        const y = ty + p.oy;
        let alpha = 1 - p.rr * 0.75;
        if (alpha < 0.06) alpha = 0.06;
        rendered.push({ x, y, rr: p.rr, size: p.size, alpha });
      }

      for (let k = 0; k < rendered.length; k += 7) {
        const r1 = rendered[k];
        const r2 = rendered[(k + 3) % rendered.length];
        const dx = r1.x - r2.x;
        const dy = r1.y - r2.y;
        if (dx * dx + dy * dy < 900 && r1.rr > 0.5) {
          ctx.strokeStyle = `rgba(150,170,255,${r1.alpha * 0.12})`;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(r1.x, r1.y);
          ctx.lineTo(r2.x, r2.y);
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < rendered.length; k++) {
        const r = rendered[k];
        ctx.fillStyle = colorFor(r.rr, r.alpha);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      const coreR = 10 * breathe;
      const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, coreR * 3);
      grad.addColorStop(0, "rgba(255,190,190,1)");
      grad.addColorStop(0.35, "rgba(255,60,60,0.95)");
      grad.addColorStop(1, "rgba(255,40,40,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff5a5a";
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      if (interactivo) {
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mouseleave", onLeave);
      }
    };
  }, []);

  const entrarConGoogle = async () => {
    setAviso("");
    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setAviso("La conexión está tardando. Revisa tu internet e intenta de nuevo.");
    }, 12000);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/carrera`,
        },
      });
      if (error) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLoading(false);
        setAviso("No se pudo iniciar sesión. Intenta de nuevo.");
      }
    } catch {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      setAviso("Ocurrió un problema al conectar. Intenta de nuevo.");
    }
  };

  return (
    <main className={`aura-root ${grotesk.variable} ${inter.variable}`}>
      <div className="bg-glow" />
      <div className="bg-grid" />
      <div className="vignette" />

      <div className="stage">
        <canvas ref={canvasRef} width={300} height={260} className="core-canvas" aria-hidden="true" />

        <h1 className="wordmark">AURA</h1>
        <p className="tagline">
          <span className="dot" /> Asistente Universitario para el Refuerzo Académico
        </p>

        {!checking && (
          <section className="panel">
            <button className="google-btn" onClick={entrarConGoogle} disabled={loading}>
              {loading ? (
                "Conectando…"
              ) : (
                <>
                  <svg className="g-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.7 9.14 4.75 12 4.75z"
                    />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            {aviso && <p className="aviso">{aviso}</p>}

            <p className="hint">
              <span className="hint-dot">●</span>
              Tu tutora con el material real de tus cursos.
            </p>
          </section>
        )}
      </div>

      <div className="footer">AURA · v0.1</div>

      <style jsx global>{`
        .aura-root {
          --bg: #070708;
          --bg-deep: #050506;
          --red: #ff3b3b;
          --red-bright: #ff5c5c;
          --glow: rgba(255, 59, 59, 0.55);
          --text: #ececef;
          --muted: #7a7a83;
          --faint: #46464d;
          --line: rgba(255, 255, 255, 0.08);
          --glass: rgba(255, 255, 255, 0.028);

          position: relative;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-inter), system-ui, sans-serif;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }
        body { background: #070708; }

        .aura-root .bg-glow,
        .aura-root .bg-grid,
        .aura-root .vignette {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .aura-root .bg-glow {
          background: radial-gradient(620px 620px at 50% 38%, rgba(255, 59, 59, 0.1), transparent 62%),
            radial-gradient(1200px 800px at 50% 120%, rgba(255, 59, 59, 0.06), transparent 70%);
        }
        .aura-root .bg-grid {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
          background-size: 46px 46px;
          -webkit-mask-image: radial-gradient(circle at 50% 42%, #000 0%, transparent 68%);
          mask-image: radial-gradient(circle at 50% 42%, #000 0%, transparent 68%);
          opacity: 0.6;
        }
        .aura-root .vignette {
          background: radial-gradient(circle at 50% 45%, transparent 55%, var(--bg-deep) 100%);
        }

        .aura-root .stage {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
        }

        .aura-root .core-canvas {
          width: 300px;
          height: 260px;
          max-width: 90vw;
          margin-bottom: 6px;
          animation: aura-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }

        .aura-root .wordmark {
          font-family: var(--font-grotesk), sans-serif;
          font-weight: 700;
          font-size: clamp(54px, 9vw, 82px);
          letter-spacing: 0.16em;
          line-height: 1;
          text-indent: 0.16em;
          margin: 0;
          color: #f4f4f6;
          text-shadow: 0 0 28px rgba(255, 59, 59, 0.28), 0 0 4px rgba(255, 59, 59, 0.18);
          animation: aura-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 0.08s both;
        }
        .aura-root .tagline {
          margin-top: 14px;
          font-size: 12.5px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 11px;
          justify-content: center;
          animation: aura-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 0.16s both;
        }
        .aura-root .tagline .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--red);
          box-shadow: 0 0 8px 1px var(--glow);
          animation: aura-blink 2.4s ease-in-out infinite;
        }

        .aura-root .panel {
          margin-top: 44px;
          width: min(380px, 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: aura-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 0.26s both;
        }
        .aura-root .google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          padding: 15px 20px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          color: #1a1a1a;
          font-family: var(--font-inter), sans-serif;
          font-size: 15.5px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.25s ease, opacity 0.2s ease;
          box-shadow: 0 0 30px -10px rgba(255, 59, 59, 0.3);
        }
        .aura-root .google-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 0 40px -8px rgba(255, 59, 59, 0.45);
        }
        .aura-root .google-btn:active:not(:disabled) { transform: scale(0.98); }
        .aura-root .google-btn:disabled { opacity: 0.7; cursor: default; }
        .aura-root .g-icon { flex: none; }

        .aura-root .aviso {
          margin-top: 16px;
          font-size: 13px;
          color: #ffb3b3;
          background: rgba(255, 59, 59, 0.08);
          border: 1px solid rgba(255, 59, 59, 0.3);
          border-radius: 10px;
          padding: 10px 14px;
          animation: aura-rise 0.4s ease both;
        }

        .aura-root .hint {
          margin-top: 20px;
          font-size: 12.5px;
          color: var(--faint);
          display: flex;
          align-items: center;
          gap: 7px;
          justify-content: center;
        }
        .aura-root .hint-dot { color: rgba(255, 59, 59, 0.7); }

        .aura-root .footer {
          position: fixed;
          bottom: 22px;
          left: 0;
          right: 0;
          z-index: 1;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #34343a;
        }

        @keyframes aura-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes aura-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .aura-root *, .aura-root .core-canvas { animation: none !important; transition: none !important; }
        }
        @media (max-width: 520px) {
          .aura-root .tagline { letter-spacing: 0.22em; font-size: 11px; }
          .aura-root .panel { margin-top: 36px; }
        }
      `}</style>
    </main>
  );
}