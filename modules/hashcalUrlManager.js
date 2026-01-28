import { decryptString, encryptString } from "./cryptoManager.js";

const HASH_PREFIX = "ENC:";

const DEFAULT_TITLE = "hash-calendar";
const DEFAULT_COLORS = ["#ff6b6b", "#ffd43b", "#4dabf7", "#63e6be", "#9775fa"];
const DEFAULT_SETTINGS = { d: 0, m: 0 };

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function compactState(state) {
  const out = {};

  if (state.t && state.t !== DEFAULT_TITLE) {
    out.t = state.t;
  }

  if (Array.isArray(state.c) && !arraysEqual(state.c, DEFAULT_COLORS)) {
    const diff = {};
    state.c.forEach((c, i) => {
      if (c !== DEFAULT_COLORS[i]) {
        diff[i] = c.startsWith("#") ? c.slice(1) : c;
      }
    });
    if (Object.keys(diff).length) {
      out.c = diff;
    }
  }

  if (Array.isArray(state.e) && state.e.length) {
    out.e = state.e.map((ev) => {
      const arr = [ev[0], ev[1], ev[2]];
      const rule = ev[4] || "";
      const colorIdx = ev[3] || 0;
      if (rule) {
        arr.push(colorIdx, rule);
      } else if (colorIdx !== 0) {
        arr.push(colorIdx);
      }
      return arr;
    });
  }

  if (state.s && (state.s.d !== 0 || state.s.m !== 0)) {
    out.s = state.s;
  }

  return out;
}

function ensureLzString() {
  if (!window.LZString) {
    throw new Error("LZString missing");
  }
  return window.LZString;
}

export function isEncryptedHash(hash = window.location.hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return raw.startsWith(HASH_PREFIX);
}

export async function readStateFromHash(password = null) {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!raw) return null;

  const lz = ensureLzString();
  if (raw.startsWith(HASH_PREFIX)) {
    if (!password) {
      const error = new Error("Password required");
      error.code = "PASSWORD_REQUIRED";
      throw error;
    }
    const payload = raw.slice(HASH_PREFIX.length);
    const compressed = await decryptString(payload, password);
    const json = lz.decompressFromEncodedURIComponent(compressed);
    if (!json) throw new Error("Decompression failed");
    return JSON.parse(json);
  }

  const json = lz.decompressFromEncodedURIComponent(raw);
  if (!json) throw new Error("Decompression failed");
  return JSON.parse(json);
}

export async function writeStateToHash(state, password = null) {
  const lz = ensureLzString();
  const json = JSON.stringify(compactState(state));
  const compressed = lz.compressToEncodedURIComponent(json);
  let nextHash = compressed;

  if (password) {
    const encrypted = await encryptString(compressed, password);
    nextHash = `${HASH_PREFIX}${encrypted}`;
  }

  if (window.location.hash !== `#${nextHash}`) {
    history.replaceState(null, "", `#${nextHash}`);
  }
  return nextHash;
}

export function clearHash() {
  history.replaceState(null, "", window.location.pathname);
}
