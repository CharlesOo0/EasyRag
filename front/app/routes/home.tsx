import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Database,
  Github,
  Languages,
  Layers,
  MessageSquareQuote,
  Rocket,
  Search,
  Sparkles,
} from "lucide-react";

export function meta() {
  return [{ title: "EasyRag" }];
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const toggleLanguage = () => i18n.changeLanguage(i18n.language === "fr" ? "en" : "fr");

  const steps: { icon: ReactNode; key: string }[] = [
    { icon: <Layers className="w-5 h-5" />, key: "ingest" },
    { icon: <Sparkles className="w-5 h-5" />, key: "embed" },
    { icon: <Search className="w-5 h-5" />, key: "retrieve" },
    { icon: <MessageSquareQuote className="w-5 h-5" />, key: "generate" },
  ];

  const stack: { icon: ReactNode; key: string }[] = [
    { icon: <Database className="w-5 h-5 text-primary" />, key: "store" },
    { icon: <Sparkles className="w-5 h-5 text-primary" />, key: "embed" },
    { icon: <MessageSquareQuote className="w-5 h-5 text-primary" />, key: "llm" },
  ];

  const examples = asArray(t("home.tryIt.examples", { returnObjects: true }));

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <nav className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-lg">
            <span className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Rocket className="w-4 h-4 text-primary-foreground" />
            </span>
            EasyRag
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
              aria-label={t("home.toggleLanguage")}
            >
              <Languages className="w-4 h-4" />
            </button>
            <Link
              to="/chat"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("home.openChat")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            {t("home.hero.title")}
          </h1>
          <p className="max-w-xl mx-auto text-lg text-muted-foreground mb-8">
            {t("home.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              to="/chat"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("home.openChat")}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://github.com/CharlesOo0/EasyRag"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 font-medium hover:bg-muted transition-colors"
            >
              <Github className="w-4 h-4" />
              {t("home.viewSource")}
            </a>
          </div>
        </section>

        {/* Pipeline */}
        <section className="border-y bg-secondary/30">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <h2 className="text-center text-2xl font-bold mb-2">{t("home.pipeline.title")}</h2>
            <p className="text-center text-muted-foreground mb-10">{t("home.pipeline.subtitle")}</p>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <li key={step.key} className="rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      {step.icon}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">{t(`home.pipeline.steps.${step.key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`home.pipeline.steps.${step.key}.description`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Corpus + stack */}
        <section className="max-w-5xl mx-auto px-4 py-16 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold mb-3">{t("home.corpus.title")}</h2>
            <p className="text-muted-foreground">{t("home.corpus.body")}</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-3">{t("home.stack.title")}</h2>
            <ul className="space-y-3">
              {stack.map((item) => (
                <li key={item.key} className="flex gap-3">
                  <span className="shrink-0 mt-0.5">{item.icon}</span>
                  <span>
                    <span className="font-medium">{t(`home.stack.items.${item.key}.name`)}</span>
                    <span className="text-muted-foreground">
                      {" — "}
                      {t(`home.stack.items.${item.key}.description`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">{t("home.stack.note")}</p>
          </div>
        </section>

        {/* Try it */}
        <section className="border-t bg-secondary/30">
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl font-bold mb-6">{t("home.tryIt.title")}</h2>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {examples.map((q) => (
                <Link
                  key={q}
                  to={`/chat?q=${encodeURIComponent(q)}`}
                  className="rounded-full border bg-background px-3.5 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  {q}
                </Link>
              ))}
            </div>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("home.openChat")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t("home.footer")}</span>
          <a
            href="https://github.com/CharlesOo0/EasyRag"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}
