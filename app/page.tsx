"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const navItems = [
  ["Home", "#inicio"],
  ["O projeto", "#projeto"],
  ["Funcionalidades", "#funcionalidades"],
  ["Como funciona", "#como-funciona"],
  ["Quem somos", "#quem-somos"],
];

const features = [
  {
    short: "CL",
    title: "Cadastro de clientes",
    text: "Dados de contato e histórico ficam organizados para os próximos atendimentos.",
  },
  {
    short: "OS",
    title: "Ordens de serviço",
    text: "Aparelho, defeito, valor, assinatura e andamento reunidos em um único registro.",
  },
  {
    short: "ET",
    title: "Controle de estoque",
    text: "Acompanhamento de peças, quantidade mínima e alertas para reposição.",
  },
  {
    short: "CP",
    title: "Comprovantes",
    text: "Geração de uma via digital ou impressa com as informações do serviço.",
  },
];

const steps = [
  ["01", "Cadastrar o cliente", "A equipe localiza um cadastro existente ou registra um novo cliente."],
  ["02", "Abrir a ordem", "O aparelho, o defeito informado e o orçamento são adicionados à OS."],
  ["03", "Atualizar o serviço", "O status e as peças utilizadas são atualizados durante o atendimento."],
  ["04", "Finalizar e entregar", "O comprovante é gerado e o histórico fica salvo para futuras consultas."],
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
    const preferredTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const initialTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme;

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
    <main>
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
        <section className="hero" id="inicio">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">PROJETO DE TCC · 2026</span>
              <h1>Gestão simples para uma assistência mais organizada.</h1>
              <p>
                A Digital+ transforma fichas de papel em um sistema único para clientes,
                ordens de serviço, estoque e comprovantes.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/login">Ir ao sistema</Link>
                <a className="button button-secondary" href="#projeto">Conheça o projeto</a>
              </div>
            </div>

            <div className="system-card" aria-label="Resumo das áreas do sistema">
              <div className="system-card-header">
                <div>
                  <small>PAINEL DIGITAL+</small>
                  <strong>Visão geral</strong>
                </div>
                <span>Online</span>
              </div>
              <div className="system-stats">
                <article><span>Ordens abertas</span><strong>24</strong></article>
                <article><span>Em andamento</span><strong>8</strong></article>
              </div>
              <div className="system-list">
                <div><i className="dot dot-pink" /><span>Clientes cadastrados</span><b>128</b></div>
                <div><i className="dot dot-blue" /><span>Peças em estoque</span><b>346</b></div>
                <div><i className="dot dot-green" /><span>Serviços concluídos</span><b>92</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="projeto">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">O PROJETO</span>
              <h2>Menos papel. Mais controle.</h2>
              <p>Uma proposta criada para resolver problemas reais da rotina de uma assistência técnica.</p>
            </div>

            <div className="project-grid">
              <article className="info-card">
                <span className="card-number">01</span>
                <h3>O problema</h3>
                <p>Fichas físicas podem se perder, dificultam a busca do histórico e deixam o controle de peças pouco confiável.</p>
                <ul>
                  <li>Informações espalhadas</li>
                  <li>Atendimento mais lento</li>
                  <li>Dificuldade para acompanhar serviços</li>
                </ul>
              </article>

              <article className="info-card info-card-accent">
                <span className="card-number">02</span>
                <h3>A solução</h3>
                <p>Centralizar as informações em uma plataforma simples, acessível e adequada ao dia a dia da loja.</p>
                <ul>
                  <li>Histórico fácil de consultar</li>
                  <li>Fluxo de atendimento organizado</li>
                  <li>Estoque conectado às ordens</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-soft" id="funcionalidades">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">FUNCIONALIDADES</span>
              <h2>O essencial para a rotina da loja.</h2>
              <p>Quatro áreas integradas, sem complicar o trabalho de quem usa o sistema.</p>
            </div>

            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <span className="feature-icon">{feature.short}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="como-funciona">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">COMO FUNCIONA</span>
              <h2>Do atendimento à entrega.</h2>
              <p>Um fluxo curto e fácil de acompanhar em cada serviço.</p>
            </div>

            <div className="steps-grid">
              {steps.map(([number, title, text]) => (
                <article className="step-card" key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section about-section" id="quem-somos">
          <div className="container about-grid">
            <div className="about-copy">
              <span className="eyebrow eyebrow-light">QUEM SOMOS</span>
              <h2>Uma equipe unida por um problema real.</h2>
              <p>
                Somos estudantes desenvolvendo uma solução acadêmica para modernizar o
                atendimento da Digital+ Acessórios. Nosso objetivo é tornar a gestão da loja
                mais simples, segura e eficiente.
              </p>
              <p>
                O projeto combina pesquisa, organização de processos e desenvolvimento web
                em uma proposta que pode evoluir do protótipo para a rotina real.
              </p>
            </div>

            <div className="team-grid" aria-label="Integrantes do projeto">
              {team.map(([initials, name]) => (
                <article className="team-card" key={name}>
                  <span>{initials}</span>
                  <div><strong>{name}</strong><small>Equipe do TCC</small></div>
                </article>
              ))}
            </div>
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
