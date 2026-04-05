import { useState, useRef, useEffect } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ACCENT = "#C6FF4B";
const BG = "#080808";
const CARD = "#111111";
const BORDER = "#1e1e1e";
const MUTED = "#444";
const TEXT = "#f0f0f0";

const SYSTEM_PROMPT = `Eres el motor de decisión de AutoPilot Fit, app de autogestión física para LATAM.
Analiza la imagen de comida y responde SOLO con JSON válido, sin markdown ni explicaciones:
{
  "alimento": "nombre del plato detectado",
  "calorias": número,
  "proteinas": gramos,
  "carbohidratos": gramos,
  "grasas": gramos,
  "decision": "acción concreta para el usuario (máx 12 palabras)",
  "ajuste": "ajuste para próxima comida o actividad (máx 15 palabras)",
  "alerta": "normal" | "atencion" | "critico",
  "mensaje_alerta": "mensaje corto si alerta no es normal, sino null",
  "prediccion": "resultado estimado si sigue así hoy (máx 12 palabras)",
  "emoji": "emoji del alimento"
}
Considera: objetivo composición corporal. Lenguaje simple, español latinoamericano.`;

const GOALS = [
  { id: "bajarpeso", label: "Bajar de peso", desc: "Reducir peso corporal de forma sostenida", emoji: "⬇️" },
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
  alimento: "Milanesa con papas fritas",
  calorias: 680,
  proteinas: 34,
  carbohidratos: 58,
  grasas: 28,
  decision: "No cenes carbohidratos esta noche",
  ajuste: "Próxima comida: proteína magra y vegetales sin almidón",
  alerta: "atencion",
  mensaje_alerta: "Calorías elevadas para este horario del día",
  prediccion: "Llegarás a 2100 kcal, 5% sobre tu objetivo",
  emoji: "🥩",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function calcTDEE(profile) {
  const { peso, altura, edad, sexo, actividad, objetivo } = profile;
  if (!peso || !altura || !edad) return 2000;
  let bmr = sexo === "mujer"
    ? 10 * peso + 6.25 * altura - 5 * edad - 161
    : 10 * peso + 6.25 * altura - 5 * edad + 5;
  const factors = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725 };
  let tdee = bmr * (factors[actividad] || 1.375);
  if (objetivo === "bajarpeso") tdee -= 500;
  if (objetivo === "definicion") tdee -= 400;
  if (objetivo === "volumen") tdee += 300;
  if (objetivo === "recomposicion") tdee -= 200;
  return Math.round(tdee);
}

function calcMacros(kcal, objetivo) {
  const prot = objetivo === "volumen" ? Math.round(kcal * 0.30 / 4) : Math.round(kcal * 0.35 / 4);
  const fat = Math.round(kcal * 0.28 / 9);
  const carb = Math.round((kcal - prot * 4 - fat * 9) / 4);
  return { proteinas: prot, grasas: fat, carbohidratos: carb };
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const Pill = ({ children, active, onClick, style = {} }) => (
  <button onClick={onClick} style={{
    background: active ? ACCENT : CARD,
    color: active ? "#000" : MUTED,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    borderRadius: 10, padding: "10px 16px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.18s", ...style
  }}>{children}</button>
);

const Input = ({ label, placeholder, value, onChange, type = "text", unit }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
    <div style={{ position: "relative" }}>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: unit ? "14px 48px 14px 16px" : "14px 16px",
          color: TEXT, fontSize: 15, fontFamily: "'DM Sans', sans-serif",
          outline: "none", boxSizing: "border-box",
        }}
      />
      {unit && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 13 }}>{unit}</span>}
    </div>
  </div>
);

const StatBar = ({ label, valor, maximo, color, unit = "g" }) => {
  const pct = Math.min((valor / maximo) * 100, 100);
  const over = valor > maximo;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>
        <span>{label}</span>
        <span style={{ color: over ? "#ff3b6b" : "#666" }}>{valor} / {maximo}{unit}</span>
      </div>
      <div style={{ background: "#1a1a1a", borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? "#ff3b6b" : color, borderRadius: 4, transition: "width 1s cubic-bezier(.4,0,.2,1)" }} />
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
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 430,
      background: "rgba(8,8,8,0.95)", backdropFilter: "blur(20px)",
      borderTop: `1px solid ${BORDER}`, display: "flex", padding: "10px 0 24px",
      zIndex: 100,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          flex: 1, background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          color: tab === t.id ? ACCENT : MUTED,
          transition: "color 0.18s",
        }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: CARD, borderRadius: 16, padding: 20, border: `1px solid ${BORDER}`, ...style }}>
    {children}
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, color: MUTED, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>{children}</div>
);

const PrimaryBtn = ({ children, onClick, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", background: disabled ? "#1a1a1a" : ACCENT,
    color: disabled ? MUTED : "#000", border: "none",
    borderRadius: 14, padding: "17px 0", fontSize: 15, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Syne', sans-serif", letterSpacing: -0.3,
    boxShadow: disabled ? "none" : `0 0 32px ${ACCENT}33`,
    transition: "all 0.2s", ...style
  }}>{children}</button>
);

// ─── SCREENS ─────────────────────────────────────────────────────────────────

function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    nombre: "", sexo: "hombre", edad: "", peso: "", altura: "",
    objetivo: "", disciplina: "", actividad: "moderado",
  });

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const steps = [
    // 0: Bienvenida
    <div key="welcome" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", padding: "0 32px" }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>⚡</div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 12, lineHeight: 1.1 }}>
        AutoPilot<br /><span style={{ color: ACCENT }}>Fit</span>
      </h1>
      <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
        La app que decide por vos.<br />Sin cálculos. Sin complicaciones.<br />Solo resultados.
      </p>
      <PrimaryBtn onClick={() => setStep(1)}>Empezar ahora →</PrimaryBtn>
      <p style={{ color: "#333", fontSize: 11, marginTop: 16 }}>30 segundos de configuración</p>
    </div>,

    // 1: Nombre y sexo
    <div key="basic" style={{ flex: 1, padding: "0 20px" }}>
      <SectionLabel>Paso 1 de 4 · Datos básicos</SectionLabel>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 24 }}>¿Cómo te llamás?</h2>
      <Input label="Tu nombre" placeholder="Ej: Martín" value={profile.nombre} onChange={v => set("nombre", v)} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Sexo biológico</div>
        <div style={{ display: "flex", gap: 10 }}>
          {["hombre", "mujer"].map(s => (
            <Pill key={s} active={profile.sexo === s} onClick={() => set("sexo", s)} style={{ flex: 1, textTransform: "capitalize" }}>{s === "hombre" ? "👨 Hombre" : "👩 Mujer"}</Pill>
          ))}
        </div>
      </div>
      <Input label="Edad" placeholder="25" value={profile.edad} onChange={v => set("edad", v)} type="number" unit="años" />
    </div>,

    // 2: Medidas
    <div key="medidas" style={{ flex: 1, padding: "0 20px" }}>
      <SectionLabel>Paso 2 de 4 · Medidas</SectionLabel>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Tu cuerpo actual</h2>
      <p style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>Para calcular tu metabolismo exacto.</p>
      <Input label="Peso actual" placeholder="75" value={profile.peso} onChange={v => set("peso", v)} type="number" unit="kg" />
      <Input label="Altura" placeholder="175" value={profile.altura} onChange={v => set("altura", v)} type="number" unit="cm" />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Nivel de actividad</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ACTIVITY.map(a => (
            <div key={a.id} onClick={() => set("actividad", a.id)} style={{
              background: profile.actividad === a.id ? `${ACCENT}11` : CARD,
              border: `1px solid ${profile.actividad === a.id ? ACCENT : BORDER}`,
              borderRadius: 12, padding: "12px 16px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: profile.actividad === a.id ? ACCENT : TEXT }}>{a.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{a.desc}</div>
              </div>
              {profile.actividad === a.id && <span style={{ color: ACCENT }}>✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>,

    // 3: Objetivo
    <div key="objetivo" style={{ flex: 1, padding: "0 20px" }}>
      <SectionLabel>Paso 3 de 4 · Objetivo</SectionLabel>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>¿Qué buscás lograr?</h2>
      <p style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>El sistema adaptará todo en base a esto.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {GOALS.map(g => (
          <div key={g.id} onClick={() => set("objetivo", g.id)} style={{
            background: profile.objetivo === g.id ? `${ACCENT}11` : CARD,
            border: `1px solid ${profile.objetivo === g.id ? ACCENT : BORDER}`,
            borderRadius: 14, padding: "16px 18px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span style={{ fontSize: 28 }}>{g.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: profile.objetivo === g.id ? ACCENT : TEXT }}>{g.label}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{g.desc}</div>
            </div>
            {profile.objetivo === g.id && <span style={{ color: ACCENT }}>✓</span>}
          </div>
        ))}
      </div>
    </div>,

    // 4: Disciplina
    <div key="disciplina" style={{ flex: 1, padding: "0 20px" }}>
      <SectionLabel>Paso 4 de 4 · Personalización</SectionLabel>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>¿Cuál es tu nivel de disciplina?</h2>
      <p style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>Sé honesto. El sistema se ajusta a vos.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {DISCIPLINE.map(d => (
          <div key={d.id} onClick={() => set("disciplina", d.id)} style={{
            background: profile.disciplina === d.id ? `${ACCENT}11` : CARD,
            border: `1px solid ${profile.disciplina === d.id ? ACCENT : BORDER}`,
            borderRadius: 14, padding: "16px 18px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span style={{ fontSize: 28 }}>{d.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: profile.disciplina === d.id ? ACCENT : TEXT }}>{d.label}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{d.desc}</div>
            </div>
            {profile.disciplina === d.id && <span style={{ color: ACCENT }}>✓</span>}
          </div>
        ))}
      </div>
    </div>,
  ];

  const canNext = [
    true,
    profile.nombre && profile.edad,
    profile.peso && profile.altura,
    profile.objetivo,
    profile.disciplina,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, color: TEXT, paddingTop: 60 }}>
      {step > 0 && (
        <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 50, padding: "16px 20px", background: BG }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: MUTED, fontSize: 18, cursor: "pointer" }}>←</button>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>{step} / 4</span>
            <div style={{ width: 24 }} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? ACCENT : BORDER, transition: "background 0.3s" }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: step === 0 ? 0 : 20 }}>
        {steps[step]}
      </div>

      {step > 0 && (
        <div style={{ padding: "16px 20px 36px" }}>
          <PrimaryBtn
            disabled={!canNext[step]}
            onClick={() => {
              if (step < 4) setStep(s => s + 1);
              else onComplete(profile);
            }}
          >
            {step === 4 ? "🚀 Activar AutoPilot" : "Continuar →"}
          </PrimaryBtn>
        </div>
      )}
    </div>
  );
}

// ─── HOME TAB ────────────────────────────────────────────────────────────────

function HomeTab({ profile, historial, mode, setMode, setTab }) {
  const kcalObj = calcTDEE(profile);
  const macros = calcMacros(kcalObj, profile.objetivo);
  const consumed = historial.reduce((acc, h) => ({
    calorias: acc.calorias + h.calorias,
    proteinas: acc.proteinas + h.proteinas,
    carbohidratos: acc.carbohidratos + h.carbohidratos,
    grasas: acc.grasas + h.grasas,
  }), { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 });

  const remaining = kcalObj - consumed.calorias;
  const pctDay = Math.round((consumed.calorias / kcalObj) * 100);

  const goalObj = GOALS.find(g => g.id === profile.objetivo);

  const decisiones = [
    consumed.proteinas < macros.proteinas * 0.5
      ? { icono: "🥩", texto: `Necesitás ${macros.proteinas - consumed.proteinas}g más de proteína hoy` }
      : { icono: "✅", texto: "Proteína del día bien encaminada" },
    remaining > 800
      ? { icono: "⚡", texto: `Tenés ${remaining} kcal disponibles. No saltees comidas.` }
      : remaining < 100
      ? { icono: "🚨", texto: "Llegaste al límite calórico. Priorizá vegetales en la próxima comida." }
      : { icono: "🎯", texto: `Vas bien. Quedan ${remaining} kcal para el resto del día.` },
    { icono: "💧", texto: "Tomá agua antes de tu próxima comida" },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "56px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800 }}>
            Hola, {profile.nombre || "crack"} {goalObj?.emoji}
          </h1>
        </div>
        <button onClick={() => setMode(m => m === "automatico" ? "asistido" : "automatico")} style={{
          background: mode === "automatico" ? ACCENT : CARD,
          color: mode === "automatico" ? "#000" : MUTED,
          border: `1px solid ${mode === "automatico" ? ACCENT : BORDER}`,
          borderRadius: 20, padding: "6px 14px", fontSize: 10,
          fontWeight: 800, cursor: "pointer", letterSpacing: 1,
          fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase",
        }}>
          {mode === "automatico" ? "🤖 Auto" : "👁 Manual"}
        </button>
      </div>

      {/* Calorias del día */}
      <div style={{ margin: "20px 20px 0" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <SectionLabel>Calorías hoy</SectionLabel>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
                {consumed.calorias}
                <span style={{ fontSize: 15, color: MUTED, fontWeight: 400 }}> / {kcalObj}</span>
              </div>
              <div style={{ fontSize: 12, color: remaining > 0 ? ACCENT : "#ff3b6b", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                {remaining > 0 ? `${remaining} kcal restantes` : `${Math.abs(remaining)} kcal sobre el objetivo`}
              </div>
            </div>
            <div style={{ position: "relative", width: 70, height: 70 }}>
              <svg viewBox="0 0 70 70" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="35" cy="35" r="28" fill="none" stroke={BORDER} strokeWidth="6" />
                <circle cx="35" cy="35" r="28" fill="none" stroke={ACCENT} strokeWidth="6"
                  strokeDasharray={`${Math.min(pctDay, 100) * 1.759} 176`}
                  strokeLinecap="round" style={{ transition: "stroke-dasharray 1s" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: ACCENT }}>
                {pctDay}%
              </div>
            </div>
          </div>
          <StatBar label="Proteínas" valor={consumed.proteinas} maximo={macros.proteinas} color="#00b4ff" />
          <StatBar label="Carbohidratos" valor={consumed.carbohidratos} maximo={macros.carbohidratos} color="#ff9500" />
          <StatBar label="Grasas" valor={consumed.grasas} maximo={macros.grasas} color="#ff3b6b" />
        </Card>
      </div>

      {/* Decisiones automáticas */}
      <div style={{ margin: "16px 20px 0" }}>
        <SectionLabel>{mode === "automatico" ? "🤖 Decisiones automáticas" : "💡 Sugerencias"}</SectionLabel>
        {decisiones.map((d, i) => (
          <div key={i} style={{
            background: CARD, borderRadius: 12, padding: "14px 16px", marginBottom: 8,
            border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{d.icono}</span>
            <span style={{ fontSize: 13, color: "#ccc", lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{d.texto}</span>
          </div>
        ))}
      </div>

      {/* Historial del día */}
      {historial.length > 0 && (
        <div style={{ margin: "16px 20px 0" }}>
          <SectionLabel>Comidas de hoy</SectionLabel>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {historial.map((h, i) => (
              <div key={i} style={{ minWidth: 80, background: CARD, borderRadius: 12, padding: "12px 8px", border: `1px solid ${BORDER}`, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>{h.emoji}</div>
                <div style={{ fontSize: 10, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>{h.hora}</div>
                <div style={{ fontSize: 12, color: TEXT, marginTop: 2, fontWeight: 600 }}>{h.calorias}</div>
                <div style={{ fontSize: 9, color: MUTED }}>kcal</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ margin: "20px 20px 0" }}>
        <PrimaryBtn onClick={() => setTab("camera")}>📸 Registrar comida</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── CAMERA TAB ──────────────────────────────────────────────────────────────

function CameraTab({ profile, onResult }) {
  const [phase, setPhase] = useState("idle"); // idle | preview | analyzing | result | manual
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState({ alimento: "", calorias: "", proteinas: "", carbohidratos: "", grasas: "" });
  const fileRef = useRef();

  const handleImage = (file) => {
    if (!file) return;
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
    setPhase("preview");
  };

  const submitManual = () => {
    const entry = {
      alimento: manual.alimento || "Alimento manual",
      calorias: parseInt(manual.calorias) || 0,
      proteinas: parseInt(manual.proteinas) || 0,
      carbohidratos: parseInt(manual.carbohidratos) || 0,
      grasas: parseInt(manual.grasas) || 0,
      decision: "Registrado manualmente. Seguí tu plan de hoy.",
      ajuste: "Ajustá la próxima comida según lo que ya comiste.",
      alerta: "normal",
      mensaje_alerta: null,
      prediccion: "Datos cargados manualmente.",
      emoji: "✏️",
    };
    onResult({ ...entry, hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), imagen: null });
    setPhase("idle");
    setManual({ alimento: "", calorias: "", proteinas: "", carbohidratos: "", grasas: "" });
  };

  const analyze = async () => {
    setPhase("analyzing");
    try {
      const msgs = imageBase64
        ? [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: `Analiza este alimento. Objetivo del usuario: ${profile.objetivo}. Calorías objetivo: ${calcTDEE(profile)} kcal.` }
          ]}]
        : [{ role: "user", content: "Analiza una milanesa con papas fritas y responde el JSON." }];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT, messages: msgs }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch {
      setResult(MOCK_RESULT);
    }
    setPhase("result");
  };

  const accept = () => {
    if (result) onResult({ ...result, hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), imagen: image });
    setPhase("idle"); setImage(null); setResult(null);
  };

  if (phase === "idle") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32, gap: 20 }}>
      <div style={{ width: 100, height: 100, borderRadius: "50%", background: `${ACCENT}11`, border: `2px dashed ${ACCENT}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>📸</div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Registrar comida</h2>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>Sacá una foto o escribí manualmente si la IA no reconoce el alimento.</p>
      </div>
      <PrimaryBtn onClick={() => fileRef.current.click()} style={{ maxWidth: 300 }}>📷 Abrir cámara</PrimaryBtn>
      <button onClick={() => fileRef.current.click()} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 24px", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", width: 300 }}>
        🖼 Elegir de galería
      </button>
      <button onClick={() => setPhase("manual")} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 24px", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", width: 300 }}>
        ✏️ Cargar manualmente
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />
    </div>
  );

  if (phase === "preview") return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setPhase("idle")} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Confirmar foto</span>
      </div>
      <div style={{ margin: "0 20px", borderRadius: 20, overflow: "hidden", aspectRatio: "4/3", background: CARD }}>
        <img src={image} alt="comida" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ margin: "16px 20px 0" }}>
        <Card>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.8, fontFamily: "'DM Sans', sans-serif" }}>
            🤖 La IA va a identificar el alimento, estimar macros y generar tu acción automática personalizada.
          </div>
        </Card>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "16px 20px 120px" }}>
        <PrimaryBtn onClick={analyze}>⚡ Analizar con IA</PrimaryBtn>
      </div>
    </div>
  );

  if (phase === "analyzing") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 24 }}>
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${BORDER}`, borderTop: `3px solid ${ACCENT}`, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>⚡</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Analizando...</div>
        <div style={{ color: MUTED, fontSize: 13 }}>Identificando alimento y calculando ajustes</div>
      </div>
    </div>
  );

  if (phase === "result" && result) return (
    <div style={{ paddingBottom: 120 }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setPhase("idle")} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Resultado</span>
      </div>

      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <span style={{ fontSize: 40 }}>{result.emoji}</span>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700 }}>{result.alimento}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: ACCENT }}>{result.calorias} <span style={{ fontSize: 13, color: MUTED, fontWeight: 400 }}>kcal</span></div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[["Proteínas", result.proteinas, "#00b4ff"], ["Carbos", result.carbohidratos, "#ff9500"], ["Grasas", result.grasas, "#ff3b6b"]].map(([l, v, c]) => (
              <div key={l} style={{ background: BG, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: c }}>{v}g</div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {result.alerta !== "normal" && (
        <div style={{ margin: "0 20px 12px", borderRadius: 12, padding: "14px 16px", background: result.alerta === "critico" ? "rgba(255,59,107,0.08)" : "rgba(255,149,0,0.08)", border: `1px solid ${result.alerta === "critico" ? "#ff3b6b44" : "#ff950044"}`, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{result.alerta === "critico" ? "🚨" : "⚠️"}</span>
          <span style={{ fontSize: 13, color: result.alerta === "critico" ? "#ff3b6b" : "#ff9500", lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{result.mensaje_alerta}</span>
        </div>
      )}

      <div style={{ margin: "0 20px 12px", background: `${ACCENT}0a`, borderRadius: 16, padding: 20, border: `1px solid ${ACCENT}22` }}>
        <SectionLabel>🤖 Decisión automática</SectionLabel>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.4 }}>{result.decision}</div>
        <div style={{ fontSize: 13, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}><span style={{ color: "#333" }}>Ajuste: </span>{result.ajuste}</div>
        {result.prediccion && <div style={{ fontSize: 12, color: "#555", marginTop: 8, fontFamily: "'DM Sans', sans-serif", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>📊 {result.prediccion}</div>}
      </div>

      <div style={{ margin: "0 20px" }}>
        <PrimaryBtn onClick={accept}>✓ Registrar y continuar</PrimaryBtn>
        <button onClick={() => setPhase("idle")} style={{ width: "100%", background: "none", border: "none", color: MUTED, fontSize: 13, padding: "12px 0", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
          Cancelar
        </button>
        <button onClick={() => setPhase("manual")} style={{ width: "100%", background: "none", border: "none", color: "#555", fontSize: 12, padding: "4px 0 12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          ¿No reconoció bien el alimento? Cargarlo manualmente →
        </button>
      </div>
    </div>
  );

  if (phase === "manual") return (
    <div style={{ paddingBottom: 120 }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setPhase("idle")} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Cargar manualmente</span>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div style={{ background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: MUTED, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
            ✏️ Usá esta opción cuando la IA no reconoce el alimento o querés ingresar datos exactos.
          </div>
        </div>
        <Input label="Nombre del alimento" placeholder="Ej: Empanada de carne" value={manual.alimento} onChange={v => setManual(m => ({ ...m, alimento: v }))} />
        <Input label="Calorías" placeholder="Ej: 280" value={manual.calorias} onChange={v => setManual(m => ({ ...m, calorias: v }))} type="number" unit="kcal" />
        <Input label="Proteínas" placeholder="Ej: 12" value={manual.proteinas} onChange={v => setManual(m => ({ ...m, proteinas: v }))} type="number" unit="g" />
        <Input label="Carbohidratos" placeholder="Ej: 32" value={manual.carbohidratos} onChange={v => setManual(m => ({ ...m, carbohidratos: v }))} type="number" unit="g" />
        <Input label="Grasas" placeholder="Ej: 11" value={manual.grasas} onChange={v => setManual(m => ({ ...m, grasas: v }))} type="number" unit="g" />
        <div style={{ marginTop: 8 }}>
          <PrimaryBtn onClick={submitManual} disabled={!manual.alimento || !manual.calorias}>✓ Registrar comida</PrimaryBtn>
          <div style={{ fontSize: 11, color: "#333", textAlign: "center", marginTop: 10, fontFamily: "'DM Sans', sans-serif" }}>
            Solo el nombre y las calorías son obligatorios
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}

// ─── STATS TAB ───────────────────────────────────────────────────────────────

function StatsTab({ profile, historial }) {
  const kcalObj = calcTDEE(profile);
  const macros = calcMacros(kcalObj, profile.objetivo);

  const days = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
  const mockWeek = [1680, 2100, 1850, 1920, 0, 2200, 1750];
  const maxBar = Math.max(...mockWeek, kcalObj);

  const goalObj = GOALS.find(g => g.id === profile.objetivo);
  const discObj = DISCIPLINE.find(d => d.id === profile.disciplina);

  const adherencia = mockWeek.filter(d => d > 0 && Math.abs(d - kcalObj) < 300).length;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "56px 20px 20px" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Progreso</h1>
      </div>

      {/* Predicción */}
      <div style={{ margin: "0 20px 12px", background: `${ACCENT}0a`, borderRadius: 16, padding: 20, border: `1px solid ${ACCENT}22` }}>
        <SectionLabel>📊 Predicción del sistema</SectionLabel>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
          {profile.objetivo === "bajarpeso" ? "En 4 semanas: −2 a 3kg de peso corporal" :
           profile.objetivo === "definicion" ? "En 4 semanas: −1.2kg de grasa" :
           profile.objetivo === "volumen" ? "En 4 semanas: +0.8kg músculo limpio" :
           "En 4 semanas: recomposición visible"}
        </div>
        <div style={{ fontSize: 12, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>
          Basado en tu adherencia de esta semana ({adherencia}/7 días)
        </div>
      </div>

      {/* Gráfica semanal */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>Calorías esta semana</SectionLabel>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 8 }}>
            {mockWeek.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: "100%", height: `${v > 0 ? (v / maxBar) * 100 : 0}%`,
                  minHeight: v > 0 ? 4 : 0,
                  background: Math.abs(v - kcalObj) < 300 ? ACCENT : v > kcalObj + 300 ? "#ff3b6b" : CARD,
                  borderRadius: "4px 4px 0 0", border: `1px solid ${BORDER}`,
                  transition: "height 0.8s",
                }} />
                <div style={{ fontSize: 9, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>{days[i]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 10, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>
            <span><span style={{ color: ACCENT }}>■</span> En objetivo</span>
            <span><span style={{ color: "#ff3b6b" }}>■</span> Excedido</span>
            <span><span style={{ color: BORDER }}>■</span> Sin registro</span>
          </div>
        </Card>
      </div>

      {/* Métricas */}
      <div style={{ margin: "0 20px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Racha actual", value: "3 días", sub: "seguidos en objetivo", color: ACCENT },
          { label: "Adherencia", value: `${adherencia}/7`, sub: "días esta semana", color: "#00b4ff" },
          { label: "Promedio kcal", value: Math.round(mockWeek.filter(d => d).reduce((a, b) => a + b, 0) / mockWeek.filter(d => d).length), sub: `objetivo: ${kcalObj}`, color: "#ff9500" },
          { label: "Riesgo abandono", value: "Bajo", sub: "seguís bien encaminado", color: "#00ff87" },
        ].map(m => (
          <div key={m.label} style={{ background: CARD, borderRadius: 14, padding: 16, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div style={{ margin: "0 20px 0" }}>
        <Card>
          <SectionLabel>⚠️ Alertas del sistema</SectionLabel>
          {[
            { icon: "✅", text: "Sin señales de sobreentrenamiento", color: ACCENT },
            { icon: "⚡", text: "Proteína por debajo del objetivo 3 días esta semana", color: "#ff9500" },
            { icon: "✅", text: "Estancamiento: no detectado", color: ACCENT },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 12 : 0, paddingBottom: i < 2 ? 12 : 0, borderBottom: i < 2 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <span style={{ fontSize: 13, color: a.color, fontFamily: "'DM Sans', sans-serif" }}>{a.text}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────────

function ProfileTab({ profile, onUpdate, mode, setMode, historial }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const set = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  const kcal = calcTDEE(profile);
  const macros = calcMacros(kcal, profile.objetivo);
  const goalObj = GOALS.find(g => g.id === profile.objetivo);
  const discObj = DISCIPLINE.find(d => d.id === profile.disciplina);
  const actObj = ACTIVITY.find(a => a.id === profile.actividad);

  const imcVal = profile.peso && profile.altura ? profile.peso / ((profile.altura / 100) ** 2) : null;
  const imc = imcVal ? imcVal.toFixed(1) : "—";
  const imcLabel = !imcVal ? "—" : imcVal < 18.5 ? "Bajo peso" : imcVal < 25 ? "Normal ✓" : imcVal < 30 ? "Sobrepeso" : "Obesidad";
  const imcColor = !imcVal ? MUTED : imcVal < 18.5 ? "#00b4ff" : imcVal < 25 ? "#C6FF4B" : imcVal < 30 ? "#ff9500" : "#ff3b6b";

  // Déficit calórico
  const tdee = calcTDEE(profile); // mantenimiento SIN déficit
  const tdeeBase = (() => {
    const { peso, altura, edad, sexo, actividad } = profile;
    if (!peso || !altura || !edad) return 2000;
    let bmr = sexo === "mujer" ? 10*peso + 6.25*altura - 5*edad - 161 : 10*peso + 6.25*altura - 5*edad + 5;
    const f = { sedentario:1.2, ligero:1.375, moderado:1.55, activo:1.725 };
    return Math.round(bmr * (f[actividad] || 1.375));
  })();
  const deficitDiario = tdeeBase - kcal; // kcal que NO come vs mantenimiento
  const consumidoHoy = historial.reduce((a, h) => a + h.calorias, 0);
  const deficitReal = kcal - consumidoHoy; // kcal que le quedan hoy
  const deficitAcum = deficitDiario * 5; // estimación semanal (5 días)
  const perdidaSemana = (deficitAcum / 7700).toFixed(2); // 7700 kcal = 1kg grasa
  const perdidaMes = (deficitDiario * 30 / 7700).toFixed(1);

  if (editing) return (
    <div style={{ paddingBottom: 120 }}>
      <div style={{ padding: "56px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Editar perfil</span>
      </div>
      <div style={{ padding: "0 20px" }}>
        <Input label="Nombre" value={draft.nombre} onChange={v => set("nombre", v)} placeholder="Tu nombre" />
        <Input label="Edad" value={draft.edad} onChange={v => set("edad", v)} type="number" unit="años" placeholder="25" />
        <Input label="Peso" value={draft.peso} onChange={v => set("peso", v)} type="number" unit="kg" placeholder="75" />
        <Input label="Altura" value={draft.altura} onChange={v => set("altura", v)} type="number" unit="cm" placeholder="175" />
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Objetivo</div>
          {GOALS.map(g => (
            <div key={g.id} onClick={() => set("objetivo", g.id)} style={{ background: draft.objetivo === g.id ? `${ACCENT}11` : CARD, border: `1px solid ${draft.objetivo === g.id ? ACCENT : BORDER}`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span>{g.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: draft.objetivo === g.id ? ACCENT : TEXT, fontFamily: "'DM Sans', sans-serif" }}>{g.label}</span>
              {draft.objetivo === g.id && <span style={{ marginLeft: "auto", color: ACCENT }}>✓</span>}
            </div>
          ))}
        </div>
        <PrimaryBtn onClick={() => { onUpdate(draft); setEditing(false); }}>Guardar cambios</PrimaryBtn>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "56px 20px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>Mi Perfil</h1>
        <button onClick={() => setEditing(true)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 14px", color: TEXT, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          ✏️ Editar
        </button>
      </div>

      {/* Avatar y nombre */}
      <div style={{ margin: "0 20px 16px" }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${ACCENT}22`, border: `2px solid ${ACCENT}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
            {profile.sexo === "mujer" ? "👩" : "👨"}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700 }}>{profile.nombre || "Usuario"}</div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>{goalObj?.label} · {discObj?.label}</div>
          </div>
        </Card>
      </div>

      {/* Stats corporales */}
      <div style={{ margin: "0 20px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Peso", value: profile.peso ? `${profile.peso}kg` : "—", sub: null },
          { label: "Altura", value: profile.altura ? `${profile.altura}cm` : "—", sub: null },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, borderRadius: 12, padding: "14px 10px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* IMC Card */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>📏 Índice de Masa Corporal</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: imcColor }}>{imc}</div>
              <div style={{ fontSize: 13, color: imcColor, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{imcLabel}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: MUTED, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                &lt; 18.5 · Bajo peso<br/>
                18.5–24.9 · <span style={{ color: "#C6FF4B" }}>Normal</span><br/>
                25–29.9 · Sobrepeso<br/>
                ≥ 30 · Obesidad
              </div>
            </div>
          </div>
          {/* IMC bar */}
          <div style={{ background: "#1a1a1a", borderRadius: 6, height: 8, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "24%", background: "#00b4ff33" }} />
            <div style={{ position: "absolute", left: "24%", top: 0, bottom: 0, width: "30%", background: "#C6FF4B33" }} />
            <div style={{ position: "absolute", left: "54%", top: 0, bottom: 0, width: "20%", background: "#ff950033" }} />
            <div style={{ position: "absolute", left: "74%", top: 0, bottom: 0, right: 0, background: "#ff3b6b33" }} />
            {imcVal && <div style={{ position: "absolute", top: -2, bottom: -2, width: 4, borderRadius: 2, background: imcColor, left: `${Math.min(Math.max(((imcVal - 15) / 25) * 100, 2), 96)}%`, transition: "left 0.6s" }} />}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#333", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
            <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
          </div>
        </Card>
      </div>

      {/* Déficit calórico */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>🔥 Déficit calórico</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Déficit diario", value: deficitDiario > 0 ? `-${deficitDiario}` : `+${Math.abs(deficitDiario)}`, unit: "kcal", color: deficitDiario > 0 ? "#C6FF4B" : "#ff3b6b", sub: deficitDiario > 0 ? "vs mantenimiento" : "superávit calórico" },
              { label: "Quedan hoy", value: deficitReal > 0 ? deficitReal : 0, unit: "kcal", color: deficitReal > 100 ? "#00b4ff" : "#ff3b6b", sub: deficitReal > 0 ? "disponibles" : "objetivo alcanzado" },
              { label: "Pérdida estimada", value: perdidaSemana, unit: "kg/sem", color: "#ff9500", sub: "a este ritmo" },
              { label: "Proyección mensual", value: `-${perdidaMes}`, unit: "kg/mes", color: "#C6FF4B", sub: "si mantenés el plan" },
            ].map(m => (
              <div key={m.label} style={{ background: BG, borderRadius: 12, padding: "12px 10px" }}>
                <div style={{ fontSize: 10, color: MUTED, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: m.color }}>{m.value} <span style={{ fontSize: 11, fontWeight: 400 }}>{m.unit}</span></div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
              💡 Para bajar 1kg de grasa se necesita un déficit acumulado de <span style={{ color: TEXT }}>~7.700 kcal</span>. Con tu déficit actual tardás <span style={{ color: "#C6FF4B" }}>{deficitDiario > 0 ? Math.round(7700 / deficitDiario) : "∞"} días</span> en perder 1kg.
            </div>
          </div>
        </Card>
      </div>

      {/* Objetivos calculados */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <SectionLabel>⚡ Tu plan personalizado</SectionLabel>
          {[
            { label: "Calorías objetivo", value: `${kcal} kcal/día`, color: ACCENT },
            { label: "Proteínas", value: `${macros.proteinas}g / día`, color: "#00b4ff" },
            { label: "Carbohidratos", value: `${macros.carbohidratos}g / día`, color: "#ff9500" },
            { label: "Grasas", value: `${macros.grasas}g / día`, color: "#ff3b6b" },
          ].map((m, i, arr) => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < arr.length - 1 ? 12 : 0, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 13, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>{m.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: "'Syne', sans-serif" }}>{m.value}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Modo autopilot */}
      <div style={{ margin: "0 20px 12px" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Modo AutoPilot</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                {mode === "automatico" ? "La app decide por vos" : "Ves datos y recomendaciones"}
              </div>
            </div>
            <button onClick={() => setMode(m => m === "automatico" ? "asistido" : "automatico")} style={{
              background: mode === "automatico" ? ACCENT : CARD,
              border: `1px solid ${mode === "automatico" ? ACCENT : BORDER}`,
              borderRadius: 20, padding: "8px 18px", color: mode === "automatico" ? "#000" : MUTED,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
              {mode === "automatico" ? "🤖 Auto" : "👁 Manual"}
            </button>
          </div>
        </Card>
      </div>

      {/* Info extra */}
      <div style={{ margin: "0 20px" }}>
        <Card>
          <SectionLabel>Configuración</SectionLabel>
          {[
            { icon: "🎯", label: "Objetivo", value: goalObj?.label || "—" },
            { icon: "⚡", label: "Actividad", value: actObj?.label || "—" },
            { icon: "🧠", label: "Disciplina", value: discObj?.label || "—" },
            { icon: "👤", label: "Sexo", value: profile.sexo === "mujer" ? "Mujer" : "Hombre" },
          ].map((r, i, arr) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < arr.length - 1 ? 12 : 0, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 13, color: MUTED, fontFamily: "'DM Sans', sans-serif" }}>{r.icon} {r.label}</span>
              <span style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function AutoPilotFit() {
  const [onboarded, setOnboarded] = useState(false);
  const [profile, setProfile] = useState({});
  const [tab, setTab] = useState("home");
  const [mode, setMode] = useState("automatico");
  const [historial, setHistorial] = useState([]);

  const handleOnboardingComplete = (p) => {
    setProfile(p);
    setOnboarded(true);
  };

  const handleResult = (entry) => {
    setHistorial(prev => [entry, ...prev.slice(0, 19)]);
    setTab("home");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: ${BG}; color: ${TEXT}; }
        input::placeholder { color: #333; }
        input { -webkit-appearance: none; }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
      `}</style>
      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: BG, position: "relative", overflow: "hidden" }}>
        {!onboarded ? (
          <OnboardingScreen onComplete={handleOnboardingComplete} />
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
