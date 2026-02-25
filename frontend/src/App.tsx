function App() {
  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">App Finanças</h1>
        <p className="mt-2 text-slate-600">
          Setup inicial concluído. As funcionalidades do produto serão implementadas nas próximas
          fases.
        </p>
      </header>

      <section
        aria-labelledby="roadmap-title"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="roadmap-title" className="text-lg font-semibold text-slate-900">
          Estado do Projeto
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
          <li>Frontend React + TypeScript + Tailwind configurado.</li>
          <li>Backend Node.js + Express + TypeScript configurado.</li>
          <li>ESLint, Prettier e estrutura modular inicial definidos.</li>
        </ul>
      </section>
    </main>
  );
}

export default App;
