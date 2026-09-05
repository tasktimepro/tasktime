#!/usr/bin/env node
import { realpathSync as bt, unlinkSync as yr, mkdirSync as br, writeFileSync as _r, chmodSync as _t, renameSync as vr } from "node:fs";
import { resolve as Ir, dirname as Tr } from "node:path";
import { fileURLToPath as wr, pathToFileURL as kr } from "node:url";
import { randomUUID as ue, randomBytes as fn, createHmac as Sr, randomInt as Ar, createHash as hn } from "node:crypto";
import { Buffer as Y } from "node:buffer";
import { createServer as Pr } from "node:http";
class j extends Error {
  constructor(t, n, r) {
    super(n), this.name = "AgentCommandError", this.code = t, this.details = r;
  }
}
const Er = 500;
function xr(e) {
  return e.startsWith("export_") || e === "create_cloud_backup" || e === "create_drive_backup" || e === "download_cloud_backup_json" || e === "download_drive_backup_json" ? "export" : e.startsWith("open_") || e.startsWith("focus_") ? "navigation" : e.includes("invoice") || e.includes("billed") || e.includes("billing") ? e.includes("email") ? "email" : "billing" : e.startsWith("list_") || e.startsWith("get_") || e.startsWith("find_") || e.startsWith("preview_") ? "read" : e.startsWith("create_") || e.startsWith("update_") || e.startsWith("complete_") || e.startsWith("archive_") || e.startsWith("unarchive_") || e.startsWith("start_") || e.startsWith("pause_") || e.startsWith("stop_") || e.startsWith("add_") || e.startsWith("mark_") || e.startsWith("finalize_") || e.startsWith("restore_") || e.startsWith("delete_") ? "write" : "unknown";
}
class gn {
  constructor(t = {}) {
    this.events = [], this.nextId = 0, this.maxEvents = t.maxEvents ?? Er, this.now = t.now ?? Date.now, this.idFactory = t.idFactory ?? (() => `bridge-audit-${this.nextId++}`);
  }
  append(t) {
    const n = {
      id: this.idFactory(),
      timestamp: this.now(),
      action: t.action
    }, r = t.commandCategory ?? (t.command ? xr(t.command) : void 0);
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
const jr = "tasktime-hmac-sha256-v1", Nr = 6e4;
function yn(e) {
  return [...new Set(e)].sort();
}
function qe(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => qe(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, qe(n)])
  ) : null;
}
function zr(e) {
  return JSON.stringify(qe({
    ...e,
    scopes: yn(e.scopes)
  }));
}
function Or(e) {
  const t = e.replace(/-/g, "+").replace(/_/g, "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return Buffer.from(n, "base64");
}
function Dr(e, t) {
  return Sr("sha256", Or(t)).update(zr(e)).digest("base64url");
}
function Rr(e) {
  const t = e.now ? e.now() : Date.now(), n = t + (e.ttlMs ?? Nr), r = e.nonce ?? (typeof ue == "function" ? ue() : fn(16).toString("base64url")), o = {
    format: jr,
    grantId: e.grant.id,
    command: e.command,
    inputHash: e.inputHash,
    category: e.category,
    scopes: yn(e.scopes),
    nonce: r,
    issuedAt: t,
    expiresAt: n
  };
  return {
    format: o.format,
    grantId: o.grantId,
    token: Dr(o, e.grant.secretKeyBase64Url),
    issuedAt: o.issuedAt,
    expiresAt: o.expiresAt,
    nonce: o.nonce,
    command: o.command,
    inputHash: o.inputHash,
    scopes: o.scopes,
    category: o.category
  };
}
const Cr = 300 * 1e3, $r = 6;
function Lr(e) {
  let t = "";
  for (let n = 0; n < e; n += 1)
    t += String(Ar(0, 10));
  return t;
}
function Mr(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? Cr, r = e.codeLength ?? $r;
  return {
    id: e.idFactory ? e.idFactory() : ue(),
    code: e.codeFactory ? e.codeFactory(r) : Lr(r),
    endpoint: e.endpoint,
    scopes: [...e.scopes],
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function Zr(e, t = Date.now()) {
  return t >= e.expiresAt;
}
class Ur {
  constructor() {
    this.challenges = /* @__PURE__ */ new Map();
  }
  create(t) {
    const n = Mr(t);
    return this.challenges.set(n.id, n), n;
  }
  get(t) {
    return this.challenges.get(t) || null;
  }
  consume(t, n, r = Date.now()) {
    const o = this.challenges.get(t);
    if (!o)
      throw new j("NOT_FOUND", "Pairing challenge not found.", { id: t });
    if (Zr(o, r))
      throw this.challenges.delete(t), new j("PERMISSION_DENIED", "Pairing challenge expired.", { id: t });
    if (o.code !== n)
      throw new j("PERMISSION_DENIED", "Pairing code is invalid.", { id: t });
    return this.challenges.delete(t), o;
  }
  delete(t) {
    this.challenges.delete(t);
  }
}
const Br = 1440 * 60 * 1e3, qr = 32;
function Fr() {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Secure random token generation is unavailable.");
  return globalThis.crypto;
}
function Gr(e = qr) {
  const t = new Uint8Array(e);
  return Fr().getRandomValues(t), Array.from(t).map((n) => n.toString(16).padStart(2, "0")).join("");
}
function vt(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? Br;
  return {
    sessionToken: e.tokenFactory ? e.tokenFactory(e.tokenBytes) : Gr(e.tokenBytes),
    scopes: new Set(e.scopes),
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function It(e, t = Date.now()) {
  return t >= e.expiresAt;
}
function u(e, t, n) {
  function r(c, l) {
    if (c._zod || Object.defineProperty(c, "_zod", {
      value: {
        def: l,
        constr: i,
        traits: /* @__PURE__ */ new Set()
      },
      enumerable: !1
    }), c._zod.traits.has(e))
      return;
    c._zod.traits.add(e), t(c, l);
    const p = i.prototype, d = Object.keys(p);
    for (let y = 0; y < d.length; y++) {
      const v = d[y];
      v in c || (c[v] = p[v].bind(c));
    }
  }
  const o = n?.Parent ?? Object;
  class a extends o {
  }
  Object.defineProperty(a, "name", { value: e });
  function i(c) {
    var l;
    const p = n?.Parent ? new a() : this;
    r(p, c), (l = p._zod).deferred ?? (l.deferred = []);
    for (const d of p._zod.deferred)
      d();
    return p;
  }
  return Object.defineProperty(i, "init", { value: r }), Object.defineProperty(i, Symbol.hasInstance, {
    value: (c) => n?.Parent && c instanceof n.Parent ? !0 : c?._zod?.traits?.has(e)
  }), Object.defineProperty(i, "name", { value: e }), i;
}
class de extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class bn extends Error {
  constructor(t) {
    super(`Encountered unidirectional transform during encode: ${t}`), this.name = "ZodEncodeError";
  }
}
const Fe = {};
function Q(e) {
  return e && Object.assign(Fe, e), Fe;
}
function _n(e) {
  const t = Object.values(e).filter((r) => typeof r == "number");
  return Object.entries(e).filter(([r, o]) => t.indexOf(+r) === -1).map(([r, o]) => o);
}
function Ge(e, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
function at(e) {
  return {
    get value() {
      {
        const t = e();
        return Object.defineProperty(this, "value", { value: t }), t;
      }
    }
  };
}
function st(e) {
  return e == null;
}
function ct(e) {
  const t = e.startsWith("^") ? 1 : 0, n = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(t, n);
}
function Vr(e, t) {
  const n = (e.toString().split(".")[1] || "").length, r = t.toString();
  let o = (r.split(".")[1] || "").length;
  if (o === 0 && /\d?e-\d?/.test(r)) {
    const l = r.match(/\d?e-(\d?)/);
    l?.[1] && (o = Number.parseInt(l[1]));
  }
  const a = n > o ? n : o, i = Number.parseInt(e.toFixed(a).replace(".", "")), c = Number.parseInt(t.toFixed(a).replace(".", ""));
  return i % c / 10 ** a;
}
const Tt = /* @__PURE__ */ Symbol("evaluating");
function S(e, t, n) {
  let r;
  Object.defineProperty(e, t, {
    get() {
      if (r !== Tt)
        return r === void 0 && (r = Tt, r = n()), r;
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
function ae(e, t, n) {
  Object.defineProperty(e, t, {
    value: n,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function oe(...e) {
  const t = {};
  for (const n of e) {
    const r = Object.getOwnPropertyDescriptors(n);
    Object.assign(t, r);
  }
  return Object.defineProperties({}, t);
}
function wt(e) {
  return JSON.stringify(e);
}
function Kr(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const vn = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function ke(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
const Jr = at(() => {
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare"))
    return !1;
  try {
    const e = Function;
    return new e(""), !0;
  } catch {
    return !1;
  }
});
function he(e) {
  if (ke(e) === !1)
    return !1;
  const t = e.constructor;
  if (t === void 0 || typeof t != "function")
    return !0;
  const n = t.prototype;
  return !(ke(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function In(e) {
  return he(e) ? { ...e } : Array.isArray(e) ? [...e] : e;
}
const Wr = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function ge(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ie(e, t, n) {
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
function Hr(e) {
  return Object.keys(e).filter((t) => e[t]._zod.optin === "optional" && e[t]._zod.optout === "optional");
}
const Xr = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function Yr(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const a = oe(e._zod.def, {
    get shape() {
      const i = {};
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && (i[c] = n.shape[c]);
      }
      return ae(this, "shape", i), i;
    },
    checks: []
  });
  return ie(e, a);
}
function Qr(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const a = oe(e._zod.def, {
    get shape() {
      const i = { ...e._zod.def.shape };
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && delete i[c];
      }
      return ae(this, "shape", i), i;
    },
    checks: []
  });
  return ie(e, a);
}
function eo(e, t) {
  if (!he(t))
    throw new Error("Invalid input to extend: expected a plain object");
  const n = e._zod.def.checks;
  if (n && n.length > 0) {
    const a = e._zod.def.shape;
    for (const i in t)
      if (Object.getOwnPropertyDescriptor(a, i) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  const o = oe(e._zod.def, {
    get shape() {
      const a = { ...e._zod.def.shape, ...t };
      return ae(this, "shape", a), a;
    }
  });
  return ie(e, o);
}
function to(e, t) {
  if (!he(t))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const n = oe(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t };
      return ae(this, "shape", r), r;
    }
  });
  return ie(e, n);
}
function no(e, t) {
  const n = oe(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t._zod.def.shape };
      return ae(this, "shape", r), r;
    },
    get catchall() {
      return t._zod.def.catchall;
    },
    checks: []
    // delete existing checks
  });
  return ie(e, n);
}
function ro(e, t, n) {
  const o = t._zod.def.checks;
  if (o && o.length > 0)
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  const i = oe(t._zod.def, {
    get shape() {
      const c = t._zod.def.shape, l = { ...c };
      if (n)
        for (const p in n) {
          if (!(p in c))
            throw new Error(`Unrecognized key: "${p}"`);
          n[p] && (l[p] = e ? new e({
            type: "optional",
            innerType: c[p]
          }) : c[p]);
        }
      else
        for (const p in c)
          l[p] = e ? new e({
            type: "optional",
            innerType: c[p]
          }) : c[p];
      return ae(this, "shape", l), l;
    },
    checks: []
  });
  return ie(t, i);
}
function oo(e, t, n) {
  const r = oe(t._zod.def, {
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
      return ae(this, "shape", a), a;
    }
  });
  return ie(t, r);
}
function le(e, t = 0) {
  if (e.aborted === !0)
    return !0;
  for (let n = t; n < e.issues.length; n++)
    if (e.issues[n]?.continue !== !0)
      return !0;
  return !1;
}
function pe(e, t) {
  return t.map((n) => {
    var r;
    return (r = n).path ?? (r.path = []), n.path.unshift(e), n;
  });
}
function Ie(e) {
  return typeof e == "string" ? e : e?.message;
}
function ee(e, t, n) {
  const r = { ...e, path: e.path ?? [] };
  if (!e.message) {
    const o = Ie(e.inst?._zod.def?.error?.(e)) ?? Ie(t?.error?.(e)) ?? Ie(n.customError?.(e)) ?? Ie(n.localeError?.(e)) ?? "Invalid input";
    r.message = o;
  }
  return delete r.inst, delete r.continue, t?.reportInput || delete r.input, r;
}
function lt(e) {
  return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function ve(...e) {
  const [t, n, r] = e;
  return typeof t == "string" ? {
    message: t,
    code: "custom",
    input: n,
    inst: r
  } : { ...t };
}
const Tn = (e, t) => {
  e.name = "$ZodError", Object.defineProperty(e, "_zod", {
    value: e._zod,
    enumerable: !1
  }), Object.defineProperty(e, "issues", {
    value: t,
    enumerable: !1
  }), e.message = JSON.stringify(t, Ge, 2), Object.defineProperty(e, "toString", {
    value: () => e.message,
    enumerable: !1
  });
}, wn = u("$ZodError", Tn), kn = u("$ZodError", Tn, { Parent: Error });
function io(e, t = (n) => n.message) {
  const n = {}, r = [];
  for (const o of e.issues)
    o.path.length > 0 ? (n[o.path[0]] = n[o.path[0]] || [], n[o.path[0]].push(t(o))) : r.push(t(o));
  return { formErrors: r, fieldErrors: n };
}
function ao(e, t = (n) => n.message) {
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
          const l = a.path[c];
          c === a.path.length - 1 ? (i[l] = i[l] || { _errors: [] }, i[l]._errors.push(t(a))) : i[l] = i[l] || { _errors: [] }, i = i[l], c++;
        }
      }
  };
  return r(e), n;
}
const pt = (e) => (t, n, r, o) => {
  const a = r ? Object.assign(r, { async: !1 }) : { async: !1 }, i = t._zod.run({ value: n, issues: [] }, a);
  if (i instanceof Promise)
    throw new de();
  if (i.issues.length) {
    const c = new (o?.Err ?? e)(i.issues.map((l) => ee(l, a, Q())));
    throw vn(c, o?.callee), c;
  }
  return i.value;
}, ut = (e) => async (t, n, r, o) => {
  const a = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let i = t._zod.run({ value: n, issues: [] }, a);
  if (i instanceof Promise && (i = await i), i.issues.length) {
    const c = new (o?.Err ?? e)(i.issues.map((l) => ee(l, a, Q())));
    throw vn(c, o?.callee), c;
  }
  return i.value;
}, De = (e) => (t, n, r) => {
  const o = r ? { ...r, async: !1 } : { async: !1 }, a = t._zod.run({ value: n, issues: [] }, o);
  if (a instanceof Promise)
    throw new de();
  return a.issues.length ? {
    success: !1,
    error: new (e ?? wn)(a.issues.map((i) => ee(i, o, Q())))
  } : { success: !0, data: a.value };
}, so = /* @__PURE__ */ De(kn), Re = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let a = t._zod.run({ value: n, issues: [] }, o);
  return a instanceof Promise && (a = await a), a.issues.length ? {
    success: !1,
    error: new e(a.issues.map((i) => ee(i, o, Q())))
  } : { success: !0, data: a.value };
}, co = /* @__PURE__ */ Re(kn), lo = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return pt(e)(t, n, o);
}, po = (e) => (t, n, r) => pt(e)(t, n, r), uo = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return ut(e)(t, n, o);
}, mo = (e) => async (t, n, r) => ut(e)(t, n, r), fo = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return De(e)(t, n, o);
}, ho = (e) => (t, n, r) => De(e)(t, n, r), go = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return Re(e)(t, n, o);
}, yo = (e) => async (t, n, r) => Re(e)(t, n, r), bo = /^[cC][^\s-]{8,}$/, _o = /^[0-9a-z]+$/, vo = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, Io = /^[0-9a-vA-V]{20}$/, To = /^[A-Za-z0-9]{27}$/, wo = /^[a-zA-Z0-9_-]{21}$/, ko = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, So = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, kt = (e) => e ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, Ao = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, Po = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Eo() {
  return new RegExp(Po, "u");
}
const xo = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, jo = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, No = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, zo = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Oo = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, Sn = /^[A-Za-z0-9_-]*$/, Do = /^\+[1-9]\d{6,14}$/, An = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", Ro = /* @__PURE__ */ new RegExp(`^${An}$`);
function Pn(e) {
  const t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function Co(e) {
  return new RegExp(`^${Pn(e)}$`);
}
function $o(e) {
  const t = Pn({ precision: e.precision }), n = ["Z"];
  e.local && n.push(""), e.offset && n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const r = `${t}(?:${n.join("|")})`;
  return new RegExp(`^${An}T(?:${r})$`);
}
const Lo = (e) => {
  const t = e ? `[\\s\\S]{${e?.minimum ?? 0},${e?.maximum ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${t}$`);
}, Mo = /^-?\d+$/, En = /^-?\d+(?:\.\d+)?$/, Zo = /^(?:true|false)$/i, Uo = /^null$/i, Bo = /^[^A-Z]*$/, qo = /^[^a-z]*$/, F = /* @__PURE__ */ u("$ZodCheck", (e, t) => {
  var n;
  e._zod ?? (e._zod = {}), e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), xn = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, jn = /* @__PURE__ */ u("$ZodCheckLessThan", (e, t) => {
  F.init(e, t);
  const n = xn[typeof t.value];
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
}), Nn = /* @__PURE__ */ u("$ZodCheckGreaterThan", (e, t) => {
  F.init(e, t);
  const n = xn[typeof t.value];
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
}), Fo = /* @__PURE__ */ u("$ZodCheckMultipleOf", (e, t) => {
  F.init(e, t), e._zod.onattach.push((n) => {
    var r;
    (r = n._zod.bag).multipleOf ?? (r.multipleOf = t.value);
  }), e._zod.check = (n) => {
    if (typeof n.value != typeof t.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof n.value == "bigint" ? n.value % t.value === BigInt(0) : Vr(n.value, t.value) === 0) || n.issues.push({
      origin: typeof n.value,
      code: "not_multiple_of",
      divisor: t.value,
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Go = /* @__PURE__ */ u("$ZodCheckNumberFormat", (e, t) => {
  F.init(e, t), t.format = t.format || "float64";
  const n = t.format?.includes("int"), r = n ? "int" : "number", [o, a] = Xr[t.format];
  e._zod.onattach.push((i) => {
    const c = i._zod.bag;
    c.format = t.format, c.minimum = o, c.maximum = a, n && (c.pattern = Mo);
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
}), Vo = /* @__PURE__ */ u("$ZodCheckMaxLength", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !st(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    t.maximum < o && (r._zod.bag.maximum = t.maximum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length <= t.maximum)
      return;
    const i = lt(o);
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
}), Ko = /* @__PURE__ */ u("$ZodCheckMinLength", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !st(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    t.minimum > o && (r._zod.bag.minimum = t.minimum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length >= t.minimum)
      return;
    const i = lt(o);
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
}), Jo = /* @__PURE__ */ u("$ZodCheckLengthEquals", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !st(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.minimum = t.length, o.maximum = t.length, o.length = t.length;
  }), e._zod.check = (r) => {
    const o = r.value, a = o.length;
    if (a === t.length)
      return;
    const i = lt(o), c = a > t.length;
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
}), Ce = /* @__PURE__ */ u("$ZodCheckStringFormat", (e, t) => {
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
}), Wo = /* @__PURE__ */ u("$ZodCheckRegex", (e, t) => {
  Ce.init(e, t), e._zod.check = (n) => {
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
}), Ho = /* @__PURE__ */ u("$ZodCheckLowerCase", (e, t) => {
  t.pattern ?? (t.pattern = Bo), Ce.init(e, t);
}), Xo = /* @__PURE__ */ u("$ZodCheckUpperCase", (e, t) => {
  t.pattern ?? (t.pattern = qo), Ce.init(e, t);
}), Yo = /* @__PURE__ */ u("$ZodCheckIncludes", (e, t) => {
  F.init(e, t);
  const n = ge(t.includes), r = new RegExp(typeof t.position == "number" ? `^.{${t.position}}${n}` : n);
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
}), Qo = /* @__PURE__ */ u("$ZodCheckStartsWith", (e, t) => {
  F.init(e, t);
  const n = new RegExp(`^${ge(t.prefix)}.*`);
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
}), ei = /* @__PURE__ */ u("$ZodCheckEndsWith", (e, t) => {
  F.init(e, t);
  const n = new RegExp(`.*${ge(t.suffix)}$`);
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
}), ti = /* @__PURE__ */ u("$ZodCheckOverwrite", (e, t) => {
  F.init(e, t), e._zod.check = (n) => {
    n.value = t.tx(n.value);
  };
});
class ni {
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
const ri = {
  major: 4,
  minor: 3,
  patch: 6
}, P = /* @__PURE__ */ u("$ZodType", (e, t) => {
  var n;
  e ?? (e = {}), e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = ri;
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
    const o = (i, c, l) => {
      let p = le(i), d;
      for (const y of c) {
        if (y._zod.def.when) {
          if (!y._zod.def.when(i))
            continue;
        } else if (p)
          continue;
        const v = i.issues.length, T = y._zod.check(i);
        if (T instanceof Promise && l?.async === !1)
          throw new de();
        if (d || T instanceof Promise)
          d = (d ?? Promise.resolve()).then(async () => {
            await T, i.issues.length !== v && (p || (p = le(i, v)));
          });
        else {
          if (i.issues.length === v)
            continue;
          p || (p = le(i, v));
        }
      }
      return d ? d.then(() => i) : i;
    }, a = (i, c, l) => {
      if (le(i))
        return i.aborted = !0, i;
      const p = o(c, r, l);
      if (p instanceof Promise) {
        if (l.async === !1)
          throw new de();
        return p.then((d) => e._zod.parse(d, l));
      }
      return e._zod.parse(p, l);
    };
    e._zod.run = (i, c) => {
      if (c.skipChecks)
        return e._zod.parse(i, c);
      if (c.direction === "backward") {
        const p = e._zod.parse({ value: i.value, issues: [] }, { ...c, skipChecks: !0 });
        return p instanceof Promise ? p.then((d) => a(d, i, c)) : a(p, i, c);
      }
      const l = e._zod.parse(i, c);
      if (l instanceof Promise) {
        if (c.async === !1)
          throw new de();
        return l.then((p) => o(p, r, c));
      }
      return o(l, r, c);
    };
  }
  S(e, "~standard", () => ({
    validate: (o) => {
      try {
        const a = so(e, o);
        return a.success ? { value: a.data } : { issues: a.error?.issues };
      } catch {
        return co(e, o).then((i) => i.success ? { value: i.data } : { issues: i.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), dt = /* @__PURE__ */ u("$ZodString", (e, t) => {
  P.init(e, t), e._zod.pattern = [...e?._zod.bag?.patterns ?? []].pop() ?? Lo(e._zod.bag), e._zod.parse = (n, r) => {
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
}), x = /* @__PURE__ */ u("$ZodStringFormat", (e, t) => {
  Ce.init(e, t), dt.init(e, t);
}), oi = /* @__PURE__ */ u("$ZodGUID", (e, t) => {
  t.pattern ?? (t.pattern = So), x.init(e, t);
}), ii = /* @__PURE__ */ u("$ZodUUID", (e, t) => {
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
    t.pattern ?? (t.pattern = kt(r));
  } else
    t.pattern ?? (t.pattern = kt());
  x.init(e, t);
}), ai = /* @__PURE__ */ u("$ZodEmail", (e, t) => {
  t.pattern ?? (t.pattern = Ao), x.init(e, t);
}), si = /* @__PURE__ */ u("$ZodURL", (e, t) => {
  x.init(e, t), e._zod.check = (n) => {
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
}), ci = /* @__PURE__ */ u("$ZodEmoji", (e, t) => {
  t.pattern ?? (t.pattern = Eo()), x.init(e, t);
}), li = /* @__PURE__ */ u("$ZodNanoID", (e, t) => {
  t.pattern ?? (t.pattern = wo), x.init(e, t);
}), pi = /* @__PURE__ */ u("$ZodCUID", (e, t) => {
  t.pattern ?? (t.pattern = bo), x.init(e, t);
}), ui = /* @__PURE__ */ u("$ZodCUID2", (e, t) => {
  t.pattern ?? (t.pattern = _o), x.init(e, t);
}), di = /* @__PURE__ */ u("$ZodULID", (e, t) => {
  t.pattern ?? (t.pattern = vo), x.init(e, t);
}), mi = /* @__PURE__ */ u("$ZodXID", (e, t) => {
  t.pattern ?? (t.pattern = Io), x.init(e, t);
}), fi = /* @__PURE__ */ u("$ZodKSUID", (e, t) => {
  t.pattern ?? (t.pattern = To), x.init(e, t);
}), hi = /* @__PURE__ */ u("$ZodISODateTime", (e, t) => {
  t.pattern ?? (t.pattern = $o(t)), x.init(e, t);
}), gi = /* @__PURE__ */ u("$ZodISODate", (e, t) => {
  t.pattern ?? (t.pattern = Ro), x.init(e, t);
}), yi = /* @__PURE__ */ u("$ZodISOTime", (e, t) => {
  t.pattern ?? (t.pattern = Co(t)), x.init(e, t);
}), bi = /* @__PURE__ */ u("$ZodISODuration", (e, t) => {
  t.pattern ?? (t.pattern = ko), x.init(e, t);
}), _i = /* @__PURE__ */ u("$ZodIPv4", (e, t) => {
  t.pattern ?? (t.pattern = xo), x.init(e, t), e._zod.bag.format = "ipv4";
}), vi = /* @__PURE__ */ u("$ZodIPv6", (e, t) => {
  t.pattern ?? (t.pattern = jo), x.init(e, t), e._zod.bag.format = "ipv6", e._zod.check = (n) => {
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
}), Ii = /* @__PURE__ */ u("$ZodCIDRv4", (e, t) => {
  t.pattern ?? (t.pattern = No), x.init(e, t);
}), Ti = /* @__PURE__ */ u("$ZodCIDRv6", (e, t) => {
  t.pattern ?? (t.pattern = zo), x.init(e, t), e._zod.check = (n) => {
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
function zn(e) {
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
const wi = /* @__PURE__ */ u("$ZodBase64", (e, t) => {
  t.pattern ?? (t.pattern = Oo), x.init(e, t), e._zod.bag.contentEncoding = "base64", e._zod.check = (n) => {
    zn(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
});
function ki(e) {
  if (!Sn.test(e))
    return !1;
  const t = e.replace(/[-_]/g, (r) => r === "-" ? "+" : "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return zn(n);
}
const Si = /* @__PURE__ */ u("$ZodBase64URL", (e, t) => {
  t.pattern ?? (t.pattern = Sn), x.init(e, t), e._zod.bag.contentEncoding = "base64url", e._zod.check = (n) => {
    ki(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Ai = /* @__PURE__ */ u("$ZodE164", (e, t) => {
  t.pattern ?? (t.pattern = Do), x.init(e, t);
});
function Pi(e, t = null) {
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
const Ei = /* @__PURE__ */ u("$ZodJWT", (e, t) => {
  x.init(e, t), e._zod.check = (n) => {
    Pi(n.value, t.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), On = /* @__PURE__ */ u("$ZodNumber", (e, t) => {
  P.init(e, t), e._zod.pattern = e._zod.bag.pattern ?? En, e._zod.parse = (n, r) => {
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
}), xi = /* @__PURE__ */ u("$ZodNumberFormat", (e, t) => {
  Go.init(e, t), On.init(e, t);
}), ji = /* @__PURE__ */ u("$ZodBoolean", (e, t) => {
  P.init(e, t), e._zod.pattern = Zo, e._zod.parse = (n, r) => {
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
}), Ni = /* @__PURE__ */ u("$ZodNull", (e, t) => {
  P.init(e, t), e._zod.pattern = Uo, e._zod.values = /* @__PURE__ */ new Set([null]), e._zod.parse = (n, r) => {
    const o = n.value;
    return o === null || n.issues.push({
      expected: "null",
      code: "invalid_type",
      input: o,
      inst: e
    }), n;
  };
}), zi = /* @__PURE__ */ u("$ZodUnknown", (e, t) => {
  P.init(e, t), e._zod.parse = (n) => n;
}), Oi = /* @__PURE__ */ u("$ZodNever", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: e
  }), n);
});
function St(e, t, n) {
  e.issues.length && t.issues.push(...pe(n, e.issues)), t.value[n] = e.value;
}
const Di = /* @__PURE__ */ u("$ZodArray", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
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
      const c = o[i], l = t.element._zod.run({
        value: c,
        issues: []
      }, r);
      l instanceof Promise ? a.push(l.then((p) => St(p, n, i))) : St(l, n, i);
    }
    return a.length ? Promise.all(a).then(() => n) : n;
  };
});
function Se(e, t, n, r, o) {
  if (e.issues.length) {
    if (o && !(n in r))
      return;
    t.issues.push(...pe(n, e.issues));
  }
  e.value === void 0 ? n in r && (t.value[n] = void 0) : t.value[n] = e.value;
}
function Dn(e) {
  const t = Object.keys(e.shape);
  for (const r of t)
    if (!e.shape?.[r]?._zod?.traits?.has("$ZodType"))
      throw new Error(`Invalid element at key "${r}": expected a Zod schema`);
  const n = Hr(e.shape);
  return {
    ...e,
    keys: t,
    keySet: new Set(t),
    numKeys: t.length,
    optionalKeys: new Set(n)
  };
}
function Rn(e, t, n, r, o, a) {
  const i = [], c = o.keySet, l = o.catchall._zod, p = l.def.type, d = l.optout === "optional";
  for (const y in t) {
    if (c.has(y))
      continue;
    if (p === "never") {
      i.push(y);
      continue;
    }
    const v = l.run({ value: t[y], issues: [] }, r);
    v instanceof Promise ? e.push(v.then((T) => Se(T, n, y, t, d))) : Se(v, n, y, t, d);
  }
  return i.length && n.issues.push({
    code: "unrecognized_keys",
    keys: i,
    input: t,
    inst: a
  }), e.length ? Promise.all(e).then(() => n) : n;
}
const Ri = /* @__PURE__ */ u("$ZodObject", (e, t) => {
  if (P.init(e, t), !Object.getOwnPropertyDescriptor(t, "shape")?.get) {
    const c = t.shape;
    Object.defineProperty(t, "shape", {
      get: () => {
        const l = { ...c };
        return Object.defineProperty(t, "shape", {
          value: l
        }), l;
      }
    });
  }
  const r = at(() => Dn(t));
  S(e._zod, "propValues", () => {
    const c = t.shape, l = {};
    for (const p in c) {
      const d = c[p]._zod;
      if (d.values) {
        l[p] ?? (l[p] = /* @__PURE__ */ new Set());
        for (const y of d.values)
          l[p].add(y);
      }
    }
    return l;
  });
  const o = ke, a = t.catchall;
  let i;
  e._zod.parse = (c, l) => {
    i ?? (i = r.value);
    const p = c.value;
    if (!o(p))
      return c.issues.push({
        expected: "object",
        code: "invalid_type",
        input: p,
        inst: e
      }), c;
    c.value = {};
    const d = [], y = i.shape;
    for (const v of i.keys) {
      const T = y[v], M = T._zod.optout === "optional", R = T._zod.run({ value: p[v], issues: [] }, l);
      R instanceof Promise ? d.push(R.then(($) => Se($, c, v, p, M))) : Se(R, c, v, p, M);
    }
    return a ? Rn(d, p, c, l, r.value, e) : d.length ? Promise.all(d).then(() => c) : c;
  };
}), Ci = /* @__PURE__ */ u("$ZodObjectJIT", (e, t) => {
  Ri.init(e, t);
  const n = e._zod.parse, r = at(() => Dn(t)), o = (v) => {
    const T = new ni(["shape", "payload", "ctx"]), M = r.value, R = (X) => {
      const q = wt(X);
      return `shape[${q}]._zod.run({ value: input[${q}], issues: [] }, ctx)`;
    };
    T.write("const input = payload.value;");
    const $ = /* @__PURE__ */ Object.create(null);
    let be = 0;
    for (const X of M.keys)
      $[X] = `key_${be++}`;
    T.write("const newResult = {};");
    for (const X of M.keys) {
      const q = $[X], W = wt(X), gr = v[X]?._zod?.optout === "optional";
      T.write(`const ${q} = ${R(X)};`), gr ? T.write(`
        if (${q}.issues.length) {
          if (${W} in input) {
            payload.issues = payload.issues.concat(${q}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${W}, ...iss.path] : [${W}]
            })));
          }
        }

        if (${q}.value === undefined) {
          if (${W} in input) {
            newResult[${W}] = undefined;
          }
        } else {
          newResult[${W}] = ${q}.value;
        }

      `) : T.write(`
        if (${q}.issues.length) {
          payload.issues = payload.issues.concat(${q}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${W}, ...iss.path] : [${W}]
          })));
        }

        if (${q}.value === undefined) {
          if (${W} in input) {
            newResult[${W}] = undefined;
          }
        } else {
          newResult[${W}] = ${q}.value;
        }

      `);
    }
    T.write("payload.value = newResult;"), T.write("return payload;");
    const hr = T.compile();
    return (X, q) => hr(v, X, q);
  };
  let a;
  const i = ke, c = !Fe.jitless, p = c && Jr.value, d = t.catchall;
  let y;
  e._zod.parse = (v, T) => {
    y ?? (y = r.value);
    const M = v.value;
    return i(M) ? c && p && T?.async === !1 && T.jitless !== !0 ? (a || (a = o(t.shape)), v = a(v, T), d ? Rn([], M, v, T, y, e) : v) : n(v, T) : (v.issues.push({
      expected: "object",
      code: "invalid_type",
      input: M,
      inst: e
    }), v);
  };
});
function At(e, t, n, r) {
  for (const a of e)
    if (a.issues.length === 0)
      return t.value = a.value, t;
  const o = e.filter((a) => !le(a));
  return o.length === 1 ? (t.value = o[0].value, o[0]) : (t.issues.push({
    code: "invalid_union",
    input: t.value,
    inst: n,
    errors: e.map((a) => a.issues.map((i) => ee(i, r, Q())))
  }), t);
}
const $i = /* @__PURE__ */ u("$ZodUnion", (e, t) => {
  P.init(e, t), S(e._zod, "optin", () => t.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0), S(e._zod, "optout", () => t.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0), S(e._zod, "values", () => {
    if (t.options.every((o) => o._zod.values))
      return new Set(t.options.flatMap((o) => Array.from(o._zod.values)));
  }), S(e._zod, "pattern", () => {
    if (t.options.every((o) => o._zod.pattern)) {
      const o = t.options.map((a) => a._zod.pattern);
      return new RegExp(`^(${o.map((a) => ct(a.source)).join("|")})$`);
    }
  });
  const n = t.options.length === 1, r = t.options[0]._zod.run;
  e._zod.parse = (o, a) => {
    if (n)
      return r(o, a);
    let i = !1;
    const c = [];
    for (const l of t.options) {
      const p = l._zod.run({
        value: o.value,
        issues: []
      }, a);
      if (p instanceof Promise)
        c.push(p), i = !0;
      else {
        if (p.issues.length === 0)
          return p;
        c.push(p);
      }
    }
    return i ? Promise.all(c).then((l) => At(l, o, e, a)) : At(c, o, e, a);
  };
}), Li = /* @__PURE__ */ u("$ZodIntersection", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value, a = t.left._zod.run({ value: o, issues: [] }, r), i = t.right._zod.run({ value: o, issues: [] }, r);
    return a instanceof Promise || i instanceof Promise ? Promise.all([a, i]).then(([l, p]) => Pt(n, l, p)) : Pt(n, a, i);
  };
});
function Ve(e, t) {
  if (e === t)
    return { valid: !0, data: e };
  if (e instanceof Date && t instanceof Date && +e == +t)
    return { valid: !0, data: e };
  if (he(e) && he(t)) {
    const n = Object.keys(t), r = Object.keys(e).filter((a) => n.indexOf(a) !== -1), o = { ...e, ...t };
    for (const a of r) {
      const i = Ve(e[a], t[a]);
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
      const o = e[r], a = t[r], i = Ve(o, a);
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
function Pt(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  let o;
  for (const c of t.issues)
    if (c.code === "unrecognized_keys") {
      o ?? (o = c);
      for (const l of c.keys)
        r.has(l) || r.set(l, {}), r.get(l).l = !0;
    } else
      e.issues.push(c);
  for (const c of n.issues)
    if (c.code === "unrecognized_keys")
      for (const l of c.keys)
        r.has(l) || r.set(l, {}), r.get(l).r = !0;
    else
      e.issues.push(c);
  const a = [...r].filter(([, c]) => c.l && c.r).map(([c]) => c);
  if (a.length && o && e.issues.push({ ...o, keys: a }), le(e))
    return e;
  const i = Ve(t.value, n.value);
  if (!i.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(i.mergeErrorPath)}`);
  return e.value = i.data, e;
}
const Mi = /* @__PURE__ */ u("$ZodRecord", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value;
    if (!he(o))
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
      for (const p of i)
        if (typeof p == "string" || typeof p == "number" || typeof p == "symbol") {
          c.add(typeof p == "number" ? p.toString() : p);
          const d = t.valueType._zod.run({ value: o[p], issues: [] }, r);
          d instanceof Promise ? a.push(d.then((y) => {
            y.issues.length && n.issues.push(...pe(p, y.issues)), n.value[p] = y.value;
          })) : (d.issues.length && n.issues.push(...pe(p, d.issues)), n.value[p] = d.value);
        }
      let l;
      for (const p in o)
        c.has(p) || (l = l ?? [], l.push(p));
      l && l.length > 0 && n.issues.push({
        code: "unrecognized_keys",
        input: o,
        inst: e,
        keys: l
      });
    } else {
      n.value = {};
      for (const c of Reflect.ownKeys(o)) {
        if (c === "__proto__")
          continue;
        let l = t.keyType._zod.run({ value: c, issues: [] }, r);
        if (l instanceof Promise)
          throw new Error("Async schemas not supported in object keys currently");
        if (typeof c == "string" && En.test(c) && l.issues.length) {
          const y = t.keyType._zod.run({ value: Number(c), issues: [] }, r);
          if (y instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          y.issues.length === 0 && (l = y);
        }
        if (l.issues.length) {
          t.mode === "loose" ? n.value[c] = o[c] : n.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: l.issues.map((y) => ee(y, r, Q())),
            input: c,
            path: [c],
            inst: e
          });
          continue;
        }
        const d = t.valueType._zod.run({ value: o[c], issues: [] }, r);
        d instanceof Promise ? a.push(d.then((y) => {
          y.issues.length && n.issues.push(...pe(c, y.issues)), n.value[l.value] = y.value;
        })) : (d.issues.length && n.issues.push(...pe(c, d.issues)), n.value[l.value] = d.value);
      }
    }
    return a.length ? Promise.all(a).then(() => n) : n;
  };
}), Zi = /* @__PURE__ */ u("$ZodEnum", (e, t) => {
  P.init(e, t);
  const n = _n(t.entries), r = new Set(n);
  e._zod.values = r, e._zod.pattern = new RegExp(`^(${n.filter((o) => Wr.has(typeof o)).map((o) => typeof o == "string" ? ge(o) : o.toString()).join("|")})$`), e._zod.parse = (o, a) => {
    const i = o.value;
    return r.has(i) || o.issues.push({
      code: "invalid_value",
      values: n,
      input: i,
      inst: e
    }), o;
  };
}), Ui = /* @__PURE__ */ u("$ZodLiteral", (e, t) => {
  if (P.init(e, t), t.values.length === 0)
    throw new Error("Cannot create literal schema with no valid values");
  const n = new Set(t.values);
  e._zod.values = n, e._zod.pattern = new RegExp(`^(${t.values.map((r) => typeof r == "string" ? ge(r) : r ? ge(r.toString()) : String(r)).join("|")})$`), e._zod.parse = (r, o) => {
    const a = r.value;
    return n.has(a) || r.issues.push({
      code: "invalid_value",
      values: t.values,
      input: a,
      inst: e
    }), r;
  };
}), Bi = /* @__PURE__ */ u("$ZodTransform", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new bn(e.constructor.name);
    const o = t.transform(n.value, n);
    if (r.async)
      return (o instanceof Promise ? o : Promise.resolve(o)).then((i) => (n.value = i, n));
    if (o instanceof Promise)
      throw new de();
    return n.value = o, n;
  };
});
function Et(e, t) {
  return e.issues.length && t === void 0 ? { issues: [], value: void 0 } : e;
}
const Cn = /* @__PURE__ */ u("$ZodOptional", (e, t) => {
  P.init(e, t), e._zod.optin = "optional", e._zod.optout = "optional", S(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, void 0]) : void 0), S(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${ct(n.source)})?$`) : void 0;
  }), e._zod.parse = (n, r) => {
    if (t.innerType._zod.optin === "optional") {
      const o = t.innerType._zod.run(n, r);
      return o instanceof Promise ? o.then((a) => Et(a, n.value)) : Et(o, n.value);
    }
    return n.value === void 0 ? n : t.innerType._zod.run(n, r);
  };
}), qi = /* @__PURE__ */ u("$ZodExactOptional", (e, t) => {
  Cn.init(e, t), S(e._zod, "values", () => t.innerType._zod.values), S(e._zod, "pattern", () => t.innerType._zod.pattern), e._zod.parse = (n, r) => t.innerType._zod.run(n, r);
}), Fi = /* @__PURE__ */ u("$ZodNullable", (e, t) => {
  P.init(e, t), S(e._zod, "optin", () => t.innerType._zod.optin), S(e._zod, "optout", () => t.innerType._zod.optout), S(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${ct(n.source)}|null)$`) : void 0;
  }), S(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, null]) : void 0), e._zod.parse = (n, r) => n.value === null ? n : t.innerType._zod.run(n, r);
}), Gi = /* @__PURE__ */ u("$ZodDefault", (e, t) => {
  P.init(e, t), e._zod.optin = "optional", S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    if (n.value === void 0)
      return n.value = t.defaultValue, n;
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => xt(a, t)) : xt(o, t);
  };
});
function xt(e, t) {
  return e.value === void 0 && (e.value = t.defaultValue), e;
}
const Vi = /* @__PURE__ */ u("$ZodPrefault", (e, t) => {
  P.init(e, t), e._zod.optin = "optional", S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => (r.direction === "backward" || n.value === void 0 && (n.value = t.defaultValue), t.innerType._zod.run(n, r));
}), Ki = /* @__PURE__ */ u("$ZodNonOptional", (e, t) => {
  P.init(e, t), S(e._zod, "values", () => {
    const n = t.innerType._zod.values;
    return n ? new Set([...n].filter((r) => r !== void 0)) : void 0;
  }), e._zod.parse = (n, r) => {
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => jt(a, e)) : jt(o, e);
  };
});
function jt(e, t) {
  return !e.issues.length && e.value === void 0 && e.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e.value,
    inst: t
  }), e;
}
const Ji = /* @__PURE__ */ u("$ZodCatch", (e, t) => {
  P.init(e, t), S(e._zod, "optin", () => t.innerType._zod.optin), S(e._zod, "optout", () => t.innerType._zod.optout), S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => (n.value = a.value, a.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: a.issues.map((i) => ee(i, r, Q()))
      },
      input: n.value
    }), n.issues = []), n)) : (n.value = o.value, o.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: o.issues.map((a) => ee(a, r, Q()))
      },
      input: n.value
    }), n.issues = []), n);
  };
}), Wi = /* @__PURE__ */ u("$ZodPipe", (e, t) => {
  P.init(e, t), S(e._zod, "values", () => t.in._zod.values), S(e._zod, "optin", () => t.in._zod.optin), S(e._zod, "optout", () => t.out._zod.optout), S(e._zod, "propValues", () => t.in._zod.propValues), e._zod.parse = (n, r) => {
    if (r.direction === "backward") {
      const a = t.out._zod.run(n, r);
      return a instanceof Promise ? a.then((i) => Te(i, t.in, r)) : Te(a, t.in, r);
    }
    const o = t.in._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => Te(a, t.out, r)) : Te(o, t.out, r);
  };
});
function Te(e, t, n) {
  return e.issues.length ? (e.aborted = !0, e) : t._zod.run({ value: e.value, issues: e.issues }, n);
}
const Hi = /* @__PURE__ */ u("$ZodReadonly", (e, t) => {
  P.init(e, t), S(e._zod, "propValues", () => t.innerType._zod.propValues), S(e._zod, "values", () => t.innerType._zod.values), S(e._zod, "optin", () => t.innerType?._zod?.optin), S(e._zod, "optout", () => t.innerType?._zod?.optout), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then(Nt) : Nt(o);
  };
});
function Nt(e) {
  return e.value = Object.freeze(e.value), e;
}
const Xi = /* @__PURE__ */ u("$ZodLazy", (e, t) => {
  P.init(e, t), S(e._zod, "innerType", () => t.getter()), S(e._zod, "pattern", () => e._zod.innerType?._zod?.pattern), S(e._zod, "propValues", () => e._zod.innerType?._zod?.propValues), S(e._zod, "optin", () => e._zod.innerType?._zod?.optin ?? void 0), S(e._zod, "optout", () => e._zod.innerType?._zod?.optout ?? void 0), e._zod.parse = (n, r) => e._zod.innerType._zod.run(n, r);
}), Yi = /* @__PURE__ */ u("$ZodCustom", (e, t) => {
  F.init(e, t), P.init(e, t), e._zod.parse = (n, r) => n, e._zod.check = (n) => {
    const r = n.value, o = t.fn(r);
    if (o instanceof Promise)
      return o.then((a) => zt(a, n, r, e));
    zt(o, n, r, e);
  };
});
function zt(e, t, n, r) {
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
    r._zod.def.params && (o.params = r._zod.def.params), t.issues.push(ve(o));
  }
}
var Ot;
class Qi {
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
function ea() {
  return new Qi();
}
(Ot = globalThis).__zod_globalRegistry ?? (Ot.__zod_globalRegistry = ea());
const _e = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function ta(e, t) {
  return new e({
    type: "string",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function na(e, t) {
  return new e({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Dt(e, t) {
  return new e({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ra(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function oa(e, t) {
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
function ia(e, t) {
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
function aa(e, t) {
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
function sa(e, t) {
  return new e({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ca(e, t) {
  return new e({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function la(e, t) {
  return new e({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function pa(e, t) {
  return new e({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ua(e, t) {
  return new e({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function da(e, t) {
  return new e({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ma(e, t) {
  return new e({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function fa(e, t) {
  return new e({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ha(e, t) {
  return new e({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ga(e, t) {
  return new e({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ya(e, t) {
  return new e({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ba(e, t) {
  return new e({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function _a(e, t) {
  return new e({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function va(e, t) {
  return new e({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ia(e, t) {
  return new e({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ta(e, t) {
  return new e({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function wa(e, t) {
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
function ka(e, t) {
  return new e({
    type: "string",
    format: "date",
    check: "string_format",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Sa(e, t) {
  return new e({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Aa(e, t) {
  return new e({
    type: "string",
    format: "duration",
    check: "string_format",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Pa(e, t) {
  return new e({
    type: "number",
    checks: [],
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ea(e, t) {
  return new e({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function xa(e, t) {
  return new e({
    type: "boolean",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ja(e, t) {
  return new e({
    type: "null",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Na(e) {
  return new e({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function za(e, t) {
  return new e({
    type: "never",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Rt(e, t) {
  return new jn({
    check: "less_than",
    ..._(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Le(e, t) {
  return new jn({
    check: "less_than",
    ..._(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Ct(e, t) {
  return new Nn({
    check: "greater_than",
    ..._(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Me(e, t) {
  return new Nn({
    check: "greater_than",
    ..._(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function $t(e, t) {
  return new Fo({
    check: "multiple_of",
    ..._(t),
    value: e
  });
}
// @__NO_SIDE_EFFECTS__
function $n(e, t) {
  return new Vo({
    check: "max_length",
    ..._(t),
    maximum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ae(e, t) {
  return new Ko({
    check: "min_length",
    ..._(t),
    minimum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ln(e, t) {
  return new Jo({
    check: "length_equals",
    ..._(t),
    length: e
  });
}
// @__NO_SIDE_EFFECTS__
function Oa(e, t) {
  return new Wo({
    check: "string_format",
    format: "regex",
    ..._(t),
    pattern: e
  });
}
// @__NO_SIDE_EFFECTS__
function Da(e) {
  return new Ho({
    check: "string_format",
    format: "lowercase",
    ..._(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ra(e) {
  return new Xo({
    check: "string_format",
    format: "uppercase",
    ..._(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ca(e, t) {
  return new Yo({
    check: "string_format",
    format: "includes",
    ..._(t),
    includes: e
  });
}
// @__NO_SIDE_EFFECTS__
function $a(e, t) {
  return new Qo({
    check: "string_format",
    format: "starts_with",
    ..._(t),
    prefix: e
  });
}
// @__NO_SIDE_EFFECTS__
function La(e, t) {
  return new ei({
    check: "string_format",
    format: "ends_with",
    ..._(t),
    suffix: e
  });
}
// @__NO_SIDE_EFFECTS__
function ye(e) {
  return new ti({
    check: "overwrite",
    tx: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ma(e) {
  return /* @__PURE__ */ ye((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function Za() {
  return /* @__PURE__ */ ye((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function Ua() {
  return /* @__PURE__ */ ye((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Ba() {
  return /* @__PURE__ */ ye((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function qa() {
  return /* @__PURE__ */ ye((e) => Kr(e));
}
// @__NO_SIDE_EFFECTS__
function Fa(e, t, n) {
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
function Ga(e, t, n) {
  return new e({
    type: "custom",
    check: "custom",
    fn: t,
    ..._(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Va(e) {
  const t = /* @__PURE__ */ Ka((n) => (n.addIssue = (r) => {
    if (typeof r == "string")
      n.issues.push(ve(r, n.value, t._zod.def));
    else {
      const o = r;
      o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), o.input ?? (o.input = n.value), o.inst ?? (o.inst = t), o.continue ?? (o.continue = !t._zod.def.abort), n.issues.push(ve(o));
    }
  }, e(n.value, n)));
  return t;
}
// @__NO_SIDE_EFFECTS__
function Ka(e, t) {
  const n = new F({
    check: "custom",
    ..._(t)
  });
  return n._zod.check = e, n;
}
function Mn(e) {
  let t = e?.target ?? "draft-2020-12";
  return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
    processors: e.processors ?? {},
    metadataRegistry: e?.metadata ?? _e,
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
function O(e, t, n = { path: [], schemaPath: [] }) {
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
    const d = {
      ...n,
      schemaPath: [...n.schemaPath, e],
      path: n.path
    };
    if (e._zod.processJSONSchema)
      e._zod.processJSONSchema(t, i.schema, d);
    else {
      const v = i.schema, T = t.processors[o.type];
      if (!T)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${o.type}`);
      T(e, t, v, d);
    }
    const y = e._zod.parent;
    y && (i.ref || (i.ref = y), O(y, t, d), t.seen.get(y).isParent = !0);
  }
  const l = t.metadataRegistry.get(e);
  return l && Object.assign(i.schema, l), t.io === "input" && B(e) && (delete i.schema.examples, delete i.schema.default), t.io === "input" && i.schema._prefault && ((r = i.schema).default ?? (r.default = i.schema._prefault)), delete i.schema._prefault, t.seen.get(e).schema;
}
function Zn(e, t) {
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = /* @__PURE__ */ new Map();
  for (const i of e.seen.entries()) {
    const c = e.metadataRegistry.get(i[0])?.id;
    if (c) {
      const l = r.get(c);
      if (l && l !== i[0])
        throw new Error(`Duplicate schema id "${c}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      r.set(c, i[0]);
    }
  }
  const o = (i) => {
    const c = e.target === "draft-2020-12" ? "$defs" : "definitions";
    if (e.external) {
      const y = e.external.registry.get(i[0])?.id, v = e.external.uri ?? ((M) => M);
      if (y)
        return { ref: v(y) };
      const T = i[1].defId ?? i[1].schema.id ?? `schema${e.counter++}`;
      return i[1].defId = T, { defId: T, ref: `${v("__shared")}#/${c}/${T}` };
    }
    if (i[1] === n)
      return { ref: "#" };
    const p = `#/${c}/`, d = i[1].schema.id ?? `__schema${e.counter++}`;
    return { defId: d, ref: p + d };
  }, a = (i) => {
    if (i[1].schema.$ref)
      return;
    const c = i[1], { ref: l, defId: p } = o(i);
    c.def = { ...c.schema }, p && (c.defId = p);
    const d = c.schema;
    for (const y in d)
      delete d[y];
    d.$ref = l;
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
      const p = e.external.registry.get(i[0])?.id;
      if (t !== i[0] && p) {
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
function Un(e, t) {
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = (i) => {
    const c = e.seen.get(i);
    if (c.ref === null)
      return;
    const l = c.def ?? c.schema, p = { ...l }, d = c.ref;
    if (c.ref = null, d) {
      r(d);
      const v = e.seen.get(d), T = v.schema;
      if (T.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (l.allOf = l.allOf ?? [], l.allOf.push(T)) : Object.assign(l, T), Object.assign(l, p), i._zod.parent === d)
        for (const R in l)
          R === "$ref" || R === "allOf" || R in p || delete l[R];
      if (T.$ref && v.def)
        for (const R in l)
          R === "$ref" || R === "allOf" || R in v.def && JSON.stringify(l[R]) === JSON.stringify(v.def[R]) && delete l[R];
    }
    const y = i._zod.parent;
    if (y && y !== d) {
      r(y);
      const v = e.seen.get(y);
      if (v?.schema.$ref && (l.$ref = v.schema.$ref, v.def))
        for (const T in l)
          T === "$ref" || T === "allOf" || T in v.def && JSON.stringify(l[T]) === JSON.stringify(v.def[T]) && delete l[T];
    }
    e.override({
      zodSchema: i,
      jsonSchema: l,
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
          input: Pe(t, "input", e.processors),
          output: Pe(t, "output", e.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), i;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function B(e, t) {
  const n = t ?? { seen: /* @__PURE__ */ new Set() };
  if (n.seen.has(e))
    return !1;
  n.seen.add(e);
  const r = e._zod.def;
  if (r.type === "transform")
    return !0;
  if (r.type === "array")
    return B(r.element, n);
  if (r.type === "set")
    return B(r.valueType, n);
  if (r.type === "lazy")
    return B(r.getter(), n);
  if (r.type === "promise" || r.type === "optional" || r.type === "nonoptional" || r.type === "nullable" || r.type === "readonly" || r.type === "default" || r.type === "prefault")
    return B(r.innerType, n);
  if (r.type === "intersection")
    return B(r.left, n) || B(r.right, n);
  if (r.type === "record" || r.type === "map")
    return B(r.keyType, n) || B(r.valueType, n);
  if (r.type === "pipe")
    return B(r.in, n) || B(r.out, n);
  if (r.type === "object") {
    for (const o in r.shape)
      if (B(r.shape[o], n))
        return !0;
    return !1;
  }
  if (r.type === "union") {
    for (const o of r.options)
      if (B(o, n))
        return !0;
    return !1;
  }
  if (r.type === "tuple") {
    for (const o of r.items)
      if (B(o, n))
        return !0;
    return !!(r.rest && B(r.rest, n));
  }
  return !1;
}
const Ja = (e, t = {}) => (n) => {
  const r = Mn({ ...n, processors: t });
  return O(e, r), Zn(r, e), Un(r, e);
}, Pe = (e, t, n = {}) => (r) => {
  const { libraryOptions: o, target: a } = r ?? {}, i = Mn({ ...o ?? {}, target: a, io: t, processors: n });
  return O(e, i), Zn(i, e), Un(i, e);
}, Wa = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, Ha = (e, t, n, r) => {
  const o = n;
  o.type = "string";
  const { minimum: a, maximum: i, format: c, patterns: l, contentEncoding: p } = e._zod.bag;
  if (typeof a == "number" && (o.minLength = a), typeof i == "number" && (o.maxLength = i), c && (o.format = Wa[c] ?? c, o.format === "" && delete o.format, c === "time" && delete o.format), p && (o.contentEncoding = p), l && l.size > 0) {
    const d = [...l];
    d.length === 1 ? o.pattern = d[0].source : d.length > 1 && (o.allOf = [
      ...d.map((y) => ({
        ...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: y.source
      }))
    ]);
  }
}, Xa = (e, t, n, r) => {
  const o = n, { minimum: a, maximum: i, format: c, multipleOf: l, exclusiveMaximum: p, exclusiveMinimum: d } = e._zod.bag;
  typeof c == "string" && c.includes("int") ? o.type = "integer" : o.type = "number", typeof d == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.minimum = d, o.exclusiveMinimum = !0) : o.exclusiveMinimum = d), typeof a == "number" && (o.minimum = a, typeof d == "number" && t.target !== "draft-04" && (d >= a ? delete o.minimum : delete o.exclusiveMinimum)), typeof p == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.maximum = p, o.exclusiveMaximum = !0) : o.exclusiveMaximum = p), typeof i == "number" && (o.maximum = i, typeof p == "number" && t.target !== "draft-04" && (p <= i ? delete o.maximum : delete o.exclusiveMaximum)), typeof l == "number" && (o.multipleOf = l);
}, Ya = (e, t, n, r) => {
  n.type = "boolean";
}, Qa = (e, t, n, r) => {
  t.target === "openapi-3.0" ? (n.type = "string", n.nullable = !0, n.enum = [null]) : n.type = "null";
}, es = (e, t, n, r) => {
  n.not = {};
}, ts = (e, t, n, r) => {
}, ns = (e, t, n, r) => {
  const o = e._zod.def, a = _n(o.entries);
  a.every((i) => typeof i == "number") && (n.type = "number"), a.every((i) => typeof i == "string") && (n.type = "string"), n.enum = a;
}, rs = (e, t, n, r) => {
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
}, os = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, is = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, as = (e, t, n, r) => {
  const o = n, a = e._zod.def, { minimum: i, maximum: c } = e._zod.bag;
  typeof i == "number" && (o.minItems = i), typeof c == "number" && (o.maxItems = c), o.type = "array", o.items = O(a.element, t, { ...r, path: [...r.path, "items"] });
}, ss = (e, t, n, r) => {
  const o = n, a = e._zod.def;
  o.type = "object", o.properties = {};
  const i = a.shape;
  for (const p in i)
    o.properties[p] = O(i[p], t, {
      ...r,
      path: [...r.path, "properties", p]
    });
  const c = new Set(Object.keys(i)), l = new Set([...c].filter((p) => {
    const d = a.shape[p]._zod;
    return t.io === "input" ? d.optin === void 0 : d.optout === void 0;
  }));
  l.size > 0 && (o.required = Array.from(l)), a.catchall?._zod.def.type === "never" ? o.additionalProperties = !1 : a.catchall ? a.catchall && (o.additionalProperties = O(a.catchall, t, {
    ...r,
    path: [...r.path, "additionalProperties"]
  })) : t.io === "output" && (o.additionalProperties = !1);
}, cs = (e, t, n, r) => {
  const o = e._zod.def, a = o.inclusive === !1, i = o.options.map((c, l) => O(c, t, {
    ...r,
    path: [...r.path, a ? "oneOf" : "anyOf", l]
  }));
  a ? n.oneOf = i : n.anyOf = i;
}, ls = (e, t, n, r) => {
  const o = e._zod.def, a = O(o.left, t, {
    ...r,
    path: [...r.path, "allOf", 0]
  }), i = O(o.right, t, {
    ...r,
    path: [...r.path, "allOf", 1]
  }), c = (p) => "allOf" in p && Object.keys(p).length === 1, l = [
    ...c(a) ? a.allOf : [a],
    ...c(i) ? i.allOf : [i]
  ];
  n.allOf = l;
}, ps = (e, t, n, r) => {
  const o = n, a = e._zod.def;
  o.type = "object";
  const i = a.keyType, l = i._zod.bag?.patterns;
  if (a.mode === "loose" && l && l.size > 0) {
    const d = O(a.valueType, t, {
      ...r,
      path: [...r.path, "patternProperties", "*"]
    });
    o.patternProperties = {};
    for (const y of l)
      o.patternProperties[y.source] = d;
  } else
    (t.target === "draft-07" || t.target === "draft-2020-12") && (o.propertyNames = O(a.keyType, t, {
      ...r,
      path: [...r.path, "propertyNames"]
    })), o.additionalProperties = O(a.valueType, t, {
      ...r,
      path: [...r.path, "additionalProperties"]
    });
  const p = i._zod.values;
  if (p) {
    const d = [...p].filter((y) => typeof y == "string" || typeof y == "number");
    d.length > 0 && (o.required = d);
  }
}, us = (e, t, n, r) => {
  const o = e._zod.def, a = O(o.innerType, t, r), i = t.seen.get(e);
  t.target === "openapi-3.0" ? (i.ref = o.innerType, n.nullable = !0) : n.anyOf = [a, { type: "null" }];
}, ds = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
}, ms = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, n.default = JSON.parse(JSON.stringify(o.defaultValue));
}, fs = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, t.io === "input" && (n._prefault = JSON.parse(JSON.stringify(o.defaultValue)));
}, hs = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
  let i;
  try {
    i = o.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  n.default = i;
}, gs = (e, t, n, r) => {
  const o = e._zod.def, a = t.io === "input" ? o.in._zod.def.type === "transform" ? o.out : o.in : o.out;
  O(a, t, r);
  const i = t.seen.get(e);
  i.ref = a;
}, ys = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, n.readOnly = !0;
}, Bn = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
}, bs = (e, t, n, r) => {
  const o = e._zod.innerType;
  O(o, t, r);
  const a = t.seen.get(e);
  a.ref = o;
}, _s = /* @__PURE__ */ u("ZodISODateTime", (e, t) => {
  hi.init(e, t), N.init(e, t);
});
function vs(e) {
  return /* @__PURE__ */ wa(_s, e);
}
const Is = /* @__PURE__ */ u("ZodISODate", (e, t) => {
  gi.init(e, t), N.init(e, t);
});
function Ts(e) {
  return /* @__PURE__ */ ka(Is, e);
}
const ws = /* @__PURE__ */ u("ZodISOTime", (e, t) => {
  yi.init(e, t), N.init(e, t);
});
function ks(e) {
  return /* @__PURE__ */ Sa(ws, e);
}
const Ss = /* @__PURE__ */ u("ZodISODuration", (e, t) => {
  bi.init(e, t), N.init(e, t);
});
function As(e) {
  return /* @__PURE__ */ Aa(Ss, e);
}
const Ps = (e, t) => {
  wn.init(e, t), e.name = "ZodError", Object.defineProperties(e, {
    format: {
      value: (n) => ao(e, n)
      // enumerable: false,
    },
    flatten: {
      value: (n) => io(e, n)
      // enumerable: false,
    },
    addIssue: {
      value: (n) => {
        e.issues.push(n), e.message = JSON.stringify(e.issues, Ge, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (n) => {
        e.issues.push(...n), e.message = JSON.stringify(e.issues, Ge, 2);
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
}, J = u("ZodError", Ps, {
  Parent: Error
}), Es = /* @__PURE__ */ pt(J), xs = /* @__PURE__ */ ut(J), js = /* @__PURE__ */ De(J), Ns = /* @__PURE__ */ Re(J), zs = /* @__PURE__ */ lo(J), Os = /* @__PURE__ */ po(J), Ds = /* @__PURE__ */ uo(J), Rs = /* @__PURE__ */ mo(J), Cs = /* @__PURE__ */ fo(J), $s = /* @__PURE__ */ ho(J), Ls = /* @__PURE__ */ go(J), Ms = /* @__PURE__ */ yo(J), E = /* @__PURE__ */ u("ZodType", (e, t) => (P.init(e, t), Object.assign(e["~standard"], {
  jsonSchema: {
    input: Pe(e, "input"),
    output: Pe(e, "output")
  }
}), e.toJSONSchema = Ja(e, {}), e.def = t, e.type = t.type, Object.defineProperty(e, "_def", { value: t }), e.check = (...n) => e.clone(oe(t, {
  checks: [
    ...t.checks ?? [],
    ...n.map((r) => typeof r == "function" ? { _zod: { check: r, def: { check: "custom" }, onattach: [] } } : r)
  ]
}), {
  parent: !0
}), e.with = e.check, e.clone = (n, r) => ie(e, n, r), e.brand = () => e, e.register = ((n, r) => (n.add(e, r), e)), e.parse = (n, r) => Es(e, n, r, { callee: e.parse }), e.safeParse = (n, r) => js(e, n, r), e.parseAsync = async (n, r) => xs(e, n, r, { callee: e.parseAsync }), e.safeParseAsync = async (n, r) => Ns(e, n, r), e.spa = e.safeParseAsync, e.encode = (n, r) => zs(e, n, r), e.decode = (n, r) => Os(e, n, r), e.encodeAsync = async (n, r) => Ds(e, n, r), e.decodeAsync = async (n, r) => Rs(e, n, r), e.safeEncode = (n, r) => Cs(e, n, r), e.safeDecode = (n, r) => $s(e, n, r), e.safeEncodeAsync = async (n, r) => Ls(e, n, r), e.safeDecodeAsync = async (n, r) => Ms(e, n, r), e.refine = (n, r) => e.check(Dc(n, r)), e.superRefine = (n) => e.check(Rc(n)), e.overwrite = (n) => e.check(/* @__PURE__ */ ye(n)), e.optional = () => Zt(e), e.exactOptional = () => vc(e), e.nullable = () => Ut(e), e.nullish = () => Zt(Ut(e)), e.nonoptional = (n) => Ac(e, n), e.array = () => L(e), e.or = (n) => mt([e, n]), e.and = (n) => hc(e, n), e.transform = (n) => Je(e, Gn(n)), e.default = (n) => wc(e, n), e.prefault = (n) => Sc(e, n), e.catch = (n) => Ec(e, n), e.pipe = (n) => Je(e, n), e.readonly = () => Nc(e), e.describe = (n) => {
  const r = e.clone();
  return _e.add(r, { description: n }), r;
}, Object.defineProperty(e, "description", {
  get() {
    return _e.get(e)?.description;
  },
  configurable: !0
}), e.meta = (...n) => {
  if (n.length === 0)
    return _e.get(e);
  const r = e.clone();
  return _e.add(r, n[0]), r;
}, e.isOptional = () => e.safeParse(void 0).success, e.isNullable = () => e.safeParse(null).success, e.apply = (n) => n(e), e)), qn = /* @__PURE__ */ u("_ZodString", (e, t) => {
  dt.init(e, t), E.init(e, t), e._zod.processJSONSchema = (r, o, a) => Ha(e, r, o);
  const n = e._zod.bag;
  e.format = n.format ?? null, e.minLength = n.minimum ?? null, e.maxLength = n.maximum ?? null, e.regex = (...r) => e.check(/* @__PURE__ */ Oa(...r)), e.includes = (...r) => e.check(/* @__PURE__ */ Ca(...r)), e.startsWith = (...r) => e.check(/* @__PURE__ */ $a(...r)), e.endsWith = (...r) => e.check(/* @__PURE__ */ La(...r)), e.min = (...r) => e.check(/* @__PURE__ */ Ae(...r)), e.max = (...r) => e.check(/* @__PURE__ */ $n(...r)), e.length = (...r) => e.check(/* @__PURE__ */ Ln(...r)), e.nonempty = (...r) => e.check(/* @__PURE__ */ Ae(1, ...r)), e.lowercase = (r) => e.check(/* @__PURE__ */ Da(r)), e.uppercase = (r) => e.check(/* @__PURE__ */ Ra(r)), e.trim = () => e.check(/* @__PURE__ */ Za()), e.normalize = (...r) => e.check(/* @__PURE__ */ Ma(...r)), e.toLowerCase = () => e.check(/* @__PURE__ */ Ua()), e.toUpperCase = () => e.check(/* @__PURE__ */ Ba()), e.slugify = () => e.check(/* @__PURE__ */ qa());
}), Zs = /* @__PURE__ */ u("ZodString", (e, t) => {
  dt.init(e, t), qn.init(e, t), e.email = (n) => e.check(/* @__PURE__ */ na(Us, n)), e.url = (n) => e.check(/* @__PURE__ */ sa(Bs, n)), e.jwt = (n) => e.check(/* @__PURE__ */ Ta(rc, n)), e.emoji = (n) => e.check(/* @__PURE__ */ ca(qs, n)), e.guid = (n) => e.check(/* @__PURE__ */ Dt(Lt, n)), e.uuid = (n) => e.check(/* @__PURE__ */ ra(we, n)), e.uuidv4 = (n) => e.check(/* @__PURE__ */ oa(we, n)), e.uuidv6 = (n) => e.check(/* @__PURE__ */ ia(we, n)), e.uuidv7 = (n) => e.check(/* @__PURE__ */ aa(we, n)), e.nanoid = (n) => e.check(/* @__PURE__ */ la(Fs, n)), e.guid = (n) => e.check(/* @__PURE__ */ Dt(Lt, n)), e.cuid = (n) => e.check(/* @__PURE__ */ pa(Gs, n)), e.cuid2 = (n) => e.check(/* @__PURE__ */ ua(Vs, n)), e.ulid = (n) => e.check(/* @__PURE__ */ da(Ks, n)), e.base64 = (n) => e.check(/* @__PURE__ */ _a(ec, n)), e.base64url = (n) => e.check(/* @__PURE__ */ va(tc, n)), e.xid = (n) => e.check(/* @__PURE__ */ ma(Js, n)), e.ksuid = (n) => e.check(/* @__PURE__ */ fa(Ws, n)), e.ipv4 = (n) => e.check(/* @__PURE__ */ ha(Hs, n)), e.ipv6 = (n) => e.check(/* @__PURE__ */ ga(Xs, n)), e.cidrv4 = (n) => e.check(/* @__PURE__ */ ya(Ys, n)), e.cidrv6 = (n) => e.check(/* @__PURE__ */ ba(Qs, n)), e.e164 = (n) => e.check(/* @__PURE__ */ Ia(nc, n)), e.datetime = (n) => e.check(vs(n)), e.date = (n) => e.check(Ts(n)), e.time = (n) => e.check(ks(n)), e.duration = (n) => e.check(As(n));
});
function m(e) {
  return /* @__PURE__ */ ta(Zs, e);
}
const N = /* @__PURE__ */ u("ZodStringFormat", (e, t) => {
  x.init(e, t), qn.init(e, t);
}), Us = /* @__PURE__ */ u("ZodEmail", (e, t) => {
  ai.init(e, t), N.init(e, t);
}), Lt = /* @__PURE__ */ u("ZodGUID", (e, t) => {
  oi.init(e, t), N.init(e, t);
}), we = /* @__PURE__ */ u("ZodUUID", (e, t) => {
  ii.init(e, t), N.init(e, t);
}), Bs = /* @__PURE__ */ u("ZodURL", (e, t) => {
  si.init(e, t), N.init(e, t);
}), qs = /* @__PURE__ */ u("ZodEmoji", (e, t) => {
  ci.init(e, t), N.init(e, t);
}), Fs = /* @__PURE__ */ u("ZodNanoID", (e, t) => {
  li.init(e, t), N.init(e, t);
}), Gs = /* @__PURE__ */ u("ZodCUID", (e, t) => {
  pi.init(e, t), N.init(e, t);
}), Vs = /* @__PURE__ */ u("ZodCUID2", (e, t) => {
  ui.init(e, t), N.init(e, t);
}), Ks = /* @__PURE__ */ u("ZodULID", (e, t) => {
  di.init(e, t), N.init(e, t);
}), Js = /* @__PURE__ */ u("ZodXID", (e, t) => {
  mi.init(e, t), N.init(e, t);
}), Ws = /* @__PURE__ */ u("ZodKSUID", (e, t) => {
  fi.init(e, t), N.init(e, t);
}), Hs = /* @__PURE__ */ u("ZodIPv4", (e, t) => {
  _i.init(e, t), N.init(e, t);
}), Xs = /* @__PURE__ */ u("ZodIPv6", (e, t) => {
  vi.init(e, t), N.init(e, t);
}), Ys = /* @__PURE__ */ u("ZodCIDRv4", (e, t) => {
  Ii.init(e, t), N.init(e, t);
}), Qs = /* @__PURE__ */ u("ZodCIDRv6", (e, t) => {
  Ti.init(e, t), N.init(e, t);
}), ec = /* @__PURE__ */ u("ZodBase64", (e, t) => {
  wi.init(e, t), N.init(e, t);
}), tc = /* @__PURE__ */ u("ZodBase64URL", (e, t) => {
  Si.init(e, t), N.init(e, t);
}), nc = /* @__PURE__ */ u("ZodE164", (e, t) => {
  Ai.init(e, t), N.init(e, t);
}), rc = /* @__PURE__ */ u("ZodJWT", (e, t) => {
  Ei.init(e, t), N.init(e, t);
}), Fn = /* @__PURE__ */ u("ZodNumber", (e, t) => {
  On.init(e, t), E.init(e, t), e._zod.processJSONSchema = (r, o, a) => Xa(e, r, o), e.gt = (r, o) => e.check(/* @__PURE__ */ Ct(r, o)), e.gte = (r, o) => e.check(/* @__PURE__ */ Me(r, o)), e.min = (r, o) => e.check(/* @__PURE__ */ Me(r, o)), e.lt = (r, o) => e.check(/* @__PURE__ */ Rt(r, o)), e.lte = (r, o) => e.check(/* @__PURE__ */ Le(r, o)), e.max = (r, o) => e.check(/* @__PURE__ */ Le(r, o)), e.int = (r) => e.check(Mt(r)), e.safe = (r) => e.check(Mt(r)), e.positive = (r) => e.check(/* @__PURE__ */ Ct(0, r)), e.nonnegative = (r) => e.check(/* @__PURE__ */ Me(0, r)), e.negative = (r) => e.check(/* @__PURE__ */ Rt(0, r)), e.nonpositive = (r) => e.check(/* @__PURE__ */ Le(0, r)), e.multipleOf = (r, o) => e.check(/* @__PURE__ */ $t(r, o)), e.step = (r, o) => e.check(/* @__PURE__ */ $t(r, o)), e.finite = () => e;
  const n = e._zod.bag;
  e.minValue = Math.max(n.minimum ?? Number.NEGATIVE_INFINITY, n.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, e.maxValue = Math.min(n.maximum ?? Number.POSITIVE_INFINITY, n.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, e.isInt = (n.format ?? "").includes("int") || Number.isSafeInteger(n.multipleOf ?? 0.5), e.isFinite = !0, e.format = n.format ?? null;
});
function te(e) {
  return /* @__PURE__ */ Pa(Fn, e);
}
const oc = /* @__PURE__ */ u("ZodNumberFormat", (e, t) => {
  xi.init(e, t), Fn.init(e, t);
});
function Mt(e) {
  return /* @__PURE__ */ Ea(oc, e);
}
const ic = /* @__PURE__ */ u("ZodBoolean", (e, t) => {
  ji.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ya(e, n, r);
});
function w(e) {
  return /* @__PURE__ */ xa(ic, e);
}
const ac = /* @__PURE__ */ u("ZodNull", (e, t) => {
  Ni.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => Qa(e, n, r);
});
function sc(e) {
  return /* @__PURE__ */ ja(ac, e);
}
const cc = /* @__PURE__ */ u("ZodUnknown", (e, t) => {
  zi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ts();
});
function Ee() {
  return /* @__PURE__ */ Na(cc);
}
const lc = /* @__PURE__ */ u("ZodNever", (e, t) => {
  Oi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => es(e, n, r);
});
function pc(e) {
  return /* @__PURE__ */ za(lc, e);
}
const uc = /* @__PURE__ */ u("ZodArray", (e, t) => {
  Di.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => as(e, n, r, o), e.element = t.element, e.min = (n, r) => e.check(/* @__PURE__ */ Ae(n, r)), e.nonempty = (n) => e.check(/* @__PURE__ */ Ae(1, n)), e.max = (n, r) => e.check(/* @__PURE__ */ $n(n, r)), e.length = (n, r) => e.check(/* @__PURE__ */ Ln(n, r)), e.unwrap = () => e.element;
});
function L(e, t) {
  return /* @__PURE__ */ Fa(uc, e, t);
}
const dc = /* @__PURE__ */ u("ZodObject", (e, t) => {
  Ci.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ss(e, n, r, o), S(e, "shape", () => t.shape), e.keyof = () => A(Object.keys(e._zod.def.shape)), e.catchall = (n) => e.clone({ ...e._zod.def, catchall: n }), e.passthrough = () => e.clone({ ...e._zod.def, catchall: Ee() }), e.loose = () => e.clone({ ...e._zod.def, catchall: Ee() }), e.strict = () => e.clone({ ...e._zod.def, catchall: pc() }), e.strip = () => e.clone({ ...e._zod.def, catchall: void 0 }), e.extend = (n) => eo(e, n), e.safeExtend = (n) => to(e, n), e.merge = (n) => no(e, n), e.pick = (n) => Yr(e, n), e.omit = (n) => Qr(e, n), e.partial = (...n) => ro(Vn, e, n[0]), e.required = (...n) => oo(Kn, e, n[0]);
});
function k(e, t) {
  const n = {
    type: "object",
    shape: e ?? {},
    ..._(t)
  };
  return new dc(n);
}
const mc = /* @__PURE__ */ u("ZodUnion", (e, t) => {
  $i.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => cs(e, n, r, o), e.options = t.options;
});
function mt(e, t) {
  return new mc({
    type: "union",
    options: e,
    ..._(t)
  });
}
const fc = /* @__PURE__ */ u("ZodIntersection", (e, t) => {
  Li.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ls(e, n, r, o);
});
function hc(e, t) {
  return new fc({
    type: "intersection",
    left: e,
    right: t
  });
}
const gc = /* @__PURE__ */ u("ZodRecord", (e, t) => {
  Mi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ps(e, n, r, o), e.keyType = t.keyType, e.valueType = t.valueType;
});
function ne(e, t, n) {
  return new gc({
    type: "record",
    keyType: e,
    valueType: t,
    ..._(n)
  });
}
const Ke = /* @__PURE__ */ u("ZodEnum", (e, t) => {
  Zi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (r, o, a) => ns(e, r, o), e.enum = t.entries, e.options = Object.values(t.entries);
  const n = new Set(Object.keys(t.entries));
  e.extract = (r, o) => {
    const a = {};
    for (const i of r)
      if (n.has(i))
        a[i] = t.entries[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new Ke({
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
    return new Ke({
      ...t,
      checks: [],
      ..._(o),
      entries: a
    });
  };
});
function A(e, t) {
  const n = Array.isArray(e) ? Object.fromEntries(e.map((r) => [r, r])) : e;
  return new Ke({
    type: "enum",
    entries: n,
    ..._(t)
  });
}
const yc = /* @__PURE__ */ u("ZodLiteral", (e, t) => {
  Ui.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => rs(e, n, r), e.values = new Set(t.values), Object.defineProperty(e, "value", {
    get() {
      if (t.values.length > 1)
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      return t.values[0];
    }
  });
});
function G(e, t) {
  return new yc({
    type: "literal",
    values: Array.isArray(e) ? e : [e],
    ..._(t)
  });
}
const bc = /* @__PURE__ */ u("ZodTransform", (e, t) => {
  Bi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => is(e, n), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new bn(e.constructor.name);
    n.addIssue = (a) => {
      if (typeof a == "string")
        n.issues.push(ve(a, n.value, t));
      else {
        const i = a;
        i.fatal && (i.continue = !1), i.code ?? (i.code = "custom"), i.input ?? (i.input = n.value), i.inst ?? (i.inst = e), n.issues.push(ve(i));
      }
    };
    const o = t.transform(n.value, n);
    return o instanceof Promise ? o.then((a) => (n.value = a, n)) : (n.value = o, n);
  };
});
function Gn(e) {
  return new bc({
    type: "transform",
    transform: e
  });
}
const Vn = /* @__PURE__ */ u("ZodOptional", (e, t) => {
  Cn.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => Bn(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Zt(e) {
  return new Vn({
    type: "optional",
    innerType: e
  });
}
const _c = /* @__PURE__ */ u("ZodExactOptional", (e, t) => {
  qi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => Bn(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function vc(e) {
  return new _c({
    type: "optional",
    innerType: e
  });
}
const Ic = /* @__PURE__ */ u("ZodNullable", (e, t) => {
  Fi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => us(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Ut(e) {
  return new Ic({
    type: "nullable",
    innerType: e
  });
}
const Tc = /* @__PURE__ */ u("ZodDefault", (e, t) => {
  Gi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ms(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function wc(e, t) {
  return new Tc({
    type: "default",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : In(t);
    }
  });
}
const kc = /* @__PURE__ */ u("ZodPrefault", (e, t) => {
  Vi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => fs(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Sc(e, t) {
  return new kc({
    type: "prefault",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : In(t);
    }
  });
}
const Kn = /* @__PURE__ */ u("ZodNonOptional", (e, t) => {
  Ki.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ds(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Ac(e, t) {
  return new Kn({
    type: "nonoptional",
    innerType: e,
    ..._(t)
  });
}
const Pc = /* @__PURE__ */ u("ZodCatch", (e, t) => {
  Ji.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => hs(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function Ec(e, t) {
  return new Pc({
    type: "catch",
    innerType: e,
    catchValue: typeof t == "function" ? t : () => t
  });
}
const xc = /* @__PURE__ */ u("ZodPipe", (e, t) => {
  Wi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => gs(e, n, r, o), e.in = t.in, e.out = t.out;
});
function Je(e, t) {
  return new xc({
    type: "pipe",
    in: e,
    out: t
    // ...util.normalizeParams(params),
  });
}
const jc = /* @__PURE__ */ u("ZodReadonly", (e, t) => {
  Hi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => ys(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Nc(e) {
  return new jc({
    type: "readonly",
    innerType: e
  });
}
const zc = /* @__PURE__ */ u("ZodLazy", (e, t) => {
  Xi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => bs(e, n, r, o), e.unwrap = () => e._zod.def.getter();
});
function Jn(e) {
  return new zc({
    type: "lazy",
    getter: e
  });
}
const Oc = /* @__PURE__ */ u("ZodCustom", (e, t) => {
  Yi.init(e, t), E.init(e, t), e._zod.processJSONSchema = (n, r, o) => os(e, n);
});
function Dc(e, t = {}) {
  return /* @__PURE__ */ Ga(Oc, e, t);
}
function Rc(e) {
  return /* @__PURE__ */ Va(e);
}
function ft(e, t) {
  return Je(Gn(e), t);
}
const re = {
  custom: "custom"
};
Q({ jitless: !0 });
const Cc = /^\d{4}-\d{2}-\d{2}$/, $c = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, Lc = /^data:image\/(svg\+xml|png|jpeg|webp)(;charset=[^;,]+)?(;base64)?,/i, D = m().regex(Cc), Mc = ft(
  (e) => e === "" ? null : e,
  D.nullable().optional()
), h = te().finite(), K = te().int(), me = te().finite().min(0), b = m().trim().min(1), Zc = m().trim().min(1).nullable(), z = m().trim().min(1).nullable().optional(), Uc = ft(
  (e) => e === void 0 ? null : e,
  Zc
), Wn = m().regex($c), Bc = m().regex(Lc), Hn = A(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]), Xn = A([
  "classic",
  "neutral"
]), Yn = A([
  "invoice-left-logo-right",
  "invoice-center-logo-center",
  "invoice-right-logo-left"
]), xe = Jn(() => mt([
  m(),
  h,
  w(),
  sc(),
  L(xe),
  ne(m(), xe)
])), Qn = Jn(() => k({
  type: b,
  attrs: ne(m(), xe).nullable().optional(),
  content: L(Qn).optional(),
  marks: L(k({
    type: b,
    attrs: ne(m(), xe).nullable().optional()
  }).passthrough()).optional(),
  text: m().optional()
}).passthrough()), Bt = k({
  version: G(1),
  type: G("tiptap-json"),
  content: Qn,
  plainTextPreview: m().optional(),
  updatedAt: h
}).passthrough(), qc = ft((e) => {
  if (e == null)
    return e;
  const t = Bt.safeParse(e);
  if (t.success)
    return t.data;
}, Bt.nullable().optional()), Fc = k({
  type: A(["weekly", "monthly", "yearly"]),
  weeklyDays: L(te().int().min(0).max(6)).optional(),
  monthlyType: A(["first", "last", "specific"]).optional(),
  monthlyDay: te().int().min(1).max(31).optional(),
  yearlyDate: D.optional()
}).passthrough();
k({
  id: b,
  title: b,
  createdAt: h.optional(),
  updatedAt: h.optional(),
  description: m().optional(),
  notes: qc,
  hourlyRate: h.nullable().optional(),
  flatRate: w().optional(),
  preferredClientId: z,
  isPersonal: w().optional(),
  archived: w().optional(),
  archivedOnDate: D.nullable().optional(),
  lastBilledAt: h.nullable().optional(),
  color: m().nullable().optional(),
  invoiceIds: L(b).optional(),
  billableTimeIncrementMinutes: te().int().positive().nullable().optional(),
  taskView: A(["list", "kanban"]).optional(),
  taskSort: A(["createdAt", "lastActive", "name", "manual"]).optional(),
  statusMode: A(["active", "quote"]).optional(),
  deadline: D.nullable().optional(),
  deadlineResolvedAt: h.nullable().optional(),
  budgetAmount: me.nullable().optional()
}).passthrough();
k({
  id: b,
  projectId: z,
  parentTaskId: z,
  title: b,
  note: m().nullable().optional(),
  completed: w().optional(),
  archived: w().optional(),
  archivedOnDate: D.nullable().optional(),
  billable: w().optional(),
  billableSetByUser: w().optional(),
  sortOrder: h.nullable().optional(),
  sortOrderUpdatedAt: h.nullable().optional(),
  lastActive: h.optional(),
  createdAt: h.optional(),
  lastBilledAt: h.nullable().optional(),
  startDate: D.nullable().optional(),
  recurring: Fc.nullable().optional(),
  promptTimeEntry: w().optional(),
  skipUntilNextRecurring: w().optional(),
  skippedOccurrenceDate: D.nullable().optional(),
  completedDatesByYear: ne(m(), ne(m(), L(te().int().min(1).max(31)))).optional(),
  completedOnDate: D.nullable().optional(),
  estimatedHours: me.nullable().optional(),
  estimatedFlatAmount: me.nullable().optional(),
  quotedAmountBilling: k({
    invoiceId: b,
    billedAt: h,
    total: me
  }).nullable().optional()
}).passthrough();
k({
  id: b,
  taskId: b,
  start: h,
  end: h,
  createdAt: h.optional(),
  updatedAt: h.optional(),
  note: m().optional(),
  source: m().optional(),
  billedHourlyRate: h.nullable().optional(),
  billedAt: h.nullable().optional(),
  billedInvoiceId: z,
  billedDurationMs: me.nullable().optional(),
  billingIncrementMinutes: te().int().positive().nullable().optional(),
  _stoppedTimerKey: b.optional(),
  _stoppedTimerInstanceId: b.optional()
}).superRefine((e, t) => {
  e.end < e.start && t.addIssue({
    code: re.custom,
    path: ["end"],
    message: "end must be greater than or equal to start"
  });
}).passthrough();
k({
  id: b,
  title: b,
  createdAt: h.optional(),
  updatedAt: h.optional(),
  clientName: m().optional(),
  contactPerson: m().optional(),
  email: m().optional(),
  phone: m().optional(),
  address: m().optional(),
  city: m().optional(),
  state: m().optional(),
  zip: m().optional(),
  country: m().optional(),
  registrationNumber: m().optional(),
  vat: m().optional(),
  taxNumber: m().optional(),
  notes: m().optional(),
  custom: L(k({ label: m(), value: m() })).optional(),
  disableTax: w().optional(),
  defaultHourlyRate: h.nullable().optional(),
  hourlyRate: h.nullable().optional(),
  flatRate: w().optional(),
  defaultCurrency: m().optional(),
  archived: w().optional(),
  archivedOnDate: D.nullable().optional(),
  color: m().nullable().optional()
}).passthrough();
k({
  id: b,
  title: m().trim().min(1).optional(),
  name: m().trim().min(1).optional(),
  businessName: m().trim().min(1).optional(),
  email: m().optional(),
  phone: m().optional(),
  address: m().optional(),
  city: m().optional(),
  state: m().optional(),
  zip: m().optional(),
  country: m().optional(),
  registrationNumber: m().optional(),
  vat: m().optional(),
  taxNumber: m().optional(),
  custom: L(k({ label: m(), value: m() })).optional(),
  taxId: m().optional(),
  logo: m().optional(),
  isDefault: w().optional(),
  taxEnabled: w().optional(),
  taxLabel: m().optional(),
  taxRate: h.optional(),
  branding: k({
    primaryColor: Wn.nullable().optional(),
    logoAssetId: z
  }).passthrough().optional()
}).superRefine((e, t) => {
  !e.title && !e.name && t.addIssue({
    code: re.custom,
    path: ["title"],
    message: "title or name is required"
  }), !e.businessName && !e.name && t.addIssue({
    code: re.custom,
    path: ["businessName"],
    message: "businessName or name is required"
  });
}).passthrough();
k({
  id: b,
  businessInfoId: b,
  kind: G("logo"),
  dataUrl: Bc,
  mimeType: Hn,
  fileName: m().nullable().optional(),
  width: K.positive(),
  height: K.positive(),
  byteSize: K.positive(),
  contentHash: b,
  createdAt: h,
  updatedAt: h.nullable().optional(),
  archivedAt: h.nullable().optional()
}).passthrough();
const Gc = k({
  description: m(),
  quantity: h,
  rate: h,
  amount: h,
  projectId: m().optional(),
  taskId: m().optional(),
  expenseId: m().optional(),
  supplierName: m().nullable().optional(),
  originalAmount: h.optional(),
  originalCurrency: m().optional(),
  exchangeRate: h.optional(),
  lineType: A(["project", "project-subtotal", "task", "expense", "custom"]).optional(),
  rateLabel: m().optional(),
  quantityLabel: m().optional(),
  pricingMode: A(["hourly", "flat", "mixed"]).optional()
}).passthrough(), er = k({
  capturedAt: h,
  sourceCurrency: b,
  sourceAmount: h,
  preferredCurrencyAtPayment: b,
  preferredCurrencyAmount: h
}).passthrough(), Vc = k({
  projectId: b,
  projectTitle: b,
  clientId: b,
  pricingMode: A(["hourly", "flat", "mixed"]),
  tasks: L(ne(m(), Ee())).optional(),
  expenseItems: L(ne(m(), Ee())).optional(),
  totalHours: h,
  subtotal: h,
  allocatedDiscount: h.optional(),
  allocatedShipping: h.optional(),
  allocatedTax: h.optional(),
  allocatedTotal: h.optional()
}).passthrough(), Kc = k({
  version: G(1),
  capturedAt: h,
  taskLastBilledAt: ne(m(), h.nullable())
}).passthrough(), Jc = k({
  version: G(1),
  capturedAt: h,
  invoiceCurrency: b,
  entries: L(k({
    entryId: b,
    taskId: b,
    start: h,
    end: h,
    actualDurationMs: h.nonnegative(),
    billableDurationMs: h.nonnegative(),
    billedHourlyRate: h.nullable()
  }).refine((e) => e.end >= e.start, {
    message: "end must be greater than or equal to start",
    path: ["end"]
  })),
  tasks: L(k({
    taskId: b,
    title: b,
    pricingMode: A(["hourly", "flat"]),
    quantity: h.nonnegative(),
    rate: h,
    amount: h,
    quotedAmount: h.nullable()
  })),
  expenses: L(k({
    expenseId: b,
    title: b,
    sourceAmount: h,
    sourceCurrency: b,
    invoiceAmount: h,
    invoiceCurrency: b,
    exchangeRate: h.positive()
  }))
}).passthrough();
k({
  id: b,
  projectId: Uc,
  projectIds: L(b).optional(),
  projectBreakdowns: L(Vc).optional(),
  clientId: b,
  createdAt: h.optional(),
  updatedAt: h.optional(),
  businessInfoId: z,
  invoiceNumber: b,
  date: D,
  dueDate: D.nullable().optional(),
  status: A(["draft", "sent", "paid", "overdue", "canceled"]),
  items: L(Gc),
  subtotal: h,
  tax: h.optional(),
  taxRate: h.optional(),
  total: h,
  notes: m().optional(),
  paymentMethodId: z,
  billingPeriodPreset: A(["last-month", "month", "all-time", "custom"]).optional(),
  billingPeriodStart: D.nullable().optional(),
  billingPeriodEnd: D.nullable().optional(),
  currency: m().optional(),
  paidAt: h.nullable().optional(),
  paymentCurrencySnapshot: er.nullable().optional(),
  sentAt: h.nullable().optional(),
  sentToEmail: m().nullable().optional(),
  canceledAt: h.positive().nullable().optional(),
  cancellationReason: m().trim().min(1).max(500).nullable().optional(),
  billingStateSnapshot: Kc.nullable().optional(),
  billingSelectionSnapshot: Jc.nullable().optional(),
  brandingSnapshot: k({
    businessInfoId: z,
    templateId: z,
    layoutStyle: Xn.optional(),
    logoPlacement: Yn,
    showBusinessLogo: w(),
    useBusinessPrimaryColor: w(),
    primaryColor: Wn.nullable().optional(),
    logoAssetId: z,
    logoAssetMeta: k({
      mimeType: Hn,
      width: K.positive(),
      height: K.positive(),
      byteSize: K.positive(),
      contentHash: b
    }).nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough().superRefine((e, t) => {
  e.status === "canceled" && (typeof e.canceledAt != "number" && t.addIssue({
    code: re.custom,
    path: ["canceledAt"],
    message: "canceledAt is required for canceled invoices"
  }), (typeof e.cancellationReason != "string" || !e.cancellationReason.trim()) && t.addIssue({
    code: re.custom,
    path: ["cancellationReason"],
    message: "cancellationReason is required for canceled invoices"
  }));
});
k({
  id: b,
  name: b,
  prefix: m().optional(),
  useSequentialNumbers: w().optional(),
  currentSequentialNumber: K.optional(),
  defaultNotes: m().optional(),
  defaultTaxRate: h.optional(),
  defaultDueDays: K.optional(),
  isDefault: w().optional(),
  brandingOptions: k({
    showBusinessLogo: w().optional(),
    useBusinessPrimaryColor: w().optional()
  }).passthrough().optional(),
  layoutStyle: Xn.optional(),
  logoPlacement: Yn.optional(),
  showBillingPeriod: w().optional(),
  showProjectTitle: w().optional()
}).passthrough();
k({
  id: b,
  name: b,
  type: A(["invoice", "quote"]),
  fromName: m().max(200).optional(),
  replyTo: m().email().max(320).optional(),
  subject: m().max(500),
  sendBody: m().max(5e3),
  reminderBody: m().max(5e3),
  attachmentTitle: m().max(200),
  isDefault: w().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
k({
  id: b,
  title: b,
  fullName: m().optional(),
  bank: m().optional(),
  iban: m().optional(),
  swift: m().optional(),
  bankAddress: m().optional(),
  paypal: m().optional(),
  custom: L(k({ label: m(), value: m() })).default([]),
  instructions: m().optional(),
  isDefault: w().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional(),
  name: m().optional()
}).passthrough();
k({
  id: b,
  title: b,
  note: m().nullable().optional(),
  date: D,
  supplierName: m().nullable().optional(),
  receiptNumber: m().nullable().optional(),
  currency: b,
  amount: h,
  paidOn: Mc,
  paidBy: m().nullable().optional(),
  paymentStatus: A(["unpaid", "paid"]),
  paymentMode: A(["manual", "auto"]).optional().default("manual"),
  clientId: z,
  projectId: z,
  businessId: z,
  categoryId: z,
  isPersonal: w(),
  billable: w(),
  billingStatus: A(["unbilled", "billed"]).default("unbilled"),
  invoiceId: z,
  billedAt: h.nullable().optional(),
  isRecurring: w().default(!1),
  recurrenceId: z,
  amountType: A(["fixed", "variable"]).nullable().optional(),
  taxNumber: m().nullable().optional(),
  isTaxExempt: w().default(!1),
  amountExcludingTax: h.nullable().optional(),
  taxLabel: m().nullable().optional(),
  taxRate: h.nullable().optional(),
  taxClaimStatus: A(["unclaimed", "claimed", "excluded"]).nullable().optional(),
  taxClaimPeriodId: z,
  taxClaimedAt: h.nullable().optional(),
  paymentCurrencySnapshot: er.nullable().optional().catch(null),
  isPreview: w().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
k({
  id: b,
  title: b,
  note: m().nullable().optional(),
  supplierName: m().nullable().optional(),
  paidBy: m().nullable().optional(),
  currency: b,
  amount: h,
  amountType: A(["fixed", "variable"]),
  paymentMode: A(["manual", "auto"]).optional(),
  repeat: A(["monthly", "yearly"]),
  monthlyType: A(["first", "last", "specific"]).optional(),
  monthlyDay: K.min(1).max(31).optional(),
  startDate: D,
  endDate: D.nullable().optional(),
  clientId: z,
  projectId: z,
  businessId: z,
  categoryId: z,
  isPersonal: w(),
  billable: w(),
  taxNumber: m().nullable().optional(),
  isTaxExempt: w(),
  amountExcludingTax: h.nullable().optional(),
  taxLabel: m().nullable().optional(),
  taxRate: h.nullable().optional(),
  lastGeneratedDate: D.nullable().optional(),
  active: w(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
k({
  id: b,
  name: b,
  group: m().nullable().optional(),
  isDefault: w().default(!1),
  archived: w().default(!1),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
k({
  id: b,
  title: b,
  type: A(["vat", "income-tax", "sales-tax", "other"]),
  startDate: D,
  endDate: D,
  businessInfoId: z,
  status: A(["draft", "filed", "paid"]).default("draft"),
  filedAt: h.nullable().optional(),
  paidAt: h.nullable().optional(),
  notes: m().nullable().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).superRefine((e, t) => {
  e.endDate < e.startDate && t.addIssue({
    code: re.custom,
    path: ["endDate"],
    message: "endDate must be greater than or equal to startDate"
  });
}).passthrough();
k({
  id: b,
  type: A(["client", "project", "task"]),
  referenceId: b,
  mode: A(["static", "date", "weekday"]),
  date: D.nullable().optional(),
  weekday: K.min(0).max(6).nullable().optional(),
  sortOrder: h,
  createdAt: h,
  estimatedHours: h.nullable().optional()
}).superRefine((e, t) => {
  e.mode === "date" && !e.date && t.addIssue({
    code: re.custom,
    path: ["date"],
    message: "date is required when mode is date"
  }), e.mode === "weekday" && (e.weekday === void 0 || e.weekday === null) && t.addIssue({
    code: re.custom,
    path: ["weekday"],
    message: "weekday is required when mode is weekday"
  });
}).passthrough();
k({
  id: b,
  weekday: K.min(0).max(6),
  targetHours: h.nullable().optional(),
  targetEarnings: h.nullable().optional(),
  createdAt: h,
  updatedAt: h.nullable().optional()
}).passthrough();
k({
  currency: m().optional(),
  dateFormat: m().optional(),
  timeFormat: m().optional(),
  theme: A(["light", "dark", "system"]).optional(),
  defaultView: m().optional(),
  weekStartsOn: mt([
    G(0),
    G(1),
    G(2),
    G(3),
    G(4),
    G(5),
    G(6)
  ]).optional(),
  autoHideTotalsOnRevisit: w().optional(),
  showCompletedTasks: w().optional(),
  defaultBillable: w().optional(),
  projectSort: A(["createdAt", "lastActive", "name"]).optional(),
  clientSort: A(["createdAt", "lastActive", "name"]).optional(),
  autoSyncEnabled: w().optional(),
  autoSyncMode: A(["backup", "sync"]).optional(),
  weeklyGoalTargetHours: h.nullable().optional(),
  weeklyGoalTargetEarnings: h.nullable().optional(),
  systemNotificationsEnabled: w().optional(),
  systemNotificationTime: m().regex(/^\d{2}:\d{2}$/).optional(),
  backupEnabled: w().optional(),
  backupFrequencyHours: K.min(1).optional()
}).passthrough();
k({
  projectId: b,
  taskId: b,
  timerInstanceId: b.optional(),
  startTime: h,
  paused: w().optional(),
  pausedElapsedTime: me.optional(),
  note: m().optional(),
  lastActive: h.optional()
}).passthrough();
const Wc = "1.5";
Array.from(/* @__PURE__ */ new Set(["1.0", "1.1", "1.3", "1.4", Wc]));
const We = (e, t) => t.some((n) => e instanceof n);
let qt, Ft;
function Hc() {
  return qt || (qt = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Xc() {
  return Ft || (Ft = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const He = /* @__PURE__ */ new WeakMap(), Ze = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap();
function Yc(e) {
  const t = new Promise((n, r) => {
    const o = () => {
      e.removeEventListener("success", a), e.removeEventListener("error", i);
    }, a = () => {
      n(je(e.result)), o();
    }, i = () => {
      r(e.error), o();
    };
    e.addEventListener("success", a), e.addEventListener("error", i);
  });
  return $e.set(t, e), t;
}
function Qc(e) {
  if (He.has(e))
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
  He.set(e, t);
}
let Xe = {
  get(e, t, n) {
    if (e instanceof IDBTransaction) {
      if (t === "done")
        return He.get(e);
      if (t === "store")
        return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
    }
    return je(e[t]);
  },
  set(e, t, n) {
    return e[t] = n, !0;
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
  }
};
function tr(e) {
  Xe = e(Xe);
}
function el(e) {
  return Xc().includes(e) ? function(...t) {
    return e.apply(Ye(this), t), je(this.request);
  } : function(...t) {
    return je(e.apply(Ye(this), t));
  };
}
function tl(e) {
  return typeof e == "function" ? el(e) : (e instanceof IDBTransaction && Qc(e), We(e, Hc()) ? new Proxy(e, Xe) : e);
}
function je(e) {
  if (e instanceof IDBRequest)
    return Yc(e);
  if (Ze.has(e))
    return Ze.get(e);
  const t = tl(e);
  return t !== e && (Ze.set(e, t), $e.set(t, e)), t;
}
const Ye = (e) => $e.get(e), nl = ["get", "getKey", "getAll", "getAllKeys", "count"], rl = ["put", "add", "delete", "clear"], Ue = /* @__PURE__ */ new Map();
function Gt(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string"))
    return;
  if (Ue.get(t))
    return Ue.get(t);
  const n = t.replace(/FromIndex$/, ""), r = t !== n, o = rl.includes(n);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(o || nl.includes(n))
  )
    return;
  const a = async function(i, ...c) {
    const l = this.transaction(i, o ? "readwrite" : "readonly");
    let p = l.store;
    return r && (p = p.index(c.shift())), (await Promise.all([
      p[n](...c),
      o && l.done
    ]))[0];
  };
  return Ue.set(t, a), a;
}
tr((e) => ({
  ...e,
  get: (t, n, r) => Gt(t, n) || e.get(t, n, r),
  has: (t, n) => !!Gt(t, n) || e.has(t, n)
}));
const ol = ["continue", "continuePrimaryKey", "advance"], Vt = {}, Qe = /* @__PURE__ */ new WeakMap(), nr = /* @__PURE__ */ new WeakMap(), il = {
  get(e, t) {
    if (!ol.includes(t))
      return e[t];
    let n = Vt[t];
    return n || (n = Vt[t] = function(...r) {
      Qe.set(this, nr.get(this)[t](...r));
    }), n;
  }
};
async function* al(...e) {
  let t = this;
  if (t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)
    return;
  t = t;
  const n = new Proxy(t, il);
  for (nr.set(n, t), $e.set(n, Ye(t)); t; )
    yield n, t = await (Qe.get(n) || t.continue()), Qe.delete(n);
}
function Kt(e, t) {
  return t === Symbol.asyncIterator && We(e, [IDBIndex, IDBObjectStore, IDBCursor]) || t === "iterate" && We(e, [IDBIndex, IDBObjectStore]);
}
tr((e) => ({
  ...e,
  get(t, n, r) {
    return Kt(t, n) ? al : e.get(t, n, r);
  },
  has(t, n) {
    return Kt(t, n) || e.has(t, n);
  }
}));
Promise.resolve(void 0);
function se(e) {
  return e === "true";
}
function rr(e) {
  return e === "localhost" || e === "127.0.0.1" || e === "::1" || e === "[::1]";
}
function sl(e) {
  return e.isDevelopment && rr(e.hostname) && se(e.sandboxValue);
}
function cl(e) {
  const t = sl({
    isDevelopment: e.isDevelopment,
    hostname: e.hostname,
    sandboxValue: e.values.VITE_BILLING_SANDBOX_MODE
  }), n = t || se(e.values.VITE_BILLING_UI_ENABLED), r = !t && se(e.values.VITE_BILLING_CANARY_UI_ENABLED);
  return {
    sandbox: t,
    localCatalogFallback: e.isDevelopment && rr(e.hostname) && !t,
    ui: n,
    canaryUi: r,
    status: n,
    trialActivation: t || r,
    checkout: t || r,
    clientLimitEnforcement: t || se(e.values.VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT),
    advancedReportsEnforcement: t || se(e.values.VITE_REPORTS_ENTITLEMENT_ENFORCEMENT),
    emailEntitlementEnforcement: t || se(e.values.VITE_EMAIL_ENTITLEMENT_ENFORCEMENT)
  };
}
Object.freeze(cl({
  isDevelopment: !1,
  hostname: typeof window > "u" ? "" : window.location.hostname,
  values: {
    VITE_BILLING_SANDBOX_MODE: void 0,
    VITE_BILLING_UI_ENABLED: void 0,
    VITE_BILLING_CANARY_UI_ENABLED: void 0,
    VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT: void 0,
    VITE_REPORTS_ENTITLEMENT_ENFORCEMENT: void 0,
    VITE_EMAIL_ENTITLEMENT_ENFORCEMENT: void 0
  }
}));
const ll = [
  { value: "last-month", label: "Last Month" },
  { value: "month", label: "This Month" },
  { value: "all-time", label: "All Time" },
  { value: "custom", label: "Custom Range" }
];
new Set(
  ll.map((e) => e.value)
);
const pl = [
  "Needs review",
  "Not due",
  "1-30 days",
  "31-60 days",
  "61-90 days",
  "90+ days"
];
pl.reduce((e, t, n) => (e.set(t, n), e), /* @__PURE__ */ new Map());
const V = 1, ul = "tasktime.agent.browser-reconnect";
function dl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_control" && t.protocolVersion === V && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && t.action === "revoke";
}
function fe(e) {
  return typeof e == "string" && e.trim().length > 0;
}
function ml(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_register" && t.protocolVersion === V && fe(t.sessionToken) && !!t.publicKeyJwk && typeof t.publicKeyJwk == "object";
}
function fl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_proof" && t.protocolVersion === V && fe(t.keyId) && fe(t.challengeId) && fe(t.signature);
}
function hl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_forget" && t.protocolVersion === V && fe(t.sessionToken) && fe(t.keyId);
}
function gl(e) {
  const t = {
    domain: ul,
    protocolVersion: V,
    bridgeInstanceId: e.bridgeInstanceId,
    keyId: e.keyId,
    challengeId: e.challengeId,
    nonce: e.nonce,
    origin: e.origin,
    expiresAt: e.expiresAt
  };
  return JSON.stringify(t);
}
function yl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.grant;
  return t.type === "agent_bridge_approval_grant" && t.protocolVersion === V && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && !!n && typeof n == "object" && typeof n.id == "string" && n.id.trim().length > 0 && typeof n.clientId == "string" && n.clientId.trim().length > 0 && (n.label === void 0 || typeof n.label == "string") && Array.isArray(n.scopes) && n.scopes.every((r) => typeof r == "string") && typeof n.secretKeyBase64Url == "string" && n.secretKeyBase64Url.trim().length > 0 && typeof n.createdAt == "number" && Number.isFinite(n.createdAt) && (n.expiresAt === void 0 || n.expiresAt === null || typeof n.expiresAt == "number" && Number.isFinite(n.expiresAt));
}
function bl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_approval_grant_revoke" && t.protocolVersion === V && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && typeof t.grantId == "string" && t.grantId.trim().length > 0 && typeof t.revokedAt == "number" && Number.isFinite(t.revokedAt);
}
const or = "https://tasktime.pro", ir = "https://app.tasktime.pro", _l = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]"]);
class Jt extends Error {
  constructor(t) {
    super(t), this.name = "TaskTimeOriginConfigurationError";
  }
}
function vl(e) {
  if (_l.has(e))
    return !0;
  const t = e.split(".");
  return t.length === 4 && t[0] === "127" && t.every((n) => /^\d+$/u.test(n) && Number(n) <= 255);
}
function ht(e, t) {
  let n;
  try {
    n = new URL(e);
  } catch {
    throw new Jt(`Invalid ${t} origin configuration.`);
  }
  const r = n.protocol === "https:", o = n.protocol === "http:" && vl(n.hostname);
  if (e.includes("*") || e !== n.origin || n.username !== "" || n.password !== "" || !r && !o)
    throw new Jt(`Invalid ${t} origin configuration.`);
  return n.origin;
}
function Il(e = or) {
  return e = ht(e, "agent documentation"), {
    llmsTxt: `${e}/llms.txt`,
    agentDocs: `${e}/agents/`,
    quickstart: `${e}/agents/quickstart/`,
    security: `${e}/agents/security/`,
    tools: `${e}/agents/tools/`,
    mcpToolsJson: `${e}/agents/mcp-tools.json`,
    skill: `${e}/agents/skill.md`,
    claude: `${e}/agents/claude/`,
    openClaw: `${e}/agents/openclaw/`,
    debugging: `${e}/agents/debugging/`
  };
}
const Tl = Il(), ar = [
  or,
  "https://www.tasktime.pro",
  ir,
  "http://localhost:3101",
  "http://127.0.0.1:3101",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
], wl = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]"
]);
function kl(e) {
  return e.trim().toLowerCase();
}
function Sl(e) {
  const t = kl(e);
  if (wl.has(t))
    return !0;
  const n = t.split(".");
  return n.length !== 4 || n[0] !== "127" ? !1 : n.every((r) => {
    if (!/^\d+$/.test(r))
      return !1;
    const o = Number(r);
    return o >= 0 && o <= 255;
  });
}
function Al(e) {
  if (!Sl(e))
    throw new j("INVALID_INPUT", "Agent bridge server must bind to a loopback host.", { host: e });
}
function Wt(e) {
  try {
    return ht(e, "agent bridge");
  } catch {
    return null;
  }
}
function Pl(e, t = ar) {
  if (!e)
    return !1;
  const n = Wt(e);
  return n ? new Set(Array.from(t).map((r) => Wt(r)).filter(Boolean)).has(n) : !1;
}
function El(e, t) {
  if (!Pl(e, t))
    throw new j("PERMISSION_DENIED", "Origin is not allowed to connect to the TaskTime Pro agent bridge.", {
      origin: e || null
    });
}
const xl = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", jl = "/tasktime-agent", Nl = 12e4, zl = 3e4;
class Ol {
  constructor(t, n, r, o = null, a = !1) {
    this.id = n, this.origin = r, this.session = o, this.reconnectPending = a, this.socket = t;
  }
  sendJson(t) {
    this.socket.destroyed || this.socket.write(Rl(JSON.stringify(t)));
  }
  close() {
    this.socket.destroy();
  }
}
function Dl(e) {
  return hn("sha1").update(`${e}${xl}`).digest("base64");
}
function Rl(e) {
  const t = Y.from(e), n = t.length;
  if (n < 126)
    return Y.concat([
      Y.from([129, n]),
      t
    ]);
  if (n <= 65535) {
    const o = Y.alloc(4);
    return o[0] = 129, o[1] = 126, o.writeUInt16BE(n, 2), Y.concat([o, t]);
  }
  const r = Y.alloc(10);
  return r[0] = 129, r[1] = 127, r.writeBigUInt64BE(BigInt(n), 2), Y.concat([r, t]);
}
function Cl(e) {
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
      const d = e.readBigUInt64BE(n);
      if (d > BigInt(Number.MAX_SAFE_INTEGER)) break;
      c = Number(d), n += 8;
    }
    let l = null;
    if (i) {
      if (n + 4 > e.length) break;
      l = e.subarray(n, n + 4), n += 4;
    }
    if (n + c > e.length) break;
    const p = Y.from(e.subarray(n, n + c));
    if (n += c, l)
      for (let d = 0; d < p.length; d += 1)
        p[d] ^= l[d % 4];
    a === 1 && t.push(p.toString("utf8"));
  }
  return t;
}
function $l(e) {
  const t = e.headers.host || "127.0.0.1";
  return new URL(e.url || "/", `http://${t}`);
}
function Ll(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.response;
  return t.protocolVersion === V && typeof t.requestId == "string" && !!n && typeof n == "object" && typeof n.command == "string" && typeof n.ok == "boolean";
}
class Ml {
  constructor(t) {
    this.clients = /* @__PURE__ */ new Set(), this.pendingResponses = /* @__PURE__ */ new Map(), this.sessions = /* @__PURE__ */ new Map(), this.reconnectAuthorizations = /* @__PURE__ */ new Map(), this.reconnectChallenges = /* @__PURE__ */ new Map(), this.sessionReconnectKeyIds = /* @__PURE__ */ new Map(), this.bridgeInstanceId = ue(), this.server = null, this.nextClientId = 0, this.authoritativeClientId = null, Al(t.host), this.options = t, this.auditLog = t.auditLog ?? new gn();
  }
  async start() {
    if (this.server)
      return;
    const t = Pr();
    this.server = t, t.on("upgrade", (n, r) => {
      this.handleUpgrade(n, r);
    }), await new Promise((n) => {
      t.listen(this.options.port, this.options.host, n);
    });
  }
  async stop() {
    const t = this.server;
    this.server = null, this.rejectPendingResponses(new j("UNAVAILABLE", "Agent bridge server stopped."));
    for (const n of this.clients)
      n.close();
    this.clients.clear(), this.sessions.clear(), this.reconnectAuthorizations.clear(), this.reconnectChallenges.clear(), this.sessionReconnectKeyIds.clear(), this.authoritativeClientId = null, t && await new Promise((n) => {
      t.close(() => n());
    });
  }
  getClientCount() {
    return this.clients.size;
  }
  getSessionCount() {
    return this.sessions.size;
  }
  getBridgeInstanceId() {
    return this.bridgeInstanceId;
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
    }), this.rejectPendingResponses(new j("PERMISSION_DENIED", "TaskTime Pro agent bridge access was revoked.")), this.sessions.clear(), this.reconnectAuthorizations.clear(), this.reconnectChallenges.clear(), this.sessionReconnectKeyIds.clear();
    for (const n of this.clients)
      n.close();
  }
  createSessionRequest(t, n, r, o, a) {
    if (!t.session)
      throw new j("PERMISSION_DENIED", "TaskTime Pro app session is not paired.");
    const i = {
      protocolVersion: V,
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
      throw new j("CONFLICT", "Agent app-session request ID is already pending.", {
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
        }), a(new j("UNAVAILABLE", "Agent app-session request timed out.", {
          requestId: t.requestId
        }));
      }, n.timeoutMs ?? Nl);
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
      throw new j("UNAVAILABLE", "No TaskTime Pro app session is connected.");
    const t = Array.from(this.clients).find((n) => n.id === this.authoritativeClientId);
    if (!t)
      throw new j("UNAVAILABLE", "No authoritative TaskTime Pro app session is available.");
    return t;
  }
  electAuthoritativeClient() {
    this.authoritativeClientId = Array.from(this.clients).find((t) => !t.reconnectPending)?.id ?? null;
  }
  resolvePendingResponse(t, n) {
    const r = t.requestId;
    if (!r)
      return !1;
    const o = this.pendingResponses.get(r);
    if (!o || o.client !== n)
      return !1;
    clearTimeout(o.timeoutId), this.pendingResponses.delete(r), o.resolve(t);
    const a = "error" in t.response ? t.response.error.code : void 0;
    return this.audit({
      action: t.response.ok ? "command_completed" : "command_failed",
      clientId: n.id,
      requestId: r,
      command: t.response.command,
      ok: t.response.ok,
      errorCode: a
    }), !0;
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
  async importReconnectPublicKey(t) {
    if (t.kty !== "EC" || t.crv !== "P-256" || typeof t.x != "string" || !t.x || typeof t.y != "string" || !t.y || t.d !== void 0 || t.use !== void 0 && t.use !== "sig" || t.key_ops !== void 0 && (t.key_ops.length !== 1 || t.key_ops[0] !== "verify"))
      return null;
    try {
      return await globalThis.crypto.subtle.importKey(
        "jwk",
        t,
        { name: "ECDSA", namedCurve: "P-256" },
        !1,
        ["verify"]
      );
    } catch {
      return null;
    }
  }
  async handleReconnectRegisterMessage(t, n) {
    const r = n.session, o = this.options.pairing?.now ? this.options.pairing.now() : Date.now();
    if (!r || t.sessionToken !== r.sessionToken || It(r, o) || n.origin.length === 0) {
      n.close();
      return;
    }
    const a = await this.importReconnectPublicKey(t.publicKeyJwk);
    if (!a) {
      n.close();
      return;
    }
    const i = ue(), c = {
      keyId: i,
      publicKey: a,
      origin: n.origin,
      scopes: new Set(r.scopes),
      createdAt: o,
      expiresAt: r.expiresAt,
      agentId: r.agentId,
      agentLabel: r.agentLabel
    };
    this.reconnectAuthorizations.set(i, c), n.sendJson({
      type: "agent_bridge_reconnect_registered",
      protocolVersion: V,
      keyId: i,
      bridgeInstanceId: this.bridgeInstanceId,
      expiresAt: c.expiresAt
    });
  }
  createReconnectChallenge(t, n, r) {
    const o = ue(), a = {
      type: "agent_bridge_reconnect_challenge",
      protocolVersion: V,
      bridgeInstanceId: this.bridgeInstanceId,
      keyId: n.keyId,
      challengeId: o,
      nonce: fn(32).toString("base64url"),
      origin: n.origin,
      expiresAt: Math.min(r + zl, n.expiresAt)
    };
    return this.reconnectChallenges.set(o, {
      clientId: t.id,
      message: a
    }), a;
  }
  async handleReconnectProofMessage(t, n) {
    const r = this.reconnectChallenges.get(t.challengeId);
    if (this.reconnectChallenges.delete(t.challengeId), !r) {
      n.close();
      return;
    }
    const o = this.reconnectAuthorizations.get(t.keyId), a = this.options.pairing?.now ? this.options.pairing.now() : Date.now();
    if (!o || r.clientId !== n.id || r.message.keyId !== t.keyId || r.message.bridgeInstanceId !== this.bridgeInstanceId || r.message.origin !== n.origin || r.message.expiresAt <= a || o.expiresAt <= a || o.origin !== n.origin) {
      n.close();
      return;
    }
    let i = !1;
    try {
      i = await globalThis.crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        o.publicKey,
        new Uint8Array(Y.from(t.signature, "base64url")),
        new TextEncoder().encode(gl(r.message))
      );
    } catch {
      i = !1;
    }
    if (!i) {
      n.close();
      return;
    }
    const c = this.options.pairing, l = vt({
      scopes: o.scopes,
      now: () => a,
      ttlMs: o.expiresAt - a,
      tokenBytes: c?.tokenBytes,
      tokenFactory: c?.tokenFactory,
      agentId: o.agentId,
      agentLabel: o.agentLabel
    });
    this.sessions.set(l.sessionToken, l), this.sessionReconnectKeyIds.set(l.sessionToken, o.keyId), n.session = l, n.reconnectPending = !1, this.authoritativeClientId || (this.authoritativeClientId = n.id), n.sendJson(this.createPairingMessage(l)), this.audit({
      action: "session_connected",
      clientId: n.id,
      details: {
        paired: !1,
        resumed: !1,
        browserReconnected: !0,
        authoritative: this.authoritativeClientId === n.id
      }
    });
  }
  handleReconnectForgetMessage(t, n) {
    if (!n.session || t.sessionToken !== n.session.sessionToken)
      return n.close(), !0;
    this.reconnectAuthorizations.delete(t.keyId);
    for (const [o, a] of this.reconnectChallenges)
      a.message.keyId === t.keyId && this.reconnectChallenges.delete(o);
    const r = /* @__PURE__ */ new Set();
    for (const [o, a] of this.sessionReconnectKeyIds)
      a === t.keyId && (r.add(o), this.sessionReconnectKeyIds.delete(o), this.sessions.delete(o));
    for (const o of this.clients)
      (o === n || o.session && r.has(o.session.sessionToken)) && o.close();
    return !0;
  }
  createSessionConnection(t) {
    const n = this.options.pairing, r = n?.now ? n.now() : Date.now(), o = t.searchParams.get("reconnectKeyId")?.trim();
    if (o) {
      const d = this.reconnectAuthorizations.get(o);
      if (!d || d.expiresAt <= r)
        throw d && this.reconnectAuthorizations.delete(o), new j("PERMISSION_DENIED", "Browser reconnect authorization expired or not found.");
      return {
        reconnectAuthorization: d,
        resumed: !1,
        session: null
      };
    }
    const a = t.searchParams.get("sessionToken")?.trim();
    if (a) {
      const d = this.sessions.get(a);
      if (!d || It(d, r))
        throw d && this.sessions.delete(a), new j("PERMISSION_DENIED", "Agent bridge session expired or not found.");
      return {
        resumed: !0,
        session: d
      };
    }
    if (!n)
      return null;
    const i = t.searchParams.get("pairingId"), c = t.searchParams.get("pairingCode");
    if (!i || !c) {
      if (n.required === !1)
        return null;
      throw new j("PERMISSION_DENIED", "Pairing credentials are required for the TaskTime Pro agent bridge.");
    }
    const l = n.store.consume(i, c, r), p = vt({
      scopes: l.scopes,
      now: () => r,
      ttlMs: n.sessionTtlMs,
      tokenBytes: n.tokenBytes,
      tokenFactory: n.tokenFactory,
      agentId: l.agentId,
      agentLabel: l.agentLabel
    });
    return this.sessions.set(p.sessionToken, p), { challenge: l, resumed: !1, session: p };
  }
  createPairingMessage(t) {
    const n = {
      type: "agent_bridge_session",
      protocolVersion: V,
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
      El(t.headers.origin, this.options.allowedOrigins || ar);
      const r = new URL(String(t.headers.origin)).origin, o = $l(t);
      if (o.pathname !== (this.options.path || jl))
        throw new Error("Invalid agent bridge WebSocket path.");
      const a = t.headers["sec-websocket-key"];
      if (typeof a != "string" || !a.trim())
        throw new Error("Missing WebSocket key.");
      const i = this.createSessionConnection(o);
      n.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${Dl(a)}`,
        "",
        ""
      ].join(`\r
`));
      const c = new Ol(
        n,
        `client-${this.nextClientId++}`,
        r,
        i?.session ?? null,
        !!i?.reconnectAuthorization
      );
      this.clients.add(c), !this.authoritativeClientId && !c.reconnectPending && (this.authoritativeClientId = c.id), this.audit({
        action: "session_connected",
        clientId: c.id,
        details: {
          paired: !!i?.challenge,
          resumed: !!i?.resumed,
          browserReconnectPending: !!i?.reconnectAuthorization,
          authoritative: this.authoritativeClientId === c.id
        }
      }), i?.session && (c.sendJson(this.createPairingMessage(i.session)), i.challenge && (this.audit({
        action: "pairing_succeeded",
        clientId: c.id,
        details: {
          pairingId: i.challenge.id,
          scopes: i.challenge.scopes,
          expiresAt: i.session.expiresAt
        }
      }), this.options.onSessionCreated?.(i.session, c, i.challenge))), i?.reconnectAuthorization && c.sendJson(this.createReconnectChallenge(
        c,
        i.reconnectAuthorization,
        this.options.pairing?.now ? this.options.pairing.now() : Date.now()
      )), this.options.onClientConnected?.(c), n.on("data", (l) => {
        for (const p of Cl(l)) {
          let d;
          try {
            d = JSON.parse(p);
          } catch {
            d = p;
          }
          if (!(Ll(d) && this.resolvePendingResponse(d, c)) && !(dl(d) && this.handleControlMessage(d, c))) {
            if (ml(d)) {
              this.handleReconnectRegisterMessage(d, c);
              continue;
            }
            if (fl(d)) {
              this.handleReconnectProofMessage(d, c);
              continue;
            }
            hl(d) && this.handleReconnectForgetMessage(d, c) || yl(d) && this.handleApprovalGrantMessage(d, c) || bl(d) && this.handleApprovalGrantRevocationMessage(d, c) || this.options.onMessage?.(d, c);
          }
        }
      }), n.on("end", () => {
        n.destroy();
      }), n.on("close", () => {
        const l = this.authoritativeClientId === c.id;
        this.clients.delete(c);
        for (const [p, d] of this.reconnectChallenges)
          d.clientId === c.id && this.reconnectChallenges.delete(p);
        l && this.electAuthoritativeClient(), this.rejectPendingResponses(new j("UNAVAILABLE", "TaskTime Pro app session disconnected."), c), this.audit({
          action: "session_disconnected",
          clientId: c.id,
          details: {
            wasAuthoritative: l,
            nextAuthoritativeClientId: this.authoritativeClientId
          }
        }), this.options.onClientDisconnected?.(c);
      });
    } catch {
      n.write(`HTTP/1.1 403 Forbidden\r
Connection: close\r
\r
`), n.destroy();
    }
  }
}
class Zl {
  constructor(t) {
    this.pairingStore = new Ur(), this.approvalGrants = /* @__PURE__ */ new Map(), this.options = t, this.auditLog = t.auditLog ?? new gn();
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
    this.server = new Ml(n);
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
  getBridgeInstanceId() {
    return this.server.getBridgeInstanceId();
  }
  getAuthoritativeClientId() {
    return this.server.getAuthoritativeClientId();
  }
  createApprovalToken(t) {
    const n = Ul(t.scopes), r = this.options.now ? this.options.now() : Date.now(), o = t.grantId ? this.approvalGrants.get(t.grantId) ?? null : Array.from(this.approvalGrants.values()).find((a) => this.isGrantBoundToConfiguredAgent(a) && Ht(a.scopes, n)) ?? null;
    if (!o)
      throw new j("UNAVAILABLE", "No trusted TaskTime Pro approval grant is available for this bridge process.");
    if (!this.isGrantBoundToConfiguredAgent(o))
      throw new j("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant belongs to a different agent identity.");
    if (o.expiresAt != null && o.expiresAt <= r)
      throw new j("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant expired.");
    if (!Ht(o.scopes, n))
      throw new j("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant does not cover the requested scopes.");
    return Rr({
      grant: o,
      command: t.command,
      inputHash: t.inputHash,
      scopes: n,
      category: t.category ?? Bl(t.command, n),
      now: () => r,
      ttlMs: t.ttlMs,
      nonce: t.nonce
    });
  }
  getEndpoint() {
    const t = this.server.getAddress();
    if (!t || typeof t == "string")
      throw new j("UNAVAILABLE", "Local agent bridge must be started before creating a pairing challenge.");
    const n = this.options.path ?? "/tasktime-agent";
    return `ws://${ql(this.options.host, t)}:${t.port}${n}`;
  }
  isGrantBoundToConfiguredAgent(t) {
    return !this.options.agentId || t.clientId === this.options.agentId;
  }
}
function Ul(e) {
  return [...new Set(e)];
}
function Ht(e, t) {
  const n = new Set(e);
  return t.every((r) => n.has(r));
}
function Bl(e, t) {
  return t.includes("billing") ? "billing" : t.includes("email") ? "email" : t.includes("export") ? "export" : e.startsWith("delete_") || e.startsWith("cascade_delete_") || e.startsWith("restore_") || e === "undo_latest_invoice" ? "destructive" : "sensitive";
}
function ql(e, t) {
  return e === "::1" || t.family === "IPv6" ? "[::1]" : e;
}
const s = { type: "string" }, I = { type: "number" }, g = { type: "boolean" }, f = { type: ["string", "null"] }, Xt = {
  type: "object",
  properties: {
    id: s,
    title: s,
    hours: I,
    hourlyRate: I,
    flatRate: I,
    quantity: I,
    useFlatRate: g,
    parentTaskId: f
  },
  required: ["title"],
  additionalProperties: !1
}, et = {
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
    items: Xt
  },
  additionalTasks: {
    type: "array",
    items: Xt
  }
}, Yt = {
  ...et,
  emailTemplateId: f,
  to: f,
  fromName: f,
  replyTo: f,
  subject: f,
  body: f,
  attachmentTitle: f,
  forwardToSelf: g
}, Z = {
  type: "object",
  properties: {},
  additionalProperties: !1
}, gt = [
  {
    name: "get_pairing_status",
    description: "Return the active local TaskTime Pro bridge endpoint, launch URL, pairing expiry, stable agent identity, and app-session status. This tool works before the browser app is paired.",
    scopes: [],
    inputSchema: Z,
    bridgeLocal: !0
  },
  {
    name: "refresh_pairing",
    description: "Create a fresh local TaskTime Pro pairing challenge and launch URL for the same bridge process when the previous pairing code expired or was consumed. This tool works before the browser app is paired.",
    scopes: [],
    inputSchema: Z,
    bridgeLocal: !0
  }
], sr = [
  {
    name: "list_projects",
    description: "List active TaskTime Pro projects visible to the paired app session.",
    scopes: ["read"],
    inputSchema: Z
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
    description: "Create a non-archived TaskTime Pro client. Free includes one active client; trial and Pro include unlimited active clients.",
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
    description: "Update client fields. Editing is always available; changing archived to false applies the active-client policy.",
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
    description: "Restore an archived client without changing related data. Free includes one active client; trial and Pro include unlimited active clients.",
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
    inputSchema: Z
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
        taxRate: I,
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
        width: I,
        height: I,
        byteSize: I,
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
    inputSchema: Z
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
    inputSchema: Z
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
        currentSequentialNumber: I,
        defaultNotes: s,
        defaultTaxRate: I,
        defaultDueDays: I,
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
    inputSchema: Z
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
            weekStartsOn: I,
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
        startDate: f,
        recurring: {
          type: ["object", "null"],
          properties: {
            type: { type: "string", enum: ["weekly", "monthly", "yearly"] },
            weeklyDays: { type: "array", items: I },
            monthlyType: { type: "string", enum: ["first", "last", "specific"] },
            monthlyDay: I,
            yearlyDate: s
          },
          required: ["type"],
          additionalProperties: !1
        },
        promptTimeEntry: g,
        estimatedHours: { type: ["number", "null"] },
        estimatedFlatAmount: { type: ["number", "null"] },
        idempotencyKey: s
      },
      required: ["title"],
      additionalProperties: !1
    }
  },
  {
    name: "update_task",
    description: "Update a TaskTime Pro task through relationship and task-state invariants. Use complete_task for recurring occurrences.",
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
    inputSchema: Z
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
        pausedAt: I
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
    description: "Stop a timer and create one matching time entry with complete-history validation and replay/concurrency recovery.",
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
        startTime: I,
        note: f
      },
      additionalProperties: !1
    }
  },
  {
    name: "add_manual_time_entry",
    description: "Create a manual time entry after TaskTime Pro validates billing cutoffs and overlaps against complete local history.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: s,
        start: I,
        end: I,
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
    description: "Edit an active unbilled time entry after validating source/target task, billing cutoff, and complete-history overlap rules. Historical and billed entries are rejected.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        entryId: s,
        taskId: s,
        start: I,
        end: I,
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
        weekday: I
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
        weekday: I
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
        weekday: I,
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
        weekday: I
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
        amount: I,
        currency: s,
        isPersonal: g,
        billable: g,
        note: f,
        supplierName: f,
        receiptNumber: f,
        paidOn: f,
        paidBy: f,
        paymentStatus: { type: "string", enum: ["unpaid", "paid"] },
        paymentMode: { type: "string", enum: ["manual", "auto"] },
        clientId: f,
        projectId: f,
        businessId: f,
        categoryId: f,
        isRecurring: g,
        recurrenceId: f,
        amountType: { type: ["string", "null"], enum: ["fixed", "variable", null] },
        taxNumber: f,
        isTaxExempt: g,
        amountExcludingTax: { type: ["number", "null"] },
        taxLabel: f,
        taxRate: { type: ["number", "null"] },
        idempotencyKey: s
      },
      required: ["title", "date", "amount", "currency", "isPersonal", "billable"],
      additionalProperties: !1
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
        amount: I,
        amountType: { type: "string", enum: ["fixed", "variable"] },
        repeat: { type: "string", enum: ["monthly", "yearly"] },
        monthlyType: { type: "string", enum: ["first", "last", "specific"] },
        monthlyDay: I,
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
        amount: I,
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
    inputSchema: Z
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
        filedAt: I,
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
        filedAt: I,
        paidAt: I,
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
        status: { enum: ["draft", "sent", "paid", "overdue", "canceled"] },
        limit: I
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
        finalizedAt: I,
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
        paidAt: I,
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
        referenceAt: I,
        idempotencyKey: s
      },
      required: ["invoiceId", "confirmUnpaid"],
      additionalProperties: !1
    }
  },
  {
    name: "cancel_invoice",
    description: "Cancel a finalized unpaid invoice after explicit confirmation and exact invoice-number confirmation text. The invoice and number remain as an audit record while source claims owned by that invoice are released for future billing.",
    scopes: ["read", "write", "billing"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: s,
        reason: { type: "string", minLength: 1, maxLength: 500 },
        confirmCancel: g,
        confirmationText: s,
        canceledAt: I,
        idempotencyKey: s
      },
      required: ["invoiceId", "reason", "confirmCancel", "confirmationText"],
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
        undoneAt: I,
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
      properties: et,
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
        ...et,
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
      properties: Yt,
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "send_project_quote_email",
    description: "Hosted quote Send requires a Pro trial or subscription, explicit confirmation, and TaskTime Pro approval. Preview and PDF export remain available without hosted Send.",
    scopes: ["read", "email"],
    inputSchema: {
      type: "object",
      properties: {
        ...Yt,
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
    description: "Hosted invoice, reminder, or quote Send requires a Pro trial or subscription, explicit confirmation, and TaskTime Pro approval. Preview and PDF export remain available without hosted Send.",
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
    name: "get_email_send_status",
    description: "Read one durable hosted-email attempt without contacting the provider or sending/retrying a message.",
    scopes: ["read", "email"],
    inputSchema: {
      type: "object",
      properties: { attemptId: s },
      required: ["attemptId"],
      additionalProperties: !1
    }
  },
  {
    name: "get_dashboard_summary",
    description: "Get a bounded summary of current work and canonical invoice-eligible time across complete local history.",
    scopes: ["read"],
    inputSchema: Z
  },
  {
    name: "get_project_overview",
    description: "Get a bounded project summary with canonical invoice-eligible time across complete local history.",
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
    description: "Get the Free basic current-month Overview with scope=basic-current-month, or Pro advanced Reports summaries. Omitted scope remains advanced.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["basic-current-month", "advanced"] },
        section: { type: "string", enum: ["overview", "monthly", "statement", "work-summary", "tax", "invoices", "outstanding", "expenses", "hours", "to-invoice"] },
        period: { type: "string", enum: ["this-month", "last-month", "this-quarter", "last-quarter", "this-year", "last-year", "custom"] },
        customStart: f,
        customEnd: f,
        businessId: f,
        clientId: f,
        projectId: f,
        categoryId: f,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        includeRows: g,
        rowLimit: I
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
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: I,
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
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: I,
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
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: I,
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
    name: "list_cloud_backups",
    description: "List TaskTime Pro backup snapshots in the active cloud provider without returning backup contents.",
    scopes: ["read", "export"],
    inputSchema: Z
  },
  {
    name: "create_cloud_backup",
    description: "Create a TaskTime Pro backup snapshot in the active cloud provider using the existing backup manager.",
    scopes: ["read", "export"],
    inputSchema: Z
  },
  {
    name: "download_cloud_backup_json",
    description: "Download a selected backup from the active cloud provider as a browser JSON file without returning backup contents through the bridge.",
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
    name: "list_drive_backups",
    description: "Deprecated Google Drive compatibility alias for list_cloud_backups. List TaskTime Pro backup snapshots in Google Drive without returning backup contents.",
    scopes: ["read", "export"],
    inputSchema: Z
  },
  {
    name: "create_drive_backup",
    description: "Deprecated Google Drive compatibility alias for create_cloud_backup. Create a TaskTime Pro backup snapshot in Google Drive.",
    scopes: ["read", "export"],
    inputSchema: Z
  },
  {
    name: "download_drive_backup_json",
    description: "Deprecated Google Drive compatibility alias for download_cloud_backup_json. Download a selected Google Drive backup as a browser JSON file without returning backup contents through the bridge.",
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
    name: "restore_cloud_backup",
    description: "Replace current local TaskTime Pro data from a selected backup in the active cloud provider after explicit confirmation and TaskTime Pro approval. Requires confirmationText to equal RESTORE.",
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
    name: "restore_drive_backup",
    description: "Deprecated Google Drive compatibility alias for restore_cloud_backup. Replace current local TaskTime Pro data from a selected Google Drive backup after explicit confirmation and TaskTime Pro approval. Requires confirmationText to equal RESTORE.",
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
    description: "Read the active cloud provider, sync status, auto-sync mode, pending changes, and backup preference metadata.",
    scopes: ["read"],
    inputSchema: Z
  },
  {
    name: "update_sync_settings",
    description: "Update explicit cloud sync and backup preferences for the active provider. Backup mode requires confirmBackupMode: true. Optional runSync triggers Sync Now after saving.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        autoSyncEnabled: g,
        autoSyncMode: { type: "string", enum: ["backup", "sync"] },
        backupEnabled: g,
        backupFrequencyHours: I,
        confirmBackupMode: g,
        runSync: g
      },
      additionalProperties: !1
    }
  },
  {
    name: "delete_all_account_data",
    description: "Delete all local TaskTime Pro data and, when cloud storage is connected, wipe all TaskTime sync data and backups and revoke the active provider after explicit confirmation and TaskTime Pro approval. Requires confirmationText to equal DELETE ALL DATA.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        confirmDelete: g,
        confirmationText: s,
        includeCloudData: g,
        includeDriveData: g
      },
      required: ["confirmDelete", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "find_unbilled_time",
    description: "Find canonical invoice-eligible time across complete local history, optionally scoped by project or task.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: f,
        taskId: f,
        limit: I
      },
      additionalProperties: !1
    }
  },
  {
    name: "list_recent_entries",
    description: "List recent entries across complete local history with actual and billable duration summaries.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: f,
        taskId: f,
        limit: I
      },
      additionalProperties: !1
    }
  },
  {
    name: "open_dashboard_view",
    description: "Open the TaskTime Pro dashboard route in the paired app session.",
    scopes: ["navigation"],
    inputSchema: Z
  },
  {
    name: "open_planner_view",
    description: "Open the TaskTime Pro planner route, optionally for a specific year and week.",
    scopes: ["navigation"],
    inputSchema: {
      type: "object",
      properties: {
        year: I,
        week: I
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
    inputSchema: Z
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
function Fl(e) {
  return [
    ...gt,
    ...sr.filter((t) => t.scopes.every((n) => e.has(n)))
  ].sort((t, n) => t.name.localeCompare(n.name));
}
function Qt(e) {
  return gt.find((t) => t.name === e) ?? sr.find((t) => t.name === e) ?? null;
}
function en(e) {
  return gt.some((t) => t.name === e);
}
const Gl = (e) => e === null ? "null" : Array.isArray(e) ? "array" : typeof e;
function tn(e, t) {
  const n = [];
  return tt(e, t, "$", n), { valid: n.length === 0, errors: n };
}
function tt(e, t, n, r) {
  if (!e || typeof e != "object") return;
  const o = Array.isArray(e.type) ? e.type : e.type ? [e.type] : [], a = Gl(t);
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
    for (const l of e.required ?? [])
      Object.prototype.hasOwnProperty.call(i, l) || r.push(`${n}.${l} is required`);
    for (const [l, p] of Object.entries(i)) {
      const d = c[l];
      d ? tt(d, p, `${n}.${l}`, r) : e.additionalProperties === !1 && r.push(`${n}.${l} is not allowed`);
    }
  }
  if (a === "array") {
    const i = t;
    typeof e.minItems == "number" && i.length < e.minItems && r.push(`${n} must contain at least ${e.minItems} item(s)`), e.items && i.forEach((c, l) => tt(e.items, c, `${n}[${l}]`, r));
  }
}
const Vl = "2025-11-25", Ne = "2.0", Kl = 120, Jl = 6e4, Wl = 5 * 6e4;
class Hl {
  constructor(t) {
    if (this.toolCallCount = 0, this.nextRequestId = 0, this.bridge = t.bridge, this.scopes = new Set(t.scopes), this.commandTimeoutMs = t.commandTimeoutMs, this.requestIdFactory = t.requestIdFactory ?? (() => `mcp-request-${this.nextRequestId++}`), this.toolCallRateLimit = t.toolCallRateLimit ?? Kl, this.toolCallRateWindowMs = t.toolCallRateWindowMs ?? Jl, this.now = t.now ?? (() => Date.now()), !Number.isInteger(this.toolCallRateLimit) || this.toolCallRateLimit < 0)
      throw new Error("toolCallRateLimit must be a non-negative integer.");
    if (!Number.isInteger(this.toolCallRateWindowMs) || this.toolCallRateWindowMs <= 0)
      throw new Error("toolCallRateWindowMs must be a positive integer.");
    this.toolCallWindowStartedAt = this.now();
  }
  async handleMessage(t) {
    if (!rp(t))
      return this.error(null, -32600, "Invalid JSON-RPC request.");
    if (t.id === void 0)
      return null;
    switch (t.method) {
      case "initialize":
        return this.result(t.id, {
          protocolVersion: Vl,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "tasktime-local-bridge",
            version: "1.1.0"
          }
        });
      case "ping":
        return this.result(t.id, {});
      case "tools/list":
        return this.result(t.id, {
          tools: Fl(this.scopes).map((n) => ({
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
    const r = Qt(n.name);
    if (!r)
      return C("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.name}`);
    const o = n.arguments ?? {}, a = tn(r.inputSchema, o);
    if (!a.valid)
      return C("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: a.errors
      });
    if (en(r.name))
      return this.callBridgeSetupTool(r.name);
    const i = r.scopes.find((p) => !this.scopes.has(p));
    if (i)
      return C("PERMISSION_DENIED", `Missing ${i} permission.`, {
        scope: i
      });
    const c = this.consumeToolCallBudget(r.name);
    if (c)
      return c;
    let l;
    try {
      l = await this.bridge.sendCommand(
        this.requestIdFactory(),
        r.name,
        o,
        this.commandTimeoutMs,
        Xl(n.approval)
      );
    } catch (p) {
      return p instanceof j ? C(p.code, p.message, nn(p)) : C(
        "UNAVAILABLE",
        p instanceof Error ? p.message : "TaskTime Pro app session is unavailable.",
        cr()
      );
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(l.response)
        }
      ],
      structuredContent: l.response,
      isError: !l.response.ok
    };
  }
  callBridgeSetupTool(t) {
    return t === "get_pairing_status" ? this.bridge.getPairingStatus ? rn(t, this.bridge.getPairingStatus()) : C("UNAVAILABLE", "TaskTime Pro bridge pairing status is unavailable.") : this.bridge.refreshPairing ? rn(t, this.bridge.refreshPairing()) : C("UNAVAILABLE", "TaskTime Pro bridge pairing refresh is unavailable.");
  }
  async createApprovalToken(t) {
    if (!this.bridge.createApprovalToken)
      return C("UNAVAILABLE", "TaskTime Pro approval-token signing is unavailable.");
    const n = t;
    if (!n || typeof n != "object" || typeof n.command != "string")
      return C("INVALID_INPUT", "tasktime/create_approval_token requires a string command.");
    const r = Qt(n.command);
    if (!r)
      return C("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.command}`);
    if (en(r.name))
      return C("INVALID_INPUT", `TaskTime Pro setup tool does not require approval tokens: ${n.command}`);
    const o = n.arguments ?? {}, a = tn(r.inputSchema, o);
    if (!a.valid)
      return C("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: a.errors
      });
    const i = Yl(n.scopes, r.scopes);
    if (!i)
      return C("INVALID_INPUT", "Approval token scopes must be an array of strings.");
    const c = i.find((p) => !this.scopes.has(p));
    if (c)
      return C("PERMISSION_DENIED", `Missing ${c} permission.`, {
        scope: c
      });
    const l = ep(n.ttlMs);
    if (l === null)
      return C("INVALID_INPUT", "Approval token ttlMs must be a positive integer no greater than 300000.");
    try {
      const p = typeof n.inputHash == "string" ? n.inputHash : Ql(o);
      return {
        approval: this.bridge.createApprovalToken({
          grantId: typeof n.grantId == "string" ? n.grantId : void 0,
          command: n.command,
          inputHash: p,
          scopes: i,
          category: typeof n.category == "string" ? n.category : void 0,
          ttlMs: l,
          nonce: typeof n.nonce == "string" ? n.nonce : void 0
        })
      };
    } catch (p) {
      return p instanceof j ? C(p.code, p.message, nn(p)) : C("UNAVAILABLE", p instanceof Error ? p.message : "TaskTime Pro approval-token signing failed.");
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
      jsonrpc: Ne,
      id: t,
      result: n
    };
  }
  error(t, n, r, o) {
    return {
      jsonrpc: Ne,
      id: t,
      error: {
        code: n,
        message: r,
        data: o
      }
    };
  }
}
function Xl(e) {
  if (!e || typeof e != "object")
    return;
  const t = e;
  if (!(typeof t.token != "string" || t.token.trim().length === 0))
    return t;
}
function Yl(e, t) {
  return e === void 0 ? t : !Array.isArray(e) || !e.every((n) => typeof n == "string") ? null : e;
}
function nt(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => nt(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, nt(n)])
  ) : null;
}
function Ql(e) {
  const t = JSON.stringify(nt(e ?? {}));
  return `sha256:${hn("sha256").update(t).digest("hex")}`;
}
function ep(e) {
  if (e !== void 0)
    return !Number.isInteger(e) || e <= 0 || e > Wl ? null : e;
}
function nn(e) {
  return e.code !== "UNAVAILABLE" ? e.details : {
    ...e.details,
    ...cr()
  };
}
function cr() {
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
function rn(e, t) {
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
function tp(e) {
  let t = "";
  const n = (r) => {
    for (t += r.toString(); t.includes(`
`); ) {
      const o = t.indexOf(`
`), a = t.slice(0, o).trim();
      t = t.slice(o + 1), a && np(a, e);
    }
  };
  return e.input.on("data", n), () => {
    e.input.off("data", n);
  };
}
async function np(e, t) {
  try {
    const n = await t.server.handleMessage(JSON.parse(e));
    n && t.output.write(`${JSON.stringify(n)}
`);
  } catch (n) {
    const r = n instanceof Error ? n : new Error("MCP stdio message handling failed.");
    t.onError?.(r), t.output.write(`${JSON.stringify({
      jsonrpc: Ne,
      id: null,
      error: {
        code: -32700,
        message: r.message
      }
    })}
`);
  }
}
function rp(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.jsonrpc === Ne && typeof t.method == "string";
}
const op = "127.0.0.1", on = 0, lr = "/tasktime-agent", rt = ["read", "write", "navigation"], Be = 300 * 1e3, an = 12e4, sn = 120, cn = 6e4, ze = "tasktime.agent.local-bridge", ot = "Local agent bridge", Oe = ["read", "write", "billing", "export", "email", "navigation"];
function ip(e, t = process.env) {
  const n = {
    host: t.TASKTIME_AGENT_BRIDGE_HOST || op,
    port: H(t.TASKTIME_AGENT_BRIDGE_PORT, on, "TASKTIME_AGENT_BRIDGE_PORT"),
    path: t.TASKTIME_AGENT_BRIDGE_PATH || lr,
    scopes: dr(t.TASKTIME_AGENT_BRIDGE_SCOPES) ?? rt,
    allowedOrigins: hp(t.TASKTIME_AGENT_BRIDGE_ORIGINS, "TASKTIME_AGENT_BRIDGE_ORIGINS"),
    agentId: ce(t.TASKTIME_AGENT_ID, ze, "TASKTIME_AGENT_ID"),
    agentLabel: ce(t.TASKTIME_AGENT_LABEL, ot, "TASKTIME_AGENT_LABEL"),
    pairingTtlMs: H(t.TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS, Be, "TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS"),
    sessionTtlMs: mp(t.TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS, "TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS"),
    commandTimeoutMs: H(t.TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS, an, "TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS"),
    toolCallRateLimit: H(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT, sn, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT"),
    toolCallRateWindowMs: mn(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS, cn, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS"),
    appUrl: fp(
      t.TASKTIME_APP_URL ?? ir,
      "TASKTIME_APP_URL"
    ),
    statusFile: gp(t.TASKTIME_AGENT_BRIDGE_STATUS_FILE, "TASKTIME_AGENT_BRIDGE_STATUS_FILE"),
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
        n.host = U(e, ++a, i);
        break;
      case "--port":
        n.port = H(U(e, ++a, i), on, i);
        break;
      case "--path":
        n.path = dn(U(e, ++a, i));
        break;
      case "--scopes":
        n.scopes = dp(U(e, ++a, i), i);
        break;
      case "--scope":
        r.push(mr(U(e, ++a, i), i));
        break;
      case "--origin":
        o.push(fr(U(e, ++a, i), i));
        break;
      case "--agent-id":
        n.agentId = ce(U(e, ++a, i), ze, i);
        break;
      case "--agent-label":
        n.agentLabel = ce(U(e, ++a, i), ot, i);
        break;
      case "--pairing-ttl-ms":
        n.pairingTtlMs = H(U(e, ++a, i), Be, i);
        break;
      case "--session-ttl-ms":
        n.sessionTtlMs = H(U(e, ++a, i), Be, i);
        break;
      case "--command-timeout-ms":
        n.commandTimeoutMs = H(U(e, ++a, i), an, i);
        break;
      case "--tool-rate-limit":
        n.toolCallRateLimit = H(U(e, ++a, i), sn, i);
        break;
      case "--tool-rate-window-ms":
        n.toolCallRateWindowMs = mn(U(e, ++a, i), cn, i);
        break;
      case "--app-url":
        n.appUrl = yt(U(e, ++a, i), i);
        break;
      case "--status-file":
        n.statusFile = ce(U(e, ++a, i), "", i);
        break;
      default:
        throw new Error(`Unsupported option: ${i}`);
    }
  }
  return r.length > 0 && (n.scopes = it(r)), o.length > 0 && (n.allowedOrigins = o), n.path = dn(n.path), n.scopes = it(n.scopes), n;
}
function ap() {
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
    "  --status-file <path>          Write non-secret machine-readable bridge status JSON.",
    "  --manifest                    Print local agent discovery metadata as JSON and exit.",
    "  --help                        Show this help.",
    "",
    "MCP JSON-RPC messages are read from stdin and written to stdout.",
    "Bridge status and pairing details are written to stderr."
  ].join(`
`);
}
function sp() {
  return {
    schemaVersion: 1,
    app: {
      id: "pro.tasktime",
      name: "TaskTime Pro",
      category: "task-time-invoicing",
      localFirst: !0,
      coreUseAccountRequired: !1,
      coreUseFree: !0,
      offlineCapable: !0,
      openSource: !0,
      workDataStorage: "browser-local",
      aggregateUsageMetrics: !0
    },
    clawHub: {
      owner: "tasktimepro",
      slug: "tasktime-agent",
      canonicalRef: "@tasktimepro/tasktime-agent",
      sourceRepository: "https://github.com/tasktimepro/tasktime",
      sourcePath: "integrations/openclaw/tasktime/skills/tasktime"
    },
    docs: {
      ...Tl
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
        defaultPath: lr,
        allowedHosts: ["127.0.0.1", "localhost", "::1"],
        pairingRequired: !0,
        defaultSessionTtlMs: 1440 * 60 * 1e3,
        resume: {
          queryParam: "sessionToken",
          currentTabStorage: "sessionStorage",
          browserReopen: "non-exportable-p256-proof-of-possession",
          bearerTokenDurable: !1,
          until: ["session_expiry", "access_revocation", "bridge_process_exit"]
        }
      },
      statusFile: {
        argument: "--status-file",
        environment: "TASKTIME_AGENT_BRIDGE_STATUS_FILE",
        schemaVersion: 2,
        containsPairingCredentials: !1
      },
      identity: {
        argument: "--agent-id",
        labelArgument: "--agent-label",
        defaultAgentId: ze
      },
      defaultScopes: rt,
      optionalScopes: Oe.filter((e) => !rt.includes(e)),
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
function pr(e, t) {
  const n = new URL(yt(t, "app URL"));
  return n.pathname = "/account", n.search = "", n.hash = "", n.searchParams.set("section", "agent"), n.searchParams.set("agentBridgeEndpoint", e.endpoint), n.searchParams.set("agentBridgePairingId", e.id), n.searchParams.set("agentBridgePairingCode", e.code), n.searchParams.set("agentBridgeScopes", e.scopes.join(",")), e.agentId && n.searchParams.set("agentBridgeAgentId", e.agentId), e.agentLabel && n.searchParams.set("agentBridgeAgentLabel", e.agentLabel), n.toString();
}
function cp(e, t) {
  const n = [
    "TaskTime Pro local agent bridge is running.",
    `App endpoint: ${e.endpoint}`,
    `Pairing ID: ${e.id}`,
    `Pairing code: ${e.code}`,
    `Agent: ${e.agentLabel || ot} (${e.agentId || ze})`,
    `Scopes: ${e.scopes.join(",")}`,
    `Pairing expires at: ${new Date(e.expiresAt).toISOString()}`
  ];
  return t && n.push(`TaskTime Pro launch URL: ${pr(e, t)}`), n.push(
    "",
    "Open TaskTime Pro and connect the agent bridge using the endpoint, pairing ID, and pairing code above."
  ), n.join(`
`);
}
async function lp(e, t) {
  let n = null, r = null, o = null;
  const a = (/* @__PURE__ */ new Date()).toISOString(), i = e.statusFile ? Ir(e.statusFile) : void 0, c = () => {
    if (!(!i || !r || !o))
      try {
        const $ = ln({
          bridge: o,
          challenge: r,
          appUrl: e.appUrl,
          agentId: e.agentId,
          agentLabel: e.agentLabel,
          startedAt: a,
          activeSessionExpiresAt: n
        }), be = pn(i, $.bridgeInstanceId);
        br(Tr(i), { recursive: !0, mode: 448 }), _r(be, `${JSON.stringify(pp($), null, 2)}
`, {
          mode: 384
        }), _t(be, 384), vr(be, i), _t(i, 384);
      } catch ($) {
        t.stderr.write(`TaskTime Pro bridge status file write failed: ${$ instanceof Error ? $.message : String($)}
`);
      }
  }, l = ($) => {
    $.action === "pairing_succeeded" && (n = typeof $.details?.expiresAt == "number" ? $.details.expiresAt : null), $.action === "session_disconnected" && o?.getClientCount() === 0 && (n = null), c();
  };
  o = new Zl({
    host: e.host,
    port: e.port,
    path: e.path,
    agentId: e.agentId,
    allowedOrigins: e.allowedOrigins,
    sessionTtlMs: e.sessionTtlMs,
    onAudit: l
  }), await o.start();
  const p = o, d = () => (r = p.createPairingChallenge({
    scopes: e.scopes,
    ttlMs: e.pairingTtlMs,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  }), c(), r), y = () => ln({
    bridge: p,
    challenge: r ?? d(),
    appUrl: e.appUrl,
    agentId: e.agentId,
    agentLabel: e.agentLabel,
    startedAt: a,
    activeSessionExpiresAt: n
  }), v = () => (d(), y()), T = d(), M = new Hl({
    bridge: {
      sendCommand: p.sendCommand.bind(p),
      createApprovalToken: p.createApprovalToken.bind(p),
      getPairingStatus: y,
      refreshPairing: v
    },
    scopes: e.scopes,
    commandTimeoutMs: e.commandTimeoutMs,
    toolCallRateLimit: e.toolCallRateLimit,
    toolCallRateWindowMs: e.toolCallRateWindowMs
  }), R = tp({
    input: t.stdin,
    output: t.stdout,
    server: M,
    onError: ($) => {
      t.stderr.write(`TaskTime Pro MCP bridge error: ${$.message}
`);
    }
  });
  return t.stderr.write(`${cp(T, e.appUrl)}
`), {
    bridge: p,
    challenge: T,
    getStatus: y,
    refreshPairing: v,
    stop: async () => {
      R(), await p.stop(), un(i), i && un(pn(i, p.getBridgeInstanceId()));
    }
  };
}
function ln(e) {
  const t = Date.now();
  return {
    schemaVersion: 1,
    pid: process.pid,
    bridgeInstanceId: e.bridge.getBridgeInstanceId(),
    startedAt: e.startedAt,
    updatedAt: new Date(t).toISOString(),
    agent: {
      id: e.agentId,
      label: e.agentLabel
    },
    endpoint: e.challenge.endpoint,
    appUrl: e.appUrl,
    launchUrl: e.appUrl ? pr(e.challenge, e.appUrl) : void 0,
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
      connectedBrowserSessions: e.bridge.getClientCount(),
      authoritativeClientId: e.bridge.getAuthoritativeClientId(),
      expiresAt: e.activeSessionExpiresAt ? new Date(e.activeSessionExpiresAt).toISOString() : void 0
    }
  };
}
function pp(e) {
  return {
    schemaVersion: 2,
    pid: e.pid,
    bridgeInstanceId: e.bridgeInstanceId,
    startedAt: e.startedAt,
    updatedAt: e.updatedAt,
    agent: e.agent,
    endpoint: e.endpoint,
    appUrl: e.appUrl,
    scopes: e.scopes,
    pairing: {
      expiresAt: e.pairing.expiresAt,
      expired: e.pairing.expired
    },
    session: e.session
  };
}
function pn(e, t) {
  return `${e}.${process.pid}.${t}.tmp`;
}
function un(e) {
  if (e)
    try {
      yr(e);
    } catch {
    }
}
async function up(e = process.argv.slice(2), t = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
}, n = process.env) {
  const r = ip(e, n);
  if (r.help)
    return t.stderr.write(`${ap()}
`), null;
  if (r.manifest)
    return t.stdout.write(`${JSON.stringify(sp(), null, 2)}
`), null;
  const o = await lp(r, t), a = async () => {
    await o.stop(), process.exit(0);
  };
  return process.once("SIGINT", () => {
    a();
  }), process.once("SIGTERM", () => {
    a();
  }), o;
}
function ur(e) {
  if (!e)
    return;
  const t = e.split(",").map((n) => n.trim()).filter(Boolean);
  return t.length > 0 ? t : void 0;
}
function dp(e, t) {
  const n = dr(e);
  if (!n || n.length === 0)
    throw new Error(`${t} must include at least one scope.`);
  return n;
}
function dr(e) {
  const t = ur(e);
  if (t)
    return it(t.map((n) => mr(n, "scope")));
}
function mr(e, t) {
  if (Oe.includes(e))
    return e;
  throw new Error(`${t} must be one of: ${Oe.join(", ")}`);
}
function it(e) {
  return Oe.filter((t) => e.includes(t));
}
function dn(e) {
  return e.startsWith("/") ? e : `/${e}`;
}
function U(e, t, n) {
  const r = e[t];
  if (!r || r.startsWith("--"))
    throw new Error(`${n} requires a value.`);
  return r;
}
function H(e, t, n) {
  if (e === void 0 || e === "")
    return t;
  const r = Number(e);
  if (!Number.isInteger(r) || r < 0)
    throw new Error(`${n} must be a non-negative integer.`);
  return r;
}
function mp(e, t) {
  if (!(e === void 0 || e === ""))
    return H(e, 0, t);
}
function mn(e, t, n) {
  const r = H(e, t, n);
  if (r <= 0)
    throw new Error(`${n} must be a positive integer.`);
  return r;
}
function fp(e, t) {
  if (e)
    return yt(e, t);
}
function fr(e, t) {
  try {
    return ht(e, "agent bridge");
  } catch {
    throw new Error(`${t} must be an exact HTTPS or loopback HTTP origin.`);
  }
}
function hp(e, t) {
  return ur(e)?.map((r) => fr(r, t));
}
function gp(e, t) {
  if (!(e === void 0 || e === ""))
    return ce(e, "", t);
}
function ce(e, t, n) {
  const r = e === void 0 ? t : e;
  if (!r.trim())
    throw new Error(`${n} must be a non-empty string.`);
  return r.trim();
}
function yt(e, t) {
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
function yp() {
  const e = process.argv[1];
  if (!e)
    return !1;
  try {
    return bt(e) === bt(wr(import.meta.url));
  } catch {
    return import.meta.url === kr(e).href;
  }
}
yp() && up().catch((e) => {
  process.stderr.write(`TaskTime Pro local agent bridge failed: ${e instanceof Error ? e.message : String(e)}
`), process.exitCode = 1;
});
export {
  pr as buildTaskTimeAgentBridgeLaunchUrl,
  cp as formatPairingInstructions,
  ap as getTaskTimeAgentBridgeCliUsage,
  sp as getTaskTimeAgentBridgeManifest,
  ip as parseTaskTimeAgentBridgeCliOptions,
  up as runTaskTimeAgentBridgeCli,
  lp as startTaskTimeAgentBridgeCli
};
