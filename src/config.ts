/**
 * Configuration management for olcli
 */

import Conf from 'conf';
import { spawnSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BASE_PROFILE_NAME = 'base';
const DEFAULT_BASE_URL = 'https://www.overleaf.com';
const DEFAULT_SESSION_COOKIE_NAME = 'overleaf_session2';
const DPAPI_PREFIX = 'olcli:v1:dpapi:';
const SECRET_PREFIX = 'olcli:v1:secret:';
const PROFILE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
let cachedAuthSecret: string | undefined;

export interface ServerProfile {
  baseUrl: string;
  cookieName?: string;
  sessionCookie?: string;
}

interface OlcliConfig {
  sessionCookie?: string;
  csrf?: string;
  lastProject?: string;
  baseUrl?: string;
  sessionCookieName?: string;
  defaultProfile?: string;
  profiles?: Record<string, ServerProfile>;
}

const config = new Conf<OlcliConfig>({
  projectName: 'olcli',
  schema: {
    sessionCookie: { type: 'string' },
    csrf: { type: 'string' },
    lastProject: { type: 'string' },
    baseUrl: { type: 'string' },
    sessionCookieName: { type: 'string' },
    defaultProfile: { type: 'string' },
    profiles: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          baseUrl: { type: 'string' },
          cookieName: { type: 'string' },
          sessionCookie: { type: 'string' }
        },
        required: ['baseUrl'],
        additionalProperties: false
      }
    }
  }
});

function normalizeProfileName(name?: string): string {
  return name?.trim() || getDefaultProfileName();
}

function validateProfileName(name: string): void {
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error('Profile name must contain only letters, numbers, underscores, and hyphens.');
  }
}

function validateCookieName(name: string): void {
  if (!COOKIE_NAME_PATTERN.test(name)) {
    throw new Error('Cookie name contains invalid characters.');
  }
}

function envProfilePrefix(profileName: string): string {
  return profileName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getEnvValue(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

function profileEnvNames(profileName: string, suffix: string): string[] {
  const prefix = envProfilePrefix(profileName);
  return prefix ? [`${prefix}_${suffix}`] : [];
}

export function getEnvCookieVariableNames(profileName?: string): string[] {
  const effectiveProfileName = normalizeProfileName(profileName);
  const names = effectiveProfileName === BASE_PROFILE_NAME
    ? ['OVERLEAF_COOKIE', 'OVERLEAF_SESSION']
    : [
        ...profileEnvNames(effectiveProfileName, 'COOKIE'),
        ...profileEnvNames(effectiveProfileName, 'SESSION')
      ];
  return [...new Set(names)];
}

function getBaseProfile(): ServerProfile {
  return {
    baseUrl: config.get('baseUrl') || DEFAULT_BASE_URL,
    cookieName: config.get('sessionCookieName') || DEFAULT_SESSION_COOKIE_NAME,
    sessionCookie: config.get('sessionCookie')
  };
}

function getStoredProfiles(): Record<string, ServerProfile> {
  return config.get('profiles') || {};
}

export function getProfiles(): Record<string, ServerProfile> {
  return {
    [BASE_PROFILE_NAME]: getBaseProfile(),
    ...getStoredProfiles()
  };
}

export function getProfile(name?: string): ServerProfile | undefined {
  const profileName = normalizeProfileName(name);
  if (!PROFILE_NAME_PATTERN.test(profileName)) {
    return undefined;
  }
  if (profileName === BASE_PROFILE_NAME) {
    return getBaseProfile();
  }
  return getStoredProfiles()[profileName];
}

export function setProfile(name: string, profile: ServerProfile): void {
  const profileName = normalizeProfileName(name);
  validateProfileName(profileName);
  if (profile.cookieName) validateCookieName(profile.cookieName);
  const storedProfile = profile.sessionCookie
    ? { ...profile, sessionCookie: encryptSecret(profile.sessionCookie) }
    : profile;
  if (profileName === BASE_PROFILE_NAME) {
    setBaseUrl(storedProfile.baseUrl);
    if (storedProfile.cookieName) setSessionCookieName(storedProfile.cookieName);
    if (storedProfile.sessionCookie) setSessionCookie(storedProfile.sessionCookie, BASE_PROFILE_NAME);
    return;
  }

  const profiles = getStoredProfiles();
  profiles[profileName] = storedProfile;
  config.set('profiles', profiles);
}

export function removeProfile(name: string): boolean {
  const profileName = normalizeProfileName(name);
  if (profileName === BASE_PROFILE_NAME) {
    return false;
  }

  const profiles = getStoredProfiles();
  if (!profiles[profileName]) {
    return false;
  }

  delete profiles[profileName];
  config.set('profiles', profiles);

  if (getDefaultProfileName() === profileName) {
    setDefaultProfileName(BASE_PROFILE_NAME);
  }
  return true;
}

export function getDefaultProfileName(): string {
  return config.get('defaultProfile') || BASE_PROFILE_NAME;
}

export function setDefaultProfileName(name: string): void {
  const profileName = normalizeProfileName(name);
  validateProfileName(profileName);
  if (!getProfile(profileName)) {
    throw new Error(`Profile not found: ${profileName}`);
  }
  config.set('defaultProfile', profileName);
}

export function getBaseUrl(profileName?: string): string {
  const effectiveProfileName = normalizeProfileName(profileName);
  const profileBaseUrl = getEnvValue(profileEnvNames(effectiveProfileName, 'BASE_URL'));
  if (profileBaseUrl) {
    return profileBaseUrl;
  }

  if (effectiveProfileName === BASE_PROFILE_NAME && process.env.OVERLEAF_BASE_URL) {
    return process.env.OVERLEAF_BASE_URL;
  }

  return getProfile(effectiveProfileName)?.baseUrl || config.get('baseUrl') || DEFAULT_BASE_URL;
}

export function setBaseUrl(url: string): void {
  config.set('baseUrl', url);
}

export function getSessionCookieName(profileName?: string): string {
  const effectiveProfileName = normalizeProfileName(profileName);
  const profileCookieName = getEnvValue(profileEnvNames(effectiveProfileName, 'COOKIE_NAME'));
  if (profileCookieName) {
    validateCookieName(profileCookieName);
    return profileCookieName;
  }

  if (effectiveProfileName === BASE_PROFILE_NAME && process.env.OVERLEAF_COOKIE_NAME) {
    validateCookieName(process.env.OVERLEAF_COOKIE_NAME);
    return process.env.OVERLEAF_COOKIE_NAME;
  }

  const cookieName = getProfile(effectiveProfileName)?.cookieName || config.get('sessionCookieName') || DEFAULT_SESSION_COOKIE_NAME;
  validateCookieName(cookieName);
  return cookieName;
}

export function setSessionCookieName(name: string): void {
  validateCookieName(name);
  config.set('sessionCookieName', name);
}

function localAuthKey(cookieName: string, profileName: string): string {
  return profileName === BASE_PROFILE_NAME ? cookieName : `${profileName}.${cookieName}`;
}

function parseLocalAuthEntries(content: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const part of content.split(/[;\r\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes('=')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    entries.set(key.trim(), valueParts.join('=').trim());
  }
  return entries;
}

function writeLocalAuthEntries(path: string, entries: Map<string, string>): void {
  const content = Array.from(entries.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  writeFileSync(path, `${content}\n`, { encoding: 'utf-8', mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort only; Windows may ignore POSIX file modes.
  }
}

function isEncryptedSecret(value: string): boolean {
  return value.startsWith(DPAPI_PREFIX) || value.startsWith(SECRET_PREFIX);
}

function runPowerShell(command: string, input: string): string {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command
  ], {
    input,
    encoding: 'utf-8',
    windowsHide: true
  });

  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.error?.message || 'PowerShell command failed';
    throw new Error(message);
  }

  return result.stdout.replace(/\r?\n$/, '');
}

function encryptWithDpapi(value: string): string {
  const cipher = runPowerShell(
    "$ErrorActionPreference='Stop'; $plain=[Console]::In.ReadToEnd(); " +
    "$secure=ConvertTo-SecureString -String $plain -AsPlainText -Force; " +
    "$secure | ConvertFrom-SecureString",
    value
  );
  return `${DPAPI_PREFIX}${Buffer.from(cipher, 'utf-8').toString('base64url')}`;
}

function decryptWithDpapi(value: string): string {
  const cipher = Buffer.from(value.slice(DPAPI_PREFIX.length), 'base64url').toString('utf-8');
  return runPowerShell(
    "$ErrorActionPreference='Stop'; $cipher=[Console]::In.ReadToEnd().Trim(); " +
    "$secure=ConvertTo-SecureString -String $cipher; " +
    "$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); " +
    "try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } " +
    "finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }",
    cipher
  );
}

function readHiddenLine(prompt: string): string {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive auth secret prompt requires a terminal.');
  }

  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const result = spawnSync('/bin/sh', [
    '-c',
    `printf '%s' '${escapedPrompt}' > /dev/tty; ` +
    `old=$(stty -g < /dev/tty); ` +
    `stty -echo < /dev/tty; ` +
    `IFS= read -r line < /dev/tty; status=$?; ` +
    `stty "$old" < /dev/tty; ` +
    `printf '\\n' > /dev/tty; ` +
    `if [ "$status" -eq 0 ]; then printf '%s' "$line"; else exit "$status"; fi`
  ], {
    encoding: 'utf-8',
    windowsHide: true
  });

  if (result.status !== 0) {
    const message = result.stderr?.trim() || 'Failed to read auth secret.';
    throw new Error(message);
  }

  return result.stdout;
}

function promptAuthSecret(create: boolean): string {
  if (cachedAuthSecret) return cachedAuthSecret;

  if (!create) {
    const secret = readHiddenLine('olcli auth secret: ');
    if (!secret) throw new Error('Auth secret cannot be empty.');
    cachedAuthSecret = secret;
    return secret;
  }

  const secret = readHiddenLine('Set olcli auth secret: ');
  if (!secret) throw new Error('Auth secret cannot be empty.');
  if (secret.length < 12) {
    throw new Error('Auth secret must be at least 12 characters.');
  }

  const confirmation = readHiddenLine('Confirm olcli auth secret: ');
  if (secret !== confirmation) {
    throw new Error('Auth secrets did not match.');
  }

  cachedAuthSecret = secret;
  return secret;
}

function secretKey(secret: string, salt: Buffer | string): Buffer {
  return scryptSync(secret, salt, 32);
}

function encryptWithSecret(value: string, createSecret: boolean): string {
  const salt = randomBytes(16);
  const key = secretKey(promptAuthSecret(createSecret), salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${salt.toString('base64url')}.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptWithSecret(value: string): string {
  const parts = value.slice(SECRET_PREFIX.length).split('.');
  const [salt, ivText, tagText, encryptedText] = parts.length === 3
    ? ['olcli-auth-v1', parts[0], parts[1], parts[2]]
    : parts;
  if (!salt || !ivText || !tagText || !encryptedText) {
    throw new Error('Invalid encrypted auth cookie format.');
  }

  const key = secretKey(
    promptAuthSecret(false),
    parts.length === 3 ? salt : Buffer.from(salt, 'base64url')
  );
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final()
  ]).toString('utf-8');
}

function encryptSecret(value: string, createSecret: boolean = true): string {
  if (isEncryptedSecret(value)) return value;
  if (process.platform === 'win32') return encryptWithDpapi(value);
  return encryptWithSecret(value, createSecret);
}

function decryptSecret(value: string): string {
  if (value.startsWith(DPAPI_PREFIX)) return decryptWithDpapi(value);
  if (value.startsWith(SECRET_PREFIX)) return decryptWithSecret(value);
  return value;
}

function decryptSavedSecret(value: string): string {
  try {
    return decryptSecret(value);
  } catch (error: any) {
    throw new Error(`Failed to decrypt saved auth cookie: ${error.message}`);
  }
}

function readLocalAuthFile(path: string, cookieName: string, profileName: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const content = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '').trim();
  if (content.includes('=')) {
    const entries = parseLocalAuthEntries(content);
    const key = profileName === BASE_PROFILE_NAME
      ? cookieName
      : localAuthKey(cookieName, profileName);
    const value = entries.get(key);
    if (!value) return undefined;
    const cookie = decryptSavedSecret(value);
    if (!isEncryptedSecret(value)) {
      const shouldCreateSecret = !Array.from(entries.values()).some(entry => entry.startsWith(SECRET_PREFIX));
      entries.set(key, encryptSecret(cookie, shouldCreateSecret));
      writeLocalAuthEntries(path, entries);
    }
    return cookie;
  }
  if (profileName !== BASE_PROFILE_NAME) {
    return undefined;
  }
  const cookie = decryptSavedSecret(content);
  if (!isEncryptedSecret(content)) {
    const entries = new Map<string, string>();
    entries.set(cookieName, encryptSecret(cookie));
    writeLocalAuthEntries(path, entries);
  }
  return cookie;
}

export function getSessionCookie(cookieName?: string, profileName?: string): string | undefined {
  const effectiveProfileName = normalizeProfileName(profileName);
  const effectiveCookieName = cookieName || getSessionCookieName(effectiveProfileName);

  // Check process environment variables first.
  const envCookie = getEnvValue(getEnvCookieVariableNames(effectiveProfileName));
  if (envCookie) {
    return envCookie;
  }

  const localCookie = readLocalAuthFile(join(process.cwd(), '.olauth'), effectiveCookieName, effectiveProfileName);
  if (localCookie) {
    return localCookie;
  }

  const profile = getProfile(effectiveProfileName);
  if (profile?.sessionCookie) {
    const cookie = decryptSavedSecret(profile.sessionCookie);
    if (!isEncryptedSecret(profile.sessionCookie)) {
      setSessionCookie(cookie, effectiveProfileName);
    }
    return cookie;
  }

  if (effectiveProfileName !== BASE_PROFILE_NAME) {
    return undefined;
  }

  // Check base global config
  const cookie = config.get('sessionCookie');
  if (!cookie) return undefined;
  const decryptedCookie = decryptSavedSecret(cookie);
  if (!isEncryptedSecret(cookie)) {
    setSessionCookie(decryptedCookie, BASE_PROFILE_NAME);
  }
  return decryptedCookie;
}

export function setSessionCookie(cookie: string, profileName?: string): void {
  const effectiveProfileName = normalizeProfileName(profileName);
  if (effectiveProfileName !== BASE_PROFILE_NAME) {
    const profile = getProfile(effectiveProfileName);
    if (!profile) {
      throw new Error(`Profile not found: ${effectiveProfileName}`);
    }
    const encryptedCookie = encryptSecret(cookie, !profile.sessionCookie?.startsWith(SECRET_PREFIX));
    setProfile(effectiveProfileName, { ...profile, sessionCookie: encryptedCookie });
    return;
  }

  const existingCookie = config.get('sessionCookie');
  const encryptedCookie = encryptSecret(cookie, !existingCookie?.startsWith(SECRET_PREFIX));
  config.set('sessionCookie', encryptedCookie);
}

export function getCsrf(): string | undefined {
  return config.get('csrf');
}

export function setCsrf(csrf: string): void {
  config.set('csrf', csrf);
}

export function getLastProject(): string | undefined {
  return config.get('lastProject');
}

export function setLastProject(projectId: string): void {
  config.set('lastProject', projectId);
}

export function clearConfig(): void {
  config.clear();
}

export function clearSessionCookie(profileName?: string): void {
  const effectiveProfileName = normalizeProfileName(profileName);
  if (effectiveProfileName !== BASE_PROFILE_NAME) {
    const profile = getProfile(effectiveProfileName);
    if (!profile) {
      throw new Error(`Profile not found: ${effectiveProfileName}`);
    }
    const { sessionCookie: _sessionCookie, ...profileWithoutCookie } = profile;
    setProfile(effectiveProfileName, profileWithoutCookie);
    return;
  }

  config.delete('sessionCookie');
  config.delete('csrf');
}

export function getConfigPath(): string {
  return config.path;
}

/**
 * Save session cookie in .olauth format for compatibility
 */
export function saveOlAuth(cookie: string, path?: string, cookieName?: string, profileName?: string): void {
  const authPath = path || join(process.cwd(), '.olauth');
  const effectiveProfileName = normalizeProfileName(profileName);
  const effectiveCookieName = cookieName || getSessionCookieName(effectiveProfileName);
  const entries = existsSync(authPath)
    ? parseLocalAuthEntries(readFileSync(authPath, 'utf-8').replace(/^\uFEFF/, ''))
    : new Map<string, string>();
  const shouldCreateSecret = !Array.from(entries.values()).some(value => value.startsWith(SECRET_PREFIX));

  entries.set(localAuthKey(effectiveCookieName, effectiveProfileName), encryptSecret(cookie, shouldCreateSecret));
  writeLocalAuthEntries(authPath, entries);
}
