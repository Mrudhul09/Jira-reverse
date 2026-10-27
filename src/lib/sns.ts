import { createVerify } from "node:crypto";

// Amazon SNS posts each message here signed with a certificate that AWS hosts. Only certificates
// from an SNS host are trusted, so a forged message can't point us at a certificate of its own.
export interface SnsMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

export function isSnsUrl(u: string | undefined, pem = false): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && SNS_HOST.test(url.hostname) && (!pem || url.pathname.endsWith(".pem"));
  } catch {
    return false;
  }
}

export function stringToSign(m: SnsMessage): string {
  const keys =
    m.Type === "Notification"
      ? ["Message", "MessageId", ...(m.Subject !== undefined ? ["Subject"] : []), "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  return keys.map((k) => `${k}\n${(m as unknown as Record<string, string>)[k] ?? ""}\n`).join("");
}

const g = globalThis as unknown as { __itsmSnsCerts?: Map<string, string> };

async function fetchCert(url: string): Promise<string> {
  const cache = (g.__itsmSnsCerts ??= new Map());
  const hit = cache.get(url);
  if (hit) return hit;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`certificate download failed (${res.status})`);
  const pem = await res.text();
  cache.set(url, pem);
  return pem;
}

export async function verifySns(m: SnsMessage, getCert: (url: string) => Promise<string> = fetchCert): Promise<boolean> {
  if (!m.Signature || !isSnsUrl(m.SigningCertURL, true)) return false;
  if (m.SignatureVersion !== "1" && m.SignatureVersion !== "2") return false;
  const pem = await getCert(m.SigningCertURL);
  return createVerify(m.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1")
    .update(stringToSign(m), "utf8")
    .verify(pem, m.Signature, "base64");
}
