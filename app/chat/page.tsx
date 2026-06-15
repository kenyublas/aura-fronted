"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Space_Grotesk, Inter } from "next/font/google";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

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

type Fuente = { archivo: string; pagina: number };
type Msg = {
  rol: "user" | "aura";
  texto: string;
  fuentes?: Fuente[];
  error?: boolean;
  adjunto?: string;
};

export default function Chat() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [carrera, setCarrera] = useState("");
  const [curso, setCurso] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState(false);

  const [docTexto, setDocTexto] = useState("");
  const [docNombre, setDocNombre] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [imgAviso, setImgAviso] = useState(false);
  const [menuAdjuntos, setMenuAdjuntos] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [docError, setDocError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuAbiertoRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
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

      let car = "", cur = "";
      try {
        car = sessionStorage.getItem("aura_carrera") || "";
        cur = sessionStorage.getItem("aura_curso") || "";
      } catch (e) {
        console.error(e);
      }
      if (!cur) {
        router.replace("/curso");
        return;
      }
      setCarrera(car);
      setCurso(cur);
      setLista(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    menuAbiertoRef.current = menuAdjuntos;
  }, [menuAdjuntos]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (menuAbiertoRef.current && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAdjuntos(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const historyItems = useMemo(() => {
    const items: Array<{ pregunta: string; msgIndex: number }> = [];
    msgs.forEach((m, index) => {
      if (m.rol === "user") {
        items.push({ pregunta: m.texto, msgIndex: index });
      }
    });
    return items.reverse();
  }, [msgs]);

  const scrollToHistory = (msgIndex: number) => {
    const element = document.getElementById(`message-${msgIndex}`);
    if (element) {
      requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      setSelectedHistory(msgIndex);
    }
    setHistOpen(false);
  };

  const mostrarDocError = (msg: string) => {
    setDocError(msg);
    setTimeout(() => setDocError(""), 3500);
  };

  const onElegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMenuAdjuntos(false);
    setSubiendo(true);
    setDocNombre("");
    setDocTexto("");
    setDocError("");
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const res = await fetch(`${API}/leer-archivo`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setDocTexto(data.texto);
        setDocNombre(data.nombre || file.name);
      } else {
        mostrarDocError(data.error || "No pude leer el archivo.");
      }
    } catch (e) {
      console.error(e);
      mostrarDocError("No pude conectar con el servidor para leer el archivo.");
    } finally {
      setSubiendo(false);
    }
  };

  const quitarAdjunto = () => {
    setDocTexto("");
    setDocNombre("");
  };

  const enviar = async (texto?: string) => {
    const pregunta = (texto ?? input).trim();
    if ((!pregunta && !docTexto) || loading) return;
    setInput("");

    const adjuntoActual = docNombre;
    const docActual = docTexto;

    const nuevos: Msg[] = [
      ...msgs,
      { rol: "user", texto: pregunta || "(documento adjunto)", adjunto: adjuntoActual || undefined },
    ];
    setMsgs(nuevos);
    setLoading(true);
    setDocTexto("");
    setDocNombre("");

    const historial = nuevos
      .slice(-7, -1)
      .map((m) => `${m.rol === "user" ? "Estudiante" : "AURA"}: ${m.texto}`)
      .join("\n");

    const preguntaConContexto = historial
      ? `Contexto de la conversacion:\n${historial}\n\nNueva pregunta: ${pregunta}`
      : pregunta;

    try {
      const res = await fetch(`${API}/preguntar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta: preguntaConContexto,
          carrera,
          curso,
          documento: docActual,
        }),
      });
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setMsgs((m) => [
        ...m,
        { rol: "aura", texto: data.respuesta || "Sin respuesta.", fuentes: data.fuentes || [] },
      ]);
    } catch (e) {
      console.error(e);
      setMsgs((m) => [
        ...m,
        {
          rol: "aura",
          texto: "No pude conectar con el servidor. Si es la primera consulta en un rato, puede tardar unos segundos en despertar. Intenta de nuevo. 🙏",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const nuevoChat = () => {
    setMsgs([]);
    quitarAdjunto();
    setSelectedHistory(null);
    setHistOpen(false);
  };
  const cambiarCurso = () => router.push("/curso");

  const SUGERENCIAS = [
    `¿Cuáles son los temas principales de ${curso}?`,
    "Explícame el tema más importante con un ejemplo",
    "Dame un ejercicio resuelto paso a paso",
  ];

  if (!lista) {
    return (
      <main className={`aura-chat ${grotesk.variable} ${inter.variable}`}>
        <div className="loading-screen">
          <span className="ls-core" />
          <span className="ls-text">Cargando AURA…</span>
        </div>
        <style jsx global>{`
          body { background: #070708; }
          .aura-chat .loading-screen {
            min-height: 100vh; display: flex; flex-direction: column; gap: 16px;
            align-items: center; justify-content: center;
            color: #7a7a83; background: #070708; font-family: sans-serif;
          }
          .aura-chat .ls-core {
            width: 14px; height: 14px; border-radius: 50%;
            background: #ff5c5c; box-shadow: 0 0 16px 3px rgba(255,59,59,0.5);
            animation: ls-pulse 1.5s ease-in-out infinite;
          }
          .aura-chat .ls-text { font-size: 13px; letter-spacing: 0.05em; }
          @keyframes ls-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.6; }
          }
        `}</style>
      </main>
    );
  }

  const vacio = msgs.length === 0;

  return (
    <main className={`aura-chat ${grotesk.variable} ${inter.variable} ${histOpen ? "hist-open" : ""}`}>
      <div className="bg-glow" />

      <div className="hist-backdrop" onClick={() => setHistOpen(false)} />

      <aside className="history-panel">
        <div className="hp-top">
          <button className="hp-new" onClick={nuevoChat}>
            <span className="hp-new-ico">+</span> Nuevo chat
          </button>
        </div>

        <p className="hp-label">Historial</p>

        <div className="hp-list">
          {historyItems.length === 0 ? (
            <p className="hp-empty">Tus preguntas aparecerán aquí.</p>
          ) : (
            historyItems.map((item) => (
              <button
                key={item.msgIndex}
                className={`hp-item ${selectedHistory === item.msgIndex ? "active" : ""}`}
                onClick={() => scrollToHistory(item.msgIndex)}
                title={item.pregunta}
              >
                <span className="hp-item-dot" />
                <span className="hp-item-text">{item.pregunta}</span>
              </button>
            ))
          )}
        </div>

        <div className="hp-foot">
          <span className="hp-curso">{curso}</span>
        </div>
      </aside>

      <div className="chat-shell">
        <header className="bar-top">
          <div className="bar-left">
            <button
              className="hamburger"
              onClick={() => setHistOpen((v) => !v)}
              aria-label="Abrir historial"
            >
              <span /><span /><span />
            </button>
            <button className="brand" onClick={cambiarCurso} aria-label="Cambiar de curso">
              <span className="mini-radar">
                <span className="mini-ring" />
                <span className="mini-core" />
              </span>
              <span className="brand-name">AURA</span>
            </button>
          </div>
          <div className="top-right">
            <span className="course-pill">{curso}</span>
          </div>
        </header>

        <div className="scroll" ref={scrollRef}>
          <div className="thread">
            {vacio && (
              <div className="empty">
                <span className="empty-core" aria-hidden="true">
                  <span className="ec-ring" />
                  <span className="ec-dot" />
                </span>
                <h2 className="greeting">
                  Hola{nombre ? `, ${nombre}` : ""} <span role="img" aria-label="saludo">👋</span>
                </h2>
                <p className="sub">
                  Pregúntame lo que quieras de <b>{curso}</b>. Respondo solo con su material.
                </p>
                <div className="sugs">
                  {SUGERENCIAS.map((s, idx) => (
                    <button
                      key={s}
                      className="sug"
                      onClick={() => enviar(s)}
                      style={{ animationDelay: `${0.3 + idx * 0.08}s` }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div id={`message-${i}`} key={i} className={`row ${m.rol}`}>
                {m.rol === "aura" && <span className={`avatar ${m.error ? "err" : ""}`} />}
                <div className={`bubble ${m.rol} ${m.error ? "err" : ""}`}>
                  {m.rol === "user" && m.adjunto && (
                    <div className="msg-adjunto">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      {m.adjunto}
                    </div>
                  )}
                  {m.rol === "aura" ? (
                    <div className="md">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code({ inline, className, children, ...props }: {
                            inline?: boolean;
                            className?: string;
                            children?: React.ReactNode;
                          }) {
                            const match = /language-(\w+)/.exec(className || "");
                            if (!inline && match) {
                              return (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  customStyle={{
                                    borderRadius: "10px",
                                    fontSize: "13px",
                                    margin: "10px 0",
                                  }}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              );
                            }
                            return (
                              <code className="inline-code" {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {m.texto}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    m.texto
                  )}

                  {m.fuentes && m.fuentes.length > 0 && (
                    <div className="fuentes">
                      <span className="fuentes-label">Fuentes</span>
                      {m.fuentes.map((f, j) => (
                        <span key={j} className="fuente">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                          {f.archivo}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="row aura">
                <span className="avatar" />
                <div className="bubble aura typing">
                  <span className="d" />
                  <span className="d" />
                  <span className="d" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="composer">
          {docError && <p className="doc-error">{docError}</p>}

          <div className="bar">
            <div className={`attach-group ${menuAdjuntos ? "open" : ""}`} ref={menuRef}>
              <button
                className="plus-btn"
                onClick={() => setMenuAdjuntos(!menuAdjuntos)}
                aria-label="Adjuntar archivo"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>

              <div className="attach-menu">
                {docNombre && (
                  <div className="adjunto-chip">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                    <span className="ac-name">{docNombre}</span>
                    <button className="ac-x" onClick={quitarAdjunto} aria-label="Quitar archivo">✕</button>
                  </div>
                )}
                {subiendo && (
                  <div className="adjunto-chip leyendo">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                    Leyendo…
                  </div>
                )}

                <div className="menu-opts">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx"
                    onChange={onElegirArchivo}
                    style={{ display: "none" }}
                  />
                  <button
                    className="opt-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={subiendo}
                  >
                    <span className="opt-ico">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                    </span>
                    <span className="opt-body">
                      <span className="opt-title">Subir PDF o Word</span>
                      <span className="opt-desc">Pregunta sobre tu documento</span>
                    </span>
                  </button>

                  <button
                    className="opt-btn img-soon"
                    onClick={() => {
                      setImgAviso(true);
                      setMenuAdjuntos(false);
                      setTimeout(() => setImgAviso(false), 2600);
                    }}
                  >
                    <span className="opt-ico">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>
                    </span>
                    <span className="opt-body">
                      <span className="opt-title">Subir imagen</span>
                      <span className="opt-desc">Foto de tu ejercicio</span>
                    </span>
                    <span className="opt-soon">Pronto</span>
                  </button>
                </div>
              </div>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              placeholder={docNombre ? "Pregunta sobre tu documento…" : "Escribe tu pregunta…"}
              autoComplete="off"
            />
            <button
              className="go"
              onClick={() => enviar()}
              disabled={loading || (!input.trim() && !docTexto)}
              aria-label="Enviar"
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          </div>

          {imgAviso && (
            <p className="img-aviso">Subir imágenes estará disponible muy pronto ✨</p>
          )}
          <p className="disclaimer">AURA puede equivocarse. Verifica con tu material.</p>
        </div>
      </div>

      <style jsx global>{`
        .aura-chat {
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

          display: grid;
          grid-template-columns: 248px 1fr;
          height: 100vh;
          position: relative;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-inter), system-ui, sans-serif;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }
        body { background: #070708; }

        .aura-chat .bg-glow {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(700px 400px at 60% -8%, rgba(255, 59, 59, 0.07), transparent 60%);
        }
        .aura-chat .hist-backdrop { display: none; }

        .aura-chat .history-panel {
          position: relative; z-index: 2;
          display: flex; flex-direction: column;
          background: rgba(13, 13, 16, 0.85);
          border-right: 1px solid var(--line);
          padding: 14px 12px;
          overflow: hidden;
        }
        .aura-chat .hp-top { margin-bottom: 16px; }
        .aura-chat .hp-new {
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 11px 14px; border-radius: 11px;
          border: 1px solid var(--line); background: var(--glass);
          color: var(--text); font-size: 13.5px; font-weight: 500; cursor: pointer;
          font-family: var(--font-inter), sans-serif; transition: all 0.2s ease;
        }
        .aura-chat .hp-new:hover {
          border-color: rgba(255, 59, 59, 0.4); background: rgba(255, 59, 59, 0.06);
          transform: translateY(-1px);
        }
        .aura-chat .hp-new-ico { font-size: 17px; line-height: 1; color: var(--red); }

        .aura-chat .hp-label {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
          color: var(--faint); margin: 0 0 8px; padding: 0 6px;
        }
        .aura-chat .hp-list {
          flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
          margin: 0 -4px; padding: 0 4px;
        }
        .aura-chat .hp-empty {
          color: var(--faint); font-size: 12.5px; padding: 10px 6px; line-height: 1.5;
        }
        .aura-chat .hp-item {
          display: flex; align-items: center; gap: 9px;
          width: 100%; text-align: left;
          padding: 9px 10px; border-radius: 9px;
          border: 0; background: none; color: var(--muted);
          cursor: pointer; font-size: 13px;
          font-family: var(--font-inter), sans-serif;
          transition: all 0.15s ease;
        }
        .aura-chat .hp-item:hover { background: rgba(255, 255, 255, 0.04); color: var(--text); }
        .aura-chat .hp-item.active { background: rgba(255, 59, 59, 0.08); color: var(--text); }
        .aura-chat .hp-item-dot {
          flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--faint);
          transition: all 0.15s ease;
        }
        .aura-chat .hp-item:hover .hp-item-dot { background: var(--muted); }
        .aura-chat .hp-item.active .hp-item-dot { background: var(--red); box-shadow: 0 0 8px 1px var(--glow); }
        .aura-chat .hp-item-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .aura-chat .hp-foot { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
        .aura-chat .hp-curso {
          font-size: 12px; color: var(--muted); display: block; padding: 4px 6px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .aura-chat .chat-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .aura-chat .bar-top {
          position: relative; z-index: 2;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid var(--line);
          background: rgba(7, 7, 8, 0.5); backdrop-filter: blur(8px);
        }
        .aura-chat .bar-left { display: flex; align-items: center; gap: 12px; }
        .aura-chat .hamburger {
          display: none;
          flex-direction: column; gap: 4px; width: 34px; height: 34px;
          border: 1px solid var(--line); border-radius: 9px; background: none;
          cursor: pointer; padding: 0; align-items: center; justify-content: center;
          transition: all 0.2s ease;
        }
        .aura-chat .hamburger:hover { border-color: rgba(255, 59, 59, 0.4); }
        .aura-chat .hamburger span {
          display: block; width: 16px; height: 2px; border-radius: 2px; background: var(--text);
        }
        .aura-chat .brand { display: flex; align-items: center; gap: 10px; background: none; border: 0; cursor: pointer; }
        .aura-chat .mini-radar { position: relative; width: 22px; height: 22px; display: grid; place-items: center; }
        .aura-chat .mini-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(255, 59, 59, 0.4); }
        .aura-chat .mini-core {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--red-bright); box-shadow: 0 0 10px 2px var(--glow);
          animation: chat-breathe 3s ease-in-out infinite;
        }
        .aura-chat .brand-name {
          font-family: var(--font-grotesk), sans-serif; font-weight: 700;
          letter-spacing: 0.18em; font-size: 16px; color: #f4f4f6;
        }
        .aura-chat .top-right { display: flex; align-items: center; gap: 11px; }
        .aura-chat .course-pill {
          font-size: 12px; color: var(--muted);
          border: 1px solid var(--line); border-radius: 999px;
          padding: 6px 13px; background: rgba(255, 255, 255, 0.015);
        }

        .aura-chat .scroll { position: relative; z-index: 1; flex: 1; overflow-y: auto; scroll-behavior: smooth; }
        .aura-chat .scroll::-webkit-scrollbar { width: 8px; }
        .aura-chat .scroll::-webkit-scrollbar-track { background: transparent; }
        .aura-chat .scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08); border-radius: 4px;
          border: 2px solid transparent; background-clip: padding-box;
        }
        .aura-chat .scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.16); background-clip: padding-box; }
        .aura-chat .thread {
          max-width: 760px; margin: 0 auto; padding: 28px 20px 16px;
          display: flex; flex-direction: column; gap: 20px;
        }

        .aura-chat .empty { margin: auto; text-align: center; padding: 6vh 0; }
        .aura-chat .empty-core {
          position: relative; display: inline-grid; place-items: center;
          width: 54px; height: 54px; margin-bottom: 20px;
          animation: chat-rise 0.7s ease both;
        }
        .aura-chat .empty-core .ec-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(255, 59, 59, 0.3);
        }
        .aura-chat .empty-core .ec-dot {
          width: 14px; height: 14px; border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #ff8080, var(--red) 60%);
          box-shadow: 0 0 16px 3px var(--glow), 0 0 36px 8px rgba(255, 59, 59, 0.25);
          animation: chat-breathe 3.2s ease-in-out infinite;
        }
        .aura-chat .greeting {
          font-family: var(--font-grotesk), sans-serif; font-weight: 600;
          font-size: 28px; margin: 0 0 10px; color: #f4f4f6;
          animation: chat-rise 0.7s ease 0.08s both;
        }
        .aura-chat .sub {
          color: var(--muted); font-size: 14.5px; margin: 0 0 26px;
          animation: chat-rise 0.7s ease 0.16s both;
        }
        .aura-chat .sub b { color: var(--text); }
        .aura-chat .sugs { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .aura-chat .sug {
          font-size: 13.5px; color: var(--text);
          border: 1px solid var(--line); border-radius: 12px;
          padding: 11px 16px; background: var(--glass); cursor: pointer; transition: all 0.2s ease;
          animation: chat-rise 0.6s ease both;
        }
        .aura-chat .sug:hover {
          border-color: rgba(255, 59, 59, 0.4); background: rgba(255, 59, 59, 0.05);
          transform: translateY(-2px);
        }

        .aura-chat .row { display: flex; gap: 11px; align-items: flex-start; animation: msg-in 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        .aura-chat .row.user { justify-content: flex-end; }
        .aura-chat .avatar {
          flex: none; width: 26px; height: 26px; border-radius: 50%; margin-top: 3px;
          position: relative;
          background: radial-gradient(circle at 40% 35%, var(--red-bright) 0%, var(--red) 50%, rgba(255, 59, 59, 0.15) 100%);
          box-shadow: 0 0 14px -2px var(--glow);
          animation: chat-breathe 3.4s ease-in-out infinite;
        }
        .aura-chat .avatar.err { background: #3a1414; box-shadow: none; animation: none; }
        .aura-chat .bubble {
          max-width: 80%; padding: 13px 17px; border-radius: 16px;
          font-size: 15px; line-height: 1.68; word-wrap: break-word; overflow-x: auto;
        }
        .aura-chat .bubble.user {
          background: #1a1a1e; border: 1px solid var(--line);
          border-bottom-right-radius: 5px; white-space: pre-wrap;
        }
        .aura-chat .bubble.aura {
          background: rgba(255, 255, 255, 0.022); border: 1px solid var(--line);
          border-bottom-left-radius: 5px; color: #e3e3e8;
        }
        .aura-chat .bubble.err {
          border-color: rgba(255, 59, 59, 0.35); background: rgba(255, 59, 59, 0.06);
          color: #f0b8b8; white-space: pre-wrap;
        }
        .aura-chat .msg-adjunto {
          font-size: 12px; color: var(--muted);
          background: rgba(255, 255, 255, 0.05); border-radius: 8px;
          padding: 5px 9px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;
        }

        .aura-chat .md p { margin: 0 0 10px; }
        .aura-chat .md p:last-child { margin-bottom: 0; }
        .aura-chat .md strong { color: #fff; font-weight: 600; }
        .aura-chat .md ul, .aura-chat .md ol { margin: 8px 0; padding-left: 22px; }
        .aura-chat .md li { margin: 4px 0; }
        .aura-chat .md h1, .aura-chat .md h2, .aura-chat .md h3 {
          font-family: var(--font-grotesk), sans-serif; margin: 14px 0 8px; color: #f4f4f6; font-size: 17px;
        }
        .aura-chat .inline-code {
          background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 6px;
          font-size: 13.5px; font-family: "Courier New", monospace; color: #ffb3b3;
        }
        .aura-chat .md a { color: var(--red-bright); }
        .aura-chat .katex { color: #f4f4f6; font-size: 1.05em; }
        .aura-chat .katex-display { margin: 14px 0; padding: 10px 0; overflow-x: auto; overflow-y: hidden; }

        .aura-chat .fuentes {
          margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line);
          display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
        }
        .aura-chat .fuentes-label {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--faint); width: 100%; margin-bottom: 2px;
        }
        .aura-chat .fuente {
          font-size: 11.5px; color: var(--muted);
          background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line);
          border-radius: 8px; padding: 4px 9px;
          display: inline-flex; align-items: center; gap: 5px;
        }

        .aura-chat .typing { display: flex; gap: 5px; align-items: center; padding: 15px 17px; }
        .aura-chat .typing .d {
          width: 7px; height: 7px; border-radius: 50%; background: var(--muted);
          animation: chat-bounce 1.3s ease-in-out infinite;
        }
        .aura-chat .typing .d:nth-child(2) { animation-delay: 0.18s; }
        .aura-chat .typing .d:nth-child(3) { animation-delay: 0.36s; }

        .aura-chat .composer {
          position: relative; z-index: 2; padding: 14px 20px 16px;
          border-top: 1px solid var(--line); background: rgba(7, 7, 8, 0.6);
          backdrop-filter: blur(10px);
        }
        .aura-chat .doc-error {
          max-width: 760px; margin: 0 auto 10px; text-align: center;
          font-size: 13px; color: #ffb3b3;
          background: rgba(255, 59, 59, 0.08); border: 1px solid rgba(255, 59, 59, 0.3);
          border-radius: 10px; padding: 9px 14px; animation: chat-fade 0.3s ease both;
        }
        .aura-chat .adjunto-chip {
          display: inline-flex; align-items: center; gap: 8px; margin-bottom: 8px;
          background: rgba(255, 59, 59, 0.08); border: 1px solid rgba(255, 59, 59, 0.3);
          border-radius: 10px; padding: 7px 12px; font-size: 13px; color: var(--text);
        }
        .aura-chat .adjunto-chip.leyendo { color: var(--muted); border-color: var(--line); background: var(--glass); }
        .aura-chat .ac-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .aura-chat .ac-x { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0 2px; }
        .aura-chat .ac-x:hover { color: var(--text); }

        .aura-chat .attach-group { position: relative; display: flex; align-items: center; flex: none; }
        .aura-chat .plus-btn {
          width: 38px; height: 38px; border-radius: 10px;
          border: 1px solid var(--line); background: none; color: var(--muted);
          cursor: pointer;
          display: grid; place-items: center; transition: all 0.2s ease;
        }
        .aura-chat .plus-btn:hover { border-color: rgba(255, 59, 59, 0.4); background: rgba(255, 59, 59, 0.05); color: var(--text); }
        .aura-chat .attach-group.open .plus-btn {
          color: var(--text); border-color: rgba(255, 59, 59, 0.4);
          background: rgba(255, 59, 59, 0.05); transform: rotate(45deg);
        }
        .aura-chat .attach-menu {
          position: absolute; bottom: 50px; left: 0; width: 248px;
          background: #121214; border: 1px solid var(--line);
          border-radius: 14px; padding: 8px;
          box-shadow: 0 16px 44px -12px rgba(0, 0, 0, 0.7);
          display: flex; flex-direction: column;
          opacity: 0; transform: translateY(8px) scale(0.97);
          pointer-events: none; transition: all 0.16s ease; z-index: 10;
        }
        .aura-chat .attach-group.open .attach-menu { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
        .aura-chat .menu-opts { display: flex; flex-direction: column; gap: 2px; }
        .aura-chat .opt-btn {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 10px; border-radius: 10px; border: 0; background: none;
          color: var(--text); cursor: pointer; text-align: left;
          font-family: var(--font-inter), sans-serif; transition: background 0.15s;
        }
        .aura-chat .opt-btn:hover:not(.img-soon) { background: rgba(255, 255, 255, 0.05); }
        .aura-chat .opt-btn:disabled { opacity: 0.5; cursor: default; }
        .aura-chat .opt-ico { flex: none; display: grid; place-items: center; color: var(--red-bright); }
        .aura-chat .opt-btn.img-soon .opt-ico { color: var(--muted); }
        .aura-chat .opt-body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .aura-chat .opt-title { font-size: 14px; font-weight: 500; }
        .aura-chat .opt-desc { font-size: 12px; color: var(--muted); }
        .aura-chat .opt-btn.img-soon { opacity: 0.55; cursor: default; }
        .aura-chat .opt-soon {
          font-size: 10px; color: var(--faint); flex: none;
          border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px;
        }

        .aura-chat .bar {
          max-width: 760px; margin: 0 auto;
          display: flex; align-items: center; gap: 8px;
          background: var(--glass); border: 1px solid var(--line);
          border-radius: 16px; padding: 7px 7px 7px 9px;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .aura-chat .bar:focus-within {
          border-color: rgba(255, 59, 59, 0.55); background: rgba(255, 59, 59, 0.04);
          box-shadow: 0 0 0 1px rgba(255, 59, 59, 0.22), 0 0 30px -8px rgba(255, 59, 59, 0.4);
        }
        .aura-chat .bar input {
          flex: 1; background: transparent; border: 0; outline: 0;
          color: var(--text); font-size: 16px; font-family: var(--font-inter), sans-serif;
          padding: 11px 4px;
        }
        .aura-chat .bar input::placeholder { color: var(--faint); }
        .aura-chat .go {
          flex: none; width: 42px; height: 42px; border-radius: 11px; border: 0;
          cursor: pointer; background: var(--red); color: #fff;
          display: grid; place-items: center;
          transition: transform 0.15s ease, background 0.2s ease;
          box-shadow: 0 0 20px -4px var(--glow);
        }
        .aura-chat .go:hover:not(:disabled) { background: var(--red-bright); transform: translateY(-1px); }
        .aura-chat .go:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
        .aura-chat .img-aviso {
          max-width: 760px; margin: 10px auto 0; text-align: center;
          font-size: 12.5px; color: #ffd479; animation: chat-fade 0.3s ease both;
        }
        .aura-chat .disclaimer {
          max-width: 760px; margin: 10px auto 0; text-align: center;
          font-size: 11.5px; color: var(--faint);
        }

        @keyframes chat-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.82; }
        }
        @keyframes chat-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes chat-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chat-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aura-chat * { animation: none !important; transition: none !important; }
        }

        @media (max-width: 1040px) {
          .aura-chat { grid-template-columns: 1fr; }
          .aura-chat .hamburger { display: flex; }
          .aura-chat .bar { max-width: 100%; }

          .aura-chat .history-panel {
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
            width: 270px; transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .aura-chat.hist-open .history-panel { transform: translateX(0); }

          .aura-chat .hist-backdrop {
            display: block; position: fixed; inset: 0; z-index: 35;
            background: rgba(0, 0, 0, 0.6); opacity: 0; pointer-events: none;
            transition: opacity 0.25s ease;
          }
          .aura-chat.hist-open .hist-backdrop { opacity: 1; pointer-events: auto; }
        }
      `}</style>
    </main>
  );
}