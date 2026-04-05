import { useState, useRef } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const BG = "#F5F5F0";
const WHITE = "#FFFFFF";
const BLACK = "#0A0A0A";
const ORANGE = "#FF4D00";
const ORANGE_LIGHT = "#FFF0EB";
const GRAY = "#888888";
const GRAY_LIGHT = "#E8E8E2";
const GRAY_MID = "#CCCCCC";
const TEXT = "#1A1A1A";
const SUCCESS = "#00A86B";

// ─── AI PROMPTS ───────────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `Eres el motor de AutoPilot Fit para LATAM. Analiza la imagen y responde SOLO JSON sin markdown:
{"alimento":"nombre","calorias":número,"proteinas":g,"carbohidratos":g,"grasas":g,"decision":"acción concreta máx 12 palabras","ajuste":"ajuste próxima comida máx 15 palabras","alerta":"normal|atencion|critico","mensaje_alerta":"texto o null","prediccion":"resultado estimado hoy máx 12 palabras","emoji":"emoji"}
Objetivo del usuario indicado abajo. Lenguaje simple español latinoamericano.`;

const ESTIMATE_PROMPT = `Eres nutricionista para app fitness LATAM. El usuario escribió el nombre de un alimento. Respondé SOLO JSON sin markdown ni explicaciones:
{"calorias":número,"proteinas":número,"carbohidratos":número,"grasas":número,"emoji":"emoji del alimento","confianza":"alta|media|baja"}
Estimá para una porción típica/estándar de ese alimento en Argentina/LATAM. Si no reconocés el alimento, usá valores genéricos razonables con confianza baja.`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GOALS = [
  { id: "bajarpeso", label: "Bajar de peso", desc: "Reducir peso de forma sostenida", emoji: "⬇️" },
  { id: "definicion", label: "Definición", desc: "Bajar grasa manteniendo músculo", emoji: "🔥" },
  { id: "recomposicion", label: "Recomposición", desc: "Perder grasa y ganar músculo", emoji: "⚖️" },
  { id: "volumen", label: "Volumen limpio", desc: "Ganar masa muscular controlando grasa", emoji: "💪" },
  { id: "salud", label: "Salud general", desc: "Mejorar hábitos y bienestar", emoji: "🌿" },
];
const DISCIPLINE = [
  { id: "bajo", label: "Soy realista", desc: "Me cuesta ser constante", emoji: "😅" },
  { id: "medio", label: "Equilibrado", desc: "Puedo seguir un plan con esfuerzo", emoji: "🙂" },
  { id: "alto", label: "Comprometido", desc: "Soy disciplinado y constante", emoji: "🎯" },
];
const ACTIVITY = [
  { id: "sedentario", label: "Sedentario", desc: "Trabajo sentado, poco movimiento" },
  { id: "ligero", label: "Ligero", desc: "Camino un poco, 1-2 días de ejercicio" },
  { id: "moderado", label: "Moderado", desc: "3-4 días de entrenamiento" },
  { id: "activo", label: "Muy activo", desc: "5+ días de entrenamiento intenso" },
];
const MOCK_RESULT = {
  alimento: "Milanesa con papas fritas", calorias: 680, proteinas: 34,
  carbohidratos: 58, grasas: 28, decision: "No cenes carbohidratos esta noche",
  ajuste: "Próxima comida: proteína magra y vegetales", alerta: "atencion",
  mensaje_alerta: "Calorías elevadas para este horario", prediccion: "Llegarás a 2100 kcal hoy", emoji: "🥩",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcTDEE(profile) {
  const { peso, altura, edad, sexo, actividad, objetivo } = profile;
  if (!peso || !altura || !edad) return 2000;
  let bmr = sexo === "mujer" ? 10*peso + 6.25*altura - 5*edad - 161 : 10*peso + 6.25*altura - 5*edad + 5;
  const f = { sedentario:1.2, ligero:1.375, moderado:1.55, activo:1.725 };
  let tdee = bmr * (f[actividad] || 1.375);
  if (objetivo === "bajarpeso") tdee -= 500;
  if (objetivo === "definicion") tdee -= 400;
  if (objetivo === "volumen") tdee += 300;
  if (objetivo === "recomposicion") tdee -= 200;
  return Math.round(tdee);
}
function calcTDEEBase(profile) {
  const { peso, altura, edad, sexo, actividad } = profile;
  if (!peso || !altura || !edad) return 2500;
  let bmr = sexo === "mujer" ? 10*peso + 6.25*altura - 5*edad - 161 : 10*peso + 6.25*altura - 5*edad + 5;
  const f = { sedentario:1.2, ligero:1.375, moderado:1.55, activo:1.725 };
  return Math.round(bmr * (f[actividad] || 1.375));
}
function calcMacros(kcal, objetivo) {
  const prot = objetivo === "volumen" ? Math.round(kcal*0.30/4) : Math.round(kcal*0.35/4);
  const fat = Math.round(kcal*0.28/9);
  const carb = Math.round((kcal - prot*4 - fat*9)/4);
  return { proteinas: prot, grasas: fat, carbohidratos: carb };
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const Tag = ({ children, color = ORANGE }) => (
  <span style={{ background: color, color: color === ORANGE ? WHITE : BLACK, fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, fontFamily: "'Barlow Condensed', sans-serif" }}>{children}</span>
);

const Input = ({ label, placeholder, value, onChange, type = "text", unit, hint }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 10, color: GRAY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>{label}</div>
    <div style={{ position: "relative" }}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", background: WHITE, border: `2px solid ${GRAY_LIGHT}`, borderRadius: 10, padding: unit ? "14px 50px 14px 16px" : "14px 16px", color: TEXT, fontSize: 16, fontFamily: "'Barlow', sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
        onFocus={e => e.target.style.borderColor = ORANGE}
        onBlur={e => e.target.style.borderColor = GRAY_LIGHT}
      />
      {unit && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: GRAY, fontSize: 12, fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>{unit}</span>}
    </div>
    {hint && <div style={{ fontSize: 11, color: GRAY, marginTop: 4, fontFamily: "'Barlow', sans-serif" }}>{hint}</div>}
  </div>
);

const BigBtn = ({ children, onClick, disabled, secondary, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", background: disabled ? GRAY_LIGHT : secondary ? WHITE : BLACK,
    color: disabled ? GRAY : secondary ? BLACK : WHITE,
    border: secondary ? `2px solid ${GRAY_LIGHT}` : "none",
    borderRadius: 12, padding: "17px 0", fontSize: 15, fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
    textTransform: "uppercase", transition: "all 0.15s", ...style
  }}>{children}</button>
);

const StatBar = ({ label, valor, maximo, color, unit = "g" }) => {
  const pct = Math.min((valor / maximo) * 100, 100);
  const over = valor > maximo;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, fontFamily: "'Barlow', sans-serif" }}>
        <span style={{ color: GRAY, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
        <span style={{ color: over ? ORANGE : TEXT, fontWeight: 700 }}>{valor}<span style={{ color: GRAY, fontWeight: 400 }}>/{maximo}{unit}</span></span>
      </div>
      <div style={{ background: GRAY_LIGHT, borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? ORANGE : color, borderRadius: 4, transition: "width 1s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
};

const NavBar = ({ tab, setTab }) => {
  const tabs = [
    { id: "home", icon: "⚡", label: "Hoy" },
    { id: "camera", icon: "📸", label: "Registrar" },
    { id: "stats", icon: "📊", label: "Progreso" },
    { id: "profile", icon: "👤", label: "Perfil" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: WHITE, borderTop: `2px solid ${GRAY_LIGHT}`, display: "flex", padding: "10px 0 24px", zIndex: 100 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? ORANGE : GRAY_MID, transition: "color 0.18s" }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
};

const Card = ({ children, style = {}, orange }) => (
  <div style={{ background: orange ? ORANGE : WHITE, borderRadius: 16, padding: 20, border: orange ? "none" : `2px solid ${GRAY_LIGHT}`, ...style }}>
    {children}
  </div>
);

const SectionLabel = ({ children, light }) => (
  <div style={{ fontSize: 10, color: light ? "rgba(255,255,255,0.6)" : GRAY, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{children}</div>
);

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ nombre: "", sexo: "hombre", edad: "", peso: "", altura: "", objetivo: "", disciplina: "", actividad: "moderado" });
  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const canNext = [true, profile.nombre && profile.edad, profile.peso && profile.altura, profile.objetivo, profile.disciplina];

  const steps = [
    // 0: Welcome
    <div key="w" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
      <div style={{ width: 80, height: 80, background: BLACK, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 32 }}>⚡</div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 800, letterSpacing: -1, lineHeight: 1, marginBottom: 8, color: BLACK }}>AUTOPILOT<br /><span style={{ color: ORANGE }}>FIT</span></h1>
      <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.6, marginBottom: 48, fontFamily: "'Barlow', sans-serif" }}>La app que decide por vos.<br />Sin cálculos. Sin drama. Solo resultados.</p>
      <BigBtn onClick={() => setStep(1)}>Empezar ahora →</BigBtn>
      <p style={{ color: GRAY_MID, fontSize: 11, marginTop: 16, fontFamily: "'Barlow', sans-serif" }}>30 segundos · gratis</p>
    </div>,

    // 1: Nombre y sexo
    <div key="b" style={{ flex: 1, padding: "0 20px" }}>
      <Tag>Paso 1 de 4</Tag>
      <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, marginTop: 12, marginBottom: 24, color: BLACK, letterSpacing: -0.5 }}>¿CÓMO TE<br />LLAMÁS?</h2>
      <Input label="Tu nombre" placeholder="Ej: Martín" value={profile.nombre} onChange={v => set("nombre", v)} />
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: GRAY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>Sexo biológico</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["hombre", "mujer"].map(s => (
            <button key={s} onClick={() => set("sexo", s)} style={{ flex: 1, background: profile.sexo === s ? BLACK : WHITE, color: profile.sexo === s ? WHITE : TEXT, border: `2px solid ${profile.sexo === s ? BLACK : GRAY_LIGHT}`, borderRadius: 10, padding: "13px 0", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              {s === "hombre" ? "👨 Hombre" : "👩 Mujer"}
            </button>
          ))}
        </div>
      </div>
      <Input label="Edad" placeholder="25" value={profile.edad} onChange={v => set("edad", v)} type="number" unit="años" />
    </div>,

    // 2: Medidas
    <div key="m" style={{ flex: 1, padding: "0 20px" }}>
      <Tag>Paso 2 de 4</Tag>
      <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, marginTop: 12, marginBottom: 8, color: BLACK, letterSpacing: -0.5 }}>TU CUERPO<br />ACTUAL</h2>
      <p style={{ color: GRAY, fontSize: 13, marginBottom: 24, fontFamily: "'Barlow', sans-serif" }}>Para calcular tu metabolismo exacto.</p>
      <Input label="Peso actual" placeholder="75" value={profile.peso} onChange={v => set("peso", v)} type="number" unit="kg" />
      <Input label="Altura" placeholder="175" value={profile.altura} onChange={v => set("altura", v)} type="number" unit="cm" />
      <div>
        <div style={{ fontSize: 10, color: GRAY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>Nivel de actividad</div>
        {ACTIVITY.map(a => (
          <div key={a.id} onClick={() => set("actividad", a.id)} style={{ background: profile.actividad === a.id ? BLACK : WHITE, border: `2px solid ${profile.actividad === a.id ? BLACK : GRAY_LIGHT}`, borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, transition: "all 0.15s" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: profile.actividad === a.id ? WHITE : TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: profile.actividad === a.id ? "rgba(255,255,255,0.6)" : GRAY, fontFamily: "'Barlow', sans-serif" }}>{a.desc}</div>
            </div>
            {profile.actividad === a.id && <span style={{ color: ORANGE, fontSize: 18 }}>✓</span>}
          </div>
        ))}
      </div>
    </div>,

    // 3: Objetivo
    <div key="o" style={{ flex: 1, padding: "0 20px" }}>
      <Tag>Paso 3 de 4</Tag>
      <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, marginTop: 12, marginBottom: 8, color: BLACK, letterSpacing: -0.5 }}>¿QUÉ<br />BUSCÁS?</h2>
      <p style={{ color: GRAY, fontSize: 13, marginBottom: 20, fontFamily: "'Barlow', sans-serif" }}>El sistema adapta todo en base a esto.</p>
      {GOALS.map(g => (
        <div key={g.id} onClick={() => set("objetivo", g.id)} style={{ background: profile.objetivo === g.id ? BLACK : WHITE, border: `2px solid ${profile.objetivo === g.id ? BLACK : GRAY_LIGHT}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, transition: "all 0.15s" }}>
          <span style={{ fontSize: 26 }}>{g.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: profile.objetivo === g.id ? WHITE : TEXT, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3 }}>{g.label}</div>
            <div style={{ fontSize: 11, color: profile.objetivo === g.id ? "rgba(255,255,255,0.6)" : GRAY, fontFamily: "'Barlow', sans-serif" }}>{g.desc}</div>
          </div>
          {profile.objetivo === g.id && <span style={{ color: ORANGE }}>✓</span>}
        </div>
      ))}
    </div>,

    // 4: Disciplina
    <div key="d" style={{ flex: 1, padding: "0 20px" }}>
      <Tag>Paso 4 de 4</Tag>
      <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, marginTop: 12, marginBottom: 8, color: BLACK, letterSpacing: -0.5 }}>¿CUÁN<br />CONSTANTE SOS?</h2>
      <p style={{ color: GRAY, fontSize: 13, marginBottom: 20, fontFamily: "'Barlow', sans-serif" }}>Sé honesto. El sistema se ajusta a vos.</p>
      {DISCIPLINE.map(d => (
        <div key={d.id} onClick={() => set("disciplina", d.id)} style={{ background: profile.disciplina === d.id ? BLACK : WHITE, border: `2px solid ${profile.disciplina === d.id ? BLACK : GRAY_LIGHT}`, borderRadius: 12, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, marginBottom: 12, transition: "all 0.15s" }}>
          <span style={{ fontSize: 28 }}>{d.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: profile.disciplina === d.id ? WHITE : TEXT, fontFamily: "'Barlow Condensed', sans-serif" }}>{d.label}</div>
            <div style={{ fontSize: 11, color: profile.disciplina === d.id ? "rgba(255,255,255,0.6)" : GRAY, fontFamily: "'Barlow', sans-serif" }}>{d.desc}</div>
          </div>
          {profile.disciplina === d.id && <span style={{ color: ORANGE }}>✓</span>}
        </div>
      ))}
    </div>,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, color: TEXT, paddingTop: step > 0 ? 72 : 0 }}>
      {step > 0 && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 50, padding: "16px 20px", background: BG, borderBottom: `1px solid ${GRAY_LIGHT}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: TEXT, fontSize: 20, cursor: "pointer" }}>←</button>
            <div style={{ display: "flex", gap: 6 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ width: i <= step ? 24 : 8, height: 4, borderRadius: 2, background: i <= step ? BLACK : GRAY_LIGHT, transition: "all 0.3s" }} />)}
            </div>
            <div style={{ width: 24 }} />
          </div>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: step === 0 ? 0 : 8, overflowY: "auto" }}>
        {steps[step]}
      </div>
      {step > 0 && (
        <div style={{ padding: "16px 20px 36px", background: BG }}>
          <BigBtn disabled={!canNext[step]} onClick={() => { if (step < 4) setStep(s => s + 1); else onComplete(profile); }}>
            {step === 4 ? "⚡ Activar AutoPilot" : "Continuar →"}
          </BigBtn>
        </div>
      )}
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ profile, historial, mode, setMode, setTab }) {
  const kcal = calcTDEE(profile);
  const macros = calcMacros(kcal, profile.objetivo);
  const consumed = historial.reduce((a, h) => ({ calorias: a.calorias+h.calorias, proteinas: a.proteinas+h.proteinas, carbohidratos: a.carbohidratos+h.carbohidratos, grasas: a.grasas+h.grasas }), { calorias:0, proteinas:0, carbohidratos:0, grasas:0 });
  const remaining = kcal - consumed.calorias;
  const pct = Math.min(Math.round((consumed.calorias/kcal)*100), 100);
  const goalObj = GOALS.find(g => g.id === profile.objetivo);

  const decisiones = [
    consumed.proteinas < macros.proteinas * 0.5
      ? { icon: "🥩", text: `Necesitás ${macros.proteinas - consumed.proteinas}g más de proteína hoy` }
      : { icon: "✅", text: "Proteína del día bien encaminada" },
    remaining > 800
      ? { icon: "⚡", text: `Quedan ${remaining} kcal disponibles. No saltees comidas.` }
      : remaining < 0
      ? { icon: "🚨", text: `Superaste el objetivo por ${Math.abs(remaining)} kcal` }
      : { icon: "🎯", text: `Vas bien. Solo ${remaining} kcal más para hoy.` },
    { icon: "💧", text: "Tomá agua antes de tu próxima comida" },
  ];

  return (
    <div style={{ paddingBottom: 100, background: BG, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "56px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: GRAY, fontFamily: "'Barlow', sans-serif", fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: BLACK, letterSpacing: -0.5, lineHeight: 1 }}>
            HOLA, {(profile.nombre || "CRACK").toUpperCase()} {goalObj?.emoji}
          </h1>
        </div>
        <button onClick={() => setMode(m => m === "automatico" ? "asistido" : "automatico")} style={{ background: mode === "automatico" ? BLACK : WHITE, color: mode === "automatico" ? WHITE : TEXT, border: `2px solid ${mode === "automatico" ? BLACK : GRAY_LIGHT}`, borderRadius: 20, padding: "6px 14px", fontSize: 9, fontWeight: 800, cursor: "pointer", letterSpacing: 1.5, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase" }}>
          {mode === "automatico" ? "🤖 Auto" : "👁 Manual"}
        </button>
      </div>

      {/* Hero kcal card */}
      <div style={{ margin: "16px 20px 0" }}>
        <Card orange>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <SectionLabel light>Calorías hoy</SectionLabel>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 52, fontWeight: 800, color: WHITE, lineHeight: 1, letterSpacing: -1 }}>
                {consumed.calorias}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'Barlow', sans-serif", marginTop: 2 }}>
                de {kcal} kcal · {remaining > 0 ? `quedan ${remaining}` : `+${Math.abs(remaining)} extra`}
              </div>
            </div>
            <div style={{ position: "relative", width: 72, height: 72 }}>
              <svg viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                <circle cx="36" cy="36" r="28" fill="none" stroke={WHITE} strokeWidth="6"
                  strokeDasharray={`${pct * 1.759} 176`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: WHITE }}>{pct}%</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[["Prot.", consumed.proteinas, macros.proteinas], ["Carbos", consumed.carbohidratos, macros.carbohidratos], ["Grasas", consumed.grasas, macros.grasas]].map(([l, v, m]) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: WHITE }}>{v}g</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "'Barlow', sans-serif" }}>{l} / {m}g</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Decisiones */}
      <div style={{ margin: "16px 20px 0" }}>
        <SectionLabel>{mode === "automatico" ? "🤖 Decisiones automáticas" : "💡 Sugerencias"}</SectionLabel>
        {decisiones.map((d, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: `2px solid ${GRAY_LIGHT}`, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{d.icon}</span>
            <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.4, fontFamily: "'Barlow', sans-serif" }}>{d.text}</span>
          </div>
        ))}
      </div>

      {/* Historial */}
      {historial.length > 0 && (
        <div style={{ margin: "16px 20px 0" }}>
          <SectionLabel>Comidas de hoy</SectionLabel>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {historial.map((h, i) => (
              <div key={i} style={{ minWidth: 76, background: WHITE, borderRadius: 12, padding: "12px 8px", border: `2px solid ${GRAY_LIGHT}`, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{h.emoji}</div>
                <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{h.hora}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, fontFamily: "'Barlow Condensed', sans-serif" }}>{h.calorias}</div>
                <div style={{ fontSize: 9, color: GRAY }}>kcal</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ margin: "20px 20px 0" }}>
        <BigBtn onClick={() => setTab("camera")}>📸 Registrar comida</BigBtn>
      </div>
    </div>
  );
}

// ─── CAMERA TAB ───────────────────────────────────────────────────────────────
function CameraTab({ profile, onResult }) {
  const [phase, setPhase] = useState("idle");
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState({ alimento: "", calorias: "", proteinas: "", carbohidratos: "", grasas: "", emoji: "🍽️" });
  const [estimating, setEstimating] = useState(false);
  const [estimated, setEstimated] = useState(false);
  const [confianza, setConfianza] = useState(null);
  const cameraRef = useRef();
  const galleryRef = useRef();

  const handleImage = (file) => {
    if (!file) return;
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
    setPhase("preview");
  };

  const analyze = async () => {
    setPhase("analyzing");
    try {
      const msgs = imageBase64
        ? [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: `Analiza este alimento. Objetivo: ${profile.objetivo}. Calorías objetivo: ${calcTDEE(profile)} kcal.` }
          ]}]
        : [{ role: "user", content: "Analiza una milanesa con papas fritas." }];

      const res = await fetch("/api/anthropic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: ANALYZE_PROMPT, messages: msgs }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      setResult(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch { setResult(MOCK_RESULT); }
    setPhase("result");
  };

  const estimateManual = async (nombre) => {
    if (!nombre || nombre.length < 2) return;
    setEstimating(true);
    setEstimated(false);
    try {
      const res = await fetch("/api/anthropic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 300,
          system: ESTIMATE_PROMPT,
          messages: [{ role: "user", content: `Alimento: "${nombre}"` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setManual(m => ({ ...m, calorias: String(parsed.calorias), proteinas: String(parsed.proteinas), carbohidratos: String(parsed.carbohidratos), grasas: String(parsed.grasas), emoji: parsed.emoji || "🍽️" }));
      setConfianza(parsed.confianza);
      setEstimated(true);
    } catch {
      // fallback silencioso
    }
    setEstimating(false);
  };

  const submitManual = () => {
    const entry = {
      alimento: manual.alimento || "Alimento manual",
      calorias: parseInt(manual.calorias) || 0,
      proteinas: parseInt(manual.proteinas) || 0,
      carbohidratos: parseInt(manual.carbohidratos) || 0,
      grasas: parseInt(manual.grasas) || 0,
      decision: "Registrado. Seguí tu plan de hoy.",
      ajuste: "Ajustá la próxima comida según lo consumido.",
      alerta: "normal", mensaje_alerta: null,
      prediccion: "Datos cargados manualmente.",
      emoji: manual.emoji || "✏️",
    };
    onResult({ ...entry, hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), imagen: null });
    setPhase("idle");
    setManual({ alimento: "", calorias: "", proteinas: "", carbohidratos: "", grasas: "", emoji: "🍽️" });
    setEstimated(false);
  };

  const accept = () => {
    if (result) onResult({ ...result, hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), imagen: image });
    setPhase("idle"); setImage(null); setResult(null);
  };

  const Back = ({ to = "idle" }) => (
    <button onClick={() => setPhase(to)} style={{ background: "none", border: "none", color: TEXT, fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
  );

  if (phase === "idle") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 20px 0" }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, color: BLACK, letterSpacing: -0.5, marginBottom: 4 }}>REGISTRAR<br />COMIDA</h1>
        <p style={{ color: GRAY, fontSize: 13, fontFamily: "'Barlow', sans-serif", marginBottom: 32 }}>Fotografiá o escribí tu alimento</p>
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Cámara */}
        <div onClick={() => cameraRef.current.click()} style={{ background: BLACK, borderRadius: 16, padding: "24px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
          <div style={{ width: 52, height: 52, background: ORANGE, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📷</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800, color: WHITE, letterSpacing: 0.3 }}>ABRIR CÁMARA</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow', sans-serif" }}>La IA analiza automáticamente</div>
          </div>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />

        {/* Galería */}
        <div onClick={() => galleryRef.current.click()} style={{ background: WHITE, borderRadius: 16, padding: "20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", border: `2px solid ${GRAY_LIGHT}` }}>
          <div style={{ width: 52, height: 52, background: GRAY_LIGHT, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🖼️</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: 0.3 }}>ELEGIR DE GALERÍA</div>
            <div style={{ fontSize: 11, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>Seleccioná una foto existente</div>
          </div>
        </div>
        <input ref={galleryRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />

        {/* Manual */}
        <div onClick={() => setPhase("manual")} style={{ background: WHITE, borderRadius: 16, padding: "20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", border: `2px solid ${GRAY_LIGHT}` }}>
          <div style={{ width: 52, height: 52, background: GRAY_LIGHT, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>✏️</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: 0.3 }}>CARGAR MANUALMENTE</div>
            <div style={{ fontSize: 11, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>La IA estima los macros por vos</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (phase === "preview") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Back /><span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: BLACK }}>CONFIRMAR FOTO</span>
      </div>
      <div style={{ margin: "0 20px", borderRadius: 16, overflow: "hidden", aspectRatio: "4/3", background: GRAY_LIGHT }}>
        <img src={image} alt="comida" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ margin: "16px 20px 0" }}>
        <Card><div style={{ fontSize: 13, color: GRAY, fontFamily: "'Barlow', sans-serif", lineHeight: 1.7 }}>🤖 La IA identificará el alimento, estimará macros y generará tu acción automática personalizada.</div></Card>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "16px 20px 120px" }}>
        <BigBtn onClick={analyze}>⚡ Analizar con IA</BigBtn>
      </div>
    </div>
  );

  if (phase === "analyzing") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", border: `4px solid ${GRAY_LIGHT}`, borderTop: `4px solid ${ORANGE}`, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>⚡</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, color: BLACK, marginBottom: 6 }}>ANALIZANDO...</div>
        <div style={{ color: GRAY, fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>Identificando alimento y calculando ajustes</div>
      </div>
    </div>
  );

  if (phase === "result" && result) return (
    <div style={{ paddingBottom: 120, background: BG, minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Back /><span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: BLACK }}>RESULTADO</span>
      </div>

      <div style={{ margin: "0 20px 12px" }}>
        <Card orange>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: 44 }}>{result.emoji}</span>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: WHITE }}>{result.alimento}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 800, color: WHITE, lineHeight: 1 }}>{result.calorias} <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.6)" }}>kcal</span></div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[["Proteínas", result.proteinas], ["Carbos", result.carbohidratos], ["Grasas", result.grasas]].map(([l, v]) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: WHITE }}>{v}g</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "'Barlow', sans-serif" }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {result.alerta !== "normal" && (
        <div style={{ margin: "0 20px 12px", borderRadius: 12, padding: "14px 16px", background: result.alerta === "critico" ? "#FFF0F0" : "#FFF8EC", border: `2px solid ${result.alerta === "critico" ? "#FFB3B3" : "#FFD580"}`, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{result.alerta === "critico" ? "🚨" : "⚠️"}</span>
          <span style={{ fontSize: 13, color: result.alerta === "critico" ? "#CC0000" : "#996600", fontFamily: "'Barlow', sans-serif", lineHeight: 1.4 }}>{result.mensaje_alerta}</span>
        </div>
      )}

      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <Tag>🤖 Decisión automática</Tag>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: BLACK, marginTop: 10, marginBottom: 8, lineHeight: 1.3 }}>{result.decision}</div>
          <div style={{ fontSize: 13, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{result.ajuste}</div>
          {result.prediccion && <div style={{ fontSize: 12, color: GRAY, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${GRAY_LIGHT}`, fontFamily: "'Barlow', sans-serif" }}>📊 {result.prediccion}</div>}
        </Card>
      </div>

      <div style={{ margin: "0 20px" }}>
        <BigBtn onClick={accept}>✓ Registrar y continuar</BigBtn>
        <button onClick={() => setPhase("manual")} style={{ width: "100%", background: "none", border: "none", color: GRAY, fontSize: 12, padding: "12px 0 4px", cursor: "pointer", fontFamily: "'Barlow', sans-serif" }}>¿No reconoció bien el alimento? Cargarlo manualmente →</button>
        <button onClick={() => setPhase("idle")} style={{ width: "100%", background: "none", border: "none", color: GRAY_MID, fontSize: 12, padding: "4px 0", cursor: "pointer", fontFamily: "'Barlow', sans-serif" }}>Cancelar</button>
      </div>
    </div>
  );

  if (phase === "manual") return (
    <div style={{ paddingBottom: 120, background: BG, minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <Back /><span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: BLACK }}>CARGA MANUAL</span>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div style={{ background: BLACK, borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "'Barlow', sans-serif", lineHeight: 1.5 }}>Escribí el nombre del alimento y la IA estima los macros automáticamente. Podés ajustar los valores si querés.</span>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: GRAY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>Nombre del alimento</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={manual.alimento}
              onChange={e => { setManual(m => ({ ...m, alimento: e.target.value })); setEstimated(false); }}
              placeholder="Ej: Empanada de carne"
              style={{ flex: 1, background: WHITE, border: `2px solid ${GRAY_LIGHT}`, borderRadius: 10, padding: "14px 16px", color: TEXT, fontSize: 15, fontFamily: "'Barlow', sans-serif", outline: "none" }}
              onFocus={e => e.target.style.borderColor = ORANGE}
              onBlur={e => e.target.style.borderColor = GRAY_LIGHT}
            />
            <button
              onClick={() => estimateManual(manual.alimento)}
              disabled={!manual.alimento || estimating}
              style={{ background: manual.alimento && !estimating ? ORANGE : GRAY_LIGHT, color: manual.alimento && !estimating ? WHITE : GRAY, border: "none", borderRadius: 10, padding: "0 16px", fontSize: 12, fontWeight: 800, cursor: manual.alimento && !estimating ? "pointer" : "not-allowed", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, flexShrink: 0 }}>
              {estimating ? "..." : "ESTIMAR"}
            </button>
          </div>
          {estimated && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{manual.emoji}</span>
              <span style={{ fontSize: 11, color: SUCCESS, fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
                ✓ Macros estimados · Confianza {confianza}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Calorías" placeholder="280" value={manual.calorias} onChange={v => setManual(m => ({ ...m, calorias: v }))} type="number" unit="kcal" />
          <Input label="Proteínas" placeholder="12" value={manual.proteinas} onChange={v => setManual(m => ({ ...m, proteinas: v }))} type="number" unit="g" />
          <Input label="Carbohidratos" placeholder="32" value={manual.carbohidratos} onChange={v => setManual(m => ({ ...m, carbohidratos: v }))} type="number" unit="g" />
          <Input label="Grasas" placeholder="11" value={manual.grasas} onChange={v => setManual(m => ({ ...m, grasas: v }))} type="number" unit="g" />
        </div>

        <div style={{ fontSize: 11, color: GRAY, fontFamily: "'Barlow', sans-serif", marginBottom: 16, textAlign: "center" }}>Solo el nombre y las calorías son obligatorios</div>
        <BigBtn onClick={submitManual} disabled={!manual.alimento || !manual.calorias}>✓ Registrar comida</BigBtn>
      </div>
    </div>
  );

  return null;
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab({ profile, historial }) {
  const kcal = calcTDEE(profile);
  const days = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
  const mockWeek = [1680, 2100, 1850, 1920, 0, 2200, 1750];
  const maxBar = Math.max(...mockWeek, kcal);
  const adherencia = mockWeek.filter(d => d > 0 && Math.abs(d - kcal) < 300).length;
  const goalObj = GOALS.find(g => g.id === profile.objetivo);

  return (
    <div style={{ paddingBottom: 100, background: BG, minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 20px" }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, color: BLACK, letterSpacing: -0.5 }}>PROGRESO</h1>
      </div>

      <div style={{ margin: "0 20px 12px" }}>
        <Card orange>
          <SectionLabel light>📊 Predicción del sistema</SectionLabel>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: WHITE, marginBottom: 4 }}>
            {profile.objetivo === "bajarpeso" ? "En 4 semanas: −2 a 3kg de peso" :
             profile.objetivo === "definicion" ? "En 4 semanas: −1.2kg de grasa" :
             profile.objetivo === "volumen" ? "En 4 semanas: +0.8kg músculo" :
             "En 4 semanas: recomposición visible"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "'Barlow', sans-serif" }}>Basado en tu adherencia ({adherencia}/7 días esta semana)</div>
        </Card>
      </div>

      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>Calorías esta semana</SectionLabel>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 8 }}>
            {mockWeek.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", height: `${v > 0 ? (v/maxBar)*100 : 0}%`, minHeight: v > 0 ? 4 : 0, background: Math.abs(v-kcal) < 300 ? BLACK : v > kcal+300 ? ORANGE : GRAY_LIGHT, borderRadius: "4px 4px 0 0", transition: "height 0.8s" }} />
                <div style={{ fontSize: 9, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{days[i]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>
            <span><span style={{ color: BLACK }}>■</span> En objetivo</span>
            <span><span style={{ color: ORANGE }}>■</span> Excedido</span>
            <span><span style={{ color: GRAY_LIGHT }}>■</span> Sin registro</span>
          </div>
        </Card>
      </div>

      <div style={{ margin: "0 20px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Racha", value: "3 días", sub: "en objetivo", color: BLACK },
          { label: "Adherencia", value: `${adherencia}/7`, sub: "esta semana", color: ORANGE },
          { label: "Promedio kcal", value: Math.round(mockWeek.filter(d=>d).reduce((a,b)=>a+b,0)/mockWeek.filter(d=>d).length), sub: `obj: ${kcal}`, color: BLACK },
          { label: "Riesgo", value: "Bajo", sub: "de abandono", color: SUCCESS },
        ].map(m => (
          <div key={m.label} style={{ background: WHITE, borderRadius: 14, padding: 16, border: `2px solid ${GRAY_LIGHT}` }}>
            <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ margin: "0 20px" }}>
        <Card>
          <SectionLabel>⚠️ Alertas</SectionLabel>
          {[
            { icon: "✅", text: "Sin señales de sobreentrenamiento", ok: true },
            { icon: "⚠️", text: "Proteína baja 3 días esta semana", ok: false },
            { icon: "✅", text: "Estancamiento: no detectado", ok: true },
          ].map((a, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: i<arr.length-1?12:0, marginBottom: i<arr.length-1?12:0, borderBottom: i<arr.length-1?`1px solid ${GRAY_LIGHT}`:"none" }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <span style={{ fontSize: 13, color: a.ok ? TEXT : ORANGE, fontFamily: "'Barlow', sans-serif", fontWeight: a.ok ? 400 : 600 }}>{a.text}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── PROFILE TAB ──────────────────────────────────────────────────────────────
function ProfileTab({ profile, onUpdate, mode, setMode, historial }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  const kcal = calcTDEE(profile);
  const macros = calcMacros(kcal, profile.objetivo);
  const goalObj = GOALS.find(g => g.id === profile.objetivo);
  const actObj = ACTIVITY.find(a => a.id === profile.actividad);
  const discObj = DISCIPLINE.find(d => d.id === profile.disciplina);

  const imcVal = profile.peso && profile.altura ? profile.peso / ((profile.altura/100)**2) : null;
  const imc = imcVal ? imcVal.toFixed(1) : "—";
  const imcLabel = !imcVal ? "—" : imcVal < 18.5 ? "Bajo peso" : imcVal < 25 ? "Normal ✓" : imcVal < 30 ? "Sobrepeso" : "Obesidad";
  const imcColor = !imcVal ? GRAY : imcVal < 18.5 ? "#0066CC" : imcVal < 25 ? SUCCESS : imcVal < 30 ? ORANGE : "#CC0000";

  const tdeeBase = calcTDEEBase(profile);
  const deficitDiario = tdeeBase - kcal;
  const consumidoHoy = historial.reduce((a, h) => a + h.calorias, 0);
  const restanHoy = Math.max(kcal - consumidoHoy, 0);
  const perdidaSemana = (deficitDiario * 7 / 7700).toFixed(2);
  const perdidaMes = (deficitDiario * 30 / 7700).toFixed(1);

  if (editing) return (
    <div style={{ paddingBottom: 120, background: BG, minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: TEXT, fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: BLACK }}>EDITAR PERFIL</span>
      </div>
      <div style={{ padding: "0 20px" }}>
        <Input label="Nombre" value={draft.nombre} onChange={v => set("nombre", v)} placeholder="Tu nombre" />
        <Input label="Edad" value={draft.edad} onChange={v => set("edad", v)} type="number" unit="años" placeholder="25" />
        <Input label="Peso" value={draft.peso} onChange={v => set("peso", v)} type="number" unit="kg" placeholder="75" />
        <Input label="Altura" value={draft.altura} onChange={v => set("altura", v)} type="number" unit="cm" placeholder="175" />
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: GRAY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, fontFamily: "'Barlow Condensed', sans-serif', fontWeight: 600" }}>Objetivo</div>
          {GOALS.map(g => (
            <div key={g.id} onClick={() => set("objetivo", g.id)} style={{ background: draft.objetivo===g.id?BLACK:WHITE, border:`2px solid ${draft.objetivo===g.id?BLACK:GRAY_LIGHT}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
              <span>{g.emoji}</span>
              <span style={{ fontSize:14, fontWeight:800, color:draft.objetivo===g.id?WHITE:TEXT, fontFamily:"'Barlow Condensed', sans-serif" }}>{g.label}</span>
              {draft.objetivo===g.id && <span style={{ marginLeft:"auto", color:ORANGE }}>✓</span>}
            </div>
          ))}
        </div>
        <BigBtn onClick={() => { onUpdate(draft); setEditing(false); }}>Guardar cambios</BigBtn>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 100, background: BG, minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, color: BLACK, letterSpacing: -0.5 }}>MI PERFIL</h1>
        <button onClick={() => setEditing(true)} style={{ background: BLACK, border: "none", borderRadius: 10, padding: "8px 16px", color: WHITE, fontSize: 11, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 1 }}>✏️ EDITAR</button>
      </div>

      {/* Avatar */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: BLACK, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
            {profile.sexo === "mujer" ? "👩" : "👨"}
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: BLACK, letterSpacing: -0.3 }}>{profile.nombre || "Usuario"}</div>
            <div style={{ fontSize: 12, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{goalObj?.label} · {discObj?.label}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => setMode(m => m === "automatico" ? "asistido" : "automatico")} style={{ background: mode==="automatico"?BLACK:WHITE, color: mode==="automatico"?WHITE:TEXT, border:`2px solid ${mode==="automatico"?BLACK:GRAY_LIGHT}`, borderRadius:20, padding:"6px 14px", fontSize:9, fontWeight:800, cursor:"pointer", fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:1.5, textTransform:"uppercase" }}>
              {mode==="automatico"?"🤖 Auto":"👁 Manual"}
            </button>
          </div>
        </Card>
      </div>

      {/* Medidas */}
      <div style={{ margin: "0 20px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ label: "Peso", value: profile.peso?`${profile.peso}kg`:"—" }, { label: "Altura", value: profile.altura?`${profile.altura}cm`:"—" }].map(s => (
          <div key={s.label} style={{ background: WHITE, borderRadius: 12, padding: "16px 12px", border: `2px solid ${GRAY_LIGHT}`, textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: BLACK }}>{s.value}</div>
            <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* IMC */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>📏 Índice de Masa Corporal</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 44, fontWeight: 800, color: imcColor, lineHeight: 1 }}>{imc}</div>
              <div style={{ fontSize: 13, color: imcColor, fontWeight: 700, fontFamily: "'Barlow', sans-serif", marginTop: 2 }}>{imcLabel}</div>
            </div>
            <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif", lineHeight: 2, textAlign: "right" }}>
              &lt;18.5 · Bajo peso<br/>18.5–24.9 · <span style={{ color: SUCCESS, fontWeight: 700 }}>Normal</span><br/>25–29.9 · Sobrepeso<br/>≥30 · Obesidad
            </div>
          </div>
          <div style={{ background: GRAY_LIGHT, borderRadius: 6, height: 8, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "24%", background: "#CCE0FF" }} />
            <div style={{ position: "absolute", left: "24%", top: 0, bottom: 0, width: "30%", background: "#CCFCE8" }} />
            <div style={{ position: "absolute", left: "54%", top: 0, bottom: 0, width: "20%", background: "#FFE8CC" }} />
            <div style={{ position: "absolute", left: "74%", top: 0, bottom: 0, right: 0, background: "#FFCCCC" }} />
            {imcVal && <div style={{ position: "absolute", top: -2, bottom: -2, width: 5, borderRadius: 3, background: imcColor, left: `${Math.min(Math.max(((imcVal-15)/25)*100, 2), 96)}%`, transition: "left 0.6s", boxShadow: `0 0 6px ${imcColor}` }} />}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: GRAY, marginTop: 4, fontFamily: "'Barlow', sans-serif" }}>
            <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
          </div>
        </Card>
      </div>

      {/* Déficit */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>🔥 Déficit calórico</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Déficit diario", value: deficitDiario > 0 ? `-${deficitDiario}` : `+${Math.abs(deficitDiario)}`, unit: "kcal", color: deficitDiario > 0 ? SUCCESS : ORANGE, sub: deficitDiario > 0 ? "vs mantenimiento" : "superávit" },
              { label: "Quedan hoy", value: restanHoy, unit: "kcal", color: restanHoy > 200 ? BLACK : ORANGE, sub: "disponibles" },
              { label: "Pérdida est.", value: perdidaSemana, unit: "kg/sem", color: ORANGE, sub: "a este ritmo" },
              { label: "Proyección", value: `-${perdidaMes}`, unit: "kg/mes", color: BLACK, sub: "si mantenés el plan" },
            ].map(m => (
              <div key={m.label} style={{ background: BG, borderRadius: 12, padding: "12px 10px" }}>
                <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: m.color }}>{m.value} <span style={{ fontSize: 10, fontWeight: 400, color: GRAY }}>{m.unit}</span></div>
                <div style={{ fontSize: 10, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: BG, borderRadius: 10, padding: "10px 14px", border: `1px solid ${GRAY_LIGHT}` }}>
            <div style={{ fontSize: 11, color: GRAY, fontFamily: "'Barlow', sans-serif", lineHeight: 1.6 }}>
              💡 1kg de grasa = <span style={{ color: TEXT, fontWeight: 700 }}>~7.700 kcal</span> de déficit acumulado. A tu ritmo: <span style={{ color: ORANGE, fontWeight: 700 }}>{deficitDiario > 0 ? Math.round(7700/deficitDiario) : "∞"} días</span> para perder 1kg.
            </div>
          </div>
        </Card>
      </div>

      {/* Plan */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>⚡ Tu plan</SectionLabel>
          {[
            { label: "Calorías objetivo", value: `${kcal} kcal/día`, color: ORANGE },
            { label: "Proteínas", value: `${macros.proteinas}g/día`, color: BLACK },
            { label: "Carbohidratos", value: `${macros.carbohidratos}g/día`, color: BLACK },
            { label: "Grasas", value: `${macros.grasas}g/día`, color: BLACK },
          ].map((m, i, arr) => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i<arr.length-1?12:0, marginBottom: i<arr.length-1?12:0, borderBottom: i<arr.length-1?`1px solid ${GRAY_LIGHT}`:"none" }}>
              <span style={{ fontSize: 13, color: GRAY, fontFamily: "'Barlow', sans-serif" }}>{m.label}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: m.color, fontFamily: "'Barlow Condensed', sans-serif" }}>{m.value}</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ margin: "0 20px" }}>
        <Card>
          <SectionLabel>Configuración</SectionLabel>
          {[
            { label: "Objetivo", value: goalObj?.label || "—" },
            { label: "Actividad", value: actObj?.label || "—" },
            { label: "Disciplina", value: discObj?.label || "—" },
            { label: "Sexo", value: profile.sexo === "mujer" ? "Mujer" : "Hombre" },
          ].map((r, i, arr) => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", paddingBottom:i<arr.length-1?12:0, marginBottom:i<arr.length-1?12:0, borderBottom:i<arr.length-1?`1px solid ${GRAY_LIGHT}`:"none" }}>
              <span style={{ fontSize:13, color:GRAY, fontFamily:"'Barlow', sans-serif" }}>{r.label}</span>
              <span style={{ fontSize:13, color:TEXT, fontFamily:"'Barlow', sans-serif", fontWeight:600 }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function AutoPilotFit() {
  const [onboarded, setOnboarded] = useState(false);
  const [profile, setProfile] = useState({});
  const [tab, setTab] = useState("home");
  const [mode, setMode] = useState("automatico");
  const [historial, setHistorial] = useState([]);

  const handleResult = (entry) => {
    setHistorial(prev => [entry, ...prev.slice(0, 19)]);
    setTab("home");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: #F5F5F0; }
        input::placeholder { color: #BBBBBB; }
        input { -webkit-appearance: none; }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
      `}</style>
      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: BG }}>
        {!onboarded ? (
          <OnboardingScreen onComplete={p => { setProfile(p); setOnboarded(true); }} />
        ) : (
          <>
            {tab === "home" && <HomeTab profile={profile} historial={historial} mode={mode} setMode={setMode} setTab={setTab} />}
            {tab === "camera" && <CameraTab profile={profile} onResult={handleResult} />}
            {tab === "stats" && <StatsTab profile={profile} historial={historial} />}
            {tab === "profile" && <ProfileTab profile={profile} onUpdate={setProfile} mode={mode} setMode={setMode} historial={historial} />}
            <NavBar tab={tab} setTab={setTab} />
          </>
        )}
      </div>
    </>
  );
}
