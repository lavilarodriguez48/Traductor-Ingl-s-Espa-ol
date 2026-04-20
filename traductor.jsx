import { useState, useEffect, useRef, useCallback } from "react";

const ACCENT = "#00e5b0";
const ACCENT2 = "#7b61ff";
const RED = "#ff4757";

export default function LiveTranslate() {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | listening | translating
  const [englishText, setEnglishText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [spanishText, setSpanishText] = useState("");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const translationTimeoutRef = useRef(null);
  const accumulatedRef = useRef("");
  const lastTranslatedRef = useRef("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const translate = useCallback(async (segment, full) => {
    if (!segment.trim() || segment.trim() === lastTranslatedRef.current) return;
    lastTranslatedRef.current = segment.trim();
    setStatus("translating");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are a real-time English to Spanish translator for professional meetings. Return ONLY the Spanish translation, nothing else. Be natural and professional.",
          messages: [{ role: "user", content: `Translate to Spanish: "${full}"` }]
        })
      });
      const data = await res.json();
      const t = data.content?.[0]?.text?.trim();
      if (t) {
        setSpanishText(t);
        setHistory(h => {
          const entry = { en: segment.trim(), es: t, id: Date.now() };
          return [entry, ...h].slice(0, 30);
        });
      }
    } catch {
      setError("Error de conexión al traducir");
    } finally {
      setStatus(isListening ? "listening" : "idle");
    }
  }, [isListening]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    recognitionRef.current = rec;

    rec.onstart = () => {
      setIsListening(true);
      setStatus("listening");
      setError("");
    };

    rec.onresult = (e) => {
      let interim = "";
      let newFinal = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t + " ";
        else interim += t;
      }
      setInterimText(interim);
      if (newFinal.trim()) {
        accumulatedRef.current += newFinal;
        setEnglishText(accumulatedRef.current);
        setInterimText("");
        clearTimeout(translationTimeoutRef.current);
        const seg = newFinal.trim();
        const full = accumulatedRef.current.trim();
        translationTimeoutRef.current = setTimeout(() => translate(seg, full), 500);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Permiso de micrófono denegado. Por favor permite el acceso.");
        setIsListening(false);
        setStatus("idle");
      } else if (e.error !== "no-speech") {
        setError("Error: " + e.error);
      }
    };

    rec.onend = () => {
      if (recognitionRef.current && isListening) {
        try { rec.start(); } catch {}
      }
    };

    try {
      rec.start();
    } catch {
      setError("No se pudo iniciar el micrófono");
    }
  }, [translate, isListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setStatus("idle");
    setInterimText("");
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const toggle = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const clearAll = () => {
    stopListening();
    setEnglishText("");
    setSpanishText("");
    setInterimText("");
    setHistory([]);
    accumulatedRef.current = "";
    lastTranslatedRef.current = "";
  };

  const statusColor = status === "listening" ? RED : status === "translating" ? ACCENT : "#5a5a7a";
  const statusLabel = status === "listening" ? "Escuchando..." : status === "translating" ? "Traduciendo..." : "En espera";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#09090f",
      color: "#e8e8f0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `radial-gradient(ellipse 70% 40% at 15% 15%, rgba(0,229,176,0.05) 0%, transparent 60%),
                     radial-gradient(ellipse 50% 50% at 85% 85%, rgba(123,97,255,0.06) 0%, transparent 60%)`
      }} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 40px", width: "100%", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
            }}>🎙</div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
              Live<span style={{ color: ACCENT }}>Translate</span>
            </span>
          </div>
          <div style={{
            background: "#1a1a24", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 100, padding: "5px 13px", fontSize: 12,
            color: "#5a5a7a", display: "flex", gap: 6, alignItems: "center"
          }}>
            🇺🇸 EN <span style={{ color: ACCENT }}>→</span> 🇪🇸 ES
          </div>
        </div>

        {/* Unsupported warning */}
        {!supported && (
          <div style={{
            background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)",
            borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#ff8a94", marginBottom: 16
          }}>
            ⚠️ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari en iOS/Android.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)",
            borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#ff8a94", marginBottom: 16
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Status */}
        <div style={{
          background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "14px 18px", display: "flex",
          alignItems: "center", justifyContent: "space-between", marginBottom: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: statusColor,
              boxShadow: status !== "idle" ? `0 0 0 4px ${statusColor}22` : "none",
              transition: "all 0.3s"
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: status !== "idle" ? "#e8e8f0" : "#5a5a7a" }}>
              {statusLabel}
            </span>
          </div>
          {status === "listening" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width: 3, borderRadius: 2, background: ACCENT,
                  animation: `bar${i} 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  height: 4
                }} />
              ))}
            </div>
          )}
          {status === "translating" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5a5a7a" }}>
              <div style={{
                width: 12, height: 12,
                border: "2px solid rgba(255,255,255,0.1)",
                borderTopColor: ACCENT2,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
              }} />
              traduciendo
            </div>
          )}
        </div>

        {/* Text panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {/* English */}
          <div style={{
            background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18, padding: 18, minHeight: 100, position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, rgba(0,229,176,0.4), transparent)` }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              color: ACCENT, marginBottom: 10 }}>🇺🇸 English</div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: "#e8e8f0", minHeight: 60 }}>
              {englishText || interimText
                ? <>{englishText}<span style={{ color: "#5a5a7a", fontStyle: "italic" }}>{interimText}</span></>
                : <span style={{ color: "#5a5a7a", fontStyle: "italic", fontSize: 14 }}>El audio en inglés aparecerá aquí...</span>
              }
            </div>
          </div>

          {/* Spanish */}
          <div style={{
            background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18, padding: 18, minHeight: 100, position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, rgba(123,97,255,0.5), transparent)` }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ACCENT2 }}>
                🇪🇸 Español
              </div>
              {spanishText && (
                <button onClick={() => navigator.clipboard?.writeText(spanishText)} style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#5a5a7a", padding: "3px 10px", borderRadius: 6,
                  fontSize: 11, cursor: "pointer"
                }}>copiar</button>
              )}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: "#e8e8f0", minHeight: 60 }}>
              {spanishText
                ? spanishText
                : <span style={{ color: "#5a5a7a", fontStyle: "italic", fontSize: 14 }}>La traducción aparecerá aquí...</span>
              }
            </div>
          </div>
        </div>

        {/* Mic button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 24px" }}>
          <div style={{ position: "relative" }}>
            {isListening && (
              <div style={{
                position: "absolute", inset: -14, borderRadius: "50%",
                border: `2px solid ${RED}`,
                animation: "ring 1.5s ease-out infinite",
                pointerEvents: "none"
              }} />
            )}
            <button onClick={toggle} style={{
              width: 76, height: 76, borderRadius: "50%", border: "none",
              cursor: "pointer", fontSize: 28,
              background: isListening
                ? `linear-gradient(135deg, #1a0a0a, #0d1510)`
                : "#1a1a24",
              boxShadow: isListening
                ? `0 0 0 3px ${RED}, 0 8px 32px rgba(255,71,87,0.3)`
                : "0 4px 20px rgba(0,0,0,0.4)",
              transition: "all 0.3s",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {isListening ? "⏹" : "🎙"}
            </button>
          </div>
        </div>

        {/* History */}
        <div style={{
          background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 18, padding: 18
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#5a5a7a" }}>
              📋 Historial
            </span>
            {history.length > 0 && (
              <button onClick={clearAll} style={{
                background: "none", border: "none", color: "#5a5a7a",
                fontSize: 12, cursor: "pointer"
              }}>limpiar</button>
            )}
          </div>
          {history.length === 0
            ? <div style={{ color: "#5a5a7a", fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                Las frases traducidas aparecerán aquí
              </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
                {history.map(item => (
                  <div key={item.id} style={{
                    background: "#1a1a24", borderRadius: 12, padding: "12px 14px",
                    borderLeft: `3px solid ${ACCENT2}`
                  }}>
                    <div style={{ fontSize: 12, color: "#5a5a7a", marginBottom: 5, fontFamily: "monospace" }}>
                      🇺🇸 {item.en}
                    </div>
                    <div style={{ fontSize: 14, color: "#e8e8f0", fontWeight: 600 }}>
                      🇪🇸 {item.es}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ring {
          0% { opacity: 0.6; transform: scale(0.9); }
          100% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
