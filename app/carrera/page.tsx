"use client";

import { useState, useEffect } from "react";
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

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SeleccionCarrera() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [carreras, setCarreras] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        router.replace("/");
        return;
      }

      const full =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        "";
      setNombre(full.split(" ")[0] || "");

      // CARRERA UNA SOLA VEZ:
      // Si el usuario YA tiene carrera guardada en su perfil,
      // saltamos esta pantalla y vamos directo a /curso.
      const uid = session.user.id;
      const { data: perfil } = await supabase
        .from("profiles")
        .select("carrera")
        .eq("id", uid)
        .single();

      if (perfil?.carrera) {
        try {
          sessionStorage.setItem("aura_carrera", perfil.carrera);
        } catch {}
        router.replace("/curso");
        return; // no seguimos cargando la pantalla
      }

      // No tiene carrera -> mostramos la selección
      fetch(`${API}/carreras`)
        .then((r) => r.json())
        .then((d) => {
          setCarreras(d.carreras || []);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    });
  }, [router]);

  const elegir = async (carrera: string) => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (uid) {
      await supabase.from("profiles").update({ carrera }).eq("id", uid);
    }
    try {
      sessionStorage.setItem("aura_carrera", carrera);
    } catch {}
    router.push("/curso");
  };

  const salir = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <main className={`aura-sel ${grotesk.variable} ${inter.variable}`}>
      <div className="bg-glow" />
      <div className="vignette" />

      <header className="topbar">
        <div className="brand">
          <span className="mini-radar">
            <span className="mini-ring" />
            <span className="mini-core" />
          </span>
          <span className="brand-name">AURA</span>
        </div>
        <button className="logout" onClick={salir}>
          Salir
        </button>
      </header>

      <div className="content">
        <p className="hi">
          Hola{nombre ? `, ${nombre}` : ""} <span className="wave">👋</span>
        </p>
        <h1 className="title">¿Qué carrera estudias?</h1>
        <p className="sub">Elige tu carrera. Solo te lo preguntaremos una vez.</p>

        {loading && <div className="state">Cargando carreras…</div>}

        {error && (
          <div className="state err">
            No pude conectar con el servidor. ¿Está prendido el backend en {API}?
          </div>
        )}

        {!loading && !error && carreras.length === 0 && (
          <div className="state">Aún no hay carreras disponibles.</div>
        )}

        {!loading && !error && carreras.length > 0 && (
          <div className="grid">
            {carreras.map((c) => (
              <button key={c} className="card" onClick={() => elegir(c)}>
                <span className="card-ico">🎓</span>
                <span className="card-name">{c}</span>
                <span className="card-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .aura-sel {
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
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }
        body { background: #070708; }

        .aura-sel .bg-glow,
        .aura-sel .vignette {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .aura-sel .bg-glow {
          background: radial-gradient(700px 500px at 50% -5%, rgba(255, 59, 59, 0.09), transparent 60%);
        }
        .aura-sel .vignette {
          background: radial-gradient(circle at 50% 30%, transparent 60%, var(--bg-deep) 100%);
        }

        .aura-sel .topbar {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
        }
        .aura-sel .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .aura-sel .mini-radar {
          position: relative;
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
        }
        .aura-sel .mini-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(255, 59, 59, 0.4);
        }
        .aura-sel .mini-core {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--red-bright);
          box-shadow: 0 0 10px 2px var(--glow);
          animation: sel-breathe 3s ease-in-out infinite;
        }
        .aura-sel .brand-name {
          font-family: var(--font-grotesk), sans-serif;
          font-weight: 700;
          letter-spacing: 0.18em;
          font-size: 16px;
          color: #f4f4f6;
        }
        .aura-sel .logout {
          background: none;
          border: 1px solid var(--line);
          color: var(--muted);
          border-radius: 999px;
          padding: 7px 16px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .aura-sel .logout:hover {
          color: var(--text);
          border-color: rgba(255, 59, 59, 0.4);
        }

        .aura-sel .content {
          position: relative;
          z-index: 1;
          max-width: 640px;
          margin: 0 auto;
          padding: 7vh 24px 60px;
          text-align: center;
        }
        .aura-sel .hi {
          font-size: 15px;
          color: var(--muted);
          margin: 0 0 10px;
          animation: sel-rise 0.7s ease both;
        }
        .aura-sel .title {
          font-family: var(--font-grotesk), sans-serif;
          font-weight: 600;
          font-size: clamp(26px, 5vw, 34px);
          margin: 0 0 10px;
          color: #f4f4f6;
          animation: sel-rise 0.7s ease 0.05s both;
        }
        .aura-sel .sub {
          color: var(--muted);
          font-size: 14.5px;
          margin: 0 0 34px;
          animation: sel-rise 0.7s ease 0.1s both;
        }

        .aura-sel .state {
          margin-top: 30px;
          color: var(--muted);
          font-size: 14.5px;
        }
        .aura-sel .state.err {
          color: #f0b8b8;
          background: rgba(255, 59, 59, 0.06);
          border: 1px solid rgba(255, 59, 59, 0.3);
          border-radius: 12px;
          padding: 16px;
        }

        .aura-sel .grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: sel-rise 0.7s ease 0.15s both;
        }
        .aura-sel .card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px 22px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: var(--glass);
          color: var(--text);
          font-family: var(--font-inter), sans-serif;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }
        .aura-sel .card:hover {
          border-color: rgba(255, 59, 59, 0.5);
          background: rgba(255, 59, 59, 0.05);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px -12px rgba(255, 59, 59, 0.5);
        }
        .aura-sel .card-ico { font-size: 22px; }
        .aura-sel .card-name { flex: 1; }
        .aura-sel .card-arrow {
          color: var(--red);
          font-size: 20px;
          opacity: 0;
          transform: translateX(-6px);
          transition: all 0.2s ease;
        }
        .aura-sel .card:hover .card-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        @keyframes sel-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.8; }
        }
        @keyframes sel-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aura-sel * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </main>
  );
}