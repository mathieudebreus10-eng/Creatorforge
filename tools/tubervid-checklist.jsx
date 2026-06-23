import { useState } from "react";

const sections = [
  {
    id: "funcionalidades",
    title: "⚙️ Funcionalidades Core",
    items: [
      { id: "f1", text: "Geração de título funcionando" },
      { id: "f2", text: "Geração de roteiro funcionando" },
      { id: "f3", text: "Geração de descrição SEO funcionando" },
      { id: "f4", text: "Geração de hashtags funcionando" },
      { id: "f5", text: "Thumbnail gerando corretamente (Stability AI)" },
      { id: "f6", text: "Canvas overlay de texto na thumbnail OK" },
      { id: "f7", text: "3 aspect ratios de thumbnail funcionando" },
      { id: "f8", text: "6 estilos de thumbnail funcionando" },
    ],
  },
  {
    id: "auth",
    title: "🔐 Autenticação & Usuários",
    items: [
      { id: "a1", text: "Cadastro de novo usuário funcionando" },
      { id: "a2", text: "Login funcionando" },
      { id: "a3", text: "Logout funcionando" },
      { id: "a4", text: "Reset de senha funcionando" },
      { id: "a5", text: "Supabase salvando dados do usuário corretamente" },
    ],
  },
  {
    id: "planos",
    title: "💳 Planos & Pagamento",
    items: [
      { id: "p1", text: "Página de pricing exibindo os 4 tiers (Free, Basic, Pro, Creator)" },
      { id: "p2", text: "Stripe processando pagamento de teste" },
      { id: "p3", text: "Webhook do Stripe ativando plano no Supabase" },
      { id: "p4", text: "Upgrade de plano funcionando" },
      { id: "p5", text: "Usuário Free não consegue ultrapassar limite" },
      { id: "p6", text: "Usuário Basic respeitando limite do tier" },
      { id: "p7", text: "Usuário Pro respeitando limite do tier" },
      { id: "p8", text: "Usuário Creator com acesso completo" },
      { id: "p9", text: "Contador de uso visível no dashboard" },
    ],
  },
  {
    id: "paginas",
    title: "📄 Páginas",
    items: [
      { id: "pg1", text: "Landing page carregando corretamente" },
      { id: "pg2", text: "Dashboard do usuário funcionando" },
      { id: "pg3", text: "Página 404 personalizada existe" },
      { id: "pg4", text: "Página de termos de uso existe" },
      { id: "pg5", text: "Página de política de privacidade existe" },
    ],
  },
  {
    id: "seo",
    title: "🔍 SEO & Indexação",
    items: [
      { id: "s1", text: "Meta title em todas as páginas" },
      { id: "s2", text: "Meta description em todas as páginas" },
      { id: "s3", text: "SSL ativo (https://tubervid.com)" },
      { id: "s4", text: "robots.txt configurado" },
      { id: "s5", text: "sitemap.xml criado e acessível" },
      { id: "s6", text: "Google Search Console configurado" },
      { id: "s7", text: "Sitemap submetido no Search Console" },
      { id: "s8", text: "Open Graph tags para redes sociais" },
    ],
  },
  {
    id: "performance",
    title: "🚀 Performance & Mobile",
    items: [
      { id: "perf1", text: "Site carregando em menos de 3 segundos" },
      { id: "perf2", text: "Layout responsivo no mobile" },
      { id: "perf3", text: "Imagens otimizadas" },
      { id: "perf4", text: "Nenhum erro no console do browser" },
    ],
  },
  {
    id: "netlify",
    title: "☁️ Netlify & Deploy",
    items: [
      { id: "n1", text: "Deploy mais recente com status success" },
      { id: "n2", text: "Variáveis de ambiente configuradas (GEMINI_API_KEY, STABILITY_API_KEY)" },
      { id: "n3", text: "netlify.toml sem configurações de timeout (quebra o build)" },
      { id: "n4", text: "Domínio tubervid.com apontando corretamente" },
      { id: "n5", text: "Functions Netlify respondendo corretamente" },
    ],
  },
];

export default function TubervidChecklist() {
  const allItems = sections.flatMap((s) => s.items);
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState({});
  const [openNote, setOpenNote] = useState(null);

  const toggle = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalDone = allItems.filter((i) => checked[i.id]).length;
  const total = allItems.length;
  const percent = Math.round((totalDone / total) * 100);

  const getColor = () => {
    if (percent < 40) return "#ef4444";
    if (percent < 80) return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#0f0f0f", minHeight: "100vh", color: "#fff", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 13, letterSpacing: 3, color: "#888", textTransform: "uppercase", marginBottom: 8 }}>
          PRÉ-LANÇAMENTO
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, background: "linear-gradient(90deg, #FFD700, #ff9900)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Tubervid Checklist
        </h1>
        <p style={{ color: "#666", marginTop: 8, fontSize: 14 }}>Double check antes de indexar e lançar</p>
      </div>

      {/* Progress */}
      <div style={{ background: "#1a1a1a", borderRadius: 16, padding: "20px 24px", marginBottom: 32, border: "1px solid #2a2a2a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: "#aaa" }}>{totalDone} de {total} itens</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: getColor() }}>{percent}%</span>
        </div>
        <div style={{ background: "#2a2a2a", borderRadius: 99, height: 10, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${getColor()}, ${getColor()}aa)`,
            borderRadius: 99,
            transition: "width 0.4s ease"
          }} />
        </div>
        {percent === 100 && (
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 16, color: "#22c55e", fontWeight: 700 }}>
            🚀 Pronto para lançar!
          </div>
        )}
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const sectionDone = section.items.filter((i) => checked[i.id]).length;
        return (
          <div key={section.id} style={{ background: "#1a1a1a", borderRadius: 16, padding: "20px", marginBottom: 16, border: "1px solid #2a2a2a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{section.title}</h2>
              <span style={{ fontSize: 12, color: sectionDone === section.items.length ? "#22c55e" : "#888", fontWeight: 600 }}>
                {sectionDone}/{section.items.length}
              </span>
            </div>
            {section.items.map((item) => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div
                  onClick={() => toggle(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: checked[item.id] ? "#162013" : "#111",
                    border: `1px solid ${checked[item.id] ? "#22c55e44" : "#2a2a2a"}`,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${checked[item.id] ? "#22c55e" : "#444"}`,
                    background: checked[item.id] ? "#22c55e" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.2s"
                  }}>
                    {checked[item.id] && <span style={{ fontSize: 13, color: "#000", fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{
                    fontSize: 14,
                    color: checked[item.id] ? "#22c55e" : "#ccc",
                    textDecoration: checked[item.id] ? "line-through" : "none",
                    flex: 1
                  }}>
                    {item.text}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenNote(openNote === item.id ? null : item.id); }}
                    style={{ background: "none", border: "none", color: notes[item.id] ? "#FFD700" : "#444", cursor: "pointer", fontSize: 16, padding: 0 }}
                  >
                    📝
                  </button>
                </div>
                {openNote === item.id && (
                  <textarea
                    placeholder="Anotação..."
                    value={notes[item.id] || ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    style={{
                      width: "100%", marginTop: 6, padding: "10px 12px",
                      background: "#111", border: "1px solid #333", borderRadius: 8,
                      color: "#fff", fontSize: 13, resize: "vertical", minHeight: 60,
                      boxSizing: "border-box", fontFamily: "inherit"
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 24, color: "#444", fontSize: 12 }}>
        tubervid.com · Double Check Pré-Lançamento
      </div>
    </div>
  );
}

