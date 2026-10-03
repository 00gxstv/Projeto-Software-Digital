import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", process.pid + "-" + Date.now() + "-" + Math.random());
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

const environment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([name, value]) => name + "=" + value).join("; ");
}

function updateCookies(response, cookies) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);

  for (const value of values) {
    const [pair] = value.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) cookies[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return cookies;
}

function postForm(worker, path, values, cookies = {}) {
  const body = new FormData();
  for (const [name, value] of Object.entries(values)) body.set(name, value);
  return worker.fetch(
    new Request("http://localhost" + path, {
      method: "POST",
      headers: {
        accept: "text/html",
        origin: "http://localhost",
        cookie: cookieHeader(cookies),
      },
      body,
      redirect: "manual",
    }),
    environment,
    context,
  );
}

test("renders the Digital+ landing page", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    environment,
    context,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Digital\+ \| Sistema de Gestão para Assistência Técnica<\/title>/i);
  assert.match(html, /href=["']\/login["']/i);
  assert.match(html, /Quem somos/i);
});

test("registers, logs in and securely recovers the password", async () => {
  const worker = await loadWorker();
  const cookies = {};
  const email = "teste." + Date.now() + "@digitalmais.local";
  const oldPassword = "SenhaTeste123";
  const newPassword = "NovaSenha456";

  const register = await postForm(worker, "/api/auth/register", {
    name: "Usuário de Teste",
    email,
    password: oldPassword,
    passwordConfirmation: oldPassword,
    website: "",
  }, cookies);
  assert.equal(register.status, 303);
  assert.match(register.headers.get("location") ?? "", /\/login\?/);
  updateCookies(register, cookies);
  assert.ok(cookies.digital_mais_account);
  assert.match(cookies.digital_mais_recovery_code, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
  const firstRecoveryCode = cookies.digital_mais_recovery_code;

  const login = await postForm(worker, "/api/auth/login", {
    email,
    password: oldPassword,
  }, cookies);
  assert.equal(login.status, 303);
  assert.match(login.headers.get("location") ?? "", /\/sistema$/);
  updateCookies(login, cookies);
  assert.ok(cookies.digital_mais_session);

  const protectedPage = await worker.fetch(
    new Request("http://localhost/sistema", {
      headers: { accept: "text/html", cookie: cookieHeader(cookies) },
    }),
    environment,
    context,
  );
  assert.equal(protectedPage.status, 200);

  const invalidRecovery = await postForm(worker, "/api/auth/recover", {
    email,
    recoveryCode: "AAAA-AAAA-AAAA-AAAA",
    password: newPassword,
    passwordConfirmation: newPassword,
    website: "",
  }, cookies);
  assert.equal(invalidRecovery.status, 303);
  assert.match(invalidRecovery.headers.get("location") ?? "", /erro=credenciais/);

  const recovery = await postForm(worker, "/api/auth/recover", {
    email,
    recoveryCode: firstRecoveryCode,
    password: newPassword,
    passwordConfirmation: newPassword,
    website: "",
  }, cookies);
  assert.equal(recovery.status, 303);
  assert.match(recovery.headers.get("location") ?? "", /senha=alterada/);
  updateCookies(recovery, cookies);
  assert.notEqual(cookies.digital_mais_recovery_code, firstRecoveryCode);

  const oldLogin = await postForm(worker, "/api/auth/login", {
    email,
    password: oldPassword,
  }, cookies);
  assert.equal(oldLogin.status, 303);
  assert.match(oldLogin.headers.get("location") ?? "", /erro=credenciais/);

  const newLogin = await postForm(worker, "/api/auth/login", {
    email,
    password: newPassword,
  }, cookies);
  assert.equal(newLogin.status, 303);
  assert.match(newLogin.headers.get("location") ?? "", /\/sistema$/);
});
