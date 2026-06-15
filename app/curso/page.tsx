"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

type Perfil = {
  id: string;
  plan: string;
  curso_free: string | null;
  carrera: string | null;
};

export default function SeleccionCurso() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carrera, setCarrera] = useState("");
  const [cursos, setCursos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const [verCarreras, setVerCarreras] = useState(false);
  const [carreras, setCarreras] = useState<string[]>([]);
  const [cargandoCarreras, setCargandoCarreras] = useState(false);
  const [confirmarSalir, setConfirmarSalir] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session;
      if (!session) {
        router.replace("/");
        return;
      }
      const uid = session.user.id;
      const full =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        "";
      setNombre(full.split(" ")[0] || "");

      const { data: p } = await supabase
        .from("profiles")
        .select("id, plan, curso_free, carrera")
        .eq("id", uid)
        .single();

      if (!p) {
        setError(true);
        setLoading(false);
        return;
      }
      setPerfil(p as Perfil);

      let car = p.carrera || "";
      if (!car) {
        try {
          car = sessionStorage.getItem("aura_carrera") || "";
        } catch (e) {
          console.error(e);
        }
      }
      if (!car) {
        router.replace("/carrera");
        return;
      }
      setCarrera(car);

      fetch(`${API}/cursos?carrera=${encodeURIComponent(car)}`)
        .then((r) => r.json())
        .then((d) => {
          setCursos(d.cursos || []);
          setLoading(false);
        })
        .catch((e) => {
          console.error(e);
          setError(true);
          setLoading(false);
        });
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const esPremium = perfil?.plan === "premium";

  const bloqueado = (curso: string) => {
    if (esPremium) return false;
    if (!perfil?.curso_free) return false;
    return curso !== perfil.curso_free;
  };

  const entrarACurso = (curso: string) => {
    try {
      sessionStorage.setItem("aura_carrera", carrera);
      sessionStorage.setItem("aura_curso", curso);
    } catch (e) {
      console.error(e);
    }
    router.push("/chat");
  };

  const clickCurso = (curso: string) => {
    if (esPremium) {
      entrarACurso(curso);
      return;
    }
    if (perfil?.curso_free) {
      if (curso === perfil.curso_free) {
        entrarACurso(curso);
      } else {
        setConfirmar("__premium__");
      }
      return;
    }
    setConfirmar(curso);
  };

  const confirmarFree = async () => {
    if (!perfil || !confirmar || confirmar === "__premium__") return;
    setGuardando(true);
    await supabase
      .from("profiles")
      .update({ curso_free: confirmar })
      .eq("id", perfil.id);
    setPerfil({ ...perfil, curso_free: confirmar });
    setGuardando(false);
    const elegido = confirmar;
    setConfirmar(null);
    entrarACurso(elegido);
  };

  const abrirCambiarCarrera = () => {
    setMenuOpen(false);
    setVerCarreras(true);
    if (carreras.length === 0) {
      setCargandoCarreras(true);
      fetch(`${API}/carreras`)
        .then((r) => r.json())
        .then((d) => {
          setCarreras(d.carreras || []);
          setCargandoCarreras(false);
        })
        .catch((e) => {
          console.error(e);
          setCargandoCarreras(false);
        });
    }
  };

  const cambiarCarrera = async (nuevaCarrera: string) => {
    if (!perfil) return;
    setGuardando(true);
    await supabase
      .from("profiles")
      .update({ carrera: nuevaCarrera })
      .eq("id", perfil.id);
    try {
      sessionStorage.setItem("aura_carrera", nuevaCarrera);
    } catch (e) {
      console.error(e);
    }
    setPerfil({ ...perfil, carrera: nuevaCarrera });
    setCarrera(nuevaCarrera);
    setBusqueda("");
    setLoading(true);
    fetch(`${API}/cursos?carrera=${encodeURIComponent(nuevaCarrera)}`)
      .then((r) => r.json())
      .then((d) => {
        setCursos(d.cursos || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
        setLoading(false);
      });
    setGuardando(false);
    setVerCarreras(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const normalizar = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const cursosFiltrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return cursos;
    return cursos.filter((c) => normalizar(c).includes(q));
  }, [cursos, busqueda]);

  return (
    <main className={`aura-sel ${grotesk.variable} ${inter.variable}`}>
      <div className="bg-glow" />
      <div className="vignette" />

      <header className="topbar">
        <button className="brand" onClick={() => router.push("/curso")} aria-label="Inicio">
          <span className="mini-radar">
            <span className="mini-ring" />
            <span className="mini-core" />
          </span>
          <span className="brand-name">AURA</span>
        </button>
        <div className="top-right">
          <span className={`plan-pill ${esPremium ? "premium" : "free"}`}>
            {esPremium ? "Premium" : "Free"}
            {carrera ? <span className="pill-sep">·</span> : null}
            {carrera ? <span className="pill-carrera">{carrera}</span> : null}
          </span>

          <div className="config-wrap" ref={menuRef}>
            <button
              className={`config-btn ${menuOpen ? "active" : ""}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Configuración"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>

            {menuOpen && (
              <div className="menu">
                <div className="menu-head">
                  <div className="menu-avatar">
                    {(nombre[0] || "?").toUpperCase()}
                  </div>
                  <div className="menu-info">
                    <span className="menu-name">{nombre || "Estudiante"}</span>
                    <span className="menu-plan">
                      {esPremium ? "Premium" : "Plan Free"}
                    </span>
                  </div>
                </div>

                <div className="menu-sep" />

                <button className="menu-item" onClick={abrirCambiarCarrera}>
                  <span className="mi-ico"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></span>
                  <span className="mi-text">Cambiar carrera</span>
                </button>

                <div className="menu-item disabled">
                  <span className="mi-ico"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></span>
                  <span className="mi-text">Apariencia</span>
                  <span className="mi-soon">Pronto</span>
                </div>

                <div className="menu-sep" />

                <button
                  className="menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmarSalir(true);
                  }}
                >
                  <span className="mi-ico"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
                  <span className="mi-text">Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="content">
        <h1 className="title">¿Con qué curso te ayudo?</h1>
        <p className="sub">
          {esPremium
            ? "Tienes acceso a todos tus cursos."
            : perfil?.curso_free
            ? "Tu curso gratis está activo. Los demás son Premium."
            : "Con el plan free eliges 1 curso gratis."}
        </p>

        {!loading && !error && cursos.length > 0 && (
          <div className="search-wrap">
            <span className="search-ico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input
              type="text"
              className="search-input"
              placeholder="Busca tu curso…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoComplete="off"
            />
            {busqueda && (
              <button className="search-clear" onClick={() => setBusqueda("")} aria-label="Limpiar">
                ✕
              </button>
            )}
          </div>
        )}

        {loading && <div className="state">Cargando cursos…</div>}

        {error && (
          <div className="state err">
            No pude conectar con el servidor. Si es la primera vez en un rato, puede tardar
            unos segundos en despertar. Recarga e intenta de nuevo.
          </div>
        )}

        {!loading && !error && cursos.length === 0 && (
          <div className="state">Aún no hay cursos en esta carrera.</div>
        )}

        {!loading && !error && cursos.length > 0 && cursosFiltrados.length === 0 && (
          <div className="state">No se encontró ningún curso con “{busqueda}”.</div>
        )}

        {!loading && !error && cursosFiltrados.length > 0 && (
          <div className="grid">
            {cursosFiltrados.map((c) => {
              const lock = bloqueado(c);
              return (
                <button
                  key={c}
                  className={`card ${lock ? "locked" : ""}`}
                  onClick={() => clickCurso(c)}
                >
                  <div className="card-top">
                    <span className={`card-ico ${lock ? "locked" : ""}`}>
                      {lock ? (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      )}
                    </span>
                    {lock ? (
                      <span className="card-tag">Premium</span>
                    ) : (
                      <span className="card-arrow">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <span className="card-name">{c}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {confirmar && confirmar !== "__premium__" && (
        <div className="overlay" onClick={() => !guardando && setConfirmar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-ico">🎓</span>
            <h2 className="modal-title">¿Elegir {confirmar} como tu curso gratis?</h2>
            <p className="modal-text">
              Con el plan free solo puedes tener <b>1 curso</b>. Este quedará como tu
              curso gratis y no podrás cambiarlo. Los demás cursos serán Premium.
            </p>
            <div className="modal-btns">
              <button
                className="btn ghost"
                onClick={() => setConfirmar(null)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button className="btn primary" onClick={confirmarFree} disabled={guardando}>
                {guardando ? "Guardando…" : "Sí, elegir este"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmar === "__premium__" && (
        <div className="overlay" onClick={() => setConfirmar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-ico">🔒</span>
            <h2 className="modal-title">Este curso es Premium</h2>
            <p className="modal-text">
              Tu plan free incluye 1 curso. Para desbloquear todos tus cursos, pásate a
              Premium por <b>S/30 al mes</b>.
            </p>
            <div className="modal-btns">
              <button className="btn ghost" onClick={() => setConfirmar(null)}>
                Ahora no
              </button>
              <a
                className="btn primary"
                href="https://wa.me/51968193508?text=Hola,%20quiero%20Premium%20en%20AURA"
                target="_blank"
                rel="noreferrer"
              >
                Quiero Premium
              </a>
            </div>
          </div>
        </div>
      )}

      {verCarreras && (
        <div className="overlay" onClick={() => !guardando && setVerCarreras(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-ico">🎓</span>
            <h2 className="modal-title">Elige tu carrera</h2>
            <p className="modal-text">Verás los cursos de la carrera que elijas.</p>

            {cargandoCarreras && <div className="state">Cargando…</div>}

            {!cargandoCarreras && (
              <div className="car-list">
                {carreras.map((c) => (
                  <button
                    key={c}
                    className={`car-item ${c === carrera ? "actual" : ""}`}
                    onClick={() => cambiarCarrera(c)}
                    disabled={guardando}
                  >
                    <span>{c}</span>
                    {c === carrera && <span className="actual-tag">Actual</span>}
                  </button>
                ))}
              </div>
            )}

            <button
              className="btn ghost full"
              onClick={() => setVerCarreras(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmarSalir && (
        <div className="overlay" onClick={() => setConfirmarSalir(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-ico">🚪</span>
            <h2 className="modal-title">¿Cerrar sesión?</h2>
            <p className="modal-text">Tendrás que volver a iniciar sesión con Google.</p>
            <div className="modal-btns">
              <button className="btn ghost" onClick={() => setConfirmarSalir(false)}>
                Cancelar
              </button>
              <button className="btn primary" onClick={cerrarSesion}>
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

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

          position: relative; min-height: 100vh;
          background: var(--bg); color: var(--text);
          font-family: var(--font-inter), system-ui, sans-serif;
          overflow-x: hidden; -webkit-font-smoothing: antialiased;
        }
        body { background: #070708; }

        .aura-sel .bg-glow, .aura-sel .vignette {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
        }
        .aura-sel .bg-glow {
          background: radial-gradient(700px 500px at 50% -5%, rgba(255, 59, 59, 0.09), transparent 60%);
        }
        .aura-sel .vignette {
          background: radial-gradient(circle at 50% 30%, transparent 60%, var(--bg-deep) 100%);
        }

        .aura-sel .topbar {
          position: relative; z-index: 5;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px;
        }
        .aura-sel .brand {
          display: flex; align-items: center; gap: 10px;
          background: none; border: 0; cursor: pointer;
        }
        .aura-sel .mini-radar {
          position: relative; width: 22px; height: 22px;
          display: grid; place-items: center;
        }
        .aura-sel .mini-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(255, 59, 59, 0.4);
        }
        .aura-sel .mini-core {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--red-bright); box-shadow: 0 0 10px 2px var(--glow);
          animation: sel-breathe 3s ease-in-out infinite;
        }
        .aura-sel .brand-name {
          font-family: var(--font-grotesk), sans-serif; font-weight: 700;
          letter-spacing: 0.18em; font-size: 16px; color: #f4f4f6;
        }
        .aura-sel .top-right { display: flex; align-items: center; gap: 12px; }
        .aura-sel .plan-pill {
          font-size: 11.5px; font-weight: 600; letter-spacing: 0.03em;
          padding: 6px 13px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 7px;
        }
        .aura-sel .plan-pill.free { color: var(--muted); border: 1px solid var(--line); }
        .aura-sel .plan-pill.premium {
          color: #ffd479; border: 1px solid rgba(255, 212, 121, 0.4);
          background: rgba(255, 212, 121, 0.08);
        }
        .aura-sel .pill-sep { opacity: 0.4; }
        .aura-sel .pill-carrera {
          font-weight: 500; opacity: 0.85;
          max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .aura-sel .config-wrap { position: relative; }
        .aura-sel .config-btn {
          background: none; border: 1px solid var(--line);
          border-radius: 50%; width: 36px; height: 36px;
          font-size: 16px; cursor: pointer; display: grid; place-items: center;
          transition: all 0.2s ease;
        }
        .aura-sel .config-btn:hover, .aura-sel .config-btn.active {
          border-color: rgba(255, 59, 59, 0.4); background: rgba(255, 59, 59, 0.05);
          transform: rotate(40deg);
        }
        .aura-sel .menu {
          position: absolute; top: 46px; right: 0; z-index: 20;
          width: 230px; background: #121214;
          border: 1px solid var(--line); border-radius: 14px;
          padding: 8px; box-shadow: 0 16px 44px -12px rgba(0, 0, 0, 0.7);
          animation: menu-pop 0.16s ease both;
          transform-origin: top right;
        }
        .aura-sel .menu-head {
          display: flex; align-items: center; gap: 11px; padding: 10px 10px 12px;
        }
        .aura-sel .menu-avatar {
          flex: none; width: 38px; height: 38px; border-radius: 50%;
          display: grid; place-items: center;
          background: radial-gradient(circle, var(--red-bright), var(--red));
          color: #fff; font-weight: 700; font-size: 16px;
          font-family: var(--font-grotesk), sans-serif;
        }
        .aura-sel .menu-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .aura-sel .menu-name { font-weight: 600; font-size: 14px; color: #f4f4f6; }
        .aura-sel .menu-plan { font-size: 12px; color: var(--muted); }
        .aura-sel .menu-sep { height: 1px; background: var(--line); margin: 4px 0; }
        .aura-sel .menu-item {
          display: flex; align-items: center; gap: 11px; width: 100%;
          padding: 11px 10px; border-radius: 9px; border: 0; background: none;
          color: var(--text); cursor: pointer; text-align: left; font-size: 14px;
          font-family: var(--font-inter), sans-serif;
          transition: background 0.15s ease;
        }
        .aura-sel .menu-item:hover:not(.disabled) { background: rgba(255, 255, 255, 0.05); }
        .aura-sel .menu-item.danger:hover { background: rgba(255, 59, 59, 0.1); }
        .aura-sel .menu-item.disabled { opacity: 0.5; cursor: default; }
        .aura-sel .mi-ico { font-size: 17px; }
        .aura-sel .mi-text { flex: 1; }
        .aura-sel .mi-soon {
          font-size: 10px; color: var(--faint);
          border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px;
        }

        .aura-sel .content {
          position: relative; z-index: 1;
          max-width: 820px; margin: 0 auto; padding: 6vh 24px 60px; text-align: center;
        }
        .aura-sel .title {
          font-family: var(--font-grotesk), sans-serif; font-weight: 600;
          font-size: clamp(26px, 5vw, 34px); margin: 0 0 10px; color: #f4f4f6;
          animation: sel-rise 0.7s ease 0.05s both;
        }
        .aura-sel .sub {
          color: var(--muted); font-size: 14.5px; margin: 0 0 28px;
          animation: sel-rise 0.7s ease 0.1s both;
        }
        .aura-sel .state { margin-top: 30px; color: var(--muted); font-size: 14.5px; }
        .aura-sel .state.err {
          color: #f0b8b8; background: rgba(255, 59, 59, 0.06);
          border: 1px solid rgba(255, 59, 59, 0.3); border-radius: 12px; padding: 16px;
        }

        .aura-sel .search-wrap {
          position: relative; max-width: 460px; margin: 0 auto 28px;
          animation: sel-rise 0.7s ease 0.12s both;
        }
        .aura-sel .search-ico {
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
          font-size: 15px; opacity: 0.6; pointer-events: none;
        }
        .aura-sel .search-input {
          width: 100%; box-sizing: border-box;
          background: var(--glass); border: 1px solid var(--line);
          border-radius: 13px; padding: 14px 16px 14px 44px;
          color: var(--text); font-size: 15px; font-family: var(--font-inter), sans-serif;
          outline: none; transition: all 0.2s ease;
        }
        .aura-sel .search-input::placeholder { color: var(--faint); }
        .aura-sel .search-input:focus {
          border-color: rgba(255, 59, 59, 0.5); background: rgba(255, 59, 59, 0.04);
          box-shadow: 0 0 0 1px rgba(255, 59, 59, 0.2), 0 0 30px -10px rgba(255, 59, 59, 0.4);
        }
        .aura-sel .search-clear {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: 0; color: var(--muted); cursor: pointer;
          font-size: 13px; padding: 4px 6px;
        }
        .aura-sel .search-clear:hover { color: var(--text); }

        .aura-sel .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 13px;
          animation: sel-rise 0.7s ease 0.15s both;
        }
        .aura-sel .card {
          display: flex; flex-direction: column; gap: 14px;
          padding: 18px 18px 20px; border-radius: 16px;
          border: 1px solid var(--line); background: var(--glass);
          color: var(--text); font-family: var(--font-inter), sans-serif;
          cursor: pointer; text-align: left;
          transition: all 0.2s ease; min-height: 96px;
        }
        .aura-sel .card:hover {
          border-color: rgba(255, 59, 59, 0.5); background: rgba(255, 59, 59, 0.05);
          transform: translateY(-2px); box-shadow: 0 8px 30px -12px rgba(255, 59, 59, 0.5);
        }
        .aura-sel .card.locked { opacity: 0.6; }
        .aura-sel .card.locked:hover {
          border-color: rgba(255, 212, 121, 0.4); background: rgba(255, 212, 121, 0.05);
          box-shadow: none;
        }
        .aura-sel .card-top {
          display: flex; align-items: center; justify-content: space-between;
        }
        .aura-sel .card-ico {
          width: 40px; height: 40px; border-radius: 11px;
          background: rgba(255, 59, 59, 0.1); display: grid; place-items: center;
          font-size: 19px;
        }
        .aura-sel .card-ico.locked { background: rgba(255, 212, 121, 0.1); }
        .aura-sel .card-name {
          font-size: 15px; font-weight: 500; line-height: 1.35; color: #f4f4f6;
        }
        .aura-sel .card-arrow {
          color: var(--red); font-size: 19px; opacity: 0;
          transform: translateX(-6px); transition: all 0.2s ease;
        }
        .aura-sel .card:hover .card-arrow { opacity: 1; transform: translateX(0); }
        .aura-sel .card-tag {
          font-size: 11px; font-weight: 600; color: #ffd479;
          border: 1px solid rgba(255, 212, 121, 0.4); border-radius: 999px; padding: 4px 10px;
        }

        .aura-sel .overlay {
          position: fixed; inset: 0; z-index: 30;
          background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
          display: grid; place-items: center; padding: 24px;
          animation: fade 0.2s ease both;
        }
        .aura-sel .modal {
          width: min(420px, 100%); background: #111113;
          border: 1px solid var(--line); border-radius: 20px;
          padding: 30px 26px; text-align: center;
          animation: pop 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .aura-sel .modal-ico { font-size: 34px; }
        .aura-sel .modal-title {
          font-family: var(--font-grotesk), sans-serif; font-weight: 600;
          font-size: 19px; margin: 14px 0 10px; color: #f4f4f6;
        }
        .aura-sel .modal-text {
          color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0 0 22px;
        }
        .aura-sel .modal-text b { color: var(--text); }

        .aura-sel .car-list {
          display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;
          max-height: 280px; overflow-y: auto;
        }
        .aura-sel .car-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-radius: 12px;
          border: 1px solid var(--line); background: var(--glass);
          color: var(--text); cursor: pointer; font-size: 14.5px; text-align: left;
          font-family: var(--font-inter), sans-serif; transition: all 0.2s ease;
        }
        .aura-sel .car-item:hover:not(:disabled) {
          border-color: rgba(255, 59, 59, 0.4); background: rgba(255, 59, 59, 0.05);
        }
        .aura-sel .car-item.actual {
          border-color: rgba(255, 212, 121, 0.4); background: rgba(255, 212, 121, 0.06);
        }
        .aura-sel .car-item:disabled { opacity: 0.5; cursor: default; }
        .aura-sel .actual-tag {
          font-size: 10.5px; color: #ffd479;
          border: 1px solid rgba(255, 212, 121, 0.4); border-radius: 999px; padding: 2px 8px;
        }

        .aura-sel .modal-btns { display: flex; gap: 10px; }
        .aura-sel .btn {
          flex: 1; padding: 13px; border-radius: 12px; font-size: 14.5px;
          font-weight: 500; cursor: pointer; border: 1px solid var(--line);
          font-family: var(--font-inter), sans-serif; text-decoration: none;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s ease;
        }
        .aura-sel .btn.full { width: 100%; flex: none; }
        .aura-sel .btn.ghost { background: none; color: var(--muted); }
        .aura-sel .btn.ghost:hover { color: var(--text); }
        .aura-sel .btn.primary {
          background: var(--red); color: #fff; border-color: var(--red);
          box-shadow: 0 0 20px -4px var(--glow);
        }
        .aura-sel .btn.primary:hover { background: var(--red-bright); }
        .aura-sel .btn:disabled { opacity: 0.6; cursor: default; }

        @keyframes sel-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.8; }
        }
        @keyframes sel-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes menu-pop {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pop {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aura-sel * { animation: none !important; transition: none !important; }
        }
        @media (max-width: 520px) {
          .aura-sel .pill-carrera { max-width: 90px; }
          .aura-sel .grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        }
      `}</style>
    </main>
  );
}