"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const navItems = [
  ["Início", "#inicio"],
  ["Sobre", "#projeto"],
  ["O sistema", "#funcionalidades"],
  ["Etapas", "#como-funciona"],
  ["Equipe", "#quem-somos"],
];

const features = [
  {
    title: "Cadastro de clientes",
    text: "Contato, aparelhos e histórico de serviços em um só lugar.",
  },
  {
    title: "Ordens de serviço",
    text: "Defeito, peças, prazo, valor e andamento registrados na mesma ordem.",
  },
  {
    title: "Controle de estoque",
    text: "Baixa automática de peças e aviso quando um item está acabando.",
  },
  {
    title: "Relatórios",
    text: "Resumo de faturamento, serviços concluídos e estoque baixo.",
  },
];

const steps = [
  ["1", "Cliente chega à loja", "A equipe encontra o cadastro ou registra os dados em poucos campos."],
  ["2", "A ordem é aberta", "Aparelho, problema, orçamento e previsão de entrega ficam documentados."],
  ["3", "O reparo é acompanhado", "Cada mudança de status e peça usada atualiza o sistema."],
  ["4", "Serviço finalizado", "A entrega é registrada e o histórico continua disponível."],
];

const team = [
  ["GC", "Gustavo Carvalho"],
  ["IG", "Ingrid Gomes"],
  ["MF", "Maria Eduarda Faria"],
  ["LE", "Luany Érika"],
];

type Theme = "light" | "dark";
type VLibrasWindow = Window & {
  VLibras?: { Widget: new (url: string) => unknown };
};

type VLibrasStatus = "loading" | "ready" | "error";

function Brand() {
  return (
    <img
      className="brand-logo"
      src="/digital-mais-logo.png"
      width={1059}
      height={308}
      alt="Digital Mais Acessórios"
      loading="eager"
    />
  );
}

function VLibrasWidget() {
  const [status, setStatus] = useState<VLibrasStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let checkCount = 0;
    const scriptId = "vlibras-plugin";
    const timers: { check?: number; timeout?: number } = {};

    const isWidgetReady = () =>
      Boolean(
        document.querySelector(
          "[vw-access-button] .vp-access-button, [vw-access-button] img",
        ),
      );

    const initialize = () => {
      const vlibrasWindow = window as VLibrasWindow;
      if (
        active &&
        vlibrasWindow.VLibras?.Widget &&
        !document.documentElement.hasAttribute("data-vlibras-initialized")
      ) {
        new vlibrasWindow.VLibras.Widget("https://vlibras.gov.br/app");
        document.documentElement.setAttribute("data-vlibras-initialized", "true");
      }

      if (active && isWidgetReady()) {
        document.documentElement.setAttribute("data-vlibras-ready", "true");
        setStatus("ready");
        if (timers.check) window.clearInterval(timers.check);
        if (timers.timeout) window.clearTimeout(timers.timeout);
        return true;
      }

      return false;
    };

    const handleError = () => {
      if (!active) return;
      setStatus("error");
      if (timers.check) window.clearInterval(timers.check);
      if (timers.timeout) window.clearTimeout(timers.timeout);
    };

    let existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (attempt > 0 && existingScript && !isWidgetReady()) {
      existingScript.remove();
      existingScript = null;
      document.documentElement.removeAttribute("data-vlibras-initialized");
      document.documentElement.removeAttribute("data-vlibras-ready");
    }

    if (existingScript) {
      existingScript.addEventListener("load", initialize, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      initialize();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
      script.async = true;
      script.addEventListener("load", initialize, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.body.appendChild(script);
    }

    timers.check = window.setInterval(() => {
      checkCount += 1;
      if (initialize() || checkCount >= 30) {
        if (timers.check) window.clearInterval(timers.check);
      }
    }, 300);

    timers.timeout = window.setTimeout(() => {
      if (!isWidgetReady()) handleError();
    }, 10000);

    return () => {
      active = false;
      if (timers.check) window.clearInterval(timers.check);
      if (timers.timeout) window.clearTimeout(timers.timeout);
    };
  }, [attempt]);

  const openOrRetry = () => {
    if (status === "ready") {
      document.querySelector<HTMLElement>("[vw-access-button]")?.click();
      return;
    }

    if (status === "error") {
      setStatus("loading");
      setAttempt((current) => current + 1);
    }
  };

  return (
    <>
      <div {...({ vw: "true" } as Record<string, string>)} className="enabled">
        <div {...({ "vw-access-button": "true" } as Record<string, string>)} className="active" />
        <div {...({ "vw-plugin-wrapper": "true" } as Record<string, string>)}>
          <div {...({ "vw-plugin-top-wrapper": "true" } as Record<string, string>)} />
        </div>
      </div>

      <div className="vlibras-control">
        <button
          className={`vlibras-launcher vlibras-launcher--${status}`}
          type="button"
          onClick={openOrRetry}
          disabled={status === "loading"}
          aria-describedby={status === "error" ? "vlibras-error" : undefined}
        >
          <span className="vlibras-badge" aria-hidden="true">LIBRAS</span>
          <span>
            {status === "ready" && "Abrir VLibras"}
            {status === "loading" && "Carregando VLibras..."}
            {status === "error" && "Tentar VLibras novamente"}
          </span>
        </button>
        {status === "error" && (
          <span className="vlibras-error" id="vlibras-error" role="alert">
            O recurso externo não carregou. Verifique a internet e tente novamente.
          </span>
        )}
      </div>
    </>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("digital-mais-theme") as Theme | null;
    const initialTheme: Theme = savedTheme === "dark" ? "dark" : "light";

    const frame = window.requestAnimationFrame(() => {
      setTheme(initialTheme);
      document.documentElement.dataset.theme = initialTheme;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("digital-mais-theme", nextTheme);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="institutional-page">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="site-header">
        <div className="header-inner">
          <a className="logo-link" href="#inicio" aria-label="Digital Mais — Home" onClick={closeMenu}>
            <Brand />
          </a>

          <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`} aria-label="Navegação principal">
            {navItems.map(([label, href]) => (
              <a key={href} href={href} onClick={closeMenu}>{label}</a>
            ))}
          </nav>

          <div className="header-actions">
            <Link className="header-system-link" href="/login">
              Ir ao sistema
            </Link>

            <button
              className="theme-button"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
              aria-pressed={theme === "dark"}
              title={theme === "light" ? "Tema escuro" : "Tema claro"}
            >
              <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
              <span className="theme-label">{theme === "light" ? "Escuro" : "Claro"}</span>
            </button>

            <button
              className="menu-button"
              type="button"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div id="conteudo">
        <section className="home-hero" id="inicio">
          <div className="container home-hero-grid">
            <div className="home-hero-copy">
              <p className="section-label">Projeto de TCC · 2026</p>
              <h1>Organização para quem conserta, vende e atende todos os dias.</h1>
              <p className="home-hero-text">
                O Digital+ reúne clientes, ordens de serviço, peças e relatórios em uma
                ferramenta pensada para a rotina de uma assistência técnica.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/login">Ir ao sistema</Link>
                <a className="text-link" href="#projeto">Entender o projeto <span aria-hidden="true">↓</span></a>
              </div>
            </div>

            <figure className="home-hero-photo">
              <img
                src="/assistencia-tecnica.webp"
                alt="Técnico realizando o reparo de um celular em uma bancada"
                width={1440}
                height={960}
                fetchPriority="high"
              />
              <figcaption>Atendimento e manutenção organizados do início ao fim.</figcaption>
            </figure>
          </div>
        </section>

        <section className="story-section" id="projeto">
          <div className="container story-grid">
            <figure className="story-photo">
              <img
                src="/atendimento-loja.webp"
                alt="Atendente auxiliando um cliente em uma loja de acessórios"
                width={1200}
                height={900}
                loading="lazy"
              />
            </figure>

            <div className="story-copy">
              <p className="section-label">Por que criamos</p>
              <h2>A ideia veio de uma rotina que ainda depende muito do papel.</h2>
              <p>
                Fichas soltas, buscas demoradas e peças sem controle tornam um atendimento
                simples mais trabalhoso. Nosso projeto nasceu para colocar essas informações
                em ordem sem mudar completamente o jeito de trabalhar da loja.
              </p>
              <div className="story-notes">
                <p><strong>Antes:</strong> anotações espalhadas e histórico difícil de encontrar.</p>
                <p><strong>Com o sistema:</strong> cada serviço fica ligado ao cliente e ao estoque.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="compact-section compact-section-soft" id="funcionalidades">
          <div className="container">
            <div className="compact-heading">
              <div>
                <p className="section-label">O sistema</p>
                <h2>O que já funciona</h2>
              </div>
              <p>As áreas conversam entre si para evitar cadastro repetido e informação perdida.</p>
            </div>

            <div className="human-feature-grid">
              {features.map((feature, index) => (
                <article className="human-feature" key={feature.title}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="process-section" id="como-funciona">
          <div className="container process-grid">
            <div className="process-copy">
              <p className="section-label">Na prática</p>
              <h2>Um serviço completo em quatro etapas.</h2>
              <div className="human-steps">
                {steps.map(([number, title, text]) => (
                  <article key={number}>
                    <span>{number}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <figure className="process-photo">
              <img
                src="/estoque-pecas.webp"
                alt="Profissional conferindo peças organizadas no estoque"
                width={1200}
                height={900}
                loading="lazy"
              />
              <figcaption>Peças usadas na ordem são descontadas do estoque automaticamente.</figcaption>
            </figure>
          </div>
        </section>

        <section className="team-section" id="quem-somos">
          <div className="container team-layout">
            <div className="team-intro">
              <p className="section-label">Quem somos</p>
              <h2>Quatro estudantes, uma ideia construída em grupo.</h2>
              <p>
                O Digital+ é nosso projeto de conclusão de curso. Cada etapa foi pensada a
                partir de situações comuns no atendimento, no reparo e no controle da loja.
              </p>
            </div>

            <ul className="human-team-list" aria-label="Integrantes do projeto">
              {team.map(([, name], index) => (
                <li key={name}>
                  <span>0{index + 1}</span>
                  <strong>{name}</strong>
                  <small>Desenvolvimento e pesquisa</small>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <footer>
        <div className="container footer-inner">
          <Brand />
          <p>Projeto de TCC · Sistema de gestão para assistência técnica · 2026</p>
          <a href="#inicio">Voltar ao início ↑</a>
        </div>
      </footer>

      <VLibrasWidget />
    </main>
  );
}
