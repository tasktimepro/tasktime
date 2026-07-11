#!/usr/bin/env node
import { realpathSync as mt, mkdirSync as rr, writeFileSync as or } from "node:fs";
import { resolve as ir, dirname as ar } from "node:path";
import { fileURLToPath as sr, pathToFileURL as cr } from "node:url";
import { randomUUID as Me, randomBytes as lr, createHmac as pr, randomInt as ur, createHash as nn } from "node:crypto";
import { Buffer as X } from "node:buffer";
import { createServer as dr } from "node:http";
class z extends Error {
  constructor(t, n, r) {
    super(n), this.name = "AgentCommandError", this.code = t, this.details = r;
  }
}
const mr = 500;
function fr(e) {
  return e.startsWith("export_") || e === "create_drive_backup" || e === "download_drive_backup_json" ? "export" : e.startsWith("open_") || e.startsWith("focus_") ? "navigation" : e.includes("invoice") || e.includes("billed") || e.includes("billing") ? e.includes("email") ? "email" : "billing" : e.startsWith("list_") || e.startsWith("get_") || e.startsWith("find_") || e.startsWith("preview_") ? "read" : e.startsWith("create_") || e.startsWith("update_") || e.startsWith("complete_") || e.startsWith("archive_") || e.startsWith("unarchive_") || e.startsWith("start_") || e.startsWith("pause_") || e.startsWith("stop_") || e.startsWith("add_") || e.startsWith("mark_") || e.startsWith("finalize_") || e.startsWith("restore_") || e.startsWith("delete_") ? "write" : "unknown";
}
class rn {
  constructor(t = {}) {
    this.events = [], this.nextId = 0, this.maxEvents = t.maxEvents ?? mr, this.now = t.now ?? Date.now, this.idFactory = t.idFactory ?? (() => `bridge-audit-${this.nextId++}`);
  }
  append(t) {
    const n = {
      id: this.idFactory(),
      timestamp: this.now(),
      action: t.action
    }, r = t.commandCategory ?? (t.command ? fr(t.command) : void 0);
    for (t.clientId && (n.clientId = t.clientId), t.requestId && (n.requestId = t.requestId), t.command && (n.command = t.command), r && (n.commandCategory = r), typeof t.ok == "boolean" && (n.ok = t.ok), t.errorCode && (n.errorCode = t.errorCode), t.details && (n.details = t.details), this.events.push(n); this.events.length > this.maxEvents; )
      this.events.shift();
    return n;
  }
  list() {
    return this.events.map((t) => ({
      ...t,
      details: t.details ? { ...t.details } : void 0
    }));
  }
  clear() {
    this.events.length = 0;
  }
}
const hr = "tasktime-hmac-sha256-v1", gr = 6e4;
function on(e) {
  return [...new Set(e)].sort();
}
function Ze(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => Ze(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, Ze(n)])
  ) : null;
}
function yr(e) {
  return JSON.stringify(Ze({
    ...e,
    scopes: on(e.scopes)
  }));
}
function br(e) {
  const t = e.replace(/-/g, "+").replace(/_/g, "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return Buffer.from(n, "base64");
}
function _r(e, t) {
  return pr("sha256", br(t)).update(yr(e)).digest("base64url");
}
function vr(e) {
  const t = e.now ? e.now() : Date.now(), n = t + (e.ttlMs ?? gr), r = e.nonce ?? (typeof Me == "function" ? Me() : lr(16).toString("base64url")), o = {
    format: hr,
    grantId: e.grant.id,
    command: e.command,
    inputHash: e.inputHash,
    category: e.category,
    scopes: on(e.scopes),
    nonce: r,
    issuedAt: t,
    expiresAt: n
  };
  return {
    format: o.format,
    grantId: o.grantId,
    token: _r(o, e.grant.secretKeyBase64Url),
    issuedAt: o.issuedAt,
    expiresAt: o.expiresAt,
    nonce: o.nonce,
    command: o.command,
    inputHash: o.inputHash,
    scopes: o.scopes,
    category: o.category
  };
}
const Ir = 300 * 1e3, wr = 6;
function kr(e) {
  let t = "";
  for (let n = 0; n < e; n += 1)
    t += String(ur(0, 10));
  return t;
}
function Tr(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? Ir, r = e.codeLength ?? wr;
  return {
    id: e.idFactory ? e.idFactory() : Me(),
    code: e.codeFactory ? e.codeFactory(r) : kr(r),
    endpoint: e.endpoint,
    scopes: [...e.scopes],
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function Sr(e, t = Date.now()) {
  return t >= e.expiresAt;
}
class Pr {
  constructor() {
    this.challenges = /* @__PURE__ */ new Map();
  }
  create(t) {
    const n = Tr(t);
    return this.challenges.set(n.id, n), n;
  }
  get(t) {
    return this.challenges.get(t) || null;
  }
  consume(t, n, r = Date.now()) {
    const o = this.challenges.get(t);
    if (!o)
      throw new z("NOT_FOUND", "Pairing challenge not found.", { id: t });
    if (Sr(o, r))
      throw this.challenges.delete(t), new z("PERMISSION_DENIED", "Pairing challenge expired.", { id: t });
    if (o.code !== n)
      throw new z("PERMISSION_DENIED", "Pairing code is invalid.", { id: t });
    return this.challenges.delete(t), o;
  }
  delete(t) {
    this.challenges.delete(t);
  }
}
const Ar = 1440 * 60 * 1e3, xr = 32;
function Er() {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Secure random token generation is unavailable.");
  return globalThis.crypto;
}
function jr(e = xr) {
  const t = new Uint8Array(e);
  return Er().getRandomValues(t), Array.from(t).map((n) => n.toString(16).padStart(2, "0")).join("");
}
function zr(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? Ar;
  return {
    sessionToken: e.tokenFactory ? e.tokenFactory(e.tokenBytes) : jr(e.tokenBytes),
    scopes: new Set(e.scopes),
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function Or(e, t = Date.now()) {
  return t >= e.expiresAt;
}
function u(e, t, n) {
  function r(c, p) {
    if (c._zod || Object.defineProperty(c, "_zod", {
      value: {
        def: p,
        constr: i,
        traits: /* @__PURE__ */ new Set()
      },
      enumerable: !1
    }), c._zod.traits.has(e))
      return;
    c._zod.traits.add(e), t(c, p);
    const l = i.prototype, h = Object.keys(l);
    for (let y = 0; y < h.length; y++) {
      const v = h[y];
      v in c || (c[v] = l[v].bind(c));
    }
  }
  const o = n?.Parent ?? Object;
  class a extends o {
  }
  Object.defineProperty(a, "name", { value: e });
  function i(c) {
    var p;
    const l = n?.Parent ? new a() : this;
    r(l, c), (p = l._zod).deferred ?? (p.deferred = []);
    for (const h of l._zod.deferred)
      h();
    return l;
  }
  return Object.defineProperty(i, "init", { value: r }), Object.defineProperty(i, Symbol.hasInstance, {
    value: (c) => n?.Parent && c instanceof n.Parent ? !0 : c?._zod?.traits?.has(e)
  }), Object.defineProperty(i, "name", { value: e }), i;
}
class se extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class an extends Error {
  constructor(t) {
    super(`Encountered unidirectional transform during encode: ${t}`), this.name = "ZodEncodeError";
  }
}
const Ue = {};
function H(e) {
  return e && Object.assign(Ue, e), Ue;
}
function sn(e) {
  const t = Object.values(e).filter((r) => typeof r == "number");
  return Object.entries(e).filter(([r, o]) => t.indexOf(+r) === -1).map(([r, o]) => o);
}
function qe(e, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
function rt(e) {
  return {
    get value() {
      {
        const t = e();
        return Object.defineProperty(this, "value", { value: t }), t;
      }
    }
  };
}
function ot(e) {
  return e == null;
}
function it(e) {
  const t = e.startsWith("^") ? 1 : 0, n = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(t, n);
}
function Dr(e, t) {
  const n = (e.toString().split(".")[1] || "").length, r = t.toString();
  let o = (r.split(".")[1] || "").length;
  if (o === 0 && /\d?e-\d?/.test(r)) {
    const p = r.match(/\d?e-(\d?)/);
    p?.[1] && (o = Number.parseInt(p[1]));
  }
  const a = n > o ? n : o, i = Number.parseInt(e.toFixed(a).replace(".", "")), c = Number.parseInt(t.toFixed(a).replace(".", ""));
  return i % c / 10 ** a;
}
const ft = /* @__PURE__ */ Symbol("evaluating");
function S(e, t, n) {
  let r;
  Object.defineProperty(e, t, {
    get() {
      if (r !== ft)
        return r === void 0 && (r = ft, r = n()), r;
    },
    set(o) {
      Object.defineProperty(e, t, {
        value: o
        // configurable: true,
      });
    },
    configurable: !0
  });
}
function re(e, t, n) {
  Object.defineProperty(e, t, {
    value: n,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function te(...e) {
  const t = {};
  for (const n of e) {
    const r = Object.getOwnPropertyDescriptors(n);
    Object.assign(t, r);
  }
  return Object.defineProperties({}, t);
}
function ht(e) {
  return JSON.stringify(e);
}
function Nr(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const cn = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function ve(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
const $r = rt(() => {
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare"))
    return !1;
  try {
    const e = Function;
    return new e(""), !0;
  } catch {
    return !1;
  }
});
function le(e) {
  if (ve(e) === !1)
    return !1;
  const t = e.constructor;
  if (t === void 0 || typeof t != "function")
    return !0;
  const n = t.prototype;
  return !(ve(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function ln(e) {
  return le(e) ? { ...e } : Array.isArray(e) ? [...e] : e;
}
const Cr = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function pe(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ne(e, t, n) {
  const r = new e._zod.constr(t ?? e._zod.def);
  return (!t || n?.parent) && (r._zod.parent = e), r;
}
function _(e) {
  const t = e;
  if (!t)
    return {};
  if (typeof t == "string")
    return { error: () => t };
  if (t?.message !== void 0) {
    if (t?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    t.error = t.message;
  }
  return delete t.message, typeof t.error == "string" ? { ...t, error: () => t.error } : t;
}
function Rr(e) {
  return Object.keys(e).filter((t) => e[t]._zod.optin === "optional" && e[t]._zod.optout === "optional");
}
const Lr = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function Mr(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const a = te(e._zod.def, {
    get shape() {
      const i = {};
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && (i[c] = n.shape[c]);
      }
      return re(this, "shape", i), i;
    },
    checks: []
  });
  return ne(e, a);
}
function Zr(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const a = te(e._zod.def, {
    get shape() {
      const i = { ...e._zod.def.shape };
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && delete i[c];
      }
      return re(this, "shape", i), i;
    },
    checks: []
  });
  return ne(e, a);
}
function Ur(e, t) {
  if (!le(t))
    throw new Error("Invalid input to extend: expected a plain object");
  const n = e._zod.def.checks;
  if (n && n.length > 0) {
    const a = e._zod.def.shape;
    for (const i in t)
      if (Object.getOwnPropertyDescriptor(a, i) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  const o = te(e._zod.def, {
    get shape() {
      const a = { ...e._zod.def.shape, ...t };
      return re(this, "shape", a), a;
    }
  });
  return ne(e, o);
}
function qr(e, t) {
  if (!le(t))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const n = te(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t };
      return re(this, "shape", r), r;
    }
  });
  return ne(e, n);
}
function Br(e, t) {
  const n = te(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t._zod.def.shape };
      return re(this, "shape", r), r;
    },
    get catchall() {
      return t._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return ne(e, n);
}
function Fr(e, t, n) {
  const o = t._zod.def.checks;
  if (o && o.length > 0)
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  const i = te(t._zod.def, {
    get shape() {
      const c = t._zod.def.shape, p = { ...c };
      if (n)
        for (const l in n) {
          if (!(l in c))
            throw new Error(`Unrecognized key: "${l}"`);
          n[l] && (p[l] = e ? new e({
            type: "optional",
            innerType: c[l]
          }) : c[l]);
        }
      else
        for (const l in c)
          p[l] = e ? new e({
            type: "optional",
            innerType: c[l]
          }) : c[l];
      return re(this, "shape", p), p;
    },
    checks: []
  });
  return ne(t, i);
}
function Gr(e, t, n) {
  const r = te(t._zod.def, {
    get shape() {
      const o = t._zod.def.shape, a = { ...o };
      if (n)
        for (const i in n) {
          if (!(i in a))
            throw new Error(`Unrecognized key: "${i}"`);
          n[i] && (a[i] = new e({
            type: "nonoptional",
            innerType: o[i]
          }));
        }
      else
        for (const i in o)
          a[i] = new e({
            type: "nonoptional",
            innerType: o[i]
          });
      return re(this, "shape", a), a;
    }
  });
  return ne(t, r);
}
function ie(e, t = 0) {
  if (e.aborted === !0)
    return !0;
  for (let n = t; n < e.issues.length; n++)
    if (e.issues[n]?.continue !== !0)
      return !0;
  return !1;
}
function ae(e, t) {
  return t.map((n) => {
    var r;
    return (r = n).path ?? (r.path = []), n.path.unshift(e), n;
  });
}
function ye(e) {
  return typeof e == "string" ? e : e?.message;
}
function Y(e, t, n) {
  const r = { ...e, path: e.path ?? [] };
  if (!e.message) {
    const o = ye(e.inst?._zod.def?.error?.(e)) ?? ye(t?.error?.(e)) ?? ye(n.customError?.(e)) ?? ye(n.localeError?.(e)) ?? "Invalid input";
    r.message = o;
  }
  return delete r.inst, delete r.continue, t?.reportInput || delete r.input, r;
}
function at(e) {
  return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function he(...e) {
  const [t, n, r] = e;
  return typeof t == "string" ? {
    message: t,
    code: "custom",
    input: n,
    inst: r
  } : { ...t };
}
const pn = (e, t) => {
  e.name = "$ZodError", Object.defineProperty(e, "_zod", {
    value: e._zod,
    enumerable: !1
  }), Object.defineProperty(e, "issues", {
    value: t,
    enumerable: !1
  }), e.message = JSON.stringify(t, qe, 2), Object.defineProperty(e, "toString", {
    value: () => e.message,
    enumerable: !1
  });
}, un = u("$ZodError", pn), dn = u("$ZodError", pn, { Parent: Error });
function Jr(e, t = (n) => n.message) {
  const n = {}, r = [];
  for (const o of e.issues)
    o.path.length > 0 ? (n[o.path[0]] = n[o.path[0]] || [], n[o.path[0]].push(t(o))) : r.push(t(o));
  return { formErrors: r, fieldErrors: n };
}
function Vr(e, t = (n) => n.message) {
  const n = { _errors: [] }, r = (o) => {
    for (const a of o.issues)
      if (a.code === "invalid_union" && a.errors.length)
        a.errors.map((i) => r({ issues: i }));
      else if (a.code === "invalid_key")
        r({ issues: a.issues });
      else if (a.code === "invalid_element")
        r({ issues: a.issues });
      else if (a.path.length === 0)
        n._errors.push(t(a));
      else {
        let i = n, c = 0;
        for (; c < a.path.length; ) {
          const p = a.path[c];
          c === a.path.length - 1 ? (i[p] = i[p] || { _errors: [] }, i[p]._errors.push(t(a))) : i[p] = i[p] || { _errors: [] }, i = i[p], c++;
        }
      }
  };
  return r(e), n;
}
const st = (e) => (t, n, r, o) => {
  const a = r ? Object.assign(r, { async: !1 }) : { async: !1 }, i = t._zod.run({ value: n, issues: [] }, a);
  if (i instanceof Promise)
    throw new se();
  if (i.issues.length) {
    const c = new (o?.Err ?? e)(i.issues.map((p) => Y(p, a, H())));
    throw cn(c, o?.callee), c;
  }
  return i.value;
}, ct = (e) => async (t, n, r, o) => {
  const a = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let i = t._zod.run({ value: n, issues: [] }, a);
  if (i instanceof Promise && (i = await i), i.issues.length) {
    const c = new (o?.Err ?? e)(i.issues.map((p) => Y(p, a, H())));
    throw cn(c, o?.callee), c;
  }
  return i.value;
}, je = (e) => (t, n, r) => {
  const o = r ? { ...r, async: !1 } : { async: !1 }, a = t._zod.run({ value: n, issues: [] }, o);
  if (a instanceof Promise)
    throw new se();
  return a.issues.length ? {
    success: !1,
    error: new (e ?? un)(a.issues.map((i) => Y(i, o, H())))
  } : { success: !0, data: a.value };
}, Kr = /* @__PURE__ */ je(dn), ze = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let a = t._zod.run({ value: n, issues: [] }, o);
  return a instanceof Promise && (a = await a), a.issues.length ? {
    success: !1,
    error: new e(a.issues.map((i) => Y(i, o, H())))
  } : { success: !0, data: a.value };
}, Wr = /* @__PURE__ */ ze(dn), Hr = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return st(e)(t, n, o);
}, Xr = (e) => (t, n, r) => st(e)(t, n, r), Yr = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return ct(e)(t, n, o);
}, Qr = (e) => async (t, n, r) => ct(e)(t, n, r), eo = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return je(e)(t, n, o);
}, to = (e) => (t, n, r) => je(e)(t, n, r), no = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return ze(e)(t, n, o);
}, ro = (e) => async (t, n, r) => ze(e)(t, n, r), oo = /^[cC][^\s-]{8,}$/, io = /^[0-9a-z]+$/, ao = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, so = /^[0-9a-vA-V]{20}$/, co = /^[A-Za-z0-9]{27}$/, lo = /^[a-zA-Z0-9_-]{21}$/, po = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, uo = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, gt = (e) => e ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, mo = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, fo = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function ho() {
  return new RegExp(fo, "u");
}
const go = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, yo = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, bo = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, _o = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, vo = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, mn = /^[A-Za-z0-9_-]*$/, Io = /^\+[1-9]\d{6,14}$/, fn = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", wo = /* @__PURE__ */ new RegExp(`^${fn}$`);
function hn(e) {
  const t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function ko(e) {
  return new RegExp(`^${hn(e)}$`);
}
function To(e) {
  const t = hn({ precision: e.precision }), n = ["Z"];
  e.local && n.push(""), e.offset && n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const r = `${t}(?:${n.join("|")})`;
  return new RegExp(`^${fn}T(?:${r})$`);
}
const So = (e) => {
  const t = e ? `[\\s\\S]{${e?.minimum ?? 0},${e?.maximum ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${t}$`);
}, Po = /^-?\d+$/, gn = /^-?\d+(?:\.\d+)?$/, Ao = /^(?:true|false)$/i, xo = /^null$/i, Eo = /^[^A-Z]*$/, jo = /^[^a-z]*$/, F = /* @__PURE__ */ u("$ZodCheck", (e, t) => {
  var n;
  e._zod ?? (e._zod = {}), e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), yn = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, bn = /* @__PURE__ */ u("$ZodCheckLessThan", (e, t) => {
  F.init(e, t);
  const n = yn[typeof t.value];
  e._zod.onattach.push((r) => {
    const o = r._zod.bag, a = (t.inclusive ? o.maximum : o.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    t.value < a && (t.inclusive ? o.maximum = t.value : o.exclusiveMaximum = t.value);
  }), e._zod.check = (r) => {
    (t.inclusive ? r.value <= t.value : r.value < t.value) || r.issues.push({
      origin: n,
      code: "too_big",
      maximum: typeof t.value == "object" ? t.value.getTime() : t.value,
      input: r.value,
      inclusive: t.inclusive,
      inst: e,
      continue: !t.abort
    });
  };
}), _n = /* @__PURE__ */ u("$ZodCheckGreaterThan", (e, t) => {
  F.init(e, t);
  const n = yn[typeof t.value];
  e._zod.onattach.push((r) => {
    const o = r._zod.bag, a = (t.inclusive ? o.minimum : o.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    t.value > a && (t.inclusive ? o.minimum = t.value : o.exclusiveMinimum = t.value);
  }), e._zod.check = (r) => {
    (t.inclusive ? r.value >= t.value : r.value > t.value) || r.issues.push({
      origin: n,
      code: "too_small",
      minimum: typeof t.value == "object" ? t.value.getTime() : t.value,
      input: r.value,
      inclusive: t.inclusive,
      inst: e,
      continue: !t.abort
    });
  };
}), zo = /* @__PURE__ */ u("$ZodCheckMultipleOf", (e, t) => {
  F.init(e, t), e._zod.onattach.push((n) => {
    var r;
    (r = n._zod.bag).multipleOf ?? (r.multipleOf = t.value);
  }), e._zod.check = (n) => {
    if (typeof n.value != typeof t.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof n.value == "bigint" ? n.value % t.value === BigInt(0) : Dr(n.value, t.value) === 0) || n.issues.push({
      origin: typeof n.value,
      code: "not_multiple_of",
      divisor: t.value,
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Oo = /* @__PURE__ */ u("$ZodCheckNumberFormat", (e, t) => {
  F.init(e, t), t.format = t.format || "float64";
  const n = t.format?.includes("int"), r = n ? "int" : "number", [o, a] = Lr[t.format];
  e._zod.onattach.push((i) => {
    const c = i._zod.bag;
    c.format = t.format, c.minimum = o, c.maximum = a, n && (c.pattern = Po);
  }), e._zod.check = (i) => {
    const c = i.value;
    if (n) {
      if (!Number.isInteger(c)) {
        i.issues.push({
          expected: r,
          format: t.format,
          code: "invalid_type",
          continue: !1,
          input: c,
          inst: e
        });
        return;
      }
      if (!Number.isSafeInteger(c)) {
        c > 0 ? i.issues.push({
          input: c,
          code: "too_big",
          maximum: Number.MAX_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: e,
          origin: r,
          inclusive: !0,
          continue: !t.abort
        }) : i.issues.push({
          input: c,
          code: "too_small",
          minimum: Number.MIN_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: e,
          origin: r,
          inclusive: !0,
          continue: !t.abort
        });
        return;
      }
    }
    c < o && i.issues.push({
      origin: "number",
      input: c,
      code: "too_small",
      minimum: o,
      inclusive: !0,
      inst: e,
      continue: !t.abort
    }), c > a && i.issues.push({
      origin: "number",
      input: c,
      code: "too_big",
      maximum: a,
      inclusive: !0,
      inst: e,
      continue: !t.abort
    });
  };
}), Do = /* @__PURE__ */ u("$ZodCheckMaxLength", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !ot(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    t.maximum < o && (r._zod.bag.maximum = t.maximum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length <= t.maximum)
      return;
    const i = at(o);
    r.issues.push({
      origin: i,
      code: "too_big",
      maximum: t.maximum,
      inclusive: !0,
      input: o,
      inst: e,
      continue: !t.abort
    });
  };
}), No = /* @__PURE__ */ u("$ZodCheckMinLength", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !ot(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    t.minimum > o && (r._zod.bag.minimum = t.minimum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length >= t.minimum)
      return;
    const i = at(o);
    r.issues.push({
      origin: i,
      code: "too_small",
      minimum: t.minimum,
      inclusive: !0,
      input: o,
      inst: e,
      continue: !t.abort
    });
  };
}), $o = /* @__PURE__ */ u("$ZodCheckLengthEquals", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !ot(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.minimum = t.length, o.maximum = t.length, o.length = t.length;
  }), e._zod.check = (r) => {
    const o = r.value, a = o.length;
    if (a === t.length)
      return;
    const i = at(o), c = a > t.length;
    r.issues.push({
      origin: i,
      ...c ? { code: "too_big", maximum: t.length } : { code: "too_small", minimum: t.length },
      inclusive: !0,
      exact: !0,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Oe = /* @__PURE__ */ u("$ZodCheckStringFormat", (e, t) => {
  var n, r;
  F.init(e, t), e._zod.onattach.push((o) => {
    const a = o._zod.bag;
    a.format = t.format, t.pattern && (a.patterns ?? (a.patterns = /* @__PURE__ */ new Set()), a.patterns.add(t.pattern));
  }), t.pattern ? (n = e._zod).check ?? (n.check = (o) => {
    t.pattern.lastIndex = 0, !t.pattern.test(o.value) && o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t.format,
      input: o.value,
      ...t.pattern ? { pattern: t.pattern.toString() } : {},
      inst: e,
      continue: !t.abort
    });
  }) : (r = e._zod).check ?? (r.check = () => {
  });
}), Co = /* @__PURE__ */ u("$ZodCheckRegex", (e, t) => {
  Oe.init(e, t), e._zod.check = (n) => {
    t.pattern.lastIndex = 0, !t.pattern.test(n.value) && n.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n.value,
      pattern: t.pattern.toString(),
      inst: e,
      continue: !t.abort
    });
  };
}), Ro = /* @__PURE__ */ u("$ZodCheckLowerCase", (e, t) => {
  t.pattern ?? (t.pattern = Eo), Oe.init(e, t);
}), Lo = /* @__PURE__ */ u("$ZodCheckUpperCase", (e, t) => {
  t.pattern ?? (t.pattern = jo), Oe.init(e, t);
}), Mo = /* @__PURE__ */ u("$ZodCheckIncludes", (e, t) => {
  F.init(e, t);
  const n = pe(t.includes), r = new RegExp(typeof t.position == "number" ? `^.{${t.position}}${n}` : n);
  t.pattern = r, e._zod.onattach.push((o) => {
    const a = o._zod.bag;
    a.patterns ?? (a.patterns = /* @__PURE__ */ new Set()), a.patterns.add(r);
  }), e._zod.check = (o) => {
    o.value.includes(t.includes, t.position) || o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t.includes,
      input: o.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Zo = /* @__PURE__ */ u("$ZodCheckStartsWith", (e, t) => {
  F.init(e, t);
  const n = new RegExp(`^${pe(t.prefix)}.*`);
  t.pattern ?? (t.pattern = n), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.patterns ?? (o.patterns = /* @__PURE__ */ new Set()), o.patterns.add(n);
  }), e._zod.check = (r) => {
    r.value.startsWith(t.prefix) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: t.prefix,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Uo = /* @__PURE__ */ u("$ZodCheckEndsWith", (e, t) => {
  F.init(e, t);
  const n = new RegExp(`.*${pe(t.suffix)}$`);
  t.pattern ?? (t.pattern = n), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.patterns ?? (o.patterns = /* @__PURE__ */ new Set()), o.patterns.add(n);
  }), e._zod.check = (r) => {
    r.value.endsWith(t.suffix) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: t.suffix,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), qo = /* @__PURE__ */ u("$ZodCheckOverwrite", (e, t) => {
  F.init(e, t), e._zod.check = (n) => {
    n.value = t.tx(n.value);
  };
});
class Bo {
  constructor(t = []) {
    this.content = [], this.indent = 0, this && (this.args = t);
  }
  indented(t) {
    this.indent += 1, t(this), this.indent -= 1;
  }
  write(t) {
    if (typeof t == "function") {
      t(this, { execution: "sync" }), t(this, { execution: "async" });
      return;
    }
    const r = t.split(`
`).filter((i) => i), o = Math.min(...r.map((i) => i.length - i.trimStart().length)), a = r.map((i) => i.slice(o)).map((i) => " ".repeat(this.indent * 2) + i);
    for (const i of a)
      this.content.push(i);
  }
  compile() {
    const t = Function, n = this?.args, o = [...(this?.content ?? [""]).map((a) => `  ${a}`)];
    return new t(...n, o.join(`
`));
  }
}
const Fo = {
  major: 4,
  minor: 3,
  patch: 6
}, A = /* @__PURE__ */ u("$ZodType", (e, t) => {
  var n;
  e ?? (e = {}), e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = Fo;
  const r = [...e._zod.def.checks ?? []];
  e._zod.traits.has("$ZodCheck") && r.unshift(e);
  for (const o of r)
    for (const a of o._zod.onattach)
      a(e);
  if (r.length === 0)
    (n = e._zod).deferred ?? (n.deferred = []), e._zod.deferred?.push(() => {
      e._zod.run = e._zod.parse;
    });
  else {
    const o = (i, c, p) => {
      let l = ie(i), h;
      for (const y of c) {
        if (y._zod.def.when) {
          if (!y._zod.def.when(i))
            continue;
        } else if (l)
          continue;
        const v = i.issues.length, I = y._zod.check(i);
        if (I instanceof Promise && p?.async === !1)
          throw new se();
        if (h || I instanceof Promise)
          h = (h ?? Promise.resolve()).then(async () => {
            await I, i.issues.length !== v && (l || (l = ie(i, v)));
          });
        else {
          if (i.issues.length === v)
            continue;
          l || (l = ie(i, v));
        }
      }
      return h ? h.then(() => i) : i;
    }, a = (i, c, p) => {
      if (ie(i))
        return i.aborted = !0, i;
      const l = o(c, r, p);
      if (l instanceof Promise) {
        if (p.async === !1)
          throw new se();
        return l.then((h) => e._zod.parse(h, p));
      }
      return e._zod.parse(l, p);
    };
    e._zod.run = (i, c) => {
      if (c.skipChecks)
        return e._zod.parse(i, c);
      if (c.direction === "backward") {
        const l = e._zod.parse({ value: i.value, issues: [] }, { ...c, skipChecks: !0 });
        return l instanceof Promise ? l.then((h) => a(h, i, c)) : a(l, i, c);
      }
      const p = e._zod.parse(i, c);
      if (p instanceof Promise) {
        if (c.async === !1)
          throw new se();
        return p.then((l) => o(l, r, c));
      }
      return o(p, r, c);
    };
  }
  S(e, "~standard", () => ({
    validate: (o) => {
      try {
        const a = Kr(e, o);
        return a.success ? { value: a.data } : { issues: a.error?.issues };
      } catch {
        return Wr(e, o).then((i) => i.success ? { value: i.data } : { issues: i.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), lt = /* @__PURE__ */ u("$ZodString", (e, t) => {
  A.init(e, t), e._zod.pattern = [...e?._zod.bag?.patterns ?? []].pop() ?? So(e._zod.bag), e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = String(n.value);
      } catch {
      }
    return typeof n.value == "string" || n.issues.push({
      expected: "string",
      code: "invalid_type",
      input: n.value,
      inst: e
    }), n;
  };
}), E = /* @__PURE__ */ u("$ZodStringFormat", (e, t) => {
  Oe.init(e, t), lt.init(e, t);
}), Go = /* @__PURE__ */ u("$ZodGUID", (e, t) => {
  t.pattern ?? (t.pattern = uo), E.init(e, t);
}), Jo = /* @__PURE__ */ u("$ZodUUID", (e, t) => {
  if (t.version) {
    const r = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[t.version];
    if (r === void 0)
      throw new Error(`Invalid UUID version: "${t.version}"`);
    t.pattern ?? (t.pattern = gt(r));
  } else
    t.pattern ?? (t.pattern = gt());
  E.init(e, t);
}), Vo = /* @__PURE__ */ u("$ZodEmail", (e, t) => {
  t.pattern ?? (t.pattern = mo), E.init(e, t);
}), Ko = /* @__PURE__ */ u("$ZodURL", (e, t) => {
  E.init(e, t), e._zod.check = (n) => {
    try {
      const r = n.value.trim(), o = new URL(r);
      t.hostname && (t.hostname.lastIndex = 0, t.hostname.test(o.hostname) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: t.hostname.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      })), t.protocol && (t.protocol.lastIndex = 0, t.protocol.test(o.protocol.endsWith(":") ? o.protocol.slice(0, -1) : o.protocol) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t.protocol.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      })), t.normalize ? n.value = o.href : n.value = r;
      return;
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "url",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
}), Wo = /* @__PURE__ */ u("$ZodEmoji", (e, t) => {
  t.pattern ?? (t.pattern = ho()), E.init(e, t);
}), Ho = /* @__PURE__ */ u("$ZodNanoID", (e, t) => {
  t.pattern ?? (t.pattern = lo), E.init(e, t);
}), Xo = /* @__PURE__ */ u("$ZodCUID", (e, t) => {
  t.pattern ?? (t.pattern = oo), E.init(e, t);
}), Yo = /* @__PURE__ */ u("$ZodCUID2", (e, t) => {
  t.pattern ?? (t.pattern = io), E.init(e, t);
}), Qo = /* @__PURE__ */ u("$ZodULID", (e, t) => {
  t.pattern ?? (t.pattern = ao), E.init(e, t);
}), ei = /* @__PURE__ */ u("$ZodXID", (e, t) => {
  t.pattern ?? (t.pattern = so), E.init(e, t);
}), ti = /* @__PURE__ */ u("$ZodKSUID", (e, t) => {
  t.pattern ?? (t.pattern = co), E.init(e, t);
}), ni = /* @__PURE__ */ u("$ZodISODateTime", (e, t) => {
  t.pattern ?? (t.pattern = To(t)), E.init(e, t);
}), ri = /* @__PURE__ */ u("$ZodISODate", (e, t) => {
  t.pattern ?? (t.pattern = wo), E.init(e, t);
}), oi = /* @__PURE__ */ u("$ZodISOTime", (e, t) => {
  t.pattern ?? (t.pattern = ko(t)), E.init(e, t);
}), ii = /* @__PURE__ */ u("$ZodISODuration", (e, t) => {
  t.pattern ?? (t.pattern = po), E.init(e, t);
}), ai = /* @__PURE__ */ u("$ZodIPv4", (e, t) => {
  t.pattern ?? (t.pattern = go), E.init(e, t), e._zod.bag.format = "ipv4";
}), si = /* @__PURE__ */ u("$ZodIPv6", (e, t) => {
  t.pattern ?? (t.pattern = yo), E.init(e, t), e._zod.bag.format = "ipv6", e._zod.check = (n) => {
    try {
      new URL(`http://[${n.value}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
}), ci = /* @__PURE__ */ u("$ZodCIDRv4", (e, t) => {
  t.pattern ?? (t.pattern = bo), E.init(e, t);
}), li = /* @__PURE__ */ u("$ZodCIDRv6", (e, t) => {
  t.pattern ?? (t.pattern = _o), E.init(e, t), e._zod.check = (n) => {
    const r = n.value.split("/");
    try {
      if (r.length !== 2)
        throw new Error();
      const [o, a] = r;
      if (!a)
        throw new Error();
      const i = Number(a);
      if (`${i}` !== a)
        throw new Error();
      if (i < 0 || i > 128)
        throw new Error();
      new URL(`http://[${o}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
});
function vn(e) {
  if (e === "")
    return !0;
  if (e.length % 4 !== 0)
    return !1;
  try {
    return atob(e), !0;
  } catch {
    return !1;
  }
}
const pi = /* @__PURE__ */ u("$ZodBase64", (e, t) => {
  t.pattern ?? (t.pattern = vo), E.init(e, t), e._zod.bag.contentEncoding = "base64", e._zod.check = (n) => {
    vn(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
});
function ui(e) {
  if (!mn.test(e))
    return !1;
  const t = e.replace(/[-_]/g, (r) => r === "-" ? "+" : "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return vn(n);
}
const di = /* @__PURE__ */ u("$ZodBase64URL", (e, t) => {
  t.pattern ?? (t.pattern = mn), E.init(e, t), e._zod.bag.contentEncoding = "base64url", e._zod.check = (n) => {
    ui(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), mi = /* @__PURE__ */ u("$ZodE164", (e, t) => {
  t.pattern ?? (t.pattern = Io), E.init(e, t);
});
function fi(e, t = null) {
  try {
    const n = e.split(".");
    if (n.length !== 3)
      return !1;
    const [r] = n;
    if (!r)
      return !1;
    const o = JSON.parse(atob(r));
    return !("typ" in o && o?.typ !== "JWT" || !o.alg || t && (!("alg" in o) || o.alg !== t));
  } catch {
    return !1;
  }
}
const hi = /* @__PURE__ */ u("$ZodJWT", (e, t) => {
  E.init(e, t), e._zod.check = (n) => {
    fi(n.value, t.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), In = /* @__PURE__ */ u("$ZodNumber", (e, t) => {
  A.init(e, t), e._zod.pattern = e._zod.bag.pattern ?? gn, e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = Number(n.value);
      } catch {
      }
    const o = n.value;
    if (typeof o == "number" && !Number.isNaN(o) && Number.isFinite(o))
      return n;
    const a = typeof o == "number" ? Number.isNaN(o) ? "NaN" : Number.isFinite(o) ? void 0 : "Infinity" : void 0;
    return n.issues.push({
      expected: "number",
      code: "invalid_type",
      input: o,
      inst: e,
      ...a ? { received: a } : {}
    }), n;
  };
}), gi = /* @__PURE__ */ u("$ZodNumberFormat", (e, t) => {
  Oo.init(e, t), In.init(e, t);
}), yi = /* @__PURE__ */ u("$ZodBoolean", (e, t) => {
  A.init(e, t), e._zod.pattern = Ao, e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = !!n.value;
      } catch {
      }
    const o = n.value;
    return typeof o == "boolean" || n.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input: o,
      inst: e
    }), n;
  };
}), bi = /* @__PURE__ */ u("$ZodNull", (e, t) => {
  A.init(e, t), e._zod.pattern = xo, e._zod.values = /* @__PURE__ */ new Set([null]), e._zod.parse = (n, r) => {
    const o = n.value;
    return o === null || n.issues.push({
      expected: "null",
      code: "invalid_type",
      input: o,
      inst: e
    }), n;
  };
}), _i = /* @__PURE__ */ u("$ZodUnknown", (e, t) => {
  A.init(e, t), e._zod.parse = (n) => n;
}), vi = /* @__PURE__ */ u("$ZodNever", (e, t) => {
  A.init(e, t), e._zod.parse = (n, r) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: e
  }), n);
});
function yt(e, t, n) {
  e.issues.length && t.issues.push(...ae(n, e.issues)), t.value[n] = e.value;
}
const Ii = /* @__PURE__ */ u("$ZodArray", (e, t) => {
  A.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value;
    if (!Array.isArray(o))
      return n.issues.push({
        expected: "array",
        code: "invalid_type",
        input: o,
        inst: e
      }), n;
    n.value = Array(o.length);
    const a = [];
    for (let i = 0; i < o.length; i++) {
      const c = o[i], p = t.element._zod.run({
        value: c,
        issues: []
      }, r);
      p instanceof Promise ? a.push(p.then((l) => yt(l, n, i))) : yt(p, n, i);
    }
    return a.length ? Promise.all(a).then(() => n) : n;
  };
});
function Ie(e, t, n, r, o) {
  if (e.issues.length) {
    if (o && !(n in r))
      return;
    t.issues.push(...ae(n, e.issues));
  }
  e.value === void 0 ? n in r && (t.value[n] = void 0) : t.value[n] = e.value;
}
function wn(e) {
  const t = Object.keys(e.shape);
  for (const r of t)
    if (!e.shape?.[r]?._zod?.traits?.has("$ZodType"))
      throw new Error(`Invalid element at key "${r}": expected a Zod schema`);
  const n = Rr(e.shape);
  return {
    ...e,
    keys: t,
    keySet: new Set(t),
    numKeys: t.length,
    optionalKeys: new Set(n)
  };
}
function kn(e, t, n, r, o, a) {
  const i = [], c = o.keySet, p = o.catchall._zod, l = p.def.type, h = p.optout === "optional";
  for (const y in t) {
    if (c.has(y))
      continue;
    if (l === "never") {
      i.push(y);
      continue;
    }
    const v = p.run({ value: t[y], issues: [] }, r);
    v instanceof Promise ? e.push(v.then((I) => Ie(I, n, y, t, h))) : Ie(v, n, y, t, h);
  }
  return i.length && n.issues.push({
    code: "unrecognized_keys",
    keys: i,
    input: t,
    inst: a
  }), e.length ? Promise.all(e).then(() => n) : n;
}
const wi = /* @__PURE__ */ u("$ZodObject", (e, t) => {
  if (A.init(e, t), !Object.getOwnPropertyDescriptor(t, "shape")?.get) {
    const c = t.shape;
    Object.defineProperty(t, "shape", {
      get: () => {
        const p = { ...c };
        return Object.defineProperty(t, "shape", {
          value: p
        }), p;
      }
    });
  }
  const r = rt(() => wn(t));
  S(e._zod, "propValues", () => {
    const c = t.shape, p = {};
    for (const l in c) {
      const h = c[l]._zod;
      if (h.values) {
        p[l] ?? (p[l] = /* @__PURE__ */ new Set());
        for (const y of h.values)
          p[l].add(y);
      }
    }
    return p;
  });
  const o = ve, a = t.catchall;
  let i;
  e._zod.parse = (c, p) => {
    i ?? (i = r.value);
    const l = c.value;
    if (!o(l))
      return c.issues.push({
        expected: "object",
        code: "invalid_type",
        input: l,
        inst: e
      }), c;
    c.value = {};
    const h = [], y = i.shape;
    for (const v of i.keys) {
      const I = y[v], L = I._zod.optout === "optional", $ = I._zod.run({ value: l[v], issues: [] }, p);
      $ instanceof Promise ? h.push($.then((M) => Ie(M, c, v, l, L))) : Ie($, c, v, l, L);
    }
    return a ? kn(h, l, c, p, r.value, e) : h.length ? Promise.all(h).then(() => c) : c;
  };
}), ki = /* @__PURE__ */ u("$ZodObjectJIT", (e, t) => {
  wi.init(e, t);
  const n = e._zod.parse, r = rt(() => wn(t)), o = (v) => {
    const I = new Bo(["shape", "payload", "ctx"]), L = r.value, $ = (W) => {
      const B = ht(W);
      return `shape[${B}]._zod.run({ value: input[${B}], issues: [] }, ctx)`;
    };
    I.write("const input = payload.value;");
    const M = /* @__PURE__ */ Object.create(null);
    let er = 0;
    for (const W of L.keys)
      M[W] = `key_${er++}`;
    I.write("const newResult = {};");
    for (const W of L.keys) {
      const B = M[W], V = ht(W), nr = v[W]?._zod?.optout === "optional";
      I.write(`const ${B} = ${$(W)};`), nr ? I.write(`
        if (${B}.issues.length) {
          if (${V} in input) {
            payload.issues = payload.issues.concat(${B}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${V}, ...iss.path] : [${V}]
            })));
          }
        }

        if (${B}.value === undefined) {
          if (${V} in input) {
            newResult[${V}] = undefined;
          }
        } else {
          newResult[${V}] = ${B}.value;
        }

      `) : I.write(`
        if (${B}.issues.length) {
          payload.issues = payload.issues.concat(${B}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${V}, ...iss.path] : [${V}]
          })));
        }

        if (${B}.value === undefined) {
          if (${V} in input) {
            newResult[${V}] = undefined;
          }
        } else {
          newResult[${V}] = ${B}.value;
        }

      `);
    }
    I.write("payload.value = newResult;"), I.write("return payload;");
    const tr = I.compile();
    return (W, B) => tr(v, W, B);
  };
  let a;
  const i = ve, c = !Ue.jitless, l = c && $r.value, h = t.catchall;
  let y;
  e._zod.parse = (v, I) => {
    y ?? (y = r.value);
    const L = v.value;
    return i(L) ? c && l && I?.async === !1 && I.jitless !== !0 ? (a || (a = o(t.shape)), v = a(v, I), h ? kn([], L, v, I, y, e) : v) : n(v, I) : (v.issues.push({
      expected: "object",
      code: "invalid_type",
      input: L,
      inst: e
    }), v);
  };
});
function bt(e, t, n, r) {
  for (const a of e)
    if (a.issues.length === 0)
      return t.value = a.value, t;
  const o = e.filter((a) => !ie(a));
  return o.length === 1 ? (t.value = o[0].value, o[0]) : (t.issues.push({
    code: "invalid_union",
    input: t.value,
    inst: n,
    errors: e.map((a) => a.issues.map((i) => Y(i, r, H())))
  }), t);
}
const Ti = /* @__PURE__ */ u("$ZodUnion", (e, t) => {
  A.init(e, t), S(e._zod, "optin", () => t.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0), S(e._zod, "optout", () => t.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0), S(e._zod, "values", () => {
    if (t.options.every((o) => o._zod.values))
      return new Set(t.options.flatMap((o) => Array.from(o._zod.values)));
  }), S(e._zod, "pattern", () => {
    if (t.options.every((o) => o._zod.pattern)) {
      const o = t.options.map((a) => a._zod.pattern);
      return new RegExp(`^(${o.map((a) => it(a.source)).join("|")})$`);
    }
  });
  const n = t.options.length === 1, r = t.options[0]._zod.run;
  e._zod.parse = (o, a) => {
    if (n)
      return r(o, a);
    let i = !1;
    const c = [];
    for (const p of t.options) {
      const l = p._zod.run({
        value: o.value,
        issues: []
      }, a);
      if (l instanceof Promise)
        c.push(l), i = !0;
      else {
        if (l.issues.length === 0)
          return l;
        c.push(l);
      }
    }
    return i ? Promise.all(c).then((p) => bt(p, o, e, a)) : bt(c, o, e, a);
  };
}), Si = /* @__PURE__ */ u("$ZodIntersection", (e, t) => {
  A.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value, a = t.left._zod.run({ value: o, issues: [] }, r), i = t.right._zod.run({ value: o, issues: [] }, r);
    return a instanceof Promise || i instanceof Promise ? Promise.all([a, i]).then(([p, l]) => _t(n, p, l)) : _t(n, a, i);
  };
});
function Be(e, t) {
  if (e === t)
    return { valid: !0, data: e };
  if (e instanceof Date && t instanceof Date && +e == +t)
    return { valid: !0, data: e };
  if (le(e) && le(t)) {
    const n = Object.keys(t), r = Object.keys(e).filter((a) => n.indexOf(a) !== -1), o = { ...e, ...t };
    for (const a of r) {
      const i = Be(e[a], t[a]);
      if (!i.valid)
        return {
          valid: !1,
          mergeErrorPath: [a, ...i.mergeErrorPath]
        };
      o[a] = i.data;
    }
    return { valid: !0, data: o };
  }
  if (Array.isArray(e) && Array.isArray(t)) {
    if (e.length !== t.length)
      return { valid: !1, mergeErrorPath: [] };
    const n = [];
    for (let r = 0; r < e.length; r++) {
      const o = e[r], a = t[r], i = Be(o, a);
      if (!i.valid)
        return {
          valid: !1,
          mergeErrorPath: [r, ...i.mergeErrorPath]
        };
      n.push(i.data);
    }
    return { valid: !0, data: n };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function _t(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  let o;
  for (const c of t.issues)
    if (c.code === "unrecognized_keys") {
      o ?? (o = c);
      for (const p of c.keys)
        r.has(p) || r.set(p, {}), r.get(p).l = !0;
    } else
      e.issues.push(c);
  for (const c of n.issues)
    if (c.code === "unrecognized_keys")
      for (const p of c.keys)
        r.has(p) || r.set(p, {}), r.get(p).r = !0;
    else
      e.issues.push(c);
  const a = [...r].filter(([, c]) => c.l && c.r).map(([c]) => c);
  if (a.length && o && e.issues.push({ ...o, keys: a }), ie(e))
    return e;
  const i = Be(t.value, n.value);
  if (!i.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(i.mergeErrorPath)}`);
  return e.value = i.data, e;
}
const Pi = /* @__PURE__ */ u("$ZodRecord", (e, t) => {
  A.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value;
    if (!le(o))
      return n.issues.push({
        expected: "record",
        code: "invalid_type",
        input: o,
        inst: e
      }), n;
    const a = [], i = t.keyType._zod.values;
    if (i) {
      n.value = {};
      const c = /* @__PURE__ */ new Set();
      for (const l of i)
        if (typeof l == "string" || typeof l == "number" || typeof l == "symbol") {
          c.add(typeof l == "number" ? l.toString() : l);
          const h = t.valueType._zod.run({ value: o[l], issues: [] }, r);
          h instanceof Promise ? a.push(h.then((y) => {
            y.issues.length && n.issues.push(...ae(l, y.issues)), n.value[l] = y.value;
          })) : (h.issues.length && n.issues.push(...ae(l, h.issues)), n.value[l] = h.value);
        }
      let p;
      for (const l in o)
        c.has(l) || (p = p ?? [], p.push(l));
      p && p.length > 0 && n.issues.push({
        code: "unrecognized_keys",
        input: o,
        inst: e,
        keys: p
      });
    } else {
      n.value = {};
      for (const c of Reflect.ownKeys(o)) {
        if (c === "__proto__")
          continue;
        let p = t.keyType._zod.run({ value: c, issues: [] }, r);
        if (p instanceof Promise)
          throw new Error("Async schemas not supported in object keys currently");
        if (typeof c == "string" && gn.test(c) && p.issues.length) {
          const y = t.keyType._zod.run({ value: Number(c), issues: [] }, r);
          if (y instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          y.issues.length === 0 && (p = y);
        }
        if (p.issues.length) {
          t.mode === "loose" ? n.value[c] = o[c] : n.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: p.issues.map((y) => Y(y, r, H())),
            input: c,
            path: [c],
            inst: e
          });
          continue;
        }
        const h = t.valueType._zod.run({ value: o[c], issues: [] }, r);
        h instanceof Promise ? a.push(h.then((y) => {
          y.issues.length && n.issues.push(...ae(c, y.issues)), n.value[p.value] = y.value;
        })) : (h.issues.length && n.issues.push(...ae(c, h.issues)), n.value[p.value] = h.value);
      }
    }
    return a.length ? Promise.all(a).then(() => n) : n;
  };
}), Ai = /* @__PURE__ */ u("$ZodEnum", (e, t) => {
  A.init(e, t);
  const n = sn(t.entries), r = new Set(n);
  e._zod.values = r, e._zod.pattern = new RegExp(`^(${n.filter((o) => Cr.has(typeof o)).map((o) => typeof o == "string" ? pe(o) : o.toString()).join("|")})$`), e._zod.parse = (o, a) => {
    const i = o.value;
    return r.has(i) || o.issues.push({
      code: "invalid_value",
      values: n,
      input: i,
      inst: e
    }), o;
  };
}), xi = /* @__PURE__ */ u("$ZodLiteral", (e, t) => {
  if (A.init(e, t), t.values.length === 0)
    throw new Error("Cannot create literal schema with no valid values");
  const n = new Set(t.values);
  e._zod.values = n, e._zod.pattern = new RegExp(`^(${t.values.map((r) => typeof r == "string" ? pe(r) : r ? pe(r.toString()) : String(r)).join("|")})$`), e._zod.parse = (r, o) => {
    const a = r.value;
    return n.has(a) || r.issues.push({
      code: "invalid_value",
      values: t.values,
      input: a,
      inst: e
    }), r;
  };
}), Ei = /* @__PURE__ */ u("$ZodTransform", (e, t) => {
  A.init(e, t), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new an(e.constructor.name);
    const o = t.transform(n.value, n);
    if (r.async)
      return (o instanceof Promise ? o : Promise.resolve(o)).then((i) => (n.value = i, n));
    if (o instanceof Promise)
      throw new se();
    return n.value = o, n;
  };
});
function vt(e, t) {
  return e.issues.length && t === void 0 ? { issues: [], value: void 0 } : e;
}
const Tn = /* @__PURE__ */ u("$ZodOptional", (e, t) => {
  A.init(e, t), e._zod.optin = "optional", e._zod.optout = "optional", S(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, void 0]) : void 0), S(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${it(n.source)})?$`) : void 0;
  }), e._zod.parse = (n, r) => {
    if (t.innerType._zod.optin === "optional") {
      const o = t.innerType._zod.run(n, r);
      return o instanceof Promise ? o.then((a) => vt(a, n.value)) : vt(o, n.value);
    }
    return n.value === void 0 ? n : t.innerType._zod.run(n, r);
  };
}), ji = /* @__PURE__ */ u("$ZodExactOptional", (e, t) => {
  Tn.init(e, t), S(e._zod, "values", () => t.innerType._zod.values), S(e._zod, "pattern", () => t.innerType._zod.pattern), e._zod.parse = (n, r) => t.innerType._zod.run(n, r);
}), zi = /* @__PURE__ */ u("$ZodNullable", (e, t) => {
  A.init(e, t), S(e._zod, "optin", () => t.innerType._zod.optin), S(e._zod, "optout", () => t.innerType._zod.optout), S(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${it(n.source)}|null)$`) : void 0;
  }), S(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, null]) : void 0), e._zod.parse = (n, r) => n.value === null ? n : t.innerType._zod.run(n, r);
}), Oi = /* @__PURE__ */ u("$ZodDefault", (e, t) => {
  A.init(e, t), e._zod.optin = "optional", S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    if (n.value === void 0)
      return n.value = t.defaultValue, n;
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => It(a, t)) : It(o, t);
  };
});
function It(e, t) {
  return e.value === void 0 && (e.value = t.defaultValue), e;
}
const Di = /* @__PURE__ */ u("$ZodPrefault", (e, t) => {
  A.init(e, t), e._zod.optin = "optional", S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => (r.direction === "backward" || n.value === void 0 && (n.value = t.defaultValue), t.innerType._zod.run(n, r));
}), Ni = /* @__PURE__ */ u("$ZodNonOptional", (e, t) => {
  A.init(e, t), S(e._zod, "values", () => {
    const n = t.innerType._zod.values;
    return n ? new Set([...n].filter((r) => r !== void 0)) : void 0;
  }), e._zod.parse = (n, r) => {
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => wt(a, e)) : wt(o, e);
  };
});
function wt(e, t) {
  return !e.issues.length && e.value === void 0 && e.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e.value,
    inst: t
  }), e;
}
const $i = /* @__PURE__ */ u("$ZodCatch", (e, t) => {
  A.init(e, t), S(e._zod, "optin", () => t.innerType._zod.optin), S(e._zod, "optout", () => t.innerType._zod.optout), S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => (n.value = a.value, a.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: a.issues.map((i) => Y(i, r, H()))
      },
      input: n.value
    }), n.issues = []), n)) : (n.value = o.value, o.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: o.issues.map((a) => Y(a, r, H()))
      },
      input: n.value
    }), n.issues = []), n);
  };
}), Ci = /* @__PURE__ */ u("$ZodPipe", (e, t) => {
  A.init(e, t), S(e._zod, "values", () => t.in._zod.values), S(e._zod, "optin", () => t.in._zod.optin), S(e._zod, "optout", () => t.out._zod.optout), S(e._zod, "propValues", () => t.in._zod.propValues), e._zod.parse = (n, r) => {
    if (r.direction === "backward") {
      const a = t.out._zod.run(n, r);
      return a instanceof Promise ? a.then((i) => be(i, t.in, r)) : be(a, t.in, r);
    }
    const o = t.in._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => be(a, t.out, r)) : be(o, t.out, r);
  };
});
function be(e, t, n) {
  return e.issues.length ? (e.aborted = !0, e) : t._zod.run({ value: e.value, issues: e.issues }, n);
}
const Ri = /* @__PURE__ */ u("$ZodReadonly", (e, t) => {
  A.init(e, t), S(e._zod, "propValues", () => t.innerType._zod.propValues), S(e._zod, "values", () => t.innerType._zod.values), S(e._zod, "optin", () => t.innerType?._zod?.optin), S(e._zod, "optout", () => t.innerType?._zod?.optout), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then(kt) : kt(o);
  };
});
function kt(e) {
  return e.value = Object.freeze(e.value), e;
}
const Li = /* @__PURE__ */ u("$ZodLazy", (e, t) => {
  A.init(e, t), S(e._zod, "innerType", () => t.getter()), S(e._zod, "pattern", () => e._zod.innerType?._zod?.pattern), S(e._zod, "propValues", () => e._zod.innerType?._zod?.propValues), S(e._zod, "optin", () => e._zod.innerType?._zod?.optin ?? void 0), S(e._zod, "optout", () => e._zod.innerType?._zod?.optout ?? void 0), e._zod.parse = (n, r) => e._zod.innerType._zod.run(n, r);
}), Mi = /* @__PURE__ */ u("$ZodCustom", (e, t) => {
  F.init(e, t), A.init(e, t), e._zod.parse = (n, r) => n, e._zod.check = (n) => {
    const r = n.value, o = t.fn(r);
    if (o instanceof Promise)
      return o.then((a) => Tt(a, n, r, e));
    Tt(o, n, r, e);
  };
});
function Tt(e, t, n, r) {
  if (!e) {
    const o = {
      code: "custom",
      input: n,
      inst: r,
      // incorporates params.error into issue reporting
      path: [...r._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !r._zod.def.abort
      // params: inst._zod.def.params,
    };
    r._zod.def.params && (o.params = r._zod.def.params), t.issues.push(he(o));
  }
}
var St;
class Zi {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(t, ...n) {
    const r = n[0];
    return this._map.set(t, r), r && typeof r == "object" && "id" in r && this._idmap.set(r.id, t), this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(t) {
    const n = this._map.get(t);
    return n && typeof n == "object" && "id" in n && this._idmap.delete(n.id), this._map.delete(t), this;
  }
  get(t) {
    const n = t._zod.parent;
    if (n) {
      const r = { ...this.get(n) ?? {} };
      delete r.id;
      const o = { ...r, ...this._map.get(t) };
      return Object.keys(o).length ? o : void 0;
    }
    return this._map.get(t);
  }
  has(t) {
    return this._map.has(t);
  }
}
function Ui() {
  return new Zi();
}
(St = globalThis).__zod_globalRegistry ?? (St.__zod_globalRegistry = Ui());
const fe = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function qi(e, t) {
  return new e({
    type: "string",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Bi(e, t) {
  return new e({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Pt(e, t) {
  return new e({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Fi(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Gi(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v4",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ji(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v6",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Vi(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v7",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ki(e, t) {
  return new e({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Wi(e, t) {
  return new e({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Hi(e, t) {
  return new e({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Xi(e, t) {
  return new e({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Yi(e, t) {
  return new e({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Qi(e, t) {
  return new e({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ea(e, t) {
  return new e({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ta(e, t) {
  return new e({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function na(e, t) {
  return new e({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ra(e, t) {
  return new e({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function oa(e, t) {
  return new e({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ia(e, t) {
  return new e({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function aa(e, t) {
  return new e({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function sa(e, t) {
  return new e({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ca(e, t) {
  return new e({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function la(e, t) {
  return new e({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function pa(e, t) {
  return new e({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ua(e, t) {
  return new e({
    type: "string",
    format: "date",
    check: "string_format",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function da(e, t) {
  return new e({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ma(e, t) {
  return new e({
    type: "string",
    format: "duration",
    check: "string_format",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function fa(e, t) {
  return new e({
    type: "number",
    checks: [],
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ha(e, t) {
  return new e({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ga(e, t) {
  return new e({
    type: "boolean",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ya(e, t) {
  return new e({
    type: "null",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ba(e) {
  return new e({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _a(e, t) {
  return new e({
    type: "never",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function At(e, t) {
  return new bn({
    check: "less_than",
    ..._(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Ne(e, t) {
  return new bn({
    check: "less_than",
    ..._(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function xt(e, t) {
  return new _n({
    check: "greater_than",
    ..._(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function $e(e, t) {
  return new _n({
    check: "greater_than",
    ..._(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Et(e, t) {
  return new zo({
    check: "multiple_of",
    ..._(t),
    value: e
  });
}
// @__NO_SIDE_EFFECTS__
function Sn(e, t) {
  return new Do({
    check: "max_length",
    ..._(t),
    maximum: e
  });
}
// @__NO_SIDE_EFFECTS__
function we(e, t) {
  return new No({
    check: "min_length",
    ..._(t),
    minimum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Pn(e, t) {
  return new $o({
    check: "length_equals",
    ..._(t),
    length: e
  });
}
// @__NO_SIDE_EFFECTS__
function va(e, t) {
  return new Co({
    check: "string_format",
    format: "regex",
    ..._(t),
    pattern: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ia(e) {
  return new Ro({
    check: "string_format",
    format: "lowercase",
    ..._(e)
  });
}
// @__NO_SIDE_EFFECTS__
function wa(e) {
  return new Lo({
    check: "string_format",
    format: "uppercase",
    ..._(e)
  });
}
// @__NO_SIDE_EFFECTS__
function ka(e, t) {
  return new Mo({
    check: "string_format",
    format: "includes",
    ..._(t),
    includes: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ta(e, t) {
  return new Zo({
    check: "string_format",
    format: "starts_with",
    ..._(t),
    prefix: e
  });
}
// @__NO_SIDE_EFFECTS__
function Sa(e, t) {
  return new Uo({
    check: "string_format",
    format: "ends_with",
    ..._(t),
    suffix: e
  });
}
// @__NO_SIDE_EFFECTS__
function me(e) {
  return new qo({
    check: "overwrite",
    tx: e
  });
}
// @__NO_SIDE_EFFECTS__
function Pa(e) {
  return /* @__PURE__ */ me((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function Aa() {
  return /* @__PURE__ */ me((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function xa() {
  return /* @__PURE__ */ me((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Ea() {
  return /* @__PURE__ */ me((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function ja() {
  return /* @__PURE__ */ me((e) => Nr(e));
}
// @__NO_SIDE_EFFECTS__
function za(e, t, n) {
  return new e({
    type: "array",
    element: t,
    // get element() {
    //   return element;
    // },
    ..._(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Oa(e, t, n) {
  return new e({
    type: "custom",
    check: "custom",
    fn: t,
    ..._(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Da(e) {
  const t = /* @__PURE__ */ Na((n) => (n.addIssue = (r) => {
    if (typeof r == "string")
      n.issues.push(he(r, n.value, t._zod.def));
    else {
      const o = r;
      o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), o.input ?? (o.input = n.value), o.inst ?? (o.inst = t), o.continue ?? (o.continue = !t._zod.def.abort), n.issues.push(he(o));
    }
  }, e(n.value, n)));
  return t;
}
// @__NO_SIDE_EFFECTS__
function Na(e, t) {
  const n = new F({
    check: "custom",
    ..._(t)
  });
  return n._zod.check = e, n;
}
function An(e) {
  let t = e?.target ?? "draft-2020-12";
  return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
    processors: e.processors ?? {},
    metadataRegistry: e?.metadata ?? fe,
    target: t,
    unrepresentable: e?.unrepresentable ?? "throw",
    override: e?.override ?? (() => {
    }),
    io: e?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: e?.cycles ?? "ref",
    reused: e?.reused ?? "inline",
    external: e?.external ?? void 0
  };
}
function D(e, t, n = { path: [], schemaPath: [] }) {
  var r;
  const o = e._zod.def, a = t.seen.get(e);
  if (a)
    return a.count++, n.schemaPath.includes(e) && (a.cycle = n.path), a.schema;
  const i = { schema: {}, count: 1, cycle: void 0, path: n.path };
  t.seen.set(e, i);
  const c = e._zod.toJSONSchema?.();
  if (c)
    i.schema = c;
  else {
    const h = {
      ...n,
      schemaPath: [...n.schemaPath, e],
      path: n.path
    };
    if (e._zod.processJSONSchema)
      e._zod.processJSONSchema(t, i.schema, h);
    else {
      const v = i.schema, I = t.processors[o.type];
      if (!I)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${o.type}`);
      I(e, t, v, h);
    }
    const y = e._zod.parent;
    y && (i.ref || (i.ref = y), D(y, t, h), t.seen.get(y).isParent = !0);
  }
  const p = t.metadataRegistry.get(e);
  return p && Object.assign(i.schema, p), t.io === "input" && U(e) && (delete i.schema.examples, delete i.schema.default), t.io === "input" && i.schema._prefault && ((r = i.schema).default ?? (r.default = i.schema._prefault)), delete i.schema._prefault, t.seen.get(e).schema;
}
function xn(e, t) {
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = /* @__PURE__ */ new Map();
  for (const i of e.seen.entries()) {
    const c = e.metadataRegistry.get(i[0])?.id;
    if (c) {
      const p = r.get(c);
      if (p && p !== i[0])
        throw new Error(`Duplicate schema id "${c}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      r.set(c, i[0]);
    }
  }
  const o = (i) => {
    const c = e.target === "draft-2020-12" ? "$defs" : "definitions";
    if (e.external) {
      const y = e.external.registry.get(i[0])?.id, v = e.external.uri ?? ((L) => L);
      if (y)
        return { ref: v(y) };
      const I = i[1].defId ?? i[1].schema.id ?? `schema${e.counter++}`;
      return i[1].defId = I, { defId: I, ref: `${v("__shared")}#/${c}/${I}` };
    }
    if (i[1] === n)
      return { ref: "#" };
    const l = `#/${c}/`, h = i[1].schema.id ?? `__schema${e.counter++}`;
    return { defId: h, ref: l + h };
  }, a = (i) => {
    if (i[1].schema.$ref)
      return;
    const c = i[1], { ref: p, defId: l } = o(i);
    c.def = { ...c.schema }, l && (c.defId = l);
    const h = c.schema;
    for (const y in h)
      delete h[y];
    h.$ref = p;
  };
  if (e.cycles === "throw")
    for (const i of e.seen.entries()) {
      const c = i[1];
      if (c.cycle)
        throw new Error(`Cycle detected: #/${c.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (const i of e.seen.entries()) {
    const c = i[1];
    if (t === i[0]) {
      a(i);
      continue;
    }
    if (e.external) {
      const l = e.external.registry.get(i[0])?.id;
      if (t !== i[0] && l) {
        a(i);
        continue;
      }
    }
    if (e.metadataRegistry.get(i[0])?.id) {
      a(i);
      continue;
    }
    if (c.cycle) {
      a(i);
      continue;
    }
    if (c.count > 1 && e.reused === "ref") {
      a(i);
      continue;
    }
  }
}
function En(e, t) {
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = (i) => {
    const c = e.seen.get(i);
    if (c.ref === null)
      return;
    const p = c.def ?? c.schema, l = { ...p }, h = c.ref;
    if (c.ref = null, h) {
      r(h);
      const v = e.seen.get(h), I = v.schema;
      if (I.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (p.allOf = p.allOf ?? [], p.allOf.push(I)) : Object.assign(p, I), Object.assign(p, l), i._zod.parent === h)
        for (const $ in p)
          $ === "$ref" || $ === "allOf" || $ in l || delete p[$];
      if (I.$ref && v.def)
        for (const $ in p)
          $ === "$ref" || $ === "allOf" || $ in v.def && JSON.stringify(p[$]) === JSON.stringify(v.def[$]) && delete p[$];
    }
    const y = i._zod.parent;
    if (y && y !== h) {
      r(y);
      const v = e.seen.get(y);
      if (v?.schema.$ref && (p.$ref = v.schema.$ref, v.def))
        for (const I in p)
          I === "$ref" || I === "allOf" || I in v.def && JSON.stringify(p[I]) === JSON.stringify(v.def[I]) && delete p[I];
    }
    e.override({
      zodSchema: i,
      jsonSchema: p,
      path: c.path ?? []
    });
  };
  for (const i of [...e.seen.entries()].reverse())
    r(i[0]);
  const o = {};
  if (e.target === "draft-2020-12" ? o.$schema = "https://json-schema.org/draft/2020-12/schema" : e.target === "draft-07" ? o.$schema = "http://json-schema.org/draft-07/schema#" : e.target === "draft-04" ? o.$schema = "http://json-schema.org/draft-04/schema#" : e.target, e.external?.uri) {
    const i = e.external.registry.get(t)?.id;
    if (!i)
      throw new Error("Schema is missing an `id` property");
    o.$id = e.external.uri(i);
  }
  Object.assign(o, n.def ?? n.schema);
  const a = e.external?.defs ?? {};
  for (const i of e.seen.entries()) {
    const c = i[1];
    c.def && c.defId && (a[c.defId] = c.def);
  }
  e.external || Object.keys(a).length > 0 && (e.target === "draft-2020-12" ? o.$defs = a : o.definitions = a);
  try {
    const i = JSON.parse(JSON.stringify(o));
    return Object.defineProperty(i, "~standard", {
      value: {
        ...t["~standard"],
        jsonSchema: {
          input: ke(t, "input", e.processors),
          output: ke(t, "output", e.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), i;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function U(e, t) {
  const n = t ?? { seen: /* @__PURE__ */ new Set() };
  if (n.seen.has(e))
    return !1;
  n.seen.add(e);
  const r = e._zod.def;
  if (r.type === "transform")
    return !0;
  if (r.type === "array")
    return U(r.element, n);
  if (r.type === "set")
    return U(r.valueType, n);
  if (r.type === "lazy")
    return U(r.getter(), n);
  if (r.type === "promise" || r.type === "optional" || r.type === "nonoptional" || r.type === "nullable" || r.type === "readonly" || r.type === "default" || r.type === "prefault")
    return U(r.innerType, n);
  if (r.type === "intersection")
    return U(r.left, n) || U(r.right, n);
  if (r.type === "record" || r.type === "map")
    return U(r.keyType, n) || U(r.valueType, n);
  if (r.type === "pipe")
    return U(r.in, n) || U(r.out, n);
  if (r.type === "object") {
    for (const o in r.shape)
      if (U(r.shape[o], n))
        return !0;
    return !1;
  }
  if (r.type === "union") {
    for (const o of r.options)
      if (U(o, n))
        return !0;
    return !1;
  }
  if (r.type === "tuple") {
    for (const o of r.items)
      if (U(o, n))
        return !0;
    return !!(r.rest && U(r.rest, n));
  }
  return !1;
}
const $a = (e, t = {}) => (n) => {
  const r = An({ ...n, processors: t });
  return D(e, r), xn(r, e), En(r, e);
}, ke = (e, t, n = {}) => (r) => {
  const { libraryOptions: o, target: a } = r ?? {}, i = An({ ...o ?? {}, target: a, io: t, processors: n });
  return D(e, i), xn(i, e), En(i, e);
}, Ca = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, Ra = (e, t, n, r) => {
  const o = n;
  o.type = "string";
  const { minimum: a, maximum: i, format: c, patterns: p, contentEncoding: l } = e._zod.bag;
  if (typeof a == "number" && (o.minLength = a), typeof i == "number" && (o.maxLength = i), c && (o.format = Ca[c] ?? c, o.format === "" && delete o.format, c === "time" && delete o.format), l && (o.contentEncoding = l), p && p.size > 0) {
    const h = [...p];
    h.length === 1 ? o.pattern = h[0].source : h.length > 1 && (o.allOf = [
      ...h.map((y) => ({
        ...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: y.source
      }))
    ]);
  }
}, La = (e, t, n, r) => {
  const o = n, { minimum: a, maximum: i, format: c, multipleOf: p, exclusiveMaximum: l, exclusiveMinimum: h } = e._zod.bag;
  typeof c == "string" && c.includes("int") ? o.type = "integer" : o.type = "number", typeof h == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.minimum = h, o.exclusiveMinimum = !0) : o.exclusiveMinimum = h), typeof a == "number" && (o.minimum = a, typeof h == "number" && t.target !== "draft-04" && (h >= a ? delete o.minimum : delete o.exclusiveMinimum)), typeof l == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.maximum = l, o.exclusiveMaximum = !0) : o.exclusiveMaximum = l), typeof i == "number" && (o.maximum = i, typeof l == "number" && t.target !== "draft-04" && (l <= i ? delete o.maximum : delete o.exclusiveMaximum)), typeof p == "number" && (o.multipleOf = p);
}, Ma = (e, t, n, r) => {
  n.type = "boolean";
}, Za = (e, t, n, r) => {
  t.target === "openapi-3.0" ? (n.type = "string", n.nullable = !0, n.enum = [null]) : n.type = "null";
}, Ua = (e, t, n, r) => {
  n.not = {};
}, qa = (e, t, n, r) => {
}, Ba = (e, t, n, r) => {
  const o = e._zod.def, a = sn(o.entries);
  a.every((i) => typeof i == "number") && (n.type = "number"), a.every((i) => typeof i == "string") && (n.type = "string"), n.enum = a;
}, Fa = (e, t, n, r) => {
  const o = e._zod.def, a = [];
  for (const i of o.values)
    if (i === void 0) {
      if (t.unrepresentable === "throw")
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
    } else if (typeof i == "bigint") {
      if (t.unrepresentable === "throw")
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      a.push(Number(i));
    } else
      a.push(i);
  if (a.length !== 0) if (a.length === 1) {
    const i = a[0];
    n.type = i === null ? "null" : typeof i, t.target === "draft-04" || t.target === "openapi-3.0" ? n.enum = [i] : n.const = i;
  } else
    a.every((i) => typeof i == "number") && (n.type = "number"), a.every((i) => typeof i == "string") && (n.type = "string"), a.every((i) => typeof i == "boolean") && (n.type = "boolean"), a.every((i) => i === null) && (n.type = "null"), n.enum = a;
}, Ga = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, Ja = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, Va = (e, t, n, r) => {
  const o = n, a = e._zod.def, { minimum: i, maximum: c } = e._zod.bag;
  typeof i == "number" && (o.minItems = i), typeof c == "number" && (o.maxItems = c), o.type = "array", o.items = D(a.element, t, { ...r, path: [...r.path, "items"] });
}, Ka = (e, t, n, r) => {
  const o = n, a = e._zod.def;
  o.type = "object", o.properties = {};
  const i = a.shape;
  for (const l in i)
    o.properties[l] = D(i[l], t, {
      ...r,
      path: [...r.path, "properties", l]
    });
  const c = new Set(Object.keys(i)), p = new Set([...c].filter((l) => {
    const h = a.shape[l]._zod;
    return t.io === "input" ? h.optin === void 0 : h.optout === void 0;
  }));
  p.size > 0 && (o.required = Array.from(p)), a.catchall?._zod.def.type === "never" ? o.additionalProperties = !1 : a.catchall ? a.catchall && (o.additionalProperties = D(a.catchall, t, {
    ...r,
    path: [...r.path, "additionalProperties"]
  })) : t.io === "output" && (o.additionalProperties = !1);
}, Wa = (e, t, n, r) => {
  const o = e._zod.def, a = o.inclusive === !1, i = o.options.map((c, p) => D(c, t, {
    ...r,
    path: [...r.path, a ? "oneOf" : "anyOf", p]
  }));
  a ? n.oneOf = i : n.anyOf = i;
}, Ha = (e, t, n, r) => {
  const o = e._zod.def, a = D(o.left, t, {
    ...r,
    path: [...r.path, "allOf", 0]
  }), i = D(o.right, t, {
    ...r,
    path: [...r.path, "allOf", 1]
  }), c = (l) => "allOf" in l && Object.keys(l).length === 1, p = [
    ...c(a) ? a.allOf : [a],
    ...c(i) ? i.allOf : [i]
  ];
  n.allOf = p;
}, Xa = (e, t, n, r) => {
  const o = n, a = e._zod.def;
  o.type = "object";
  const i = a.keyType, p = i._zod.bag?.patterns;
  if (a.mode === "loose" && p && p.size > 0) {
    const h = D(a.valueType, t, {
      ...r,
      path: [...r.path, "patternProperties", "*"]
    });
    o.patternProperties = {};
    for (const y of p)
      o.patternProperties[y.source] = h;
  } else
    (t.target === "draft-07" || t.target === "draft-2020-12") && (o.propertyNames = D(a.keyType, t, {
      ...r,
      path: [...r.path, "propertyNames"]
    })), o.additionalProperties = D(a.valueType, t, {
      ...r,
      path: [...r.path, "additionalProperties"]
    });
  const l = i._zod.values;
  if (l) {
    const h = [...l].filter((y) => typeof y == "string" || typeof y == "number");
    h.length > 0 && (o.required = h);
  }
}, Ya = (e, t, n, r) => {
  const o = e._zod.def, a = D(o.innerType, t, r), i = t.seen.get(e);
  t.target === "openapi-3.0" ? (i.ref = o.innerType, n.nullable = !0) : n.anyOf = [a, { type: "null" }];
}, Qa = (e, t, n, r) => {
  const o = e._zod.def;
  D(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
}, es = (e, t, n, r) => {
  const o = e._zod.def;
  D(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, n.default = JSON.parse(JSON.stringify(o.defaultValue));
}, ts = (e, t, n, r) => {
  const o = e._zod.def;
  D(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, t.io === "input" && (n._prefault = JSON.parse(JSON.stringify(o.defaultValue)));
}, ns = (e, t, n, r) => {
  const o = e._zod.def;
  D(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
  let i;
  try {
    i = o.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  n.default = i;
}, rs = (e, t, n, r) => {
  const o = e._zod.def, a = t.io === "input" ? o.in._zod.def.type === "transform" ? o.out : o.in : o.out;
  D(a, t, r);
  const i = t.seen.get(e);
  i.ref = a;
}, os = (e, t, n, r) => {
  const o = e._zod.def;
  D(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, n.readOnly = !0;
}, jn = (e, t, n, r) => {
  const o = e._zod.def;
  D(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
}, is = (e, t, n, r) => {
  const o = e._zod.innerType;
  D(o, t, r);
  const a = t.seen.get(e);
  a.ref = o;
}, as = /* @__PURE__ */ u("ZodISODateTime", (e, t) => {
  ni.init(e, t), j.init(e, t);
});
function ss(e) {
  return /* @__PURE__ */ pa(as, e);
}
const cs = /* @__PURE__ */ u("ZodISODate", (e, t) => {
  ri.init(e, t), j.init(e, t);
});
function ls(e) {
  return /* @__PURE__ */ ua(cs, e);
}
const ps = /* @__PURE__ */ u("ZodISOTime", (e, t) => {
  oi.init(e, t), j.init(e, t);
});
function us(e) {
  return /* @__PURE__ */ da(ps, e);
}
const ds = /* @__PURE__ */ u("ZodISODuration", (e, t) => {
  ii.init(e, t), j.init(e, t);
});
function ms(e) {
  return /* @__PURE__ */ ma(ds, e);
}
const fs = (e, t) => {
  un.init(e, t), e.name = "ZodError", Object.defineProperties(e, {
    format: {
      value: (n) => Vr(e, n)
      // enumerable: false,
    },
    flatten: {
      value: (n) => Jr(e, n)
      // enumerable: false,
    },
    addIssue: {
      value: (n) => {
        e.issues.push(n), e.message = JSON.stringify(e.issues, qe, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (n) => {
        e.issues.push(...n), e.message = JSON.stringify(e.issues, qe, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return e.issues.length === 0;
      }
      // enumerable: false,
    }
  });
}, J = u("ZodError", fs, {
  Parent: Error
}), hs = /* @__PURE__ */ st(J), gs = /* @__PURE__ */ ct(J), ys = /* @__PURE__ */ je(J), bs = /* @__PURE__ */ ze(J), _s = /* @__PURE__ */ Hr(J), vs = /* @__PURE__ */ Xr(J), Is = /* @__PURE__ */ Yr(J), ws = /* @__PURE__ */ Qr(J), ks = /* @__PURE__ */ eo(J), Ts = /* @__PURE__ */ to(J), Ss = /* @__PURE__ */ no(J), Ps = /* @__PURE__ */ ro(J), x = /* @__PURE__ */ u("ZodType", (e, t) => (A.init(e, t), Object.assign(e["~standard"], {
  jsonSchema: {
    input: ke(e, "input"),
    output: ke(e, "output")
  }
}), e.toJSONSchema = $a(e, {}), e.def = t, e.type = t.type, Object.defineProperty(e, "_def", { value: t }), e.check = (...n) => e.clone(te(t, {
  checks: [
    ...t.checks ?? [],
    ...n.map((r) => typeof r == "function" ? { _zod: { check: r, def: { check: "custom" }, onattach: [] } } : r)
  ]
}), {
  parent: !0
}), e.with = e.check, e.clone = (n, r) => ne(e, n, r), e.brand = () => e, e.register = ((n, r) => (n.add(e, r), e)), e.parse = (n, r) => hs(e, n, r, { callee: e.parse }), e.safeParse = (n, r) => ys(e, n, r), e.parseAsync = async (n, r) => gs(e, n, r, { callee: e.parseAsync }), e.safeParseAsync = async (n, r) => bs(e, n, r), e.spa = e.safeParseAsync, e.encode = (n, r) => _s(e, n, r), e.decode = (n, r) => vs(e, n, r), e.encodeAsync = async (n, r) => Is(e, n, r), e.decodeAsync = async (n, r) => ws(e, n, r), e.safeEncode = (n, r) => ks(e, n, r), e.safeDecode = (n, r) => Ts(e, n, r), e.safeEncodeAsync = async (n, r) => Ss(e, n, r), e.safeDecodeAsync = async (n, r) => Ps(e, n, r), e.refine = (n, r) => e.check(Ic(n, r)), e.superRefine = (n) => e.check(wc(n)), e.overwrite = (n) => e.check(/* @__PURE__ */ me(n)), e.optional = () => Ot(e), e.exactOptional = () => sc(e), e.nullable = () => Dt(e), e.nullish = () => Ot(Dt(e)), e.nonoptional = (n) => mc(e, n), e.array = () => R(e), e.or = (n) => Dn([e, n]), e.and = (n) => nc(e, n), e.transform = (n) => Ge(e, Nn(n)), e.default = (n) => pc(e, n), e.prefault = (n) => dc(e, n), e.catch = (n) => hc(e, n), e.pipe = (n) => Ge(e, n), e.readonly = () => bc(e), e.describe = (n) => {
  const r = e.clone();
  return fe.add(r, { description: n }), r;
}, Object.defineProperty(e, "description", {
  get() {
    return fe.get(e)?.description;
  },
  configurable: !0
}), e.meta = (...n) => {
  if (n.length === 0)
    return fe.get(e);
  const r = e.clone();
  return fe.add(r, n[0]), r;
}, e.isOptional = () => e.safeParse(void 0).success, e.isNullable = () => e.safeParse(null).success, e.apply = (n) => n(e), e)), zn = /* @__PURE__ */ u("_ZodString", (e, t) => {
  lt.init(e, t), x.init(e, t), e._zod.processJSONSchema = (r, o, a) => Ra(e, r, o);
  const n = e._zod.bag;
  e.format = n.format ?? null, e.minLength = n.minimum ?? null, e.maxLength = n.maximum ?? null, e.regex = (...r) => e.check(/* @__PURE__ */ va(...r)), e.includes = (...r) => e.check(/* @__PURE__ */ ka(...r)), e.startsWith = (...r) => e.check(/* @__PURE__ */ Ta(...r)), e.endsWith = (...r) => e.check(/* @__PURE__ */ Sa(...r)), e.min = (...r) => e.check(/* @__PURE__ */ we(...r)), e.max = (...r) => e.check(/* @__PURE__ */ Sn(...r)), e.length = (...r) => e.check(/* @__PURE__ */ Pn(...r)), e.nonempty = (...r) => e.check(/* @__PURE__ */ we(1, ...r)), e.lowercase = (r) => e.check(/* @__PURE__ */ Ia(r)), e.uppercase = (r) => e.check(/* @__PURE__ */ wa(r)), e.trim = () => e.check(/* @__PURE__ */ Aa()), e.normalize = (...r) => e.check(/* @__PURE__ */ Pa(...r)), e.toLowerCase = () => e.check(/* @__PURE__ */ xa()), e.toUpperCase = () => e.check(/* @__PURE__ */ Ea()), e.slugify = () => e.check(/* @__PURE__ */ ja());
}), As = /* @__PURE__ */ u("ZodString", (e, t) => {
  lt.init(e, t), zn.init(e, t), e.email = (n) => e.check(/* @__PURE__ */ Bi(xs, n)), e.url = (n) => e.check(/* @__PURE__ */ Ki(Es, n)), e.jwt = (n) => e.check(/* @__PURE__ */ la(Fs, n)), e.emoji = (n) => e.check(/* @__PURE__ */ Wi(js, n)), e.guid = (n) => e.check(/* @__PURE__ */ Pt(jt, n)), e.uuid = (n) => e.check(/* @__PURE__ */ Fi(_e, n)), e.uuidv4 = (n) => e.check(/* @__PURE__ */ Gi(_e, n)), e.uuidv6 = (n) => e.check(/* @__PURE__ */ Ji(_e, n)), e.uuidv7 = (n) => e.check(/* @__PURE__ */ Vi(_e, n)), e.nanoid = (n) => e.check(/* @__PURE__ */ Hi(zs, n)), e.guid = (n) => e.check(/* @__PURE__ */ Pt(jt, n)), e.cuid = (n) => e.check(/* @__PURE__ */ Xi(Os, n)), e.cuid2 = (n) => e.check(/* @__PURE__ */ Yi(Ds, n)), e.ulid = (n) => e.check(/* @__PURE__ */ Qi(Ns, n)), e.base64 = (n) => e.check(/* @__PURE__ */ aa(Us, n)), e.base64url = (n) => e.check(/* @__PURE__ */ sa(qs, n)), e.xid = (n) => e.check(/* @__PURE__ */ ea($s, n)), e.ksuid = (n) => e.check(/* @__PURE__ */ ta(Cs, n)), e.ipv4 = (n) => e.check(/* @__PURE__ */ na(Rs, n)), e.ipv6 = (n) => e.check(/* @__PURE__ */ ra(Ls, n)), e.cidrv4 = (n) => e.check(/* @__PURE__ */ oa(Ms, n)), e.cidrv6 = (n) => e.check(/* @__PURE__ */ ia(Zs, n)), e.e164 = (n) => e.check(/* @__PURE__ */ ca(Bs, n)), e.datetime = (n) => e.check(ss(n)), e.date = (n) => e.check(ls(n)), e.time = (n) => e.check(us(n)), e.duration = (n) => e.check(ms(n));
});
function d(e) {
  return /* @__PURE__ */ qi(As, e);
}
const j = /* @__PURE__ */ u("ZodStringFormat", (e, t) => {
  E.init(e, t), zn.init(e, t);
}), xs = /* @__PURE__ */ u("ZodEmail", (e, t) => {
  Vo.init(e, t), j.init(e, t);
}), jt = /* @__PURE__ */ u("ZodGUID", (e, t) => {
  Go.init(e, t), j.init(e, t);
}), _e = /* @__PURE__ */ u("ZodUUID", (e, t) => {
  Jo.init(e, t), j.init(e, t);
}), Es = /* @__PURE__ */ u("ZodURL", (e, t) => {
  Ko.init(e, t), j.init(e, t);
}), js = /* @__PURE__ */ u("ZodEmoji", (e, t) => {
  Wo.init(e, t), j.init(e, t);
}), zs = /* @__PURE__ */ u("ZodNanoID", (e, t) => {
  Ho.init(e, t), j.init(e, t);
}), Os = /* @__PURE__ */ u("ZodCUID", (e, t) => {
  Xo.init(e, t), j.init(e, t);
}), Ds = /* @__PURE__ */ u("ZodCUID2", (e, t) => {
  Yo.init(e, t), j.init(e, t);
}), Ns = /* @__PURE__ */ u("ZodULID", (e, t) => {
  Qo.init(e, t), j.init(e, t);
}), $s = /* @__PURE__ */ u("ZodXID", (e, t) => {
  ei.init(e, t), j.init(e, t);
}), Cs = /* @__PURE__ */ u("ZodKSUID", (e, t) => {
  ti.init(e, t), j.init(e, t);
}), Rs = /* @__PURE__ */ u("ZodIPv4", (e, t) => {
  ai.init(e, t), j.init(e, t);
}), Ls = /* @__PURE__ */ u("ZodIPv6", (e, t) => {
  si.init(e, t), j.init(e, t);
}), Ms = /* @__PURE__ */ u("ZodCIDRv4", (e, t) => {
  ci.init(e, t), j.init(e, t);
}), Zs = /* @__PURE__ */ u("ZodCIDRv6", (e, t) => {
  li.init(e, t), j.init(e, t);
}), Us = /* @__PURE__ */ u("ZodBase64", (e, t) => {
  pi.init(e, t), j.init(e, t);
}), qs = /* @__PURE__ */ u("ZodBase64URL", (e, t) => {
  di.init(e, t), j.init(e, t);
}), Bs = /* @__PURE__ */ u("ZodE164", (e, t) => {
  mi.init(e, t), j.init(e, t);
}), Fs = /* @__PURE__ */ u("ZodJWT", (e, t) => {
  hi.init(e, t), j.init(e, t);
}), On = /* @__PURE__ */ u("ZodNumber", (e, t) => {
  In.init(e, t), x.init(e, t), e._zod.processJSONSchema = (r, o, a) => La(e, r, o), e.gt = (r, o) => e.check(/* @__PURE__ */ xt(r, o)), e.gte = (r, o) => e.check(/* @__PURE__ */ $e(r, o)), e.min = (r, o) => e.check(/* @__PURE__ */ $e(r, o)), e.lt = (r, o) => e.check(/* @__PURE__ */ At(r, o)), e.lte = (r, o) => e.check(/* @__PURE__ */ Ne(r, o)), e.max = (r, o) => e.check(/* @__PURE__ */ Ne(r, o)), e.int = (r) => e.check(zt(r)), e.safe = (r) => e.check(zt(r)), e.positive = (r) => e.check(/* @__PURE__ */ xt(0, r)), e.nonnegative = (r) => e.check(/* @__PURE__ */ $e(0, r)), e.negative = (r) => e.check(/* @__PURE__ */ At(0, r)), e.nonpositive = (r) => e.check(/* @__PURE__ */ Ne(0, r)), e.multipleOf = (r, o) => e.check(/* @__PURE__ */ Et(r, o)), e.step = (r, o) => e.check(/* @__PURE__ */ Et(r, o)), e.finite = () => e;
  const n = e._zod.bag;
  e.minValue = Math.max(n.minimum ?? Number.NEGATIVE_INFINITY, n.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, e.maxValue = Math.min(n.maximum ?? Number.POSITIVE_INFINITY, n.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, e.isInt = (n.format ?? "").includes("int") || Number.isSafeInteger(n.multipleOf ?? 0.5), e.isFinite = !0, e.format = n.format ?? null;
});
function Q(e) {
  return /* @__PURE__ */ fa(On, e);
}
const Gs = /* @__PURE__ */ u("ZodNumberFormat", (e, t) => {
  gi.init(e, t), On.init(e, t);
});
function zt(e) {
  return /* @__PURE__ */ ha(Gs, e);
}
const Js = /* @__PURE__ */ u("ZodBoolean", (e, t) => {
  yi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ma(e, n, r);
});
function k(e) {
  return /* @__PURE__ */ ga(Js, e);
}
const Vs = /* @__PURE__ */ u("ZodNull", (e, t) => {
  bi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Za(e, n, r);
});
function Ks(e) {
  return /* @__PURE__ */ ya(Vs, e);
}
const Ws = /* @__PURE__ */ u("ZodUnknown", (e, t) => {
  _i.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => qa();
});
function Te() {
  return /* @__PURE__ */ ba(Ws);
}
const Hs = /* @__PURE__ */ u("ZodNever", (e, t) => {
  vi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ua(e, n, r);
});
function Xs(e) {
  return /* @__PURE__ */ _a(Hs, e);
}
const Ys = /* @__PURE__ */ u("ZodArray", (e, t) => {
  Ii.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Va(e, n, r, o), e.element = t.element, e.min = (n, r) => e.check(/* @__PURE__ */ we(n, r)), e.nonempty = (n) => e.check(/* @__PURE__ */ we(1, n)), e.max = (n, r) => e.check(/* @__PURE__ */ Sn(n, r)), e.length = (n, r) => e.check(/* @__PURE__ */ Pn(n, r)), e.unwrap = () => e.element;
});
function R(e, t) {
  return /* @__PURE__ */ za(Ys, e, t);
}
const Qs = /* @__PURE__ */ u("ZodObject", (e, t) => {
  ki.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ka(e, n, r, o), S(e, "shape", () => t.shape), e.keyof = () => P(Object.keys(e._zod.def.shape)), e.catchall = (n) => e.clone({ ...e._zod.def, catchall: n }), e.passthrough = () => e.clone({ ...e._zod.def, catchall: Te() }), e.loose = () => e.clone({ ...e._zod.def, catchall: Te() }), e.strict = () => e.clone({ ...e._zod.def, catchall: Xs() }), e.strip = () => e.clone({ ...e._zod.def, catchall: void 0 }), e.extend = (n) => Ur(e, n), e.safeExtend = (n) => qr(e, n), e.merge = (n) => Br(e, n), e.pick = (n) => Mr(e, n), e.omit = (n) => Zr(e, n), e.partial = (...n) => Fr($n, e, n[0]), e.required = (...n) => Gr(Cn, e, n[0]);
});
function T(e, t) {
  const n = {
    type: "object",
    shape: e ?? {},
    ..._(t)
  };
  return new Qs(n);
}
const ec = /* @__PURE__ */ u("ZodUnion", (e, t) => {
  Ti.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Wa(e, n, r, o), e.options = t.options;
});
function Dn(e, t) {
  return new ec({
    type: "union",
    options: e,
    ..._(t)
  });
}
const tc = /* @__PURE__ */ u("ZodIntersection", (e, t) => {
  Si.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ha(e, n, r, o);
});
function nc(e, t) {
  return new tc({
    type: "intersection",
    left: e,
    right: t
  });
}
const rc = /* @__PURE__ */ u("ZodRecord", (e, t) => {
  Pi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Xa(e, n, r, o), e.keyType = t.keyType, e.valueType = t.valueType;
});
function ee(e, t, n) {
  return new rc({
    type: "record",
    keyType: e,
    valueType: t,
    ..._(n)
  });
}
const Fe = /* @__PURE__ */ u("ZodEnum", (e, t) => {
  Ai.init(e, t), x.init(e, t), e._zod.processJSONSchema = (r, o, a) => Ba(e, r, o), e.enum = t.entries, e.options = Object.values(t.entries);
  const n = new Set(Object.keys(t.entries));
  e.extract = (r, o) => {
    const a = {};
    for (const i of r)
      if (n.has(i))
        a[i] = t.entries[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new Fe({
      ...t,
      checks: [],
      ..._(o),
      entries: a
    });
  }, e.exclude = (r, o) => {
    const a = { ...t.entries };
    for (const i of r)
      if (n.has(i))
        delete a[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new Fe({
      ...t,
      checks: [],
      ..._(o),
      entries: a
    });
  };
});
function P(e, t) {
  const n = Array.isArray(e) ? Object.fromEntries(e.map((r) => [r, r])) : e;
  return new Fe({
    type: "enum",
    entries: n,
    ..._(t)
  });
}
const oc = /* @__PURE__ */ u("ZodLiteral", (e, t) => {
  xi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Fa(e, n, r), e.values = new Set(t.values), Object.defineProperty(e, "value", {
    get() {
      if (t.values.length > 1)
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      return t.values[0];
    }
  });
});
function ge(e, t) {
  return new oc({
    type: "literal",
    values: Array.isArray(e) ? e : [e],
    ..._(t)
  });
}
const ic = /* @__PURE__ */ u("ZodTransform", (e, t) => {
  Ei.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ja(e, n), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new an(e.constructor.name);
    n.addIssue = (a) => {
      if (typeof a == "string")
        n.issues.push(he(a, n.value, t));
      else {
        const i = a;
        i.fatal && (i.continue = !1), i.code ?? (i.code = "custom"), i.input ?? (i.input = n.value), i.inst ?? (i.inst = e), n.issues.push(he(i));
      }
    };
    const o = t.transform(n.value, n);
    return o instanceof Promise ? o.then((a) => (n.value = a, n)) : (n.value = o, n);
  };
});
function Nn(e) {
  return new ic({
    type: "transform",
    transform: e
  });
}
const $n = /* @__PURE__ */ u("ZodOptional", (e, t) => {
  Tn.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => jn(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Ot(e) {
  return new $n({
    type: "optional",
    innerType: e
  });
}
const ac = /* @__PURE__ */ u("ZodExactOptional", (e, t) => {
  ji.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => jn(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function sc(e) {
  return new ac({
    type: "optional",
    innerType: e
  });
}
const cc = /* @__PURE__ */ u("ZodNullable", (e, t) => {
  zi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ya(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Dt(e) {
  return new cc({
    type: "nullable",
    innerType: e
  });
}
const lc = /* @__PURE__ */ u("ZodDefault", (e, t) => {
  Oi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => es(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function pc(e, t) {
  return new lc({
    type: "default",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : ln(t);
    }
  });
}
const uc = /* @__PURE__ */ u("ZodPrefault", (e, t) => {
  Di.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ts(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function dc(e, t) {
  return new uc({
    type: "prefault",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : ln(t);
    }
  });
}
const Cn = /* @__PURE__ */ u("ZodNonOptional", (e, t) => {
  Ni.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Qa(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function mc(e, t) {
  return new Cn({
    type: "nonoptional",
    innerType: e,
    ..._(t)
  });
}
const fc = /* @__PURE__ */ u("ZodCatch", (e, t) => {
  $i.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ns(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function hc(e, t) {
  return new fc({
    type: "catch",
    innerType: e,
    catchValue: typeof t == "function" ? t : () => t
  });
}
const gc = /* @__PURE__ */ u("ZodPipe", (e, t) => {
  Ci.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => rs(e, n, r, o), e.in = t.in, e.out = t.out;
});
function Ge(e, t) {
  return new gc({
    type: "pipe",
    in: e,
    out: t
    // ...util.normalizeParams(params),
  });
}
const yc = /* @__PURE__ */ u("ZodReadonly", (e, t) => {
  Ri.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => os(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function bc(e) {
  return new yc({
    type: "readonly",
    innerType: e
  });
}
const _c = /* @__PURE__ */ u("ZodLazy", (e, t) => {
  Li.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => is(e, n, r, o), e.unwrap = () => e._zod.def.getter();
});
function Rn(e) {
  return new _c({
    type: "lazy",
    getter: e
  });
}
const vc = /* @__PURE__ */ u("ZodCustom", (e, t) => {
  Mi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ga(e, n);
});
function Ic(e, t = {}) {
  return /* @__PURE__ */ Oa(vc, e, t);
}
function wc(e) {
  return /* @__PURE__ */ Da(e);
}
function pt(e, t) {
  return Ge(Nn(e), t);
}
const ue = {
  custom: "custom"
};
H({ jitless: !0 });
const kc = /^\d{4}-\d{2}-\d{2}$/, Tc = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, Sc = /^data:image\/(svg\+xml|png|jpeg|webp)(;charset=[^;,]+)?(;base64)?,/i, N = d().regex(kc), Pc = pt(
  (e) => e === "" ? null : e,
  N.nullable().optional()
), m = Q().finite(), G = Q().int(), ce = Q().finite().min(0), b = d().trim().min(1), Ac = d().trim().min(1).nullable(), O = d().trim().min(1).nullable().optional(), xc = pt(
  (e) => e === void 0 ? null : e,
  Ac
), Ln = d().regex(Tc), Ec = d().regex(Sc), Mn = P(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]), Zn = P([
  "classic",
  "neutral"
]), Un = P([
  "invoice-left-logo-right",
  "invoice-center-logo-center",
  "invoice-right-logo-left"
]), Se = Rn(() => Dn([
  d(),
  m,
  k(),
  Ks(),
  R(Se),
  ee(d(), Se)
])), qn = Rn(() => T({
  type: b,
  attrs: ee(d(), Se).nullable().optional(),
  content: R(qn).optional(),
  marks: R(T({
    type: b,
    attrs: ee(d(), Se).nullable().optional()
  }).passthrough()).optional(),
  text: d().optional()
}).passthrough()), Nt = T({
  version: ge(1),
  type: ge("tiptap-json"),
  content: qn,
  plainTextPreview: d().optional(),
  updatedAt: m
}).passthrough(), jc = pt((e) => {
  if (e == null)
    return e;
  const t = Nt.safeParse(e);
  if (t.success)
    return t.data;
}, Nt.nullable().optional()), zc = T({
  type: P(["weekly", "monthly", "yearly"]),
  weeklyDays: R(Q().int().min(0).max(6)).optional(),
  monthlyType: P(["first", "last", "specific"]).optional(),
  monthlyDay: Q().int().min(1).max(31).optional(),
  yearlyDate: N.optional()
}).passthrough();
T({
  id: b,
  title: b,
  createdAt: m.optional(),
  updatedAt: m.optional(),
  description: d().optional(),
  notes: jc,
  hourlyRate: m.nullable().optional(),
  flatRate: k().optional(),
  preferredClientId: O,
  isPersonal: k().optional(),
  archived: k().optional(),
  archivedOnDate: N.nullable().optional(),
  lastBilledAt: m.nullable().optional(),
  color: d().nullable().optional(),
  invoiceIds: R(b).optional(),
  billableTimeIncrementMinutes: Q().int().positive().nullable().optional(),
  taskView: P(["list", "kanban"]).optional(),
  taskSort: P(["createdAt", "lastActive", "name", "manual"]).optional(),
  statusMode: P(["active", "quote"]).optional(),
  deadline: N.nullable().optional(),
  deadlineResolvedAt: m.nullable().optional(),
  budgetAmount: ce.nullable().optional()
}).passthrough();
T({
  id: b,
  projectId: O,
  parentTaskId: O,
  title: b,
  note: d().nullable().optional(),
  completed: k().optional(),
  archived: k().optional(),
  archivedOnDate: N.nullable().optional(),
  billable: k().optional(),
  billableSetByUser: k().optional(),
  sortOrder: m.nullable().optional(),
  sortOrderUpdatedAt: m.nullable().optional(),
  lastActive: m.optional(),
  createdAt: m.optional(),
  lastBilledAt: m.nullable().optional(),
  startDate: N.nullable().optional(),
  recurring: zc.nullable().optional(),
  promptTimeEntry: k().optional(),
  skipUntilNextRecurring: k().optional(),
  skippedOccurrenceDate: N.nullable().optional(),
  completedDatesByYear: ee(d(), ee(d(), R(Q().int().min(1).max(31)))).optional(),
  completedOnDate: N.nullable().optional(),
  estimatedHours: ce.nullable().optional(),
  estimatedFlatAmount: ce.nullable().optional(),
  quotedAmountBilling: T({
    invoiceId: b,
    billedAt: m,
    total: ce
  }).nullable().optional()
}).passthrough();
T({
  id: b,
  taskId: b,
  start: m,
  end: m,
  createdAt: m.optional(),
  updatedAt: m.optional(),
  note: d().optional(),
  source: d().optional(),
  billedHourlyRate: m.nullable().optional(),
  billedAt: m.nullable().optional(),
  billedInvoiceId: O,
  billedDurationMs: ce.nullable().optional(),
  billingIncrementMinutes: Q().int().positive().nullable().optional(),
  _stoppedTimerKey: b.optional(),
  _stoppedTimerInstanceId: b.optional()
}).superRefine((e, t) => {
  e.end < e.start && t.addIssue({
    code: ue.custom,
    path: ["end"],
    message: "end must be greater than or equal to start"
  });
}).passthrough();
T({
  id: b,
  title: b,
  createdAt: m.optional(),
  updatedAt: m.optional(),
  clientName: d().optional(),
  contactPerson: d().optional(),
  email: d().optional(),
  phone: d().optional(),
  address: d().optional(),
  city: d().optional(),
  state: d().optional(),
  zip: d().optional(),
  country: d().optional(),
  registrationNumber: d().optional(),
  vat: d().optional(),
  taxNumber: d().optional(),
  notes: d().optional(),
  custom: R(T({ label: d(), value: d() })).optional(),
  disableTax: k().optional(),
  defaultHourlyRate: m.nullable().optional(),
  hourlyRate: m.nullable().optional(),
  flatRate: k().optional(),
  defaultCurrency: d().optional(),
  archived: k().optional(),
  archivedOnDate: N.nullable().optional(),
  color: d().nullable().optional()
}).passthrough();
T({
  id: b,
  title: d().trim().min(1).optional(),
  name: d().trim().min(1).optional(),
  businessName: d().trim().min(1).optional(),
  email: d().optional(),
  phone: d().optional(),
  address: d().optional(),
  city: d().optional(),
  state: d().optional(),
  zip: d().optional(),
  country: d().optional(),
  registrationNumber: d().optional(),
  vat: d().optional(),
  taxNumber: d().optional(),
  custom: R(T({ label: d(), value: d() })).optional(),
  taxId: d().optional(),
  logo: d().optional(),
  isDefault: k().optional(),
  taxEnabled: k().optional(),
  taxLabel: d().optional(),
  taxRate: m.optional(),
  branding: T({
    primaryColor: Ln.nullable().optional(),
    logoAssetId: O
  }).passthrough().optional()
}).superRefine((e, t) => {
  !e.title && !e.name && t.addIssue({
    code: ue.custom,
    path: ["title"],
    message: "title or name is required"
  }), !e.businessName && !e.name && t.addIssue({
    code: ue.custom,
    path: ["businessName"],
    message: "businessName or name is required"
  });
}).passthrough();
T({
  id: b,
  businessInfoId: b,
  kind: ge("logo"),
  dataUrl: Ec,
  mimeType: Mn,
  fileName: d().nullable().optional(),
  width: G.positive(),
  height: G.positive(),
  byteSize: G.positive(),
  contentHash: b,
  createdAt: m,
  updatedAt: m.nullable().optional(),
  archivedAt: m.nullable().optional()
}).passthrough();
const Oc = T({
  description: d(),
  quantity: m,
  rate: m,
  amount: m,
  projectId: d().optional(),
  taskId: d().optional(),
  expenseId: d().optional(),
  supplierName: d().nullable().optional(),
  originalAmount: m.optional(),
  originalCurrency: d().optional(),
  exchangeRate: m.optional(),
  lineType: P(["project", "project-subtotal", "task", "expense", "custom"]).optional(),
  rateLabel: d().optional(),
  quantityLabel: d().optional(),
  pricingMode: P(["hourly", "flat", "mixed"]).optional()
}).passthrough(), Bn = T({
  capturedAt: m,
  sourceCurrency: b,
  sourceAmount: m,
  preferredCurrencyAtPayment: b,
  preferredCurrencyAmount: m
}).passthrough(), Dc = T({
  projectId: b,
  projectTitle: b,
  clientId: b,
  pricingMode: P(["hourly", "flat", "mixed"]),
  tasks: R(ee(d(), Te())).optional(),
  expenseItems: R(ee(d(), Te())).optional(),
  totalHours: m,
  subtotal: m,
  allocatedDiscount: m.optional(),
  allocatedShipping: m.optional(),
  allocatedTax: m.optional(),
  allocatedTotal: m.optional()
}).passthrough(), Nc = T({
  version: ge(1),
  capturedAt: m,
  taskLastBilledAt: ee(d(), m.nullable())
}).passthrough(), $c = T({
  version: ge(1),
  capturedAt: m,
  invoiceCurrency: b,
  entries: R(T({
    entryId: b,
    taskId: b,
    start: m,
    end: m,
    actualDurationMs: m.nonnegative(),
    billableDurationMs: m.nonnegative(),
    billedHourlyRate: m.nullable()
  }).refine((e) => e.end >= e.start, {
    message: "end must be greater than or equal to start",
    path: ["end"]
  })),
  tasks: R(T({
    taskId: b,
    title: b,
    pricingMode: P(["hourly", "flat"]),
    quantity: m.nonnegative(),
    rate: m,
    amount: m,
    quotedAmount: m.nullable()
  })),
  expenses: R(T({
    expenseId: b,
    title: b,
    sourceAmount: m,
    sourceCurrency: b,
    invoiceAmount: m,
    invoiceCurrency: b,
    exchangeRate: m.positive()
  }))
}).passthrough();
T({
  id: b,
  projectId: xc,
  projectIds: R(b).optional(),
  projectBreakdowns: R(Dc).optional(),
  clientId: b,
  createdAt: m.optional(),
  updatedAt: m.optional(),
  businessInfoId: O,
  invoiceNumber: b,
  date: N,
  dueDate: N.nullable().optional(),
  status: P(["draft", "sent", "paid", "overdue"]),
  items: R(Oc),
  subtotal: m,
  tax: m.optional(),
  taxRate: m.optional(),
  total: m,
  notes: d().optional(),
  paymentMethodId: O,
  billingPeriodPreset: P(["last-month", "month", "all-time", "custom"]).optional(),
  billingPeriodStart: N.nullable().optional(),
  billingPeriodEnd: N.nullable().optional(),
  currency: d().optional(),
  paidAt: m.nullable().optional(),
  paymentCurrencySnapshot: Bn.nullable().optional(),
  sentAt: m.nullable().optional(),
  sentToEmail: d().nullable().optional(),
  billingStateSnapshot: Nc.nullable().optional(),
  billingSelectionSnapshot: $c.nullable().optional(),
  brandingSnapshot: T({
    businessInfoId: O,
    templateId: O,
    layoutStyle: Zn.optional(),
    logoPlacement: Un,
    showBusinessLogo: k(),
    useBusinessPrimaryColor: k(),
    primaryColor: Ln.nullable().optional(),
    logoAssetId: O,
    logoAssetMeta: T({
      mimeType: Mn,
      width: G.positive(),
      height: G.positive(),
      byteSize: G.positive(),
      contentHash: b
    }).nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough();
T({
  id: b,
  name: b,
  prefix: d().optional(),
  useSequentialNumbers: k().optional(),
  currentSequentialNumber: G.optional(),
  defaultNotes: d().optional(),
  defaultTaxRate: m.optional(),
  defaultDueDays: G.optional(),
  isDefault: k().optional(),
  brandingOptions: T({
    showBusinessLogo: k().optional(),
    useBusinessPrimaryColor: k().optional()
  }).passthrough().optional(),
  layoutStyle: Zn.optional(),
  logoPlacement: Un.optional(),
  showBillingPeriod: k().optional(),
  showProjectTitle: k().optional()
}).passthrough();
T({
  id: b,
  name: b,
  type: P(["invoice", "quote"]),
  fromName: d().max(200).optional(),
  replyTo: d().email().max(320).optional(),
  subject: d().max(500),
  sendBody: d().max(5e3),
  reminderBody: d().max(5e3),
  attachmentTitle: d().max(200),
  isDefault: k().optional(),
  createdAt: m.optional(),
  updatedAt: m.optional()
}).passthrough();
T({
  id: b,
  title: b,
  fullName: d().optional(),
  bank: d().optional(),
  iban: d().optional(),
  swift: d().optional(),
  bankAddress: d().optional(),
  paypal: d().optional(),
  custom: R(T({ label: d(), value: d() })).default([]),
  instructions: d().optional(),
  isDefault: k().optional(),
  createdAt: m.optional(),
  updatedAt: m.optional(),
  name: d().optional()
}).passthrough();
T({
  id: b,
  title: b,
  note: d().nullable().optional(),
  date: N,
  supplierName: d().nullable().optional(),
  receiptNumber: d().nullable().optional(),
  currency: b,
  amount: m,
  paidOn: Pc,
  paidBy: d().nullable().optional(),
  paymentStatus: P(["unpaid", "paid"]),
  paymentMode: P(["manual", "auto"]).optional().default("manual"),
  clientId: O,
  projectId: O,
  businessId: O,
  categoryId: O,
  isPersonal: k(),
  billable: k(),
  billingStatus: P(["unbilled", "billed"]).default("unbilled"),
  invoiceId: O,
  billedAt: m.nullable().optional(),
  isRecurring: k().default(!1),
  recurrenceId: O,
  amountType: P(["fixed", "variable"]).nullable().optional(),
  taxNumber: d().nullable().optional(),
  isTaxExempt: k().default(!1),
  amountExcludingTax: m.nullable().optional(),
  taxLabel: d().nullable().optional(),
  taxRate: m.nullable().optional(),
  taxClaimStatus: P(["unclaimed", "claimed", "excluded"]).nullable().optional(),
  taxClaimPeriodId: O,
  taxClaimedAt: m.nullable().optional(),
  paymentCurrencySnapshot: Bn.nullable().optional().catch(null),
  isPreview: k().optional(),
  createdAt: m.optional(),
  updatedAt: m.optional()
}).passthrough();
T({
  id: b,
  title: b,
  note: d().nullable().optional(),
  supplierName: d().nullable().optional(),
  paidBy: d().nullable().optional(),
  currency: b,
  amount: m,
  amountType: P(["fixed", "variable"]),
  paymentMode: P(["manual", "auto"]).optional(),
  repeat: P(["monthly", "yearly"]),
  monthlyType: P(["first", "last", "specific"]).optional(),
  monthlyDay: G.min(1).max(31).optional(),
  startDate: N,
  endDate: N.nullable().optional(),
  clientId: O,
  projectId: O,
  businessId: O,
  categoryId: O,
  isPersonal: k(),
  billable: k(),
  taxNumber: d().nullable().optional(),
  isTaxExempt: k(),
  amountExcludingTax: m.nullable().optional(),
  taxLabel: d().nullable().optional(),
  taxRate: m.nullable().optional(),
  lastGeneratedDate: N.nullable().optional(),
  active: k(),
  createdAt: m.optional(),
  updatedAt: m.optional()
}).passthrough();
T({
  id: b,
  name: b,
  group: d().nullable().optional(),
  isDefault: k().default(!1),
  archived: k().default(!1),
  createdAt: m.optional(),
  updatedAt: m.optional()
}).passthrough();
T({
  id: b,
  title: b,
  type: P(["vat", "income-tax", "sales-tax", "other"]),
  startDate: N,
  endDate: N,
  businessInfoId: O,
  status: P(["draft", "filed", "paid"]).default("draft"),
  filedAt: m.nullable().optional(),
  paidAt: m.nullable().optional(),
  notes: d().nullable().optional(),
  createdAt: m.optional(),
  updatedAt: m.optional()
}).superRefine((e, t) => {
  e.endDate < e.startDate && t.addIssue({
    code: ue.custom,
    path: ["endDate"],
    message: "endDate must be greater than or equal to startDate"
  });
}).passthrough();
T({
  id: b,
  type: P(["client", "project", "task"]),
  referenceId: b,
  mode: P(["static", "date", "weekday"]),
  date: N.nullable().optional(),
  weekday: G.min(0).max(6).nullable().optional(),
  sortOrder: m,
  createdAt: m,
  estimatedHours: m.nullable().optional()
}).superRefine((e, t) => {
  e.mode === "date" && !e.date && t.addIssue({
    code: ue.custom,
    path: ["date"],
    message: "date is required when mode is date"
  }), e.mode === "weekday" && (e.weekday === void 0 || e.weekday === null) && t.addIssue({
    code: ue.custom,
    path: ["weekday"],
    message: "weekday is required when mode is weekday"
  });
}).passthrough();
T({
  id: b,
  weekday: G.min(0).max(6),
  targetHours: m.nullable().optional(),
  targetEarnings: m.nullable().optional(),
  createdAt: m,
  updatedAt: m.nullable().optional()
}).passthrough();
T({
  currency: d().optional(),
  dateFormat: d().optional(),
  timeFormat: d().optional(),
  theme: P(["light", "dark", "system"]).optional(),
  defaultView: d().optional(),
  weekStartsOn: G.min(0).max(6).optional(),
  autoHideTotalsOnRevisit: k().optional(),
  showCompletedTasks: k().optional(),
  defaultBillable: k().optional(),
  projectSort: P(["createdAt", "lastActive", "name"]).optional(),
  clientSort: P(["createdAt", "lastActive", "name"]).optional(),
  autoSyncEnabled: k().optional(),
  autoSyncMode: P(["backup", "sync"]).optional(),
  weeklyGoalTargetHours: m.nullable().optional(),
  weeklyGoalTargetEarnings: m.nullable().optional(),
  systemNotificationsEnabled: k().optional(),
  systemNotificationTime: d().regex(/^\d{2}:\d{2}$/).optional(),
  backupEnabled: k().optional(),
  backupFrequencyHours: G.min(1).optional()
}).passthrough();
T({
  projectId: b,
  taskId: b,
  timerInstanceId: b.optional(),
  startTime: m,
  paused: k().optional(),
  pausedElapsedTime: ce.optional(),
  note: d().optional(),
  lastActive: m.optional()
}).passthrough();
const Cc = "1.4";
Array.from(/* @__PURE__ */ new Set(["1.0", "1.1", "1.3", Cc]));
const Je = (e, t) => t.some((n) => e instanceof n);
let $t, Ct;
function Rc() {
  return $t || ($t = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Lc() {
  return Ct || (Ct = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const Ve = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakMap(), De = /* @__PURE__ */ new WeakMap();
function Mc(e) {
  const t = new Promise((n, r) => {
    const o = () => {
      e.removeEventListener("success", a), e.removeEventListener("error", i);
    }, a = () => {
      n(Pe(e.result)), o();
    }, i = () => {
      r(e.error), o();
    };
    e.addEventListener("success", a), e.addEventListener("error", i);
  });
  return De.set(t, e), t;
}
function Zc(e) {
  if (Ve.has(e))
    return;
  const t = new Promise((n, r) => {
    const o = () => {
      e.removeEventListener("complete", a), e.removeEventListener("error", i), e.removeEventListener("abort", i);
    }, a = () => {
      n(), o();
    }, i = () => {
      r(e.error || new DOMException("AbortError", "AbortError")), o();
    };
    e.addEventListener("complete", a), e.addEventListener("error", i), e.addEventListener("abort", i);
  });
  Ve.set(e, t);
}
let Ke = {
  get(e, t, n) {
    if (e instanceof IDBTransaction) {
      if (t === "done")
        return Ve.get(e);
      if (t === "store")
        return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
    }
    return Pe(e[t]);
  },
  set(e, t, n) {
    return e[t] = n, !0;
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
  }
};
function Fn(e) {
  Ke = e(Ke);
}
function Uc(e) {
  return Lc().includes(e) ? function(...t) {
    return e.apply(We(this), t), Pe(this.request);
  } : function(...t) {
    return Pe(e.apply(We(this), t));
  };
}
function qc(e) {
  return typeof e == "function" ? Uc(e) : (e instanceof IDBTransaction && Zc(e), Je(e, Rc()) ? new Proxy(e, Ke) : e);
}
function Pe(e) {
  if (e instanceof IDBRequest)
    return Mc(e);
  if (Ce.has(e))
    return Ce.get(e);
  const t = qc(e);
  return t !== e && (Ce.set(e, t), De.set(t, e)), t;
}
const We = (e) => De.get(e), Bc = ["get", "getKey", "getAll", "getAllKeys", "count"], Fc = ["put", "add", "delete", "clear"], Re = /* @__PURE__ */ new Map();
function Rt(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string"))
    return;
  if (Re.get(t))
    return Re.get(t);
  const n = t.replace(/FromIndex$/, ""), r = t !== n, o = Fc.includes(n);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(o || Bc.includes(n))
  )
    return;
  const a = async function(i, ...c) {
    const p = this.transaction(i, o ? "readwrite" : "readonly");
    let l = p.store;
    return r && (l = l.index(c.shift())), (await Promise.all([
      l[n](...c),
      o && p.done
    ]))[0];
  };
  return Re.set(t, a), a;
}
Fn((e) => ({
  ...e,
  get: (t, n, r) => Rt(t, n) || e.get(t, n, r),
  has: (t, n) => !!Rt(t, n) || e.has(t, n)
}));
const Gc = ["continue", "continuePrimaryKey", "advance"], Lt = {}, He = /* @__PURE__ */ new WeakMap(), Gn = /* @__PURE__ */ new WeakMap(), Jc = {
  get(e, t) {
    if (!Gc.includes(t))
      return e[t];
    let n = Lt[t];
    return n || (n = Lt[t] = function(...r) {
      He.set(this, Gn.get(this)[t](...r));
    }), n;
  }
};
async function* Vc(...e) {
  let t = this;
  if (t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)
    return;
  t = t;
  const n = new Proxy(t, Jc);
  for (Gn.set(n, t), De.set(n, We(t)); t; )
    yield n, t = await (He.get(n) || t.continue()), He.delete(n);
}
function Mt(e, t) {
  return t === Symbol.asyncIterator && Je(e, [IDBIndex, IDBObjectStore, IDBCursor]) || t === "iterate" && Je(e, [IDBIndex, IDBObjectStore]);
}
Fn((e) => ({
  ...e,
  get(t, n, r) {
    return Mt(t, n) ? Vc : e.get(t, n, r);
  },
  has(t, n) {
    return Mt(t, n) || e.has(t, n);
  }
}));
Promise.resolve(void 0);
const Kc = [
  { value: "last-month", label: "Last Month" },
  { value: "month", label: "This Month" },
  { value: "all-time", label: "All Time" },
  { value: "custom", label: "Custom Range" }
];
new Set(
  Kc.map((e) => e.value)
);
const Wc = [
  "Needs review",
  "Not due",
  "1-30 days",
  "31-60 days",
  "61-90 days",
  "90+ days"
];
Wc.reduce((e, t, n) => (e.set(t, n), e), /* @__PURE__ */ new Map());
const de = 1;
function Hc(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_control" && t.protocolVersion === de && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && t.action === "revoke";
}
function Xc(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.grant;
  return t.type === "agent_bridge_approval_grant" && t.protocolVersion === de && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && !!n && typeof n == "object" && typeof n.id == "string" && n.id.trim().length > 0 && typeof n.clientId == "string" && n.clientId.trim().length > 0 && (n.label === void 0 || typeof n.label == "string") && Array.isArray(n.scopes) && n.scopes.every((r) => typeof r == "string") && typeof n.secretKeyBase64Url == "string" && n.secretKeyBase64Url.trim().length > 0 && typeof n.createdAt == "number" && Number.isFinite(n.createdAt) && (n.expiresAt === void 0 || n.expiresAt === null || typeof n.expiresAt == "number" && Number.isFinite(n.expiresAt));
}
function Yc(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_approval_grant_revoke" && t.protocolVersion === de && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && typeof t.grantId == "string" && t.grantId.trim().length > 0 && typeof t.revokedAt == "number" && Number.isFinite(t.revokedAt);
}
const Jn = [
  "https://tasktime.pro",
  "https://www.tasktime.pro",
  "http://localhost:3101",
  "http://127.0.0.1:3101",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
], Qc = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]"
]);
function el(e) {
  return e.trim().toLowerCase();
}
function tl(e) {
  const t = el(e);
  if (Qc.has(t))
    return !0;
  const n = t.split(".");
  return n.length !== 4 || n[0] !== "127" ? !1 : n.every((r) => {
    if (!/^\d+$/.test(r))
      return !1;
    const o = Number(r);
    return o >= 0 && o <= 255;
  });
}
function nl(e) {
  if (!tl(e))
    throw new z("INVALID_INPUT", "Agent bridge server must bind to a loopback host.", { host: e });
}
function Zt(e) {
  try {
    return new URL(e).origin;
  } catch {
    return null;
  }
}
function rl(e, t = Jn) {
  if (!e)
    return !1;
  const n = Zt(e);
  return n ? new Set(Array.from(t).map((r) => Zt(r)).filter(Boolean)).has(n) : !1;
}
function ol(e, t) {
  if (!rl(e, t))
    throw new z("PERMISSION_DENIED", "Origin is not allowed to connect to the TaskTime Pro agent bridge.", {
      origin: e || null
    });
}
const il = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", al = "/tasktime-agent", sl = 12e4;
class cl {
  constructor(t, n, r = null) {
    this.id = n, this.session = r, this.socket = t;
  }
  sendJson(t) {
    this.socket.destroyed || this.socket.write(pl(JSON.stringify(t)));
  }
  close() {
    this.socket.destroy();
  }
}
function ll(e) {
  return nn("sha1").update(`${e}${il}`).digest("base64");
}
function pl(e) {
  const t = X.from(e), n = t.length;
  if (n < 126)
    return X.concat([
      X.from([129, n]),
      t
    ]);
  if (n <= 65535) {
    const o = X.alloc(4);
    return o[0] = 129, o[1] = 126, o.writeUInt16BE(n, 2), X.concat([o, t]);
  }
  const r = X.alloc(10);
  return r[0] = 129, r[1] = 127, r.writeBigUInt64BE(BigInt(n), 2), X.concat([r, t]);
}
function ul(e) {
  const t = [];
  let n = 0;
  for (; n + 2 <= e.length; ) {
    const r = e[n], o = e[n + 1], a = r & 15, i = (o & 128) === 128;
    let c = o & 127;
    if (n += 2, c === 126) {
      if (n + 2 > e.length) break;
      c = e.readUInt16BE(n), n += 2;
    } else if (c === 127) {
      if (n + 8 > e.length) break;
      const h = e.readBigUInt64BE(n);
      if (h > BigInt(Number.MAX_SAFE_INTEGER)) break;
      c = Number(h), n += 8;
    }
    let p = null;
    if (i) {
      if (n + 4 > e.length) break;
      p = e.subarray(n, n + 4), n += 4;
    }
    if (n + c > e.length) break;
    const l = X.from(e.subarray(n, n + c));
    if (n += c, p)
      for (let h = 0; h < l.length; h += 1)
        l[h] ^= p[h % 4];
    a === 1 && t.push(l.toString("utf8"));
  }
  return t;
}
function dl(e) {
  const t = e.headers.host || "127.0.0.1";
  return new URL(e.url || "/", `http://${t}`);
}
function ml(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.response;
  return t.protocolVersion === de && typeof t.requestId == "string" && !!n && typeof n == "object" && typeof n.command == "string" && typeof n.ok == "boolean";
}
class fl {
  constructor(t) {
    this.clients = /* @__PURE__ */ new Set(), this.pendingResponses = /* @__PURE__ */ new Map(), this.sessions = /* @__PURE__ */ new Map(), this.server = null, this.nextClientId = 0, this.authoritativeClientId = null, nl(t.host), this.options = t, this.auditLog = t.auditLog ?? new rn();
  }
  async start() {
    if (this.server)
      return;
    const t = dr();
    this.server = t, t.on("upgrade", (n, r) => {
      this.handleUpgrade(n, r);
    }), await new Promise((n) => {
      t.listen(this.options.port, this.options.host, n);
    });
  }
  async stop() {
    const t = this.server;
    this.server = null, this.rejectPendingResponses(new z("UNAVAILABLE", "Agent bridge server stopped."));
    for (const n of this.clients)
      n.close();
    this.clients.clear(), this.sessions.clear(), this.authoritativeClientId = null, t && await new Promise((n) => {
      t.close(() => n());
    });
  }
  getClientCount() {
    return this.clients.size;
  }
  getSessionCount() {
    return this.sessions.size;
  }
  getAuthoritativeClientId() {
    return this.authoritativeClientId;
  }
  getAuditEvents() {
    return this.auditLog.list();
  }
  getAddress() {
    return this.server?.address() ?? null;
  }
  broadcastJson(t) {
    for (const n of this.clients)
      n.sendJson(t);
  }
  disconnectClient(t) {
    const n = Array.from(this.clients).find((r) => r.id === t);
    return n ? (n.close(), !0) : !1;
  }
  revokeAllSessions(t) {
    this.audit({
      action: "access_revoked",
      clientId: t
    }), this.rejectPendingResponses(new z("PERMISSION_DENIED", "TaskTime Pro agent bridge access was revoked.")), this.sessions.clear();
    for (const n of this.clients)
      n.close();
  }
  createSessionRequest(t, n, r, o, a) {
    if (!t.session)
      throw new z("PERMISSION_DENIED", "TaskTime Pro app session is not paired.");
    const i = {
      protocolVersion: de,
      requestId: n,
      sessionToken: t.session.sessionToken,
      command: r,
      input: o
    };
    return a && (i.approval = a), i;
  }
  sendPairedAppSessionCommand(t, n, r, o = {}) {
    const a = this.getAuthoritativeClient(), i = this.createSessionRequest(a, t, n, r, o.approval);
    return this.sendAppSessionRequest(i, {
      ...o,
      client: a
    });
  }
  sendAppSessionRequest(t, n = {}) {
    const r = n.client || this.getAuthoritativeClient();
    if (this.pendingResponses.has(t.requestId))
      throw new z("CONFLICT", "Agent app-session request ID is already pending.", {
        requestId: t.requestId
      });
    return new Promise((o, a) => {
      const i = setTimeout(() => {
        this.pendingResponses.delete(t.requestId), this.audit({
          action: "command_failed",
          clientId: r.id,
          requestId: t.requestId,
          command: t.command,
          ok: !1,
          errorCode: "UNAVAILABLE",
          details: {
            reason: "timeout"
          }
        }), a(new z("UNAVAILABLE", "Agent app-session request timed out.", {
          requestId: t.requestId
        }));
      }, n.timeoutMs ?? sl);
      this.pendingResponses.set(t.requestId, {
        client: r,
        timeoutId: i,
        resolve: o,
        reject: a
      }), r.sendJson(t), this.audit({
        action: "command_dispatched",
        clientId: r.id,
        requestId: t.requestId,
        command: t.command
      });
    });
  }
  getAuthoritativeClient() {
    if (this.clients.size === 0)
      throw new z("UNAVAILABLE", "No TaskTime Pro app session is connected.");
    const t = Array.from(this.clients).find((n) => n.id === this.authoritativeClientId);
    if (!t)
      throw new z("UNAVAILABLE", "No authoritative TaskTime Pro app session is available.");
    return t;
  }
  electAuthoritativeClient() {
    this.authoritativeClientId = Array.from(this.clients)[0]?.id ?? null;
  }
  resolvePendingResponse(t, n) {
    const r = t.requestId;
    if (!r)
      return !1;
    const o = this.pendingResponses.get(r);
    return !o || o.client !== n ? !1 : (clearTimeout(o.timeoutId), this.pendingResponses.delete(r), o.resolve(t), this.audit({
      action: t.response.ok ? "command_completed" : "command_failed",
      clientId: n.id,
      requestId: r,
      command: t.response.command,
      ok: t.response.ok,
      errorCode: t.response.ok ? void 0 : t.response.error.code
    }), !0);
  }
  handleControlMessage(t, n) {
    return !n.session || t.sessionToken !== n.session.sessionToken ? (n.close(), !0) : t.action === "revoke" ? (this.revokeAllSessions(n.id), !0) : !1;
  }
  handleApprovalGrantMessage(t, n) {
    return !n.session || t.sessionToken !== n.session.sessionToken ? (n.close(), !0) : (this.audit({
      action: "approval_grant_received",
      clientId: n.id,
      details: {
        grantId: t.grant.id,
        grantClientId: t.grant.clientId,
        scopes: t.grant.scopes,
        expiresAt: t.grant.expiresAt ?? null
      }
    }), this.options.onApprovalGrantReceived?.(t.grant, n), !0);
  }
  handleApprovalGrantRevocationMessage(t, n) {
    return !n.session || t.sessionToken !== n.session.sessionToken ? (n.close(), !0) : (this.audit({
      action: "approval_grant_revoked",
      clientId: n.id,
      details: {
        grantId: t.grantId,
        revokedAt: t.revokedAt
      }
    }), this.options.onApprovalGrantRevoked?.(t.grantId, t.revokedAt, n), !0);
  }
  rejectPendingResponses(t, n) {
    for (const [r, o] of this.pendingResponses)
      n && o.client !== n || (clearTimeout(o.timeoutId), this.pendingResponses.delete(r), o.reject(t));
  }
  createSessionConnection(t) {
    const n = this.options.pairing, r = n?.now ? n.now() : Date.now(), o = t.searchParams.get("sessionToken")?.trim();
    if (o) {
      const l = this.sessions.get(o);
      if (!l || Or(l, r))
        throw l && this.sessions.delete(o), new z("PERMISSION_DENIED", "Agent bridge session expired or not found.");
      return {
        resumed: !0,
        session: l
      };
    }
    if (!n)
      return null;
    const a = t.searchParams.get("pairingId"), i = t.searchParams.get("pairingCode");
    if (!a || !i) {
      if (n.required === !1)
        return null;
      throw new z("PERMISSION_DENIED", "Pairing credentials are required for the TaskTime Pro agent bridge.");
    }
    const c = n.store.consume(a, i, r), p = zr({
      scopes: c.scopes,
      now: () => r,
      ttlMs: n.sessionTtlMs,
      tokenBytes: n.tokenBytes,
      tokenFactory: n.tokenFactory,
      agentId: c.agentId,
      agentLabel: c.agentLabel
    });
    return this.sessions.set(p.sessionToken, p), { challenge: c, resumed: !1, session: p };
  }
  createPairingMessage(t) {
    const n = {
      type: "agent_bridge_session",
      protocolVersion: de,
      sessionToken: t.sessionToken,
      scopes: Array.from(t.scopes),
      expiresAt: t.expiresAt
    };
    return t.agentId && (n.agentId = t.agentId), t.agentLabel && (n.agentLabel = t.agentLabel), n;
  }
  audit(t) {
    const n = this.auditLog.append(t);
    this.options.onAudit?.(n);
  }
  async handleUpgrade(t, n) {
    try {
      ol(t.headers.origin, this.options.allowedOrigins || Jn);
      const r = dl(t);
      if (r.pathname !== (this.options.path || al))
        throw new Error("Invalid agent bridge WebSocket path.");
      const o = t.headers["sec-websocket-key"];
      if (typeof o != "string" || !o.trim())
        throw new Error("Missing WebSocket key.");
      const a = this.createSessionConnection(r);
      n.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${ll(o)}`,
        "",
        ""
      ].join(`\r
`));
      const i = new cl(n, `client-${this.nextClientId++}`, a?.session ?? null);
      this.clients.add(i), this.authoritativeClientId || (this.authoritativeClientId = i.id), this.audit({
        action: "session_connected",
        clientId: i.id,
        details: {
          paired: !!a?.challenge,
          resumed: !!a?.resumed,
          authoritative: this.authoritativeClientId === i.id
        }
      }), a && (i.sendJson(this.createPairingMessage(a.session)), a.challenge && (this.audit({
        action: "pairing_succeeded",
        clientId: i.id,
        details: {
          pairingId: a.challenge.id,
          scopes: a.challenge.scopes,
          expiresAt: a.session.expiresAt
        }
      }), this.options.onSessionCreated?.(a.session, i, a.challenge))), this.options.onClientConnected?.(i), n.on("data", (c) => {
        for (const p of ul(c)) {
          let l;
          try {
            l = JSON.parse(p);
          } catch {
            l = p;
          }
          ml(l) && this.resolvePendingResponse(l, i) || Hc(l) && this.handleControlMessage(l, i) || Xc(l) && this.handleApprovalGrantMessage(l, i) || Yc(l) && this.handleApprovalGrantRevocationMessage(l, i) || this.options.onMessage?.(l, i);
        }
      }), n.on("end", () => {
        n.destroy();
      }), n.on("close", () => {
        const c = this.authoritativeClientId === i.id;
        this.clients.delete(i), c && this.electAuthoritativeClient(), this.rejectPendingResponses(new z("UNAVAILABLE", "TaskTime Pro app session disconnected."), i), this.audit({
          action: "session_disconnected",
          clientId: i.id,
          details: {
            wasAuthoritative: c,
            nextAuthoritativeClientId: this.authoritativeClientId
          }
        }), this.options.onClientDisconnected?.(i);
      });
    } catch {
      n.write(`HTTP/1.1 403 Forbidden\r
Connection: close\r
\r
`), n.destroy();
    }
  }
}
class hl {
  constructor(t) {
    this.pairingStore = new Pr(), this.approvalGrants = /* @__PURE__ */ new Map(), this.options = t, this.auditLog = t.auditLog ?? new rn();
    const n = {
      host: t.host,
      port: t.port,
      path: t.path,
      allowedOrigins: t.allowedOrigins,
      auditLog: this.auditLog,
      pairing: {
        store: this.pairingStore,
        now: t.now,
        sessionTtlMs: t.sessionTtlMs,
        tokenBytes: t.tokenBytes,
        tokenFactory: t.tokenFactory
      },
      onAudit: t.onAudit,
      onApprovalGrantReceived: (r) => {
        this.approvalGrants.set(r.id, r);
      },
      onApprovalGrantRevoked: (r) => {
        this.approvalGrants.delete(r);
      }
    };
    this.server = new fl(n);
  }
  async start() {
    await this.server.start();
  }
  async stop() {
    await this.server.stop();
  }
  createPairingChallenge(t) {
    return this.pairingStore.create({
      endpoint: this.getEndpoint(),
      scopes: t.scopes,
      now: this.options.now,
      ttlMs: t.ttlMs,
      codeLength: t.codeLength,
      idFactory: t.idFactory,
      codeFactory: t.codeFactory,
      agentId: t.agentId,
      agentLabel: t.agentLabel
    });
  }
  sendCommand(t, n, r, o, a) {
    return this.server.sendPairedAppSessionCommand(t, n, r, { timeoutMs: o, approval: a });
  }
  disconnectClient(t) {
    return this.server.disconnectClient(t);
  }
  revoke() {
    this.server.revokeAllSessions();
  }
  getAuditEvents() {
    return this.auditLog.list();
  }
  getApprovalGrant(t) {
    return this.approvalGrants.get(t) ?? null;
  }
  listApprovalGrants() {
    return Array.from(this.approvalGrants.values());
  }
  getClientCount() {
    return this.server.getClientCount();
  }
  getAuthoritativeClientId() {
    return this.server.getAuthoritativeClientId();
  }
  createApprovalToken(t) {
    const n = gl(t.scopes), r = this.options.now ? this.options.now() : Date.now(), o = t.grantId ? this.approvalGrants.get(t.grantId) ?? null : Array.from(this.approvalGrants.values()).find((a) => this.isGrantBoundToConfiguredAgent(a) && Ut(a.scopes, n)) ?? null;
    if (!o)
      throw new z("UNAVAILABLE", "No trusted TaskTime Pro approval grant is available for this bridge process.");
    if (!this.isGrantBoundToConfiguredAgent(o))
      throw new z("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant belongs to a different agent identity.");
    if (o.expiresAt != null && o.expiresAt <= r)
      throw new z("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant expired.");
    if (!Ut(o.scopes, n))
      throw new z("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant does not cover the requested scopes.");
    return vr({
      grant: o,
      command: t.command,
      inputHash: t.inputHash,
      scopes: n,
      category: t.category ?? yl(t.command, n),
      now: () => r,
      ttlMs: t.ttlMs,
      nonce: t.nonce
    });
  }
  getEndpoint() {
    const t = this.server.getAddress();
    if (!t || typeof t == "string")
      throw new z("UNAVAILABLE", "Local agent bridge must be started before creating a pairing challenge.");
    const n = this.options.path ?? "/tasktime-agent";
    return `ws://${bl(this.options.host, t)}:${t.port}${n}`;
  }
  isGrantBoundToConfiguredAgent(t) {
    return !this.options.agentId || t.clientId === this.options.agentId;
  }
}
function gl(e) {
  return [...new Set(e)];
}
function Ut(e, t) {
  const n = new Set(e);
  return t.every((r) => n.has(r));
}
function yl(e, t) {
  return t.includes("billing") ? "billing" : t.includes("email") ? "email" : t.includes("export") ? "export" : e.startsWith("delete_") || e.startsWith("cascade_delete_") || e.startsWith("restore_") || e === "undo_latest_invoice" ? "destructive" : "sensitive";
}
function bl(e, t) {
  return e === "::1" || t.family === "IPv6" ? "[::1]" : e;
}
const s = { type: "string" }, w = { type: "number" }, g = { type: "boolean" }, f = { type: ["string", "null"] }, qt = {
  type: "object",
  properties: {
    id: s,
    title: s,
    hours: w,
    hourlyRate: w,
    flatRate: w,
    quantity: w,
    useFlatRate: g,
    parentTaskId: f
  },
  required: ["title"],
  additionalProperties: !1
}, Xe = {
  projectId: s,
  clientId: f,
  businessInfoId: f,
  paymentMethodId: f,
  invoiceTemplateId: f,
  note: s,
  quoteDate: s,
  quoteTimestamp: s,
  quoteTasks: {
    type: "array",
    items: qt
  },
  additionalTasks: {
    type: "array",
    items: qt
  }
}, Bt = {
  ...Xe,
  emailTemplateId: f,
  to: f,
  fromName: f,
  replyTo: f,
  subject: f,
  body: f,
  attachmentTitle: f,
  forwardToSelf: g
}, q = {
  type: "object",
  properties: {},
  additionalProperties: !1
}, ut = [
  {
    name: "get_pairing_status",
    description: "Return the active local TaskTime Pro bridge endpoint, launch URL, pairing expiry, stable agent identity, and app-session status. This tool works before the browser app is paired.",
    scopes: [],
    inputSchema: q,
    bridgeLocal: !0
  },
  {
    name: "refresh_pairing",
    description: "Create a fresh local TaskTime Pro pairing challenge and launch URL for the same bridge process when the previous pairing code expired or was consumed. This tool works before the browser app is paired.",
    scopes: [],
    inputSchema: q,
    bridgeLocal: !0
  }
], Vn = [
  {
    name: "list_projects",
    description: "List active TaskTime Pro projects visible to the paired app session.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "create_project",
    description: "Create a non-archived TaskTime Pro project, optionally linked to an existing preferred client.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        title: s,
        description: s,
        hourlyRate: { type: ["number", "null"] },
        flatRate: g,
        preferredClientId: f,
        isPersonal: g,
        color: f,
        billableTimeIncrementMinutes: { type: ["number", "null"] },
        taskView: { type: "string", enum: ["list", "kanban"] },
        taskSort: { type: "string", enum: ["createdAt", "lastActive", "name", "manual"] },
        statusMode: { type: "string", enum: ["active", "quote"] },
        deadline: f,
        budgetAmount: { type: ["number", "null"] },
        idempotencyKey: s
      },
      required: ["title"],
      additionalProperties: !1
    }
  },
  {
    name: "update_project",
    description: "Update non-destructive project fields such as title, rates, client link, color, deadline, budget, and task view preferences.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        updates: {
          type: "object",
          additionalProperties: !0
        }
      },
      required: ["projectId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "archive_project",
    description: "Archive an existing project without deleting related data.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "unarchive_project",
    description: "Restore an archived project without changing related data.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_delete_project",
    description: "Preview the UI-style cascade impact of deleting a project without mutating data.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        includeInvoiceDeletion: g
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "cascade_delete_project",
    description: "Delete a project and related non-billed tasks, active time entries, timers, expenses, recurring templates, and planner attachments after preview matching, explicit confirmation, and TaskTime Pro approval. Invoice-linked, billed, or tax-claimed records are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        confirmDelete: g,
        confirmationText: s,
        expectedTaskIds: {
          type: "array",
          items: s
        },
        expectedTimeEntryIds: {
          type: "array",
          items: s
        },
        expectedTimerKeys: {
          type: "array",
          items: s
        },
        expectedExpenseIds: {
          type: "array",
          items: s
        },
        expectedRecurrenceIds: {
          type: "array",
          items: s
        },
        expectedPlannerAttachmentIds: {
          type: "array",
          items: s
        }
      },
      required: ["projectId", "confirmDelete", "confirmationText", "expectedTaskIds", "expectedTimeEntryIds"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_project",
    description: "Delete one unreferenced project after explicit command confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["projectId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_clients",
    description: "List TaskTime Pro clients visible to the paired app session.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        includeArchived: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_client",
    description: "Create a non-archived TaskTime Pro client with contact, billing, tax, and notes fields.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        title: s,
        clientName: s,
        contactPerson: s,
        email: s,
        phone: s,
        address: s,
        city: s,
        state: s,
        zip: s,
        country: s,
        registrationNumber: s,
        vat: s,
        taxNumber: s,
        notes: s,
        disableTax: g,
        defaultHourlyRate: { type: ["number", "null"] },
        hourlyRate: { type: ["number", "null"] },
        flatRate: g,
        defaultCurrency: s,
        color: f,
        idempotencyKey: s
      },
      required: ["title"],
      additionalProperties: !1
    }
  },
  {
    name: "update_client",
    description: "Update non-destructive client fields such as contact, billing, tax, notes, hourly rate, and color.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s,
        updates: {
          type: "object",
          additionalProperties: !0
        }
      },
      required: ["clientId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "archive_client",
    description: "Archive an existing client without deleting related data.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s
      },
      required: ["clientId"],
      additionalProperties: !1
    }
  },
  {
    name: "unarchive_client",
    description: "Restore an archived client without changing related data.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s
      },
      required: ["clientId"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_delete_client",
    description: "Preview the UI-style cascade impact of deleting a client without mutating data.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s,
        alsoDeleteProjects: g,
        includeInvoiceDeletion: g
      },
      required: ["clientId"],
      additionalProperties: !1
    }
  },
  {
    name: "cascade_delete_client",
    description: "Delete a client and either convert linked projects to personal or delete related non-billed project data after preview matching, explicit confirmation, and TaskTime Pro approval. Invoice-linked, billed, or tax-claimed records are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s,
        alsoDeleteProjects: g,
        confirmDelete: g,
        confirmationText: s,
        expectedProjectIdsToDelete: {
          type: "array",
          items: s
        },
        expectedProjectIdsToConvertToPersonal: {
          type: "array",
          items: s
        },
        expectedTaskIds: {
          type: "array",
          items: s
        },
        expectedTimeEntryIds: {
          type: "array",
          items: s
        },
        expectedTimerKeys: {
          type: "array",
          items: s
        },
        expectedExpenseIds: {
          type: "array",
          items: s
        },
        expectedRecurrenceIds: {
          type: "array",
          items: s
        },
        expectedPlannerAttachmentIds: {
          type: "array",
          items: s
        }
      },
      required: ["clientId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_client",
    description: "Delete one unreferenced client after explicit command confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["clientId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_business_infos",
    description: "List business profiles used for invoices, expenses, and tax/reporting context.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "create_business_info",
    description: "Create a business profile for invoice sender/tax details. Requires title/name and businessName/name.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        title: s,
        name: s,
        businessName: s,
        email: s,
        phone: s,
        address: s,
        city: s,
        state: s,
        zip: s,
        country: s,
        registrationNumber: s,
        vat: s,
        taxNumber: s,
        taxId: s,
        isDefault: g,
        taxEnabled: g,
        taxLabel: s,
        taxRate: w,
        branding: { type: "object" },
        idempotencyKey: s
      },
      additionalProperties: !1
    }
  },
  {
    name: "update_business_info",
    description: "Update a business profile without deleting invoices, expenses, or brand assets.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessInfoId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["businessInfoId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "set_default_business_info",
    description: "Set the default business profile and clear default status from the others.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessInfoId: s
      },
      required: ["businessInfoId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_business_info",
    description: "Delete one unreferenced business profile after explicit command confirmation and TaskTime Pro approval. Profiles referenced by invoices, brand assets, expenses, recurring templates, or tax return periods are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessInfoId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["businessInfoId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_business_brand_assets",
    description: "List business logo brand assets, optionally scoped to a business profile and including archived assets or data URLs.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        businessInfoId: s,
        includeArchived: g,
        includeDataUrl: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_business_brand_asset",
    description: "Create a validated business logo brand asset for an existing business profile, reusing an existing matching content hash when present.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        businessInfoId: s,
        kind: { type: "string", enum: ["logo"] },
        dataUrl: s,
        mimeType: { type: "string", enum: ["image/svg+xml", "image/png", "image/jpeg", "image/webp"] },
        fileName: f,
        width: w,
        height: w,
        byteSize: w,
        contentHash: s,
        idempotencyKey: s
      },
      required: ["businessInfoId", "dataUrl", "mimeType", "width", "height", "byteSize", "contentHash"],
      additionalProperties: !1
    }
  },
  {
    name: "update_business_brand_asset",
    description: "Update a business logo brand asset without deleting invoices or business profile references.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessBrandAssetId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["businessBrandAssetId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "archive_business_brand_asset",
    description: "Archive a business logo brand asset without deleting invoices or business profile references.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessBrandAssetId: s
      },
      required: ["businessBrandAssetId"],
      additionalProperties: !1
    }
  },
  {
    name: "unarchive_business_brand_asset",
    description: "Restore an archived business logo brand asset without changing invoices or business profile references.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessBrandAssetId: s
      },
      required: ["businessBrandAssetId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_business_brand_asset",
    description: "Delete one unreferenced business logo brand asset after explicit command confirmation and TaskTime Pro approval. Assets referenced by business profiles or invoice snapshots are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        businessBrandAssetId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["businessBrandAssetId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_payment_methods",
    description: "List payment methods used on invoices and expenses.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "create_payment_method",
    description: "Create a payment method. The first method becomes default unless specified otherwise.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        title: s,
        fullName: s,
        bank: s,
        iban: s,
        swift: s,
        bankAddress: s,
        paypal: s,
        instructions: s,
        custom: { type: "array" },
        isDefault: g,
        idempotencyKey: s
      },
      required: ["title"],
      additionalProperties: !1
    }
  },
  {
    name: "update_payment_method",
    description: "Update a payment method without deleting invoices or expenses that reference older snapshots.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        paymentMethodId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["paymentMethodId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "set_default_payment_method",
    description: "Set the default payment method and clear default status from the others.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        paymentMethodId: s
      },
      required: ["paymentMethodId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_payment_method",
    description: "Delete one unreferenced payment method after explicit command confirmation and TaskTime Pro approval. Payment methods referenced by invoices are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        paymentMethodId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["paymentMethodId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_invoice_templates",
    description: "List invoice templates, including sequence and branding defaults.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "create_invoice_template",
    description: "Create an invoice template with sequence, tax, notes, and branding defaults.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        name: s,
        prefix: s,
        useSequentialNumbers: g,
        currentSequentialNumber: w,
        defaultNotes: s,
        defaultTaxRate: w,
        defaultDueDays: w,
        isDefault: g,
        brandingOptions: { type: "object" },
        layoutStyle: { type: "string", enum: ["classic", "neutral"] },
        logoPlacement: { type: "string" },
        showBillingPeriod: g,
        showProjectTitle: g,
        idempotencyKey: s
      },
      required: ["name"],
      additionalProperties: !1
    }
  },
  {
    name: "update_invoice_template",
    description: "Update an invoice template. Sequence changes are allowed but should be deliberate.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceTemplateId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["invoiceTemplateId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "set_default_invoice_template",
    description: "Set the default invoice template and clear default status from the others.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceTemplateId: s
      },
      required: ["invoiceTemplateId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_invoice_template",
    description: "Delete one unreferenced invoice template after explicit command confirmation and TaskTime Pro approval. Templates referenced by invoices are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceTemplateId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["invoiceTemplateId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_email_templates",
    description: "List invoice/quote email templates, optionally filtered by template type.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        type: { type: ["string", "null"], enum: ["invoice", "quote", null] }
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_email_template",
    description: "Create an invoice or quote email template with subject, body, reminder body, and attachment filename defaults.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        name: s,
        type: { type: "string", enum: ["invoice", "quote"] },
        fromName: s,
        replyTo: s,
        subject: s,
        sendBody: s,
        reminderBody: s,
        attachmentTitle: s,
        isDefault: g,
        idempotencyKey: s
      },
      required: ["name", "type", "subject", "sendBody", "reminderBody", "attachmentTitle"],
      additionalProperties: !1
    }
  },
  {
    name: "update_email_template",
    description: "Update an invoice or quote email template.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        emailTemplateId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["emailTemplateId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "set_default_email_template",
    description: "Set the default email template for its type and clear default status from other templates of the same type.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        emailTemplateId: s
      },
      required: ["emailTemplateId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_email_template",
    description: "Delete one invoice or quote email template after explicit command confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        emailTemplateId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["emailTemplateId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_expense_categories",
    description: "List active expense categories used by expense and recurring expense workflows. Set includeArchived to true to include archived categories.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        includeArchived: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_expense_category",
    description: "Create a non-archived expense category through the validated settings collection.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        name: s,
        group: f,
        isDefault: g,
        archived: g,
        idempotencyKey: s
      },
      required: ["name"],
      additionalProperties: !1
    }
  },
  {
    name: "update_expense_category",
    description: "Update expense category metadata such as name, group, default flag, and archive state.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseCategoryId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["expenseCategoryId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "archive_expense_category",
    description: "Archive an expense category without deleting expenses or recurring templates that reference it.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseCategoryId: s
      },
      required: ["expenseCategoryId"],
      additionalProperties: !1
    }
  },
  {
    name: "unarchive_expense_category",
    description: "Restore an archived expense category without changing related expenses or recurring templates.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseCategoryId: s
      },
      required: ["expenseCategoryId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_expense_category",
    description: "Delete one unreferenced expense category after explicit command confirmation and TaskTime Pro approval. Categories referenced by expenses or recurring templates are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseCategoryId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["expenseCategoryId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "get_preferences",
    description: "Return validated TaskTime Pro user preferences. Sync/backup control state is readable but not mutable through update_preferences.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "update_preferences",
    description: "Update non-sync user preferences such as currency, theme, date/time format, default view, week start, task visibility, default billable behavior, sorting, weekly goals, and notification time. Sync/backup preferences are intentionally rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        updates: {
          type: "object",
          properties: {
            currency: s,
            dateFormat: s,
            timeFormat: s,
            theme: { type: "string", enum: ["light", "dark", "system"] },
            defaultView: s,
            weekStartsOn: w,
            autoHideTotalsOnRevisit: g,
            showCompletedTasks: g,
            defaultBillable: g,
            projectSort: { type: "string", enum: ["createdAt", "lastActive", "name"] },
            clientSort: { type: "string", enum: ["createdAt", "lastActive", "name"] },
            weeklyGoalTargetHours: { type: ["number", "null"] },
            weeklyGoalTargetEarnings: { type: ["number", "null"] },
            systemNotificationsEnabled: g,
            systemNotificationTime: s
          },
          additionalProperties: !1
        }
      },
      required: ["updates"],
      additionalProperties: !1
    }
  },
  {
    name: "list_tasks",
    description: "List TaskTime Pro tasks, optionally scoped to a project ID.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: f
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_task",
    description: "Create a TaskTime Pro task or subtask. Subtasks cannot be recurring.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        title: s,
        projectId: f,
        parentTaskId: f,
        note: f,
        billable: g,
        idempotencyKey: s
      },
      required: ["title"],
      additionalProperties: !0
    }
  },
  {
    name: "update_task",
    description: "Update an existing TaskTime Pro task.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        updates: { type: "object" }
      },
      required: ["taskId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "complete_task",
    description: "Complete a non-recurring task or a specific recurring occurrence.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        occurrenceDate: s
      },
      required: ["taskId"],
      additionalProperties: !1
    }
  },
  {
    name: "archive_task",
    description: "Archive a task using TaskTime Pro archive behavior. This is not a destructive delete.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s
      },
      required: ["taskId"],
      additionalProperties: !1
    }
  },
  {
    name: "unarchive_task",
    description: "Restore an archived task using TaskTime Pro unarchive behavior. This is not a destructive recreate.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s
      },
      required: ["taskId"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_delete_task",
    description: "Preview the UI-style cascade impact of deleting an active or archived task without mutating data.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s
      },
      required: ["taskId"],
      additionalProperties: !1
    }
  },
  {
    name: "cascade_delete_task",
    description: "Delete a task, descendant tasks, related active time entries, matching timers, and planner attachments after preview matching, explicit confirmation, and TaskTime Pro approval. Billed or invoice-linked tasks are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        confirmDelete: g,
        confirmationText: s,
        expectedTaskIds: {
          type: "array",
          items: s
        },
        expectedTimeEntryIds: {
          type: "array",
          items: s
        },
        expectedTimerKeys: {
          type: "array",
          items: s
        },
        expectedPlannerAttachmentIds: {
          type: "array",
          items: s
        }
      },
      required: ["taskId", "confirmDelete", "confirmationText", "expectedTaskIds", "expectedTimeEntryIds"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_task",
    description: "Delete one unreferenced active or archived task after explicit command confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["taskId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "get_active_timers",
    description: "List active timers with resolved timer keys and elapsed time.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "start_timer",
    description: "Start a timer for a task. Existing active timers for the same key are not overwritten.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        note: s,
        idempotencyKey: s
      },
      required: ["taskId"],
      additionalProperties: !1
    }
  },
  {
    name: "pause_timer",
    description: "Pause a timer by timer key or task ID.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        timerKey: s,
        taskId: s,
        pausedAt: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "resume_timer",
    description: "Resume a paused timer by timer key or task ID.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        timerKey: s,
        taskId: s,
        idempotencyKey: s
      },
      additionalProperties: !1
    }
  },
  {
    name: "stop_timer",
    description: "Stop a timer and create the matching time entry.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        timerKey: s,
        taskId: s
      },
      additionalProperties: !1
    }
  },
  {
    name: "clear_timer",
    description: "Discard an active timer without creating a time entry after explicit confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        timerKey: s,
        taskId: s,
        confirmClear: g,
        confirmationText: s
      },
      required: ["confirmClear", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "update_timer",
    description: "Update an active timer note and/or start timestamp.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        timerKey: s,
        taskId: s,
        startTime: w,
        note: f
      },
      additionalProperties: !1
    }
  },
  {
    name: "add_manual_time_entry",
    description: "Create a manual time entry after TaskTime Pro validates billing cutoffs and overlaps.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        start: w,
        end: w,
        note: s,
        billingIncrementMinutes: { type: ["number", "null"] },
        idempotencyKey: s
      },
      required: ["taskId", "start", "end"],
      additionalProperties: !1
    }
  },
  {
    name: "update_time_entry",
    description: "Edit an active unbilled time entry after validating task, billing cutoff, and overlap rules. Historical and billed entries are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        entryId: s,
        taskId: s,
        start: w,
        end: w,
        note: f,
        billingIncrementMinutes: { type: ["number", "null"] }
      },
      required: ["entryId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_time_entry",
    description: "Delete one active unbilled time entry after explicit command confirmation and TaskTime Pro approval. Historical and billed entries are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        entryId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["entryId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_planner_attachments",
    description: "List planner attachments, optionally filtered by entity, mode, date, or weekday.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["client", "project", "task"] },
        referenceId: s,
        mode: { type: "string", enum: ["static", "date", "weekday"] },
        date: s,
        weekday: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "attach_planner_item",
    description: "Attach a client, project, or task to the planner for a static pin, date, weekday, this week, or every week.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["client", "project", "task"] },
        referenceId: s,
        mode: { type: "string", enum: ["static", "date", "weekday", "week", "every-week"] },
        date: f,
        weekday: { type: ["number", "null"] },
        weekStartDate: f,
        includeWeekends: g,
        estimatedHours: { type: ["number", "null"] },
        duplicateMode: { type: "string", enum: ["reject", "skip", "overwrite"] },
        idempotencyKey: s
      },
      required: ["type", "referenceId", "mode"],
      additionalProperties: !1
    }
  },
  {
    name: "update_planner_attachment",
    description: "Update planner attachment options such as estimated hours.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        plannerAttachmentId: s,
        estimatedHours: { type: ["number", "null"] }
      },
      required: ["plannerAttachmentId"],
      additionalProperties: !1
    }
  },
  {
    name: "remove_planner_attachment",
    description: "Remove one planner attachment without deleting the referenced entity.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        plannerAttachmentId: s
      },
      required: ["plannerAttachmentId"],
      additionalProperties: !1
    }
  },
  {
    name: "list_daily_goals",
    description: "List weekday daily planner goals.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        weekday: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "set_daily_goal",
    description: "Set or clear a weekday daily planner goal.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        weekday: w,
        targetHours: { type: ["number", "null"] },
        targetEarnings: { type: ["number", "null"] }
      },
      required: ["weekday"],
      additionalProperties: !1
    }
  },
  {
    name: "remove_daily_goal",
    description: "Remove a weekday daily planner goal.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        weekday: w
      },
      required: ["weekday"],
      additionalProperties: !1
    }
  },
  {
    name: "get_project_notes",
    description: "Read project notes in persisted TipTap JSON format plus plain text.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "update_project_notes",
    description: "Update project notes with plain text or TipTap JSON using the same persisted notes payload as the UI.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        plainText: s,
        content: {
          type: ["object", "null"],
          additionalProperties: !0
        },
        clear: g
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "list_expenses",
    description: "List expenses, optionally scoped by client, project, or billable state.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: f,
        projectId: f,
        billableOnly: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_expense",
    description: "Create an expense through the TaskTime Pro command layer.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        title: s,
        date: s,
        amount: w,
        currency: s,
        isPersonal: g,
        billable: g,
        clientId: f,
        projectId: f,
        idempotencyKey: s
      },
      required: ["title", "date", "amount", "currency", "isPersonal", "billable"],
      additionalProperties: !0
    }
  },
  {
    name: "delete_expense",
    description: "Delete one active unbilled and unclaimed expense after explicit command confirmation and TaskTime Pro approval. Billed and tax-claimed expenses are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["expenseId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "list_expense_recurrences",
    description: "List recurring expense templates, optionally scoped by client/project or active status.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: g,
        clientId: f,
        projectId: f
      },
      additionalProperties: !1
    }
  },
  {
    name: "create_expense_recurrence",
    description: "Create a recurring expense template and optionally generate the initial expense instance when due, matching the UI flow.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        title: s,
        note: f,
        supplierName: f,
        paidBy: f,
        paymentMode: { type: "string", enum: ["manual", "auto"] },
        currency: s,
        amount: w,
        amountType: { type: "string", enum: ["fixed", "variable"] },
        repeat: { type: "string", enum: ["monthly", "yearly"] },
        monthlyType: { type: "string", enum: ["first", "last", "specific"] },
        monthlyDay: w,
        startDate: s,
        endDate: f,
        clientId: f,
        projectId: f,
        businessId: f,
        categoryId: f,
        isPersonal: g,
        billable: g,
        taxNumber: f,
        isTaxExempt: g,
        amountExcludingTax: { type: ["number", "null"] },
        taxLabel: f,
        taxRate: { type: ["number", "null"] },
        active: g,
        generateInitial: g,
        idempotencyKey: s
      },
      required: ["title", "currency", "amount", "amountType", "repeat", "startDate", "isPersonal", "billable", "isTaxExempt"],
      additionalProperties: !1
    }
  },
  {
    name: "update_expense_recurrence",
    description: "Update a recurring expense template for future generated expenses without mutating already-created expenses.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        recurrenceId: s,
        updates: { type: "object", additionalProperties: !0 }
      },
      required: ["recurrenceId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "pause_expense_recurrence",
    description: "Pause a recurring expense template without deleting generated expenses.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        recurrenceId: s
      },
      required: ["recurrenceId"],
      additionalProperties: !1
    }
  },
  {
    name: "resume_expense_recurrence",
    description: "Resume a paused recurring expense template without changing already-generated expenses.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        recurrenceId: s
      },
      required: ["recurrenceId"],
      additionalProperties: !1
    }
  },
  {
    name: "delete_expense_recurrence",
    description: "Delete one recurring expense template after explicit command confirmation and TaskTime Pro approval without deleting generated expenses.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        recurrenceId: s,
        confirmDelete: g,
        confirmationText: s
      },
      required: ["recurrenceId", "confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_expense_paid",
    description: "Mark an expense paid using existing TaskTime Pro payment snapshot behavior.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseId: s,
        amount: w,
        paidOn: f,
        paidBy: f
      },
      required: ["expenseId"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_expense_unpaid",
    description: "Mark an expense unpaid.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseId: s
      },
      required: ["expenseId"],
      additionalProperties: !1
    }
  },
  {
    name: "list_tax_return_periods",
    description: "List tax return periods used by Reports tax-claim workflows.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "create_tax_return_period",
    description: "Create a tax return period for VAT, income-tax, sales-tax, or other reporting workflows.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        id: s,
        title: s,
        type: { type: "string", enum: ["vat", "income-tax", "sales-tax", "other"] },
        startDate: s,
        endDate: s,
        businessInfoId: f,
        status: { type: "string", enum: ["draft", "filed", "paid"] },
        filedAt: { type: ["number", "null"] },
        paidAt: { type: ["number", "null"] },
        notes: f,
        idempotencyKey: s
      },
      required: ["title", "type", "startDate", "endDate"],
      additionalProperties: !1
    }
  },
  {
    name: "update_tax_return_period",
    description: "Update non-status tax return period metadata such as title, dates, business profile, and notes. Filing/payment status changes use explicit status tools.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taxReturnPeriodId: s,
        updates: {
          type: "object",
          additionalProperties: !0
        }
      },
      required: ["taxReturnPeriodId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_tax_return_period_filed",
    description: "Mark a tax return period filed after explicit confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taxReturnPeriodId: s,
        filedAt: w,
        confirmFiled: g
      },
      required: ["taxReturnPeriodId", "confirmFiled"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_tax_return_period_paid",
    description: "Mark a tax return period paid after explicit confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taxReturnPeriodId: s,
        filedAt: w,
        paidAt: w,
        confirmPaid: g
      },
      required: ["taxReturnPeriodId", "confirmPaid"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_expenses_tax_claimed",
    description: "Mark selected expenses as tax claimed against an existing tax return period after explicit confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseIds: {
          type: "array",
          items: s,
          minItems: 1
        },
        taxReturnPeriodId: s,
        confirmClaim: g
      },
      required: ["expenseIds", "taxReturnPeriodId", "confirmClaim"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_expenses_tax_unclaimed",
    description: "Clear tax claim status and period links from selected expenses after explicit confirmation and TaskTime Pro approval.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseIds: {
          type: "array",
          items: s,
          minItems: 1
        },
        confirmUnclaim: g
      },
      required: ["expenseIds", "confirmUnclaim"],
      additionalProperties: !1
    }
  },
  {
    name: "list_invoices",
    description: "List invoices as bounded summary records, optionally scoped by client, project, or status.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: f,
        projectId: f,
        status: { enum: ["draft", "sent", "paid", "overdue"] },
        limit: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "preview_invoice_from_unbilled_work",
    description: "Calculate a read-only invoice preview from unbilled project work. This does not create invoices, mark billing state, or advance invoice numbering.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        billingPeriodStart: s,
        billingPeriodEnd: s,
        includeClientLevelExpenses: g,
        exchangeRates: { type: ["object", "null"] }
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "create_invoice_draft",
    description: "Create a draft invoice from unbilled project work. This creates only a draft invoice record and does not mark entries or expenses billed, update task billing cutoffs, update project invoice references, or advance invoice numbering.",
    scopes: ["read", "write"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s,
        clientId: s,
        invoiceNumber: s,
        invoiceDate: s,
        dueDate: f,
        templateId: f,
        businessInfoId: f,
        paymentMethodId: f,
        notes: s,
        billingPeriodStart: s,
        billingPeriodEnd: s,
        includeClientLevelExpenses: g,
        exchangeRates: { type: ["object", "null"] },
        idempotencyKey: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "update_invoice_draft",
    description: "Edit allowed metadata, line items, totals, and UI composition fields on an existing draft invoice. This does not mark billing state, update task billing cutoffs, link projects, or advance invoice numbering.",
    scopes: ["read", "write"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        updates: {
          type: "object",
          additionalProperties: !0
        }
      },
      required: ["invoiceId", "updates"],
      additionalProperties: !1
    }
  },
  {
    name: "finalize_invoice",
    description: "Finalize an agent-created draft invoice after explicit confirmation. This marks matching active time entries and expenses billed, updates task billing cutoffs, links the invoice to the project, advances invoice sequence state, and changes the invoice from draft to sent.",
    scopes: ["read", "write", "billing"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        confirmFinalize: g,
        finalizedAt: w,
        idempotencyKey: s
      },
      required: ["invoiceId", "confirmFinalize"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_invoice_paid",
    description: "Mark an invoice paid after explicit confirmation. Cross-currency invoices require exchange rates so TaskTime Pro can store the existing payment currency snapshot.",
    scopes: ["read", "write", "billing"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        confirmPaid: g,
        paidAt: w,
        exchangeRates: { type: ["object", "null"] },
        idempotencyKey: s
      },
      required: ["invoiceId", "confirmPaid"],
      additionalProperties: !1
    }
  },
  {
    name: "mark_invoice_unpaid",
    description: "Mark an invoice unpaid after explicit confirmation, matching TaskTime Pro UI status fallback behavior.",
    scopes: ["read", "write", "billing"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        confirmUnpaid: g,
        referenceAt: w,
        idempotencyKey: s
      },
      required: ["invoiceId", "confirmUnpaid"],
      additionalProperties: !1
    }
  },
  {
    name: "undo_latest_invoice",
    description: "Undo the latest unpaid invoice after explicit confirmation text matching the invoice number. Restores billed time entries, invoice adjustments, quoted flat amounts, linked expenses, project invoice references, task cutoffs, and sequence state when safe.",
    scopes: ["read", "write", "billing"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        confirmUndo: g,
        confirmationText: s,
        undoneAt: w,
        idempotencyKey: s
      },
      required: ["invoiceId", "confirmUndo", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "export_invoice_pdf",
    description: "Generate and download an invoice PDF in the paired browser app session. The bridge returns status metadata only, not PDF bytes.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        filename: s
      },
      required: ["invoiceId"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_project_quote",
    description: "Build a non-persistent quote document from project estimates without creating invoices or billing side effects.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: Xe,
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "export_project_quote_pdf",
    description: "Generate and download a non-persistent project quote PDF in the paired browser app session. The bridge returns status metadata only, not PDF bytes.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        ...Xe,
        filename: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_project_quote_email",
    description: "Resolve project quote email recipient, template fields, body, and attachment title without sending email or mutating data.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: Bt,
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "send_project_quote_email",
    description: "Send a non-persistent project quote email through the paired browser app session after explicit confirmation and TaskTime Pro approval. Generates the quote PDF in-browser and does not update invoice records.",
    scopes: ["read", "email"],
    inputSchema: {
      type: "object",
      properties: {
        ...Bt,
        confirmSend: g,
        idempotencyKey: s
      },
      required: ["projectId", "confirmSend"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_invoice_email",
    description: "Resolve invoice email recipient, template, subject, body, and attachment filename without sending email or mutating invoice state.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        sendType: { type: "string", enum: ["invoice", "reminder", "quote"] },
        templateId: f,
        to: f,
        fromName: f,
        replyTo: f,
        subject: f,
        body: f,
        attachmentTitle: f,
        forwardToSelf: g
      },
      required: ["invoiceId"],
      additionalProperties: !1
    }
  },
  {
    name: "send_invoice_email",
    description: "Send an invoice, reminder, or quote email through the paired browser app session after explicit confirmation and TaskTime Pro approval. Generates the PDF in-browser and updates invoice sent metadata when applicable.",
    scopes: ["read", "write", "email"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        sendType: { type: "string", enum: ["invoice", "reminder", "quote"] },
        templateId: f,
        to: f,
        fromName: f,
        replyTo: f,
        subject: f,
        body: f,
        attachmentTitle: f,
        forwardToSelf: g,
        confirmSend: g,
        idempotencyKey: s
      },
      required: ["invoiceId", "confirmSend"],
      additionalProperties: !1
    }
  },
  {
    name: "get_dashboard_summary",
    description: "Get a bounded summary of current TaskTime Pro work, timers, unbilled time, expenses, and draft invoices.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "get_project_overview",
    description: "Get a bounded project summary with task, timer, unbilled time, expense, and invoice counts.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "get_client_overview",
    description: "Get a bounded client summary with project, expense, and invoice totals.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s
      },
      required: ["clientId"],
      additionalProperties: !1
    }
  },
  {
    name: "get_report_summary",
    description: "Get read-only Reports-page summaries for filtered invoices, expenses, hours, tax, outstanding, statement, work-summary, and to-invoice sections.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["overview", "monthly", "statement", "work-summary", "tax", "invoices", "outstanding", "expenses", "hours", "to-invoice"] },
        period: { type: "string", enum: ["this-month", "last-month", "this-quarter", "last-quarter", "this-year", "last-year", "custom"] },
        customStart: f,
        customEnd: f,
        businessId: f,
        clientId: f,
        projectId: f,
        categoryId: f,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        includeRows: g,
        rowLimit: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "export_report_csv",
    description: "Generate and download a CSV export for a Reports-page section in the paired browser app session without returning file contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["overview", "monthly", "statement", "work-summary", "tax", "invoices", "outstanding", "expenses", "hours", "to-invoice"] },
        period: { type: "string", enum: ["this-month", "last-month", "this-quarter", "last-quarter", "this-year", "last-year", "custom"] },
        customStart: f,
        customEnd: f,
        businessId: f,
        clientId: f,
        projectId: f,
        categoryId: f,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: w,
        filename: s
      },
      required: ["section"],
      additionalProperties: !1
    }
  },
  {
    name: "export_report_pdf",
    description: "Generate and download a PDF export for Reports-page sections that have existing UI PDF exporters, without returning file contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["overview", "monthly", "statement", "work-summary", "invoices", "outstanding", "expenses"] },
        period: { type: "string", enum: ["this-month", "last-month", "this-quarter", "last-quarter", "this-year", "last-year", "custom"] },
        customStart: f,
        customEnd: f,
        businessId: f,
        clientId: f,
        projectId: f,
        categoryId: f,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: w,
        filename: s
      },
      required: ["section"],
      additionalProperties: !1
    }
  },
  {
    name: "export_accountant_pack",
    description: "Generate and download the Reports accountant pack ZIP in the paired browser app session without returning file contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["this-month", "last-month", "this-quarter", "last-quarter", "this-year", "last-year", "custom"] },
        customStart: f,
        customEnd: f,
        businessId: f,
        clientId: f,
        projectId: f,
        categoryId: f,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: w,
        filename: s,
        includeInvoicePdfs: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "export_backup_json",
    description: "Export all TaskTime Pro backup data as a browser-downloaded JSON file without returning backup contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        filename: s,
        exportDate: s,
        refreshFromCloud: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "list_drive_backups",
    description: "List TaskTime Pro backup snapshots available in Google Drive without returning backup contents.",
    scopes: ["read", "export"],
    inputSchema: q
  },
  {
    name: "create_drive_backup",
    description: "Create a TaskTime Pro backup snapshot in Google Drive using the existing backup manager.",
    scopes: ["read", "export"],
    inputSchema: q
  },
  {
    name: "download_drive_backup_json",
    description: "Download a selected Google Drive backup as a browser JSON file without returning backup contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        backupId: s,
        filename: s
      },
      required: ["backupId"],
      additionalProperties: !1
    }
  },
  {
    name: "preview_backup_import_json",
    description: "Validate a TaskTime Pro backup JSON payload and return version/count metadata without changing current data.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        backupJson: s
      },
      required: ["backupJson"],
      additionalProperties: !1
    }
  },
  {
    name: "restore_backup_json",
    description: "Replace current local TaskTime Pro data with a validated backup JSON payload after explicit confirmation and TaskTime Pro approval. Requires confirmationText to equal RESTORE.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        backupJson: s,
        confirmRestore: g,
        confirmationText: s
      },
      required: ["backupJson", "confirmRestore", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "restore_drive_backup",
    description: "Replace current local TaskTime Pro data from a selected Google Drive backup after explicit confirmation and TaskTime Pro approval. Requires confirmationText to equal RESTORE.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        backupId: s,
        confirmRestore: g,
        confirmationText: s
      },
      required: ["backupId", "confirmRestore", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "get_sync_status",
    description: "Read current Google Drive sync status, auto-sync mode, pending changes, and backup preference metadata.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "update_sync_settings",
    description: "Update explicit Google Drive sync and backup preferences. Backup mode requires confirmBackupMode: true. Optional runSync triggers Sync Now after saving.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        autoSyncEnabled: g,
        autoSyncMode: { type: "string", enum: ["backup", "sync"] },
        backupEnabled: g,
        backupFrequencyHours: w,
        confirmBackupMode: g,
        runSync: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "delete_all_account_data",
    description: "Delete all local TaskTime Pro data and, when Drive is connected, wipe Drive sync data and backups after explicit confirmation and TaskTime Pro approval. Requires confirmationText to equal DELETE ALL DATA.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        confirmDelete: g,
        confirmationText: s,
        includeDriveData: g
      },
      required: ["confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "find_unbilled_time",
    description: "Find recent unbilled time entries, optionally scoped by project or task.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: f,
        taskId: f,
        limit: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "list_recent_entries",
    description: "List recent time entries as bounded summary records.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: f,
        taskId: f,
        limit: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "open_dashboard_view",
    description: "Open the TaskTime Pro dashboard route in the paired app session.",
    scopes: ["navigation"],
    inputSchema: q
  },
  {
    name: "open_planner_view",
    description: "Open the TaskTime Pro planner route, optionally for a specific year and week.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        year: w,
        week: w
      },
      additionalProperties: !1
    }
  },
  {
    name: "open_account_view",
    description: "Open the TaskTime Pro account route, optionally focused on a specific Account section.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["preferences", "email-templates", "sync", "agent", "data"]
        }
      },
      additionalProperties: !1
    }
  },
  {
    name: "open_project_view",
    description: "Open a project view in the paired TaskTime Pro app session after validating the project exists.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: s
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "open_client_view",
    description: "Open a client view in the paired TaskTime Pro app session after validating the client exists.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s
      },
      required: ["clientId"],
      additionalProperties: !1
    }
  },
  {
    name: "open_invoice_view",
    description: "Open the invoices route, optionally focused on an existing invoice.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s
      },
      additionalProperties: !1
    }
  },
  {
    name: "open_expenses_view",
    description: "Open the expenses route, optionally scoped by client or project.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        clientId: s,
        projectId: s
      },
      additionalProperties: !1
    }
  },
  {
    name: "open_reports_view",
    description: "Open the TaskTime Pro reports route in the paired app session.",
    scopes: ["navigation"],
    inputSchema: q
  },
  {
    name: "focus_running_timer",
    description: "Focus the TaskTime Pro app on a running timer by timer key or task ID.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        timerKey: s,
        taskId: s
      },
      additionalProperties: !1
    }
  }
];
function _l(e) {
  return [
    ...ut,
    ...Vn.filter((t) => t.scopes.every((n) => e.has(n)))
  ].sort((t, n) => t.name.localeCompare(n.name));
}
function Ft(e) {
  return ut.find((t) => t.name === e) ?? Vn.find((t) => t.name === e) ?? null;
}
function Gt(e) {
  return ut.some((t) => t.name === e);
}
const vl = (e) => e === null ? "null" : Array.isArray(e) ? "array" : typeof e;
function Jt(e, t) {
  const n = [];
  return Ye(e, t, "$", n), { valid: n.length === 0, errors: n };
}
function Ye(e, t, n, r) {
  if (!e || typeof e != "object") return;
  const o = Array.isArray(e.type) ? e.type : e.type ? [e.type] : [], a = vl(t);
  if (o.length > 0 && !o.includes(a)) {
    r.push(`${n} must be ${o.join(" or ")}, received ${a}`);
    return;
  }
  if (e.enum && !e.enum.some((i) => Object.is(i, t))) {
    r.push(`${n} must be one of the advertised enum values`);
    return;
  }
  if (a === "object") {
    const i = t, c = e.properties ?? {};
    for (const p of e.required ?? [])
      Object.prototype.hasOwnProperty.call(i, p) || r.push(`${n}.${p} is required`);
    for (const [p, l] of Object.entries(i)) {
      const h = c[p];
      h ? Ye(h, l, `${n}.${p}`, r) : e.additionalProperties === !1 && r.push(`${n}.${p} is not allowed`);
    }
  }
  if (a === "array") {
    const i = t;
    typeof e.minItems == "number" && i.length < e.minItems && r.push(`${n} must contain at least ${e.minItems} item(s)`), e.items && i.forEach((c, p) => Ye(e.items, c, `${n}[${p}]`, r));
  }
}
const Il = "2025-11-25", Ae = "2.0", wl = 120, kl = 6e4, Tl = 5 * 6e4;
class Sl {
  constructor(t) {
    if (this.toolCallCount = 0, this.nextRequestId = 0, this.bridge = t.bridge, this.scopes = new Set(t.scopes), this.commandTimeoutMs = t.commandTimeoutMs, this.requestIdFactory = t.requestIdFactory ?? (() => `mcp-request-${this.nextRequestId++}`), this.toolCallRateLimit = t.toolCallRateLimit ?? wl, this.toolCallRateWindowMs = t.toolCallRateWindowMs ?? kl, this.now = t.now ?? (() => Date.now()), !Number.isInteger(this.toolCallRateLimit) || this.toolCallRateLimit < 0)
      throw new Error("toolCallRateLimit must be a non-negative integer.");
    if (!Number.isInteger(this.toolCallRateWindowMs) || this.toolCallRateWindowMs <= 0)
      throw new Error("toolCallRateWindowMs must be a positive integer.");
    this.toolCallWindowStartedAt = this.now();
  }
  async handleMessage(t) {
    if (!Ol(t))
      return this.error(null, -32600, "Invalid JSON-RPC request.");
    if (t.id === void 0)
      return null;
    switch (t.method) {
      case "initialize":
        return this.result(t.id, {
          protocolVersion: Il,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "tasktime-local-bridge",
            version: "0.1.0"
          }
        });
      case "ping":
        return this.result(t.id, {});
      case "tools/list":
        return this.result(t.id, {
          tools: _l(this.scopes).map((n) => ({
            name: n.name,
            description: n.description,
            inputSchema: n.inputSchema
          }))
        });
      case "tools/call":
        return this.result(t.id, await this.callTool(t.params));
      case "tasktime/create_approval_token":
        return this.result(t.id, await this.createApprovalToken(t.params));
      default:
        return this.error(t.id, -32601, `Unsupported MCP method: ${t.method || "unknown"}`);
    }
  }
  async callTool(t) {
    const n = t;
    if (!n || typeof n != "object" || typeof n.name != "string")
      return C("INVALID_INPUT", "tools/call requires a string tool name.");
    const r = Ft(n.name);
    if (!r)
      return C("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.name}`);
    const o = n.arguments ?? {}, a = Jt(r.inputSchema, o);
    if (!a.valid)
      return C("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: a.errors
      });
    if (Gt(r.name))
      return this.callBridgeSetupTool(r.name);
    const i = r.scopes.find((l) => !this.scopes.has(l));
    if (i)
      return C("PERMISSION_DENIED", `Missing ${i} permission.`, {
        scope: i
      });
    const c = this.consumeToolCallBudget(r.name);
    if (c)
      return c;
    let p;
    try {
      p = await this.bridge.sendCommand(
        this.requestIdFactory(),
        r.name,
        o,
        this.commandTimeoutMs,
        Pl(n.approval)
      );
    } catch (l) {
      return l instanceof z ? C(l.code, l.message, Vt(l)) : C(
        "UNAVAILABLE",
        l instanceof Error ? l.message : "TaskTime Pro app session is unavailable.",
        Kn()
      );
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(p.response)
        }
      ],
      structuredContent: p.response,
      isError: !p.response.ok
    };
  }
  callBridgeSetupTool(t) {
    return t === "get_pairing_status" ? this.bridge.getPairingStatus ? Kt(t, this.bridge.getPairingStatus()) : C("UNAVAILABLE", "TaskTime Pro bridge pairing status is unavailable.") : this.bridge.refreshPairing ? Kt(t, this.bridge.refreshPairing()) : C("UNAVAILABLE", "TaskTime Pro bridge pairing refresh is unavailable.");
  }
  async createApprovalToken(t) {
    if (!this.bridge.createApprovalToken)
      return C("UNAVAILABLE", "TaskTime Pro approval-token signing is unavailable.");
    const n = t;
    if (!n || typeof n != "object" || typeof n.command != "string")
      return C("INVALID_INPUT", "tasktime/create_approval_token requires a string command.");
    const r = Ft(n.command);
    if (!r)
      return C("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.command}`);
    if (Gt(r.name))
      return C("INVALID_INPUT", `TaskTime Pro setup tool does not require approval tokens: ${n.command}`);
    const o = n.arguments ?? {}, a = Jt(r.inputSchema, o);
    if (!a.valid)
      return C("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: a.errors
      });
    const i = Al(n.scopes, r.scopes);
    if (!i)
      return C("INVALID_INPUT", "Approval token scopes must be an array of strings.");
    const c = i.find((l) => !this.scopes.has(l));
    if (c)
      return C("PERMISSION_DENIED", `Missing ${c} permission.`, {
        scope: c
      });
    const p = El(n.ttlMs);
    if (p === null)
      return C("INVALID_INPUT", "Approval token ttlMs must be a positive integer no greater than 300000.");
    try {
      const l = typeof n.inputHash == "string" ? n.inputHash : xl(o);
      return {
        approval: this.bridge.createApprovalToken({
          grantId: typeof n.grantId == "string" ? n.grantId : void 0,
          command: n.command,
          inputHash: l,
          scopes: i,
          category: typeof n.category == "string" ? n.category : void 0,
          ttlMs: p,
          nonce: typeof n.nonce == "string" ? n.nonce : void 0
        })
      };
    } catch (l) {
      return l instanceof z ? C(l.code, l.message, Vt(l)) : C("UNAVAILABLE", l instanceof Error ? l.message : "TaskTime Pro approval-token signing failed.");
    }
  }
  consumeToolCallBudget(t) {
    if (this.toolCallRateLimit <= 0)
      return null;
    const n = this.now();
    if (n - this.toolCallWindowStartedAt >= this.toolCallRateWindowMs && (this.toolCallWindowStartedAt = n, this.toolCallCount = 0), this.toolCallCount >= this.toolCallRateLimit) {
      const r = Math.max(0, this.toolCallRateWindowMs - (n - this.toolCallWindowStartedAt));
      return C("RATE_LIMITED", "TaskTime Pro MCP tool call rate limit exceeded.", {
        tool: t,
        limit: this.toolCallRateLimit,
        windowMs: this.toolCallRateWindowMs,
        retryAfterMs: r
      });
    }
    return this.toolCallCount += 1, null;
  }
  result(t, n) {
    return {
      jsonrpc: Ae,
      id: t,
      result: n
    };
  }
  error(t, n, r, o) {
    return {
      jsonrpc: Ae,
      id: t,
      error: {
        code: n,
        message: r,
        data: o
      }
    };
  }
}
function Pl(e) {
  if (!e || typeof e != "object")
    return;
  const t = e;
  if (!(typeof t.token != "string" || t.token.trim().length === 0))
    return t;
}
function Al(e, t) {
  return e === void 0 ? t : !Array.isArray(e) || !e.every((n) => typeof n == "string") ? null : e;
}
function Qe(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => Qe(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, Qe(n)])
  ) : null;
}
function xl(e) {
  const t = JSON.stringify(Qe(e ?? {}));
  return `sha256:${nn("sha256").update(t).digest("hex")}`;
}
function El(e) {
  if (e !== void 0)
    return !Number.isInteger(e) || e <= 0 || e > Tl ? null : e;
}
function Vt(e) {
  return e.code !== "UNAVAILABLE" ? e.details : {
    ...e.details,
    ...Kn()
  };
}
function Kn() {
  return {
    recovery: {
      action: "launch_tasktime",
      reason: "authoritative_app_session_required",
      message: "Open TaskTime Pro and connect the local agent bridge, then retry the tool call.",
      statusTool: "get_pairing_status",
      refreshTool: "refresh_pairing"
    }
  };
}
function Kt(e, t) {
  const n = {
    ok: !0,
    command: e,
    data: t
  };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(n)
      }
    ],
    structuredContent: n,
    isError: !1
  };
}
function C(e, t, n) {
  const r = {
    ok: !1,
    command: "tools/call",
    error: {
      code: e,
      message: t,
      details: n
    }
  };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(r)
      }
    ],
    structuredContent: r,
    isError: !0
  };
}
function jl(e) {
  let t = "";
  const n = (r) => {
    for (t += r.toString(); t.includes(`
`); ) {
      const o = t.indexOf(`
`), a = t.slice(0, o).trim();
      t = t.slice(o + 1), a && zl(a, e);
    }
  };
  return e.input.on("data", n), () => {
    e.input.off("data", n);
  };
}
async function zl(e, t) {
  try {
    const n = await t.server.handleMessage(JSON.parse(e));
    n && t.output.write(`${JSON.stringify(n)}
`);
  } catch (n) {
    const r = n instanceof Error ? n : new Error("MCP stdio message handling failed.");
    t.onError?.(r), t.output.write(`${JSON.stringify({
      jsonrpc: Ae,
      id: null,
      error: {
        code: -32700,
        message: r.message
      }
    })}
`);
  }
}
function Ol(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.jsonrpc === Ae && typeof t.method == "string";
}
const Dl = "127.0.0.1", Wt = 0, Wn = "/tasktime-agent", et = ["read", "write", "navigation"], Le = 300 * 1e3, Ht = 12e4, Xt = 120, Yt = 6e4, xe = "tasktime.agent.local-bridge", tt = "Local agent bridge", Ee = ["read", "write", "billing", "export", "email", "navigation"];
function Nl(e, t = process.env) {
  const n = {
    host: t.TASKTIME_AGENT_BRIDGE_HOST || Dl,
    port: K(t.TASKTIME_AGENT_BRIDGE_PORT, Wt, "TASKTIME_AGENT_BRIDGE_PORT"),
    path: t.TASKTIME_AGENT_BRIDGE_PATH || Wn,
    scopes: Yn(t.TASKTIME_AGENT_BRIDGE_SCOPES) ?? et,
    allowedOrigins: Xn(t.TASKTIME_AGENT_BRIDGE_ORIGINS),
    agentId: oe(t.TASKTIME_AGENT_ID, xe, "TASKTIME_AGENT_ID"),
    agentLabel: oe(t.TASKTIME_AGENT_LABEL, tt, "TASKTIME_AGENT_LABEL"),
    pairingTtlMs: K(t.TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS, Le, "TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS"),
    sessionTtlMs: Ul(t.TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS, "TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS"),
    commandTimeoutMs: K(t.TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS, Ht, "TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS"),
    toolCallRateLimit: K(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT, Xt, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT"),
    toolCallRateWindowMs: tn(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS, Yt, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS"),
    appUrl: ql(t.TASKTIME_APP_URL, "TASKTIME_APP_URL"),
    statusFile: Bl(t.TASKTIME_AGENT_BRIDGE_STATUS_FILE, "TASKTIME_AGENT_BRIDGE_STATUS_FILE"),
    help: !1,
    manifest: !1
  }, r = [], o = [];
  for (let a = 0; a < e.length; a += 1) {
    const i = e[a];
    switch (i) {
      case "--help":
      case "-h":
        n.help = !0;
        break;
      case "--manifest":
        n.manifest = !0;
        break;
      case "--host":
        n.host = Z(e, ++a, i);
        break;
      case "--port":
        n.port = K(Z(e, ++a, i), Wt, i);
        break;
      case "--path":
        n.path = en(Z(e, ++a, i));
        break;
      case "--scopes":
        n.scopes = Zl(Z(e, ++a, i), i);
        break;
      case "--scope":
        r.push(Qn(Z(e, ++a, i), i));
        break;
      case "--origin":
        o.push(Z(e, ++a, i));
        break;
      case "--agent-id":
        n.agentId = oe(Z(e, ++a, i), xe, i);
        break;
      case "--agent-label":
        n.agentLabel = oe(Z(e, ++a, i), tt, i);
        break;
      case "--pairing-ttl-ms":
        n.pairingTtlMs = K(Z(e, ++a, i), Le, i);
        break;
      case "--session-ttl-ms":
        n.sessionTtlMs = K(Z(e, ++a, i), Le, i);
        break;
      case "--command-timeout-ms":
        n.commandTimeoutMs = K(Z(e, ++a, i), Ht, i);
        break;
      case "--tool-rate-limit":
        n.toolCallRateLimit = K(Z(e, ++a, i), Xt, i);
        break;
      case "--tool-rate-window-ms":
        n.toolCallRateWindowMs = tn(Z(e, ++a, i), Yt, i);
        break;
      case "--app-url":
        n.appUrl = dt(Z(e, ++a, i), i);
        break;
      case "--status-file":
        n.statusFile = oe(Z(e, ++a, i), "", i);
        break;
      default:
        throw new Error(`Unsupported option: ${i}`);
    }
  }
  return r.length > 0 && (n.scopes = nt(r)), o.length > 0 && (n.allowedOrigins = o), n.path = en(n.path), n.scopes = nt(n.scopes), n;
}
function $l() {
  return [
    "TaskTime Pro local agent bridge",
    "",
    "Usage:",
    "  tasktime-agent-bridge [options]",
    "",
    "Options:",
    "  --host <host>                 Loopback host to bind. Default: 127.0.0.1",
    "  --port <port>                 Loopback port to bind. Default: 0",
    "  --path <path>                 App-session WebSocket path. Default: /tasktime-agent",
    "  --scopes <list>               Comma-separated scopes. Default: read,write,navigation",
    "  --scope <scope>               Add one scope. Can be repeated.",
    "  --origin <origin>             Allowed TaskTime Pro browser origin. Can be repeated.",
    "  --agent-id <id>               Stable local agent identity. Default: tasktime.agent.local-bridge",
    "  --agent-label <label>         User-facing local agent label. Default: Local agent bridge",
    "  --pairing-ttl-ms <ms>         Pairing code lifetime. Default: 300000",
    "  --session-ttl-ms <ms>         App-session token lifetime.",
    "  --command-timeout-ms <ms>     App command timeout. Default: 120000",
    "  --tool-rate-limit <count>     Max MCP tools/call requests per window. Default: 120. Use 0 to disable.",
    "  --tool-rate-window-ms <ms>    MCP tools/call rate-limit window. Default: 60000",
    "  --app-url <url>               Print a TaskTime Pro launch URL with pairing details.",
    "  --status-file <path>          Write machine-readable bridge pairing/status JSON.",
    "  --manifest                    Print local agent discovery metadata as JSON and exit.",
    "  --help                        Show this help.",
    "",
    "MCP JSON-RPC messages are read from stdin and written to stdout.",
    "Bridge status and pairing details are written to stderr."
  ].join(`
`);
}
function Cl() {
  return {
    schemaVersion: 1,
    app: {
      id: "pro.tasktime",
      name: "TaskTime Pro",
      category: "task-time-invoicing",
      localFirst: !0
    },
    docs: {
      llmsTxt: "https://tasktime.pro/llms.txt",
      agentDocs: "https://tasktime.pro/agents/",
      quickstart: "https://tasktime.pro/agents/quickstart/",
      security: "https://tasktime.pro/agents/security/",
      tools: "https://tasktime.pro/agents/tools/",
      mcpToolsJson: "https://tasktime.pro/agents/mcp-tools.json",
      skill: "https://tasktime.pro/agents/skill.md",
      claude: "https://tasktime.pro/agents/claude/",
      openClaw: "https://tasktime.pro/agents/openclaw/",
      debugging: "https://tasktime.pro/agents/debugging/"
    },
    bridge: {
      packageName: "@tasktimepro/agent-bridge",
      binary: "tasktime-agent-bridge",
      transport: "mcp-stdio-json-rpc",
      install: {
        npmPackage: "@tasktimepro/agent-bridge",
        officialMcpRegistryName: "pro.tasktime/agent-bridge",
        openClawBundlePackage: "@tasktimepro/openclaw",
        claudeCodeMarketplace: "tasktimepro",
        claudeCodeMarketplaceRepository: "https://github.com/tasktimepro/tasktime",
        claudeCodePlugin: "tasktime"
      },
      appSession: {
        protocol: "websocket",
        defaultPath: Wn,
        allowedHosts: ["127.0.0.1", "localhost", "::1"],
        pairingRequired: !0,
        defaultSessionTtlMs: 1440 * 60 * 1e3,
        resume: {
          queryParam: "sessionToken",
          memoryOnly: !0,
          until: ["session_expiry", "access_revocation", "bridge_process_exit"]
        }
      },
      statusFile: {
        argument: "--status-file",
        environment: "TASKTIME_AGENT_BRIDGE_STATUS_FILE",
        schemaVersion: 1
      },
      identity: {
        argument: "--agent-id",
        labelArgument: "--agent-label",
        defaultAgentId: xe
      },
      defaultScopes: et,
      optionalScopes: Ee.filter((e) => !et.includes(e)),
      methods: {
        mcp: ["initialize", "ping", "tools/list", "tools/call"],
        tasktime: ["tasktime/create_approval_token"]
      },
      approvalTokens: {
        format: "tasktime-hmac-sha256-v1",
        requiresTrustedGrant: !0,
        trustedGrantDurations: ["until_revoked", "today", "30_days"],
        defaultTrustedGrantDuration: "until_revoked",
        maxTtlMs: 3e5,
        singleUse: !0
      },
      launch: {
        accountPath: "/account",
        sectionParam: {
          name: "section",
          value: "agent"
        },
        pairingParams: {
          endpoint: "agentBridgeEndpoint",
          pairingId: "agentBridgePairingId",
          pairingCode: "agentBridgePairingCode",
          agentId: "agentBridgeAgentId",
          agentLabel: "agentBridgeAgentLabel",
          scopes: "agentBridgeScopes"
        }
      },
      recovery: {
        unavailableAction: "launch_tasktime",
        reason: "authoritative_app_session_required",
        setupTools: ["get_pairing_status", "refresh_pairing"]
      }
    }
  };
}
function Hn(e, t) {
  const n = new URL(dt(t, "app URL"));
  return n.pathname = "/account", n.search = "", n.hash = "", n.searchParams.set("section", "agent"), n.searchParams.set("agentBridgeEndpoint", e.endpoint), n.searchParams.set("agentBridgePairingId", e.id), n.searchParams.set("agentBridgePairingCode", e.code), n.searchParams.set("agentBridgeScopes", e.scopes.join(",")), e.agentId && n.searchParams.set("agentBridgeAgentId", e.agentId), e.agentLabel && n.searchParams.set("agentBridgeAgentLabel", e.agentLabel), n.toString();
}
function Rl(e, t) {
  const n = [
    "TaskTime Pro local agent bridge is running.",
    `App endpoint: ${e.endpoint}`,
    `Pairing ID: ${e.id}`,
    `Pairing code: ${e.code}`,
    `Agent: ${e.agentLabel || tt} (${e.agentId || xe})`,
    `Scopes: ${e.scopes.join(",")}`,
    `Pairing expires at: ${new Date(e.expiresAt).toISOString()}`
  ];
  return t && n.push(`TaskTime Pro launch URL: ${Hn(e, t)}`), n.push(
    "",
    "Open TaskTime Pro and connect the agent bridge using the endpoint, pairing ID, and pairing code above."
  ), n.join(`
`);
}
async function Ll(e, t) {
  let n = null, r = null, o = null;
  const a = (/* @__PURE__ */ new Date()).toISOString(), i = e.statusFile ? ir(e.statusFile) : void 0, c = () => {
    if (!(!i || !r || !o))
      try {
        rr(ar(i), { recursive: !0 }), or(i, `${JSON.stringify(Qt({
          bridge: o,
          challenge: r,
          appUrl: e.appUrl,
          agentId: e.agentId,
          agentLabel: e.agentLabel,
          startedAt: a,
          activeSessionExpiresAt: n
        }), null, 2)}
`);
      } catch (M) {
        t.stderr.write(`TaskTime Pro bridge status file write failed: ${M instanceof Error ? M.message : String(M)}
`);
      }
  }, p = (M) => {
    M.action === "pairing_succeeded" && (n = typeof M.details?.expiresAt == "number" ? M.details.expiresAt : null), M.action === "session_disconnected" && o?.getClientCount() === 0 && (n = null), c();
  };
  o = new hl({
    host: e.host,
    port: e.port,
    path: e.path,
    agentId: e.agentId,
    allowedOrigins: e.allowedOrigins,
    sessionTtlMs: e.sessionTtlMs,
    onAudit: p
  }), await o.start();
  const l = o, h = () => (r = l.createPairingChallenge({
    scopes: e.scopes,
    ttlMs: e.pairingTtlMs,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  }), c(), r), y = () => Qt({
    bridge: l,
    challenge: r ?? h(),
    appUrl: e.appUrl,
    agentId: e.agentId,
    agentLabel: e.agentLabel,
    startedAt: a,
    activeSessionExpiresAt: n
  }), v = () => (h(), y()), I = h(), L = new Sl({
    bridge: {
      sendCommand: l.sendCommand.bind(l),
      createApprovalToken: l.createApprovalToken.bind(l),
      getPairingStatus: y,
      refreshPairing: v
    },
    scopes: e.scopes,
    commandTimeoutMs: e.commandTimeoutMs,
    toolCallRateLimit: e.toolCallRateLimit,
    toolCallRateWindowMs: e.toolCallRateWindowMs
  }), $ = jl({
    input: t.stdin,
    output: t.stdout,
    server: L,
    onError: (M) => {
      t.stderr.write(`TaskTime Pro MCP bridge error: ${M.message}
`);
    }
  });
  return t.stderr.write(`${Rl(I, e.appUrl)}
`), {
    bridge: l,
    challenge: I,
    getStatus: y,
    refreshPairing: v,
    stop: async () => {
      $(), await l.stop();
    }
  };
}
function Qt(e) {
  const t = Date.now();
  return {
    schemaVersion: 1,
    pid: process.pid,
    startedAt: e.startedAt,
    updatedAt: new Date(t).toISOString(),
    agent: {
      id: e.agentId,
      label: e.agentLabel
    },
    endpoint: e.challenge.endpoint,
    appUrl: e.appUrl,
    launchUrl: e.appUrl ? Hn(e.challenge, e.appUrl) : void 0,
    scopes: [...e.challenge.scopes],
    pairing: {
      id: e.challenge.id,
      code: e.challenge.code,
      expiresAt: new Date(e.challenge.expiresAt).toISOString(),
      expired: e.challenge.expiresAt <= t
    },
    session: {
      paired: e.bridge.getClientCount() > 0,
      clientCount: e.bridge.getClientCount(),
      authoritativeClientId: e.bridge.getAuthoritativeClientId(),
      expiresAt: e.activeSessionExpiresAt ? new Date(e.activeSessionExpiresAt).toISOString() : void 0
    }
  };
}
async function Ml(e = process.argv.slice(2), t = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
}, n = process.env) {
  const r = Nl(e, n);
  if (r.help)
    return t.stderr.write(`${$l()}
`), null;
  if (r.manifest)
    return t.stdout.write(`${JSON.stringify(Cl(), null, 2)}
`), null;
  const o = await Ll(r, t), a = async () => {
    await o.stop(), process.exit(0);
  };
  return process.once("SIGINT", () => {
    a();
  }), process.once("SIGTERM", () => {
    a();
  }), o;
}
function Xn(e) {
  if (!e)
    return;
  const t = e.split(",").map((n) => n.trim()).filter(Boolean);
  return t.length > 0 ? t : void 0;
}
function Zl(e, t) {
  const n = Yn(e);
  if (!n || n.length === 0)
    throw new Error(`${t} must include at least one scope.`);
  return n;
}
function Yn(e) {
  const t = Xn(e);
  if (t)
    return nt(t.map((n) => Qn(n, "scope")));
}
function Qn(e, t) {
  if (Ee.includes(e))
    return e;
  throw new Error(`${t} must be one of: ${Ee.join(", ")}`);
}
function nt(e) {
  return Ee.filter((t) => e.includes(t));
}
function en(e) {
  return e.startsWith("/") ? e : `/${e}`;
}
function Z(e, t, n) {
  const r = e[t];
  if (!r || r.startsWith("--"))
    throw new Error(`${n} requires a value.`);
  return r;
}
function K(e, t, n) {
  if (e === void 0 || e === "")
    return t;
  const r = Number(e);
  if (!Number.isInteger(r) || r < 0)
    throw new Error(`${n} must be a non-negative integer.`);
  return r;
}
function Ul(e, t) {
  if (!(e === void 0 || e === ""))
    return K(e, 0, t);
}
function tn(e, t, n) {
  const r = K(e, t, n);
  if (r <= 0)
    throw new Error(`${n} must be a positive integer.`);
  return r;
}
function ql(e, t) {
  if (e)
    return dt(e, t);
}
function Bl(e, t) {
  if (!(e === void 0 || e === ""))
    return oe(e, "", t);
}
function oe(e, t, n) {
  const r = e === void 0 ? t : e;
  if (!r.trim())
    throw new Error(`${n} must be a non-empty string.`);
  return r.trim();
}
function dt(e, t) {
  let n;
  try {
    n = new URL(e);
  } catch {
    throw new Error(`${t} must be a valid http:// or https:// URL.`);
  }
  if (n.protocol !== "http:" && n.protocol !== "https:")
    throw new Error(`${t} must be a valid http:// or https:// URL.`);
  return n.toString();
}
function Fl() {
  const e = process.argv[1];
  if (!e)
    return !1;
  try {
    return mt(e) === mt(sr(import.meta.url));
  } catch {
    return import.meta.url === cr(e).href;
  }
}
Fl() && Ml().catch((e) => {
  process.stderr.write(`TaskTime Pro local agent bridge failed: ${e instanceof Error ? e.message : String(e)}
`), process.exitCode = 1;
});
export {
  Hn as buildTaskTimeAgentBridgeLaunchUrl,
  Rl as formatPairingInstructions,
  $l as getTaskTimeAgentBridgeCliUsage,
  Cl as getTaskTimeAgentBridgeManifest,
  Nl as parseTaskTimeAgentBridgeCliOptions,
  Ml as runTaskTimeAgentBridgeCli,
  Ll as startTaskTimeAgentBridgeCli
};
