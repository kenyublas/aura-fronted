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

  // Si ya hay sesion activa, lo mandamos directo a la seleccion.
  // ARREGLO I7: bandera "mounted" para no actualizar estado si el componente se desmonta.
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

  // Limpia el timeout si el componente se desmonta
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const entrarConGoogle = async () => {
    setAviso("");
    setLoading(true);

    // ARREGLO C1: timeout de seguridad. Si en 12s no redirigió (algo falló),
    // reseteamos el botón para que no quede colgado para siempre.
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
      // Si no hay error, Google redirige y salimos de la página (el timeout se cancela solo al desmontar).
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
        <div className="radar" aria-hidden="true">
          <span className="ring r5" />
          <span className="ring r4" />
          <span className="ring r3" />
          <span className="ring r2" />
          <span className="ring r1" />
          <span className="pulse p1" />
          <span className="pulse p2" />
          <span className="pulse p3" />
          <span className="core" />
        </div>

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

            {/* ARREGLO I1: aviso inline bonito en vez de alert() feo */}
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

        .aura-root .radar {
          position: relative;
          width: 184px;
          height: 184px;
          margin-bottom: 30px;
          display: grid;
          place-items: center;
          animation: aura-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }
        .aura-root .radar .ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255, 59, 59, 0.32);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .aura-root .radar .r1 { width: 34px; height: 34px; border-color: rgba(255, 59, 59, 0.7); }
        .aura-root .radar .r2 { width: 72px; height: 72px; border-color: rgba(255, 59, 59, 0.5); }
        .aura-root .radar .r3 { width: 114px; height: 114px; border-color: rgba(255, 59, 59, 0.34); }
        .aura-root .radar .r4 { width: 158px; height: 158px; border-color: rgba(255, 59, 59, 0.2); }
        .aura-root .radar .r5 { width: 200px; height: 200px; border-color: rgba(255, 59, 59, 0.1); }

        .aura-root .radar .pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid var(--red);
          transform: translate(-50%, -50%) scale(1);
          animation: aura-sonar 3.4s ease-out infinite;
        }
        .aura-root .radar .p2 { animation-delay: 1.13s; }
        .aura-root .radar .p3 { animation-delay: 2.26s; }

        .aura-root .radar .core {
          position: relative;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--red-bright);
          box-shadow: 0 0 8px 2px var(--glow), 0 0 26px 6px rgba(255, 59, 59, 0.45),
            0 0 60px 14px rgba(255, 59, 59, 0.22);
          animation: aura-breathe 3.4s ease-in-out infinite;
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
          margin-top: 50px;
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

        @keyframes aura-sonar {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
          80% { opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(6.2); opacity: 0; }
        }
        @keyframes aura-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.85; }
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
          .aura-root * { animation: none !important; transition: none !important; }
        }
        @media (max-width: 520px) {
          .aura-root .tagline { letter-spacing: 0.22em; font-size: 11px; }
          .aura-root .panel { margin-top: 40px; }
        }
      `}</style>
    </main>
  );
}