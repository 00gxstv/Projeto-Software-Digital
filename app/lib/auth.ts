import { cookies } from "next/headers";
import { GENERATED_AUTH_SECRET } from "./generated-auth-secret";

export const ACCOUNT_COOKIE = "digital_mais_account";
export const SESSION_COOKIE = "digital_mais_session";
export const RECOVERY_CODE_COOKIE = "digital_mais_recovery_code";

const ACCOUNT_MAX_AGE = 60 * 60 * 24 * 90;
const SESSION_MAX_AGE = 60 * 60 * 8;
const RECOVERY_CODE_MAX_AGE = 60 * 15;
// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

type RegisteredAccountV1 = {
  v: 1;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
};

export type RegisteredAccount = RegisteredAccountV1 | {
  v: 2;
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  recoverySalt: string;
  recoveryHash: string;
  createdAt: number;
};

export type AuthSession = {
  v: 1;
  name: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? GENERATED_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array<ArrayBufferLike>): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodePayload(value: unknown): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodePayload<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    return null;
  }
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(value: unknown): Promise<string> {
  const payload = encodePayload(value);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyPayload<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    return valid ? decodePayload<T>(payload) : null;
  } catch {
    return null;
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128 && /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value);
}

export function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function randomToken(byteLength = 16): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    baseKey,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return characters.join("").match(/.{1,4}/g)?.join("-") ?? characters.join("");
}

function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function createAccountBundle(
  name: string,
  email: string,
  password: string,
): Promise<{ accountToken: string; recoveryCode: string }> {
  const salt = randomToken();
  const recoverySalt = randomToken();
  const recoveryCode = generateRecoveryCode();
  const account: RegisteredAccount = {
    v: 2,
    name,
    email,
    salt,
    passwordHash: await hashPassword(password, salt),
    recoverySalt,
    recoveryHash: await hashPassword(normalizeRecoveryCode(recoveryCode), recoverySalt),
    createdAt: Date.now(),
  };
  return { accountToken: await signPayload(account), recoveryCode };
}

export async function readAccountToken(token: string | undefined): Promise<RegisteredAccount | null> {
  const account = await verifyPayload<RegisteredAccount>(token);
  if (
    !account ||
    (account.v !== 1 && account.v !== 2) ||
    !account.name ||
    !validEmail(account.email) ||
    !account.salt ||
    !account.passwordHash
  ) {
    return null;
  }
  return account;
}

export function accountHasRecoveryCode(account: RegisteredAccount): account is Extract<RegisteredAccount, { v: 2 }> {
  return account.v === 2 && Boolean(account.recoverySalt) && Boolean(account.recoveryHash);
}

export async function recoveryCodeMatches(account: RegisteredAccount, recoveryCode: string): Promise<boolean> {
  if (!accountHasRecoveryCode(account)) return false;
  const normalizedCode = normalizeRecoveryCode(recoveryCode);
  if (normalizedCode.length !== 16) return false;
  const candidate = await hashPassword(normalizedCode, account.recoverySalt);
  const expectedBytes = base64UrlToBytes(account.recoveryHash);
  const candidateBytes = base64UrlToBytes(candidate);
  if (expectedBytes.length !== candidateBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ candidateBytes[index];
  }
  return difference === 0;
}

export async function resetAccountPassword(
  account: RegisteredAccount,
  password: string,
): Promise<{ accountToken: string; recoveryCode: string }> {
  return createAccountBundle(account.name, account.email, password);
}

export async function passwordMatches(account: RegisteredAccount, password: string): Promise<boolean> {
  const candidate = await hashPassword(password, account.salt);
  const expectedBytes = base64UrlToBytes(account.passwordHash);
  const candidateBytes = base64UrlToBytes(candidate);
  if (expectedBytes.length !== candidateBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ candidateBytes[index];
  }
  return difference === 0;
}

export async function createSessionToken(name: string, email: string): Promise<string> {
  const now = Date.now();
  const session: AuthSession = {
    v: 1,
    name,
    email,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE * 1000,
    nonce: randomToken(),
  };
  return signPayload(session);
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const session = await verifyPayload<AuthSession>(cookieStore.get(SESSION_COOKIE)?.value);
  if (
    !session ||
    session.v !== 1 ||
    !session.name ||
    !validEmail(session.email) ||
    session.expiresAt <= Date.now()
  ) {
    return null;
  }
  return session;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export const accountCookieOptions = () => cookieOptions(ACCOUNT_MAX_AGE);
export const sessionCookieOptions = () => cookieOptions(SESSION_MAX_AGE);
export const recoveryCodeCookieOptions = () => cookieOptions(RECOVERY_CODE_MAX_AGE);

export function cookieFromRequest(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

export function requestHasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export function absoluteAppUrl(request: Request, path: string): URL {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
  return new URL(path, `${protocol}://${host}`);
}
