#!/usr/bin/env node
import { realpathSync as gt, unlinkSync as pr, mkdirSync as ur, writeFileSync as dr, chmodSync as yt, renameSync as mr } from "node:fs";
import { resolve as fr, dirname as hr } from "node:path";
import { fileURLToPath as gr, pathToFileURL as yr } from "node:url";
import { randomUUID as pe, randomBytes as un, createHmac as br, randomInt as _r, createHash as dn } from "node:crypto";
import { Buffer as Y } from "node:buffer";
import { createServer as vr } from "node:http";
class j extends Error {
  constructor(t, n, r) {
    super(n), this.name = "AgentCommandError", this.code = t, this.details = r;
  }
}
const Ir = 500;
function wr(e) {
  return e.startsWith("export_") || e === "create_drive_backup" || e === "download_drive_backup_json" ? "export" : e.startsWith("open_") || e.startsWith("focus_") ? "navigation" : e.includes("invoice") || e.includes("billed") || e.includes("billing") ? e.includes("email") ? "email" : "billing" : e.startsWith("list_") || e.startsWith("get_") || e.startsWith("find_") || e.startsWith("preview_") ? "read" : e.startsWith("create_") || e.startsWith("update_") || e.startsWith("complete_") || e.startsWith("archive_") || e.startsWith("unarchive_") || e.startsWith("start_") || e.startsWith("pause_") || e.startsWith("stop_") || e.startsWith("add_") || e.startsWith("mark_") || e.startsWith("finalize_") || e.startsWith("restore_") || e.startsWith("delete_") ? "write" : "unknown";
}
class mn {
  constructor(t = {}) {
    this.events = [], this.nextId = 0, this.maxEvents = t.maxEvents ?? Ir, this.now = t.now ?? Date.now, this.idFactory = t.idFactory ?? (() => `bridge-audit-${this.nextId++}`);
  }
  append(t) {
    const n = {
      id: this.idFactory(),
      timestamp: this.now(),
      action: t.action
    }, r = t.commandCategory ?? (t.command ? wr(t.command) : void 0);
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
const kr = "tasktime-hmac-sha256-v1", Tr = 6e4;
function fn(e) {
  return [...new Set(e)].sort();
}
function Be(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => Be(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, Be(n)])
  ) : null;
}
function Sr(e) {
  return JSON.stringify(Be({
    ...e,
    scopes: fn(e.scopes)
  }));
}
function Ar(e) {
  const t = e.replace(/-/g, "+").replace(/_/g, "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return Buffer.from(n, "base64");
}
function Pr(e, t) {
  return br("sha256", Ar(t)).update(Sr(e)).digest("base64url");
}
function xr(e) {
  const t = e.now ? e.now() : Date.now(), n = t + (e.ttlMs ?? Tr), r = e.nonce ?? (typeof pe == "function" ? pe() : un(16).toString("base64url")), o = {
    format: kr,
    grantId: e.grant.id,
    command: e.command,
    inputHash: e.inputHash,
    category: e.category,
    scopes: fn(e.scopes),
    nonce: r,
    issuedAt: t,
    expiresAt: n
  };
  return {
    format: o.format,
    grantId: o.grantId,
    token: Pr(o, e.grant.secretKeyBase64Url),
    issuedAt: o.issuedAt,
    expiresAt: o.expiresAt,
    nonce: o.nonce,
    command: o.command,
    inputHash: o.inputHash,
    scopes: o.scopes,
    category: o.category
  };
}
const Er = 300 * 1e3, jr = 6;
function zr(e) {
  let t = "";
  for (let n = 0; n < e; n += 1)
    t += String(_r(0, 10));
  return t;
}
function Dr(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? Er, r = e.codeLength ?? jr;
  return {
    id: e.idFactory ? e.idFactory() : pe(),
    code: e.codeFactory ? e.codeFactory(r) : zr(r),
    endpoint: e.endpoint,
    scopes: [...e.scopes],
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function Or(e, t = Date.now()) {
  return t >= e.expiresAt;
}
class Nr {
  constructor() {
    this.challenges = /* @__PURE__ */ new Map();
  }
  create(t) {
    const n = Dr(t);
    return this.challenges.set(n.id, n), n;
  }
  get(t) {
    return this.challenges.get(t) || null;
  }
  consume(t, n, r = Date.now()) {
    const o = this.challenges.get(t);
    if (!o)
      throw new j("NOT_FOUND", "Pairing challenge not found.", { id: t });
    if (Or(o, r))
      throw this.challenges.delete(t), new j("PERMISSION_DENIED", "Pairing challenge expired.", { id: t });
    if (o.code !== n)
      throw new j("PERMISSION_DENIED", "Pairing code is invalid.", { id: t });
    return this.challenges.delete(t), o;
  }
  delete(t) {
    this.challenges.delete(t);
  }
}
const Cr = 1440 * 60 * 1e3, Rr = 32;
function $r() {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Secure random token generation is unavailable.");
  return globalThis.crypto;
}
function Lr(e = Rr) {
  const t = new Uint8Array(e);
  return $r().getRandomValues(t), Array.from(t).map((n) => n.toString(16).padStart(2, "0")).join("");
}
function bt(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? Cr;
  return {
    sessionToken: e.tokenFactory ? e.tokenFactory(e.tokenBytes) : Lr(e.tokenBytes),
    scopes: new Set(e.scopes),
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function _t(e, t = Date.now()) {
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
class ue extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class hn extends Error {
  constructor(t) {
    super(`Encountered unidirectional transform during encode: ${t}`), this.name = "ZodEncodeError";
  }
}
const qe = {};
function Q(e) {
  return e && Object.assign(qe, e), qe;
}
function gn(e) {
  const t = Object.values(e).filter((r) => typeof r == "number");
  return Object.entries(e).filter(([r, o]) => t.indexOf(+r) === -1).map(([r, o]) => o);
}
function Fe(e, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
function it(e) {
  return {
    get value() {
      {
        const t = e();
        return Object.defineProperty(this, "value", { value: t }), t;
      }
    }
  };
}
function at(e) {
  return e == null;
}
function st(e) {
  const t = e.startsWith("^") ? 1 : 0, n = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(t, n);
}
function Mr(e, t) {
  const n = (e.toString().split(".")[1] || "").length, r = t.toString();
  let o = (r.split(".")[1] || "").length;
  if (o === 0 && /\d?e-\d?/.test(r)) {
    const l = r.match(/\d?e-(\d?)/);
    l?.[1] && (o = Number.parseInt(l[1]));
  }
  const a = n > o ? n : o, i = Number.parseInt(e.toFixed(a).replace(".", "")), c = Number.parseInt(t.toFixed(a).replace(".", ""));
  return i % c / 10 ** a;
}
const vt = /* @__PURE__ */ Symbol("evaluating");
function S(e, t, n) {
  let r;
  Object.defineProperty(e, t, {
    get() {
      if (r !== vt)
        return r === void 0 && (r = vt, r = n()), r;
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
function It(e) {
  return JSON.stringify(e);
}
function Zr(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const yn = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function ke(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
const Ur = it(() => {
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare"))
    return !1;
  try {
    const e = Function;
    return new e(""), !0;
  } catch {
    return !1;
  }
});
function fe(e) {
  if (ke(e) === !1)
    return !1;
  const t = e.constructor;
  if (t === void 0 || typeof t != "function")
    return !0;
  const n = t.prototype;
  return !(ke(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function bn(e) {
  return fe(e) ? { ...e } : Array.isArray(e) ? [...e] : e;
}
const Br = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function he(e) {
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
function qr(e) {
  return Object.keys(e).filter((t) => e[t]._zod.optin === "optional" && e[t]._zod.optout === "optional");
}
const Fr = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function Gr(e, t) {
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
function Vr(e, t) {
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
function Kr(e, t) {
  if (!fe(t))
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
function Jr(e, t) {
  if (!fe(t))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const n = oe(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t };
      return ae(this, "shape", r), r;
    }
  });
  return ie(e, n);
}
function Wr(e, t) {
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
function Hr(e, t, n) {
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
function Xr(e, t, n) {
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
function ce(e, t = 0) {
  if (e.aborted === !0)
    return !0;
  for (let n = t; n < e.issues.length; n++)
    if (e.issues[n]?.continue !== !0)
      return !0;
  return !1;
}
function le(e, t) {
  return t.map((n) => {
    var r;
    return (r = n).path ?? (r.path = []), n.path.unshift(e), n;
  });
}
function ve(e) {
  return typeof e == "string" ? e : e?.message;
}
function ee(e, t, n) {
  const r = { ...e, path: e.path ?? [] };
  if (!e.message) {
    const o = ve(e.inst?._zod.def?.error?.(e)) ?? ve(t?.error?.(e)) ?? ve(n.customError?.(e)) ?? ve(n.localeError?.(e)) ?? "Invalid input";
    r.message = o;
  }
  return delete r.inst, delete r.continue, t?.reportInput || delete r.input, r;
}
function ct(e) {
  return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function _e(...e) {
  const [t, n, r] = e;
  return typeof t == "string" ? {
    message: t,
    code: "custom",
    input: n,
    inst: r
  } : { ...t };
}
const _n = (e, t) => {
  e.name = "$ZodError", Object.defineProperty(e, "_zod", {
    value: e._zod,
    enumerable: !1
  }), Object.defineProperty(e, "issues", {
    value: t,
    enumerable: !1
  }), e.message = JSON.stringify(t, Fe, 2), Object.defineProperty(e, "toString", {
    value: () => e.message,
    enumerable: !1
  });
}, vn = u("$ZodError", _n), In = u("$ZodError", _n, { Parent: Error });
function Yr(e, t = (n) => n.message) {
  const n = {}, r = [];
  for (const o of e.issues)
    o.path.length > 0 ? (n[o.path[0]] = n[o.path[0]] || [], n[o.path[0]].push(t(o))) : r.push(t(o));
  return { formErrors: r, fieldErrors: n };
}
function Qr(e, t = (n) => n.message) {
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
const lt = (e) => (t, n, r, o) => {
  const a = r ? Object.assign(r, { async: !1 }) : { async: !1 }, i = t._zod.run({ value: n, issues: [] }, a);
  if (i instanceof Promise)
    throw new ue();
  if (i.issues.length) {
    const c = new (o?.Err ?? e)(i.issues.map((l) => ee(l, a, Q())));
    throw yn(c, o?.callee), c;
  }
  return i.value;
}, pt = (e) => async (t, n, r, o) => {
  const a = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let i = t._zod.run({ value: n, issues: [] }, a);
  if (i instanceof Promise && (i = await i), i.issues.length) {
    const c = new (o?.Err ?? e)(i.issues.map((l) => ee(l, a, Q())));
    throw yn(c, o?.callee), c;
  }
  return i.value;
}, Oe = (e) => (t, n, r) => {
  const o = r ? { ...r, async: !1 } : { async: !1 }, a = t._zod.run({ value: n, issues: [] }, o);
  if (a instanceof Promise)
    throw new ue();
  return a.issues.length ? {
    success: !1,
    error: new (e ?? vn)(a.issues.map((i) => ee(i, o, Q())))
  } : { success: !0, data: a.value };
}, eo = /* @__PURE__ */ Oe(In), Ne = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { async: !0 }) : { async: !0 };
  let a = t._zod.run({ value: n, issues: [] }, o);
  return a instanceof Promise && (a = await a), a.issues.length ? {
    success: !1,
    error: new e(a.issues.map((i) => ee(i, o, Q())))
  } : { success: !0, data: a.value };
}, to = /* @__PURE__ */ Ne(In), no = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return lt(e)(t, n, o);
}, ro = (e) => (t, n, r) => lt(e)(t, n, r), oo = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return pt(e)(t, n, o);
}, io = (e) => async (t, n, r) => pt(e)(t, n, r), ao = (e) => (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return Oe(e)(t, n, o);
}, so = (e) => (t, n, r) => Oe(e)(t, n, r), co = (e) => async (t, n, r) => {
  const o = r ? Object.assign(r, { direction: "backward" }) : { direction: "backward" };
  return Ne(e)(t, n, o);
}, lo = (e) => async (t, n, r) => Ne(e)(t, n, r), po = /^[cC][^\s-]{8,}$/, uo = /^[0-9a-z]+$/, mo = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, fo = /^[0-9a-vA-V]{20}$/, ho = /^[A-Za-z0-9]{27}$/, go = /^[a-zA-Z0-9_-]{21}$/, yo = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, bo = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, wt = (e) => e ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, _o = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, vo = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Io() {
  return new RegExp(vo, "u");
}
const wo = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, ko = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, To = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, So = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Ao = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, wn = /^[A-Za-z0-9_-]*$/, Po = /^\+[1-9]\d{6,14}$/, kn = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", xo = /* @__PURE__ */ new RegExp(`^${kn}$`);
function Tn(e) {
  const t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function Eo(e) {
  return new RegExp(`^${Tn(e)}$`);
}
function jo(e) {
  const t = Tn({ precision: e.precision }), n = ["Z"];
  e.local && n.push(""), e.offset && n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const r = `${t}(?:${n.join("|")})`;
  return new RegExp(`^${kn}T(?:${r})$`);
}
const zo = (e) => {
  const t = e ? `[\\s\\S]{${e?.minimum ?? 0},${e?.maximum ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${t}$`);
}, Do = /^-?\d+$/, Sn = /^-?\d+(?:\.\d+)?$/, Oo = /^(?:true|false)$/i, No = /^null$/i, Co = /^[^A-Z]*$/, Ro = /^[^a-z]*$/, F = /* @__PURE__ */ u("$ZodCheck", (e, t) => {
  var n;
  e._zod ?? (e._zod = {}), e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), An = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, Pn = /* @__PURE__ */ u("$ZodCheckLessThan", (e, t) => {
  F.init(e, t);
  const n = An[typeof t.value];
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
}), xn = /* @__PURE__ */ u("$ZodCheckGreaterThan", (e, t) => {
  F.init(e, t);
  const n = An[typeof t.value];
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
}), $o = /* @__PURE__ */ u("$ZodCheckMultipleOf", (e, t) => {
  F.init(e, t), e._zod.onattach.push((n) => {
    var r;
    (r = n._zod.bag).multipleOf ?? (r.multipleOf = t.value);
  }), e._zod.check = (n) => {
    if (typeof n.value != typeof t.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof n.value == "bigint" ? n.value % t.value === BigInt(0) : Mr(n.value, t.value) === 0) || n.issues.push({
      origin: typeof n.value,
      code: "not_multiple_of",
      divisor: t.value,
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Lo = /* @__PURE__ */ u("$ZodCheckNumberFormat", (e, t) => {
  F.init(e, t), t.format = t.format || "float64";
  const n = t.format?.includes("int"), r = n ? "int" : "number", [o, a] = Fr[t.format];
  e._zod.onattach.push((i) => {
    const c = i._zod.bag;
    c.format = t.format, c.minimum = o, c.maximum = a, n && (c.pattern = Do);
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
}), Mo = /* @__PURE__ */ u("$ZodCheckMaxLength", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !at(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    t.maximum < o && (r._zod.bag.maximum = t.maximum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length <= t.maximum)
      return;
    const i = ct(o);
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
}), Zo = /* @__PURE__ */ u("$ZodCheckMinLength", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !at(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    t.minimum > o && (r._zod.bag.minimum = t.minimum);
  }), e._zod.check = (r) => {
    const o = r.value;
    if (o.length >= t.minimum)
      return;
    const i = ct(o);
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
}), Uo = /* @__PURE__ */ u("$ZodCheckLengthEquals", (e, t) => {
  var n;
  F.init(e, t), (n = e._zod.def).when ?? (n.when = (r) => {
    const o = r.value;
    return !at(o) && o.length !== void 0;
  }), e._zod.onattach.push((r) => {
    const o = r._zod.bag;
    o.minimum = t.length, o.maximum = t.length, o.length = t.length;
  }), e._zod.check = (r) => {
    const o = r.value, a = o.length;
    if (a === t.length)
      return;
    const i = ct(o), c = a > t.length;
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
}), Bo = /* @__PURE__ */ u("$ZodCheckRegex", (e, t) => {
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
}), qo = /* @__PURE__ */ u("$ZodCheckLowerCase", (e, t) => {
  t.pattern ?? (t.pattern = Co), Ce.init(e, t);
}), Fo = /* @__PURE__ */ u("$ZodCheckUpperCase", (e, t) => {
  t.pattern ?? (t.pattern = Ro), Ce.init(e, t);
}), Go = /* @__PURE__ */ u("$ZodCheckIncludes", (e, t) => {
  F.init(e, t);
  const n = he(t.includes), r = new RegExp(typeof t.position == "number" ? `^.{${t.position}}${n}` : n);
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
}), Vo = /* @__PURE__ */ u("$ZodCheckStartsWith", (e, t) => {
  F.init(e, t);
  const n = new RegExp(`^${he(t.prefix)}.*`);
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
}), Ko = /* @__PURE__ */ u("$ZodCheckEndsWith", (e, t) => {
  F.init(e, t);
  const n = new RegExp(`.*${he(t.suffix)}$`);
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
}), Jo = /* @__PURE__ */ u("$ZodCheckOverwrite", (e, t) => {
  F.init(e, t), e._zod.check = (n) => {
    n.value = t.tx(n.value);
  };
});
class Wo {
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
const Ho = {
  major: 4,
  minor: 3,
  patch: 6
}, P = /* @__PURE__ */ u("$ZodType", (e, t) => {
  var n;
  e ?? (e = {}), e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = Ho;
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
      let p = ce(i), d;
      for (const y of c) {
        if (y._zod.def.when) {
          if (!y._zod.def.when(i))
            continue;
        } else if (p)
          continue;
        const v = i.issues.length, w = y._zod.check(i);
        if (w instanceof Promise && l?.async === !1)
          throw new ue();
        if (d || w instanceof Promise)
          d = (d ?? Promise.resolve()).then(async () => {
            await w, i.issues.length !== v && (p || (p = ce(i, v)));
          });
        else {
          if (i.issues.length === v)
            continue;
          p || (p = ce(i, v));
        }
      }
      return d ? d.then(() => i) : i;
    }, a = (i, c, l) => {
      if (ce(i))
        return i.aborted = !0, i;
      const p = o(c, r, l);
      if (p instanceof Promise) {
        if (l.async === !1)
          throw new ue();
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
          throw new ue();
        return l.then((p) => o(p, r, c));
      }
      return o(l, r, c);
    };
  }
  S(e, "~standard", () => ({
    validate: (o) => {
      try {
        const a = eo(e, o);
        return a.success ? { value: a.data } : { issues: a.error?.issues };
      } catch {
        return to(e, o).then((i) => i.success ? { value: i.data } : { issues: i.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), ut = /* @__PURE__ */ u("$ZodString", (e, t) => {
  P.init(e, t), e._zod.pattern = [...e?._zod.bag?.patterns ?? []].pop() ?? zo(e._zod.bag), e._zod.parse = (n, r) => {
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
  Ce.init(e, t), ut.init(e, t);
}), Xo = /* @__PURE__ */ u("$ZodGUID", (e, t) => {
  t.pattern ?? (t.pattern = bo), E.init(e, t);
}), Yo = /* @__PURE__ */ u("$ZodUUID", (e, t) => {
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
    t.pattern ?? (t.pattern = wt(r));
  } else
    t.pattern ?? (t.pattern = wt());
  E.init(e, t);
}), Qo = /* @__PURE__ */ u("$ZodEmail", (e, t) => {
  t.pattern ?? (t.pattern = _o), E.init(e, t);
}), ei = /* @__PURE__ */ u("$ZodURL", (e, t) => {
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
}), ti = /* @__PURE__ */ u("$ZodEmoji", (e, t) => {
  t.pattern ?? (t.pattern = Io()), E.init(e, t);
}), ni = /* @__PURE__ */ u("$ZodNanoID", (e, t) => {
  t.pattern ?? (t.pattern = go), E.init(e, t);
}), ri = /* @__PURE__ */ u("$ZodCUID", (e, t) => {
  t.pattern ?? (t.pattern = po), E.init(e, t);
}), oi = /* @__PURE__ */ u("$ZodCUID2", (e, t) => {
  t.pattern ?? (t.pattern = uo), E.init(e, t);
}), ii = /* @__PURE__ */ u("$ZodULID", (e, t) => {
  t.pattern ?? (t.pattern = mo), E.init(e, t);
}), ai = /* @__PURE__ */ u("$ZodXID", (e, t) => {
  t.pattern ?? (t.pattern = fo), E.init(e, t);
}), si = /* @__PURE__ */ u("$ZodKSUID", (e, t) => {
  t.pattern ?? (t.pattern = ho), E.init(e, t);
}), ci = /* @__PURE__ */ u("$ZodISODateTime", (e, t) => {
  t.pattern ?? (t.pattern = jo(t)), E.init(e, t);
}), li = /* @__PURE__ */ u("$ZodISODate", (e, t) => {
  t.pattern ?? (t.pattern = xo), E.init(e, t);
}), pi = /* @__PURE__ */ u("$ZodISOTime", (e, t) => {
  t.pattern ?? (t.pattern = Eo(t)), E.init(e, t);
}), ui = /* @__PURE__ */ u("$ZodISODuration", (e, t) => {
  t.pattern ?? (t.pattern = yo), E.init(e, t);
}), di = /* @__PURE__ */ u("$ZodIPv4", (e, t) => {
  t.pattern ?? (t.pattern = wo), E.init(e, t), e._zod.bag.format = "ipv4";
}), mi = /* @__PURE__ */ u("$ZodIPv6", (e, t) => {
  t.pattern ?? (t.pattern = ko), E.init(e, t), e._zod.bag.format = "ipv6", e._zod.check = (n) => {
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
}), fi = /* @__PURE__ */ u("$ZodCIDRv4", (e, t) => {
  t.pattern ?? (t.pattern = To), E.init(e, t);
}), hi = /* @__PURE__ */ u("$ZodCIDRv6", (e, t) => {
  t.pattern ?? (t.pattern = So), E.init(e, t), e._zod.check = (n) => {
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
function En(e) {
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
const gi = /* @__PURE__ */ u("$ZodBase64", (e, t) => {
  t.pattern ?? (t.pattern = Ao), E.init(e, t), e._zod.bag.contentEncoding = "base64", e._zod.check = (n) => {
    En(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
});
function yi(e) {
  if (!wn.test(e))
    return !1;
  const t = e.replace(/[-_]/g, (r) => r === "-" ? "+" : "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return En(n);
}
const bi = /* @__PURE__ */ u("$ZodBase64URL", (e, t) => {
  t.pattern ?? (t.pattern = wn), E.init(e, t), e._zod.bag.contentEncoding = "base64url", e._zod.check = (n) => {
    yi(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), _i = /* @__PURE__ */ u("$ZodE164", (e, t) => {
  t.pattern ?? (t.pattern = Po), E.init(e, t);
});
function vi(e, t = null) {
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
const Ii = /* @__PURE__ */ u("$ZodJWT", (e, t) => {
  E.init(e, t), e._zod.check = (n) => {
    vi(n.value, t.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), jn = /* @__PURE__ */ u("$ZodNumber", (e, t) => {
  P.init(e, t), e._zod.pattern = e._zod.bag.pattern ?? Sn, e._zod.parse = (n, r) => {
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
}), wi = /* @__PURE__ */ u("$ZodNumberFormat", (e, t) => {
  Lo.init(e, t), jn.init(e, t);
}), ki = /* @__PURE__ */ u("$ZodBoolean", (e, t) => {
  P.init(e, t), e._zod.pattern = Oo, e._zod.parse = (n, r) => {
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
}), Ti = /* @__PURE__ */ u("$ZodNull", (e, t) => {
  P.init(e, t), e._zod.pattern = No, e._zod.values = /* @__PURE__ */ new Set([null]), e._zod.parse = (n, r) => {
    const o = n.value;
    return o === null || n.issues.push({
      expected: "null",
      code: "invalid_type",
      input: o,
      inst: e
    }), n;
  };
}), Si = /* @__PURE__ */ u("$ZodUnknown", (e, t) => {
  P.init(e, t), e._zod.parse = (n) => n;
}), Ai = /* @__PURE__ */ u("$ZodNever", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: e
  }), n);
});
function kt(e, t, n) {
  e.issues.length && t.issues.push(...le(n, e.issues)), t.value[n] = e.value;
}
const Pi = /* @__PURE__ */ u("$ZodArray", (e, t) => {
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
      l instanceof Promise ? a.push(l.then((p) => kt(p, n, i))) : kt(l, n, i);
    }
    return a.length ? Promise.all(a).then(() => n) : n;
  };
});
function Te(e, t, n, r, o) {
  if (e.issues.length) {
    if (o && !(n in r))
      return;
    t.issues.push(...le(n, e.issues));
  }
  e.value === void 0 ? n in r && (t.value[n] = void 0) : t.value[n] = e.value;
}
function zn(e) {
  const t = Object.keys(e.shape);
  for (const r of t)
    if (!e.shape?.[r]?._zod?.traits?.has("$ZodType"))
      throw new Error(`Invalid element at key "${r}": expected a Zod schema`);
  const n = qr(e.shape);
  return {
    ...e,
    keys: t,
    keySet: new Set(t),
    numKeys: t.length,
    optionalKeys: new Set(n)
  };
}
function Dn(e, t, n, r, o, a) {
  const i = [], c = o.keySet, l = o.catchall._zod, p = l.def.type, d = l.optout === "optional";
  for (const y in t) {
    if (c.has(y))
      continue;
    if (p === "never") {
      i.push(y);
      continue;
    }
    const v = l.run({ value: t[y], issues: [] }, r);
    v instanceof Promise ? e.push(v.then((w) => Te(w, n, y, t, d))) : Te(v, n, y, t, d);
  }
  return i.length && n.issues.push({
    code: "unrecognized_keys",
    keys: i,
    input: t,
    inst: a
  }), e.length ? Promise.all(e).then(() => n) : n;
}
const xi = /* @__PURE__ */ u("$ZodObject", (e, t) => {
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
  const r = it(() => zn(t));
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
      const w = y[v], M = w._zod.optout === "optional", C = w._zod.run({ value: p[v], issues: [] }, l);
      C instanceof Promise ? d.push(C.then(($) => Te($, c, v, p, M))) : Te(C, c, v, p, M);
    }
    return a ? Dn(d, p, c, l, r.value, e) : d.length ? Promise.all(d).then(() => c) : c;
  };
}), Ei = /* @__PURE__ */ u("$ZodObjectJIT", (e, t) => {
  xi.init(e, t);
  const n = e._zod.parse, r = it(() => zn(t)), o = (v) => {
    const w = new Wo(["shape", "payload", "ctx"]), M = r.value, C = (X) => {
      const q = It(X);
      return `shape[${q}]._zod.run({ value: input[${q}], issues: [] }, ctx)`;
    };
    w.write("const input = payload.value;");
    const $ = /* @__PURE__ */ Object.create(null);
    let ye = 0;
    for (const X of M.keys)
      $[X] = `key_${ye++}`;
    w.write("const newResult = {};");
    for (const X of M.keys) {
      const q = $[X], W = It(X), lr = v[X]?._zod?.optout === "optional";
      w.write(`const ${q} = ${C(X)};`), lr ? w.write(`
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

      `) : w.write(`
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
    w.write("payload.value = newResult;"), w.write("return payload;");
    const cr = w.compile();
    return (X, q) => cr(v, X, q);
  };
  let a;
  const i = ke, c = !qe.jitless, p = c && Ur.value, d = t.catchall;
  let y;
  e._zod.parse = (v, w) => {
    y ?? (y = r.value);
    const M = v.value;
    return i(M) ? c && p && w?.async === !1 && w.jitless !== !0 ? (a || (a = o(t.shape)), v = a(v, w), d ? Dn([], M, v, w, y, e) : v) : n(v, w) : (v.issues.push({
      expected: "object",
      code: "invalid_type",
      input: M,
      inst: e
    }), v);
  };
});
function Tt(e, t, n, r) {
  for (const a of e)
    if (a.issues.length === 0)
      return t.value = a.value, t;
  const o = e.filter((a) => !ce(a));
  return o.length === 1 ? (t.value = o[0].value, o[0]) : (t.issues.push({
    code: "invalid_union",
    input: t.value,
    inst: n,
    errors: e.map((a) => a.issues.map((i) => ee(i, r, Q())))
  }), t);
}
const ji = /* @__PURE__ */ u("$ZodUnion", (e, t) => {
  P.init(e, t), S(e._zod, "optin", () => t.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0), S(e._zod, "optout", () => t.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0), S(e._zod, "values", () => {
    if (t.options.every((o) => o._zod.values))
      return new Set(t.options.flatMap((o) => Array.from(o._zod.values)));
  }), S(e._zod, "pattern", () => {
    if (t.options.every((o) => o._zod.pattern)) {
      const o = t.options.map((a) => a._zod.pattern);
      return new RegExp(`^(${o.map((a) => st(a.source)).join("|")})$`);
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
    return i ? Promise.all(c).then((l) => Tt(l, o, e, a)) : Tt(c, o, e, a);
  };
}), zi = /* @__PURE__ */ u("$ZodIntersection", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value, a = t.left._zod.run({ value: o, issues: [] }, r), i = t.right._zod.run({ value: o, issues: [] }, r);
    return a instanceof Promise || i instanceof Promise ? Promise.all([a, i]).then(([l, p]) => St(n, l, p)) : St(n, a, i);
  };
});
function Ge(e, t) {
  if (e === t)
    return { valid: !0, data: e };
  if (e instanceof Date && t instanceof Date && +e == +t)
    return { valid: !0, data: e };
  if (fe(e) && fe(t)) {
    const n = Object.keys(t), r = Object.keys(e).filter((a) => n.indexOf(a) !== -1), o = { ...e, ...t };
    for (const a of r) {
      const i = Ge(e[a], t[a]);
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
      const o = e[r], a = t[r], i = Ge(o, a);
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
function St(e, t, n) {
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
  if (a.length && o && e.issues.push({ ...o, keys: a }), ce(e))
    return e;
  const i = Ge(t.value, n.value);
  if (!i.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(i.mergeErrorPath)}`);
  return e.value = i.data, e;
}
const Di = /* @__PURE__ */ u("$ZodRecord", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
    const o = n.value;
    if (!fe(o))
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
            y.issues.length && n.issues.push(...le(p, y.issues)), n.value[p] = y.value;
          })) : (d.issues.length && n.issues.push(...le(p, d.issues)), n.value[p] = d.value);
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
        if (typeof c == "string" && Sn.test(c) && l.issues.length) {
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
          y.issues.length && n.issues.push(...le(c, y.issues)), n.value[l.value] = y.value;
        })) : (d.issues.length && n.issues.push(...le(c, d.issues)), n.value[l.value] = d.value);
      }
    }
    return a.length ? Promise.all(a).then(() => n) : n;
  };
}), Oi = /* @__PURE__ */ u("$ZodEnum", (e, t) => {
  P.init(e, t);
  const n = gn(t.entries), r = new Set(n);
  e._zod.values = r, e._zod.pattern = new RegExp(`^(${n.filter((o) => Br.has(typeof o)).map((o) => typeof o == "string" ? he(o) : o.toString()).join("|")})$`), e._zod.parse = (o, a) => {
    const i = o.value;
    return r.has(i) || o.issues.push({
      code: "invalid_value",
      values: n,
      input: i,
      inst: e
    }), o;
  };
}), Ni = /* @__PURE__ */ u("$ZodLiteral", (e, t) => {
  if (P.init(e, t), t.values.length === 0)
    throw new Error("Cannot create literal schema with no valid values");
  const n = new Set(t.values);
  e._zod.values = n, e._zod.pattern = new RegExp(`^(${t.values.map((r) => typeof r == "string" ? he(r) : r ? he(r.toString()) : String(r)).join("|")})$`), e._zod.parse = (r, o) => {
    const a = r.value;
    return n.has(a) || r.issues.push({
      code: "invalid_value",
      values: t.values,
      input: a,
      inst: e
    }), r;
  };
}), Ci = /* @__PURE__ */ u("$ZodTransform", (e, t) => {
  P.init(e, t), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new hn(e.constructor.name);
    const o = t.transform(n.value, n);
    if (r.async)
      return (o instanceof Promise ? o : Promise.resolve(o)).then((i) => (n.value = i, n));
    if (o instanceof Promise)
      throw new ue();
    return n.value = o, n;
  };
});
function At(e, t) {
  return e.issues.length && t === void 0 ? { issues: [], value: void 0 } : e;
}
const On = /* @__PURE__ */ u("$ZodOptional", (e, t) => {
  P.init(e, t), e._zod.optin = "optional", e._zod.optout = "optional", S(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, void 0]) : void 0), S(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${st(n.source)})?$`) : void 0;
  }), e._zod.parse = (n, r) => {
    if (t.innerType._zod.optin === "optional") {
      const o = t.innerType._zod.run(n, r);
      return o instanceof Promise ? o.then((a) => At(a, n.value)) : At(o, n.value);
    }
    return n.value === void 0 ? n : t.innerType._zod.run(n, r);
  };
}), Ri = /* @__PURE__ */ u("$ZodExactOptional", (e, t) => {
  On.init(e, t), S(e._zod, "values", () => t.innerType._zod.values), S(e._zod, "pattern", () => t.innerType._zod.pattern), e._zod.parse = (n, r) => t.innerType._zod.run(n, r);
}), $i = /* @__PURE__ */ u("$ZodNullable", (e, t) => {
  P.init(e, t), S(e._zod, "optin", () => t.innerType._zod.optin), S(e._zod, "optout", () => t.innerType._zod.optout), S(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${st(n.source)}|null)$`) : void 0;
  }), S(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, null]) : void 0), e._zod.parse = (n, r) => n.value === null ? n : t.innerType._zod.run(n, r);
}), Li = /* @__PURE__ */ u("$ZodDefault", (e, t) => {
  P.init(e, t), e._zod.optin = "optional", S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    if (n.value === void 0)
      return n.value = t.defaultValue, n;
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => Pt(a, t)) : Pt(o, t);
  };
});
function Pt(e, t) {
  return e.value === void 0 && (e.value = t.defaultValue), e;
}
const Mi = /* @__PURE__ */ u("$ZodPrefault", (e, t) => {
  P.init(e, t), e._zod.optin = "optional", S(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, r) => (r.direction === "backward" || n.value === void 0 && (n.value = t.defaultValue), t.innerType._zod.run(n, r));
}), Zi = /* @__PURE__ */ u("$ZodNonOptional", (e, t) => {
  P.init(e, t), S(e._zod, "values", () => {
    const n = t.innerType._zod.values;
    return n ? new Set([...n].filter((r) => r !== void 0)) : void 0;
  }), e._zod.parse = (n, r) => {
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => xt(a, e)) : xt(o, e);
  };
});
function xt(e, t) {
  return !e.issues.length && e.value === void 0 && e.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e.value,
    inst: t
  }), e;
}
const Ui = /* @__PURE__ */ u("$ZodCatch", (e, t) => {
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
}), Bi = /* @__PURE__ */ u("$ZodPipe", (e, t) => {
  P.init(e, t), S(e._zod, "values", () => t.in._zod.values), S(e._zod, "optin", () => t.in._zod.optin), S(e._zod, "optout", () => t.out._zod.optout), S(e._zod, "propValues", () => t.in._zod.propValues), e._zod.parse = (n, r) => {
    if (r.direction === "backward") {
      const a = t.out._zod.run(n, r);
      return a instanceof Promise ? a.then((i) => Ie(i, t.in, r)) : Ie(a, t.in, r);
    }
    const o = t.in._zod.run(n, r);
    return o instanceof Promise ? o.then((a) => Ie(a, t.out, r)) : Ie(o, t.out, r);
  };
});
function Ie(e, t, n) {
  return e.issues.length ? (e.aborted = !0, e) : t._zod.run({ value: e.value, issues: e.issues }, n);
}
const qi = /* @__PURE__ */ u("$ZodReadonly", (e, t) => {
  P.init(e, t), S(e._zod, "propValues", () => t.innerType._zod.propValues), S(e._zod, "values", () => t.innerType._zod.values), S(e._zod, "optin", () => t.innerType?._zod?.optin), S(e._zod, "optout", () => t.innerType?._zod?.optout), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const o = t.innerType._zod.run(n, r);
    return o instanceof Promise ? o.then(Et) : Et(o);
  };
});
function Et(e) {
  return e.value = Object.freeze(e.value), e;
}
const Fi = /* @__PURE__ */ u("$ZodLazy", (e, t) => {
  P.init(e, t), S(e._zod, "innerType", () => t.getter()), S(e._zod, "pattern", () => e._zod.innerType?._zod?.pattern), S(e._zod, "propValues", () => e._zod.innerType?._zod?.propValues), S(e._zod, "optin", () => e._zod.innerType?._zod?.optin ?? void 0), S(e._zod, "optout", () => e._zod.innerType?._zod?.optout ?? void 0), e._zod.parse = (n, r) => e._zod.innerType._zod.run(n, r);
}), Gi = /* @__PURE__ */ u("$ZodCustom", (e, t) => {
  F.init(e, t), P.init(e, t), e._zod.parse = (n, r) => n, e._zod.check = (n) => {
    const r = n.value, o = t.fn(r);
    if (o instanceof Promise)
      return o.then((a) => jt(a, n, r, e));
    jt(o, n, r, e);
  };
});
function jt(e, t, n, r) {
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
    r._zod.def.params && (o.params = r._zod.def.params), t.issues.push(_e(o));
  }
}
var zt;
class Vi {
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
function Ki() {
  return new Vi();
}
(zt = globalThis).__zod_globalRegistry ?? (zt.__zod_globalRegistry = Ki());
const be = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function Ji(e, t) {
  return new e({
    type: "string",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Wi(e, t) {
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
function Hi(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Xi(e, t) {
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
function Yi(e, t) {
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
function Qi(e, t) {
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
function ea(e, t) {
  return new e({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ta(e, t) {
  return new e({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function na(e, t) {
  return new e({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ra(e, t) {
  return new e({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function oa(e, t) {
  return new e({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ia(e, t) {
  return new e({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function aa(e, t) {
  return new e({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function sa(e, t) {
  return new e({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ca(e, t) {
  return new e({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function la(e, t) {
  return new e({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function pa(e, t) {
  return new e({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ua(e, t) {
  return new e({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function da(e, t) {
  return new e({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ma(e, t) {
  return new e({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function fa(e, t) {
  return new e({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ha(e, t) {
  return new e({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ga(e, t) {
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
function ya(e, t) {
  return new e({
    type: "string",
    format: "date",
    check: "string_format",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ba(e, t) {
  return new e({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function _a(e, t) {
  return new e({
    type: "string",
    format: "duration",
    check: "string_format",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function va(e, t) {
  return new e({
    type: "number",
    checks: [],
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ia(e, t) {
  return new e({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function wa(e, t) {
  return new e({
    type: "boolean",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ka(e, t) {
  return new e({
    type: "null",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ta(e) {
  return new e({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function Sa(e, t) {
  return new e({
    type: "never",
    ..._(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ot(e, t) {
  return new Pn({
    check: "less_than",
    ..._(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function $e(e, t) {
  return new Pn({
    check: "less_than",
    ..._(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Nt(e, t) {
  return new xn({
    check: "greater_than",
    ..._(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function Le(e, t) {
  return new xn({
    check: "greater_than",
    ..._(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Ct(e, t) {
  return new $o({
    check: "multiple_of",
    ..._(t),
    value: e
  });
}
// @__NO_SIDE_EFFECTS__
function Nn(e, t) {
  return new Mo({
    check: "max_length",
    ..._(t),
    maximum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Se(e, t) {
  return new Zo({
    check: "min_length",
    ..._(t),
    minimum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Cn(e, t) {
  return new Uo({
    check: "length_equals",
    ..._(t),
    length: e
  });
}
// @__NO_SIDE_EFFECTS__
function Aa(e, t) {
  return new Bo({
    check: "string_format",
    format: "regex",
    ..._(t),
    pattern: e
  });
}
// @__NO_SIDE_EFFECTS__
function Pa(e) {
  return new qo({
    check: "string_format",
    format: "lowercase",
    ..._(e)
  });
}
// @__NO_SIDE_EFFECTS__
function xa(e) {
  return new Fo({
    check: "string_format",
    format: "uppercase",
    ..._(e)
  });
}
// @__NO_SIDE_EFFECTS__
function Ea(e, t) {
  return new Go({
    check: "string_format",
    format: "includes",
    ..._(t),
    includes: e
  });
}
// @__NO_SIDE_EFFECTS__
function ja(e, t) {
  return new Vo({
    check: "string_format",
    format: "starts_with",
    ..._(t),
    prefix: e
  });
}
// @__NO_SIDE_EFFECTS__
function za(e, t) {
  return new Ko({
    check: "string_format",
    format: "ends_with",
    ..._(t),
    suffix: e
  });
}
// @__NO_SIDE_EFFECTS__
function ge(e) {
  return new Jo({
    check: "overwrite",
    tx: e
  });
}
// @__NO_SIDE_EFFECTS__
function Da(e) {
  return /* @__PURE__ */ ge((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function Oa() {
  return /* @__PURE__ */ ge((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function Na() {
  return /* @__PURE__ */ ge((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Ca() {
  return /* @__PURE__ */ ge((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function Ra() {
  return /* @__PURE__ */ ge((e) => Zr(e));
}
// @__NO_SIDE_EFFECTS__
function $a(e, t, n) {
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
function La(e, t, n) {
  return new e({
    type: "custom",
    check: "custom",
    fn: t,
    ..._(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Ma(e) {
  const t = /* @__PURE__ */ Za((n) => (n.addIssue = (r) => {
    if (typeof r == "string")
      n.issues.push(_e(r, n.value, t._zod.def));
    else {
      const o = r;
      o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), o.input ?? (o.input = n.value), o.inst ?? (o.inst = t), o.continue ?? (o.continue = !t._zod.def.abort), n.issues.push(_e(o));
    }
  }, e(n.value, n)));
  return t;
}
// @__NO_SIDE_EFFECTS__
function Za(e, t) {
  const n = new F({
    check: "custom",
    ..._(t)
  });
  return n._zod.check = e, n;
}
function Rn(e) {
  let t = e?.target ?? "draft-2020-12";
  return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
    processors: e.processors ?? {},
    metadataRegistry: e?.metadata ?? be,
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
      const v = i.schema, w = t.processors[o.type];
      if (!w)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${o.type}`);
      w(e, t, v, d);
    }
    const y = e._zod.parent;
    y && (i.ref || (i.ref = y), O(y, t, d), t.seen.get(y).isParent = !0);
  }
  const l = t.metadataRegistry.get(e);
  return l && Object.assign(i.schema, l), t.io === "input" && U(e) && (delete i.schema.examples, delete i.schema.default), t.io === "input" && i.schema._prefault && ((r = i.schema).default ?? (r.default = i.schema._prefault)), delete i.schema._prefault, t.seen.get(e).schema;
}
function $n(e, t) {
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
      const w = i[1].defId ?? i[1].schema.id ?? `schema${e.counter++}`;
      return i[1].defId = w, { defId: w, ref: `${v("__shared")}#/${c}/${w}` };
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
function Ln(e, t) {
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
      const v = e.seen.get(d), w = v.schema;
      if (w.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (l.allOf = l.allOf ?? [], l.allOf.push(w)) : Object.assign(l, w), Object.assign(l, p), i._zod.parent === d)
        for (const C in l)
          C === "$ref" || C === "allOf" || C in p || delete l[C];
      if (w.$ref && v.def)
        for (const C in l)
          C === "$ref" || C === "allOf" || C in v.def && JSON.stringify(l[C]) === JSON.stringify(v.def[C]) && delete l[C];
    }
    const y = i._zod.parent;
    if (y && y !== d) {
      r(y);
      const v = e.seen.get(y);
      if (v?.schema.$ref && (l.$ref = v.schema.$ref, v.def))
        for (const w in l)
          w === "$ref" || w === "allOf" || w in v.def && JSON.stringify(l[w]) === JSON.stringify(v.def[w]) && delete l[w];
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
          input: Ae(t, "input", e.processors),
          output: Ae(t, "output", e.processors)
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
const Ua = (e, t = {}) => (n) => {
  const r = Rn({ ...n, processors: t });
  return O(e, r), $n(r, e), Ln(r, e);
}, Ae = (e, t, n = {}) => (r) => {
  const { libraryOptions: o, target: a } = r ?? {}, i = Rn({ ...o ?? {}, target: a, io: t, processors: n });
  return O(e, i), $n(i, e), Ln(i, e);
}, Ba = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, qa = (e, t, n, r) => {
  const o = n;
  o.type = "string";
  const { minimum: a, maximum: i, format: c, patterns: l, contentEncoding: p } = e._zod.bag;
  if (typeof a == "number" && (o.minLength = a), typeof i == "number" && (o.maxLength = i), c && (o.format = Ba[c] ?? c, o.format === "" && delete o.format, c === "time" && delete o.format), p && (o.contentEncoding = p), l && l.size > 0) {
    const d = [...l];
    d.length === 1 ? o.pattern = d[0].source : d.length > 1 && (o.allOf = [
      ...d.map((y) => ({
        ...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: y.source
      }))
    ]);
  }
}, Fa = (e, t, n, r) => {
  const o = n, { minimum: a, maximum: i, format: c, multipleOf: l, exclusiveMaximum: p, exclusiveMinimum: d } = e._zod.bag;
  typeof c == "string" && c.includes("int") ? o.type = "integer" : o.type = "number", typeof d == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.minimum = d, o.exclusiveMinimum = !0) : o.exclusiveMinimum = d), typeof a == "number" && (o.minimum = a, typeof d == "number" && t.target !== "draft-04" && (d >= a ? delete o.minimum : delete o.exclusiveMinimum)), typeof p == "number" && (t.target === "draft-04" || t.target === "openapi-3.0" ? (o.maximum = p, o.exclusiveMaximum = !0) : o.exclusiveMaximum = p), typeof i == "number" && (o.maximum = i, typeof p == "number" && t.target !== "draft-04" && (p <= i ? delete o.maximum : delete o.exclusiveMaximum)), typeof l == "number" && (o.multipleOf = l);
}, Ga = (e, t, n, r) => {
  n.type = "boolean";
}, Va = (e, t, n, r) => {
  t.target === "openapi-3.0" ? (n.type = "string", n.nullable = !0, n.enum = [null]) : n.type = "null";
}, Ka = (e, t, n, r) => {
  n.not = {};
}, Ja = (e, t, n, r) => {
}, Wa = (e, t, n, r) => {
  const o = e._zod.def, a = gn(o.entries);
  a.every((i) => typeof i == "number") && (n.type = "number"), a.every((i) => typeof i == "string") && (n.type = "string"), n.enum = a;
}, Ha = (e, t, n, r) => {
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
}, Xa = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, Ya = (e, t, n, r) => {
  if (t.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, Qa = (e, t, n, r) => {
  const o = n, a = e._zod.def, { minimum: i, maximum: c } = e._zod.bag;
  typeof i == "number" && (o.minItems = i), typeof c == "number" && (o.maxItems = c), o.type = "array", o.items = O(a.element, t, { ...r, path: [...r.path, "items"] });
}, es = (e, t, n, r) => {
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
}, ts = (e, t, n, r) => {
  const o = e._zod.def, a = o.inclusive === !1, i = o.options.map((c, l) => O(c, t, {
    ...r,
    path: [...r.path, a ? "oneOf" : "anyOf", l]
  }));
  a ? n.oneOf = i : n.anyOf = i;
}, ns = (e, t, n, r) => {
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
}, rs = (e, t, n, r) => {
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
}, os = (e, t, n, r) => {
  const o = e._zod.def, a = O(o.innerType, t, r), i = t.seen.get(e);
  t.target === "openapi-3.0" ? (i.ref = o.innerType, n.nullable = !0) : n.anyOf = [a, { type: "null" }];
}, is = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
}, as = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, n.default = JSON.parse(JSON.stringify(o.defaultValue));
}, ss = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, t.io === "input" && (n._prefault = JSON.parse(JSON.stringify(o.defaultValue)));
}, cs = (e, t, n, r) => {
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
}, ls = (e, t, n, r) => {
  const o = e._zod.def, a = t.io === "input" ? o.in._zod.def.type === "transform" ? o.out : o.in : o.out;
  O(a, t, r);
  const i = t.seen.get(e);
  i.ref = a;
}, ps = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType, n.readOnly = !0;
}, Mn = (e, t, n, r) => {
  const o = e._zod.def;
  O(o.innerType, t, r);
  const a = t.seen.get(e);
  a.ref = o.innerType;
}, us = (e, t, n, r) => {
  const o = e._zod.innerType;
  O(o, t, r);
  const a = t.seen.get(e);
  a.ref = o;
}, ds = /* @__PURE__ */ u("ZodISODateTime", (e, t) => {
  ci.init(e, t), z.init(e, t);
});
function ms(e) {
  return /* @__PURE__ */ ga(ds, e);
}
const fs = /* @__PURE__ */ u("ZodISODate", (e, t) => {
  li.init(e, t), z.init(e, t);
});
function hs(e) {
  return /* @__PURE__ */ ya(fs, e);
}
const gs = /* @__PURE__ */ u("ZodISOTime", (e, t) => {
  pi.init(e, t), z.init(e, t);
});
function ys(e) {
  return /* @__PURE__ */ ba(gs, e);
}
const bs = /* @__PURE__ */ u("ZodISODuration", (e, t) => {
  ui.init(e, t), z.init(e, t);
});
function _s(e) {
  return /* @__PURE__ */ _a(bs, e);
}
const vs = (e, t) => {
  vn.init(e, t), e.name = "ZodError", Object.defineProperties(e, {
    format: {
      value: (n) => Qr(e, n)
      // enumerable: false,
    },
    flatten: {
      value: (n) => Yr(e, n)
      // enumerable: false,
    },
    addIssue: {
      value: (n) => {
        e.issues.push(n), e.message = JSON.stringify(e.issues, Fe, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (n) => {
        e.issues.push(...n), e.message = JSON.stringify(e.issues, Fe, 2);
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
}, J = u("ZodError", vs, {
  Parent: Error
}), Is = /* @__PURE__ */ lt(J), ws = /* @__PURE__ */ pt(J), ks = /* @__PURE__ */ Oe(J), Ts = /* @__PURE__ */ Ne(J), Ss = /* @__PURE__ */ no(J), As = /* @__PURE__ */ ro(J), Ps = /* @__PURE__ */ oo(J), xs = /* @__PURE__ */ io(J), Es = /* @__PURE__ */ ao(J), js = /* @__PURE__ */ so(J), zs = /* @__PURE__ */ co(J), Ds = /* @__PURE__ */ lo(J), x = /* @__PURE__ */ u("ZodType", (e, t) => (P.init(e, t), Object.assign(e["~standard"], {
  jsonSchema: {
    input: Ae(e, "input"),
    output: Ae(e, "output")
  }
}), e.toJSONSchema = Ua(e, {}), e.def = t, e.type = t.type, Object.defineProperty(e, "_def", { value: t }), e.check = (...n) => e.clone(oe(t, {
  checks: [
    ...t.checks ?? [],
    ...n.map((r) => typeof r == "function" ? { _zod: { check: r, def: { check: "custom" }, onattach: [] } } : r)
  ]
}), {
  parent: !0
}), e.with = e.check, e.clone = (n, r) => ie(e, n, r), e.brand = () => e, e.register = ((n, r) => (n.add(e, r), e)), e.parse = (n, r) => Is(e, n, r, { callee: e.parse }), e.safeParse = (n, r) => ks(e, n, r), e.parseAsync = async (n, r) => ws(e, n, r, { callee: e.parseAsync }), e.safeParseAsync = async (n, r) => Ts(e, n, r), e.spa = e.safeParseAsync, e.encode = (n, r) => Ss(e, n, r), e.decode = (n, r) => As(e, n, r), e.encodeAsync = async (n, r) => Ps(e, n, r), e.decodeAsync = async (n, r) => xs(e, n, r), e.safeEncode = (n, r) => Es(e, n, r), e.safeDecode = (n, r) => js(e, n, r), e.safeEncodeAsync = async (n, r) => zs(e, n, r), e.safeDecodeAsync = async (n, r) => Ds(e, n, r), e.refine = (n, r) => e.check(Pc(n, r)), e.superRefine = (n) => e.check(xc(n)), e.overwrite = (n) => e.check(/* @__PURE__ */ ge(n)), e.optional = () => Lt(e), e.exactOptional = () => mc(e), e.nullable = () => Mt(e), e.nullish = () => Lt(Mt(e)), e.nonoptional = (n) => _c(e, n), e.array = () => L(e), e.or = (n) => dt([e, n]), e.and = (n) => cc(e, n), e.transform = (n) => Ke(e, Bn(n)), e.default = (n) => gc(e, n), e.prefault = (n) => bc(e, n), e.catch = (n) => Ic(e, n), e.pipe = (n) => Ke(e, n), e.readonly = () => Tc(e), e.describe = (n) => {
  const r = e.clone();
  return be.add(r, { description: n }), r;
}, Object.defineProperty(e, "description", {
  get() {
    return be.get(e)?.description;
  },
  configurable: !0
}), e.meta = (...n) => {
  if (n.length === 0)
    return be.get(e);
  const r = e.clone();
  return be.add(r, n[0]), r;
}, e.isOptional = () => e.safeParse(void 0).success, e.isNullable = () => e.safeParse(null).success, e.apply = (n) => n(e), e)), Zn = /* @__PURE__ */ u("_ZodString", (e, t) => {
  ut.init(e, t), x.init(e, t), e._zod.processJSONSchema = (r, o, a) => qa(e, r, o);
  const n = e._zod.bag;
  e.format = n.format ?? null, e.minLength = n.minimum ?? null, e.maxLength = n.maximum ?? null, e.regex = (...r) => e.check(/* @__PURE__ */ Aa(...r)), e.includes = (...r) => e.check(/* @__PURE__ */ Ea(...r)), e.startsWith = (...r) => e.check(/* @__PURE__ */ ja(...r)), e.endsWith = (...r) => e.check(/* @__PURE__ */ za(...r)), e.min = (...r) => e.check(/* @__PURE__ */ Se(...r)), e.max = (...r) => e.check(/* @__PURE__ */ Nn(...r)), e.length = (...r) => e.check(/* @__PURE__ */ Cn(...r)), e.nonempty = (...r) => e.check(/* @__PURE__ */ Se(1, ...r)), e.lowercase = (r) => e.check(/* @__PURE__ */ Pa(r)), e.uppercase = (r) => e.check(/* @__PURE__ */ xa(r)), e.trim = () => e.check(/* @__PURE__ */ Oa()), e.normalize = (...r) => e.check(/* @__PURE__ */ Da(...r)), e.toLowerCase = () => e.check(/* @__PURE__ */ Na()), e.toUpperCase = () => e.check(/* @__PURE__ */ Ca()), e.slugify = () => e.check(/* @__PURE__ */ Ra());
}), Os = /* @__PURE__ */ u("ZodString", (e, t) => {
  ut.init(e, t), Zn.init(e, t), e.email = (n) => e.check(/* @__PURE__ */ Wi(Ns, n)), e.url = (n) => e.check(/* @__PURE__ */ ea(Cs, n)), e.jwt = (n) => e.check(/* @__PURE__ */ ha(Hs, n)), e.emoji = (n) => e.check(/* @__PURE__ */ ta(Rs, n)), e.guid = (n) => e.check(/* @__PURE__ */ Dt(Rt, n)), e.uuid = (n) => e.check(/* @__PURE__ */ Hi(we, n)), e.uuidv4 = (n) => e.check(/* @__PURE__ */ Xi(we, n)), e.uuidv6 = (n) => e.check(/* @__PURE__ */ Yi(we, n)), e.uuidv7 = (n) => e.check(/* @__PURE__ */ Qi(we, n)), e.nanoid = (n) => e.check(/* @__PURE__ */ na($s, n)), e.guid = (n) => e.check(/* @__PURE__ */ Dt(Rt, n)), e.cuid = (n) => e.check(/* @__PURE__ */ ra(Ls, n)), e.cuid2 = (n) => e.check(/* @__PURE__ */ oa(Ms, n)), e.ulid = (n) => e.check(/* @__PURE__ */ ia(Zs, n)), e.base64 = (n) => e.check(/* @__PURE__ */ da(Ks, n)), e.base64url = (n) => e.check(/* @__PURE__ */ ma(Js, n)), e.xid = (n) => e.check(/* @__PURE__ */ aa(Us, n)), e.ksuid = (n) => e.check(/* @__PURE__ */ sa(Bs, n)), e.ipv4 = (n) => e.check(/* @__PURE__ */ ca(qs, n)), e.ipv6 = (n) => e.check(/* @__PURE__ */ la(Fs, n)), e.cidrv4 = (n) => e.check(/* @__PURE__ */ pa(Gs, n)), e.cidrv6 = (n) => e.check(/* @__PURE__ */ ua(Vs, n)), e.e164 = (n) => e.check(/* @__PURE__ */ fa(Ws, n)), e.datetime = (n) => e.check(ms(n)), e.date = (n) => e.check(hs(n)), e.time = (n) => e.check(ys(n)), e.duration = (n) => e.check(_s(n));
});
function m(e) {
  return /* @__PURE__ */ Ji(Os, e);
}
const z = /* @__PURE__ */ u("ZodStringFormat", (e, t) => {
  E.init(e, t), Zn.init(e, t);
}), Ns = /* @__PURE__ */ u("ZodEmail", (e, t) => {
  Qo.init(e, t), z.init(e, t);
}), Rt = /* @__PURE__ */ u("ZodGUID", (e, t) => {
  Xo.init(e, t), z.init(e, t);
}), we = /* @__PURE__ */ u("ZodUUID", (e, t) => {
  Yo.init(e, t), z.init(e, t);
}), Cs = /* @__PURE__ */ u("ZodURL", (e, t) => {
  ei.init(e, t), z.init(e, t);
}), Rs = /* @__PURE__ */ u("ZodEmoji", (e, t) => {
  ti.init(e, t), z.init(e, t);
}), $s = /* @__PURE__ */ u("ZodNanoID", (e, t) => {
  ni.init(e, t), z.init(e, t);
}), Ls = /* @__PURE__ */ u("ZodCUID", (e, t) => {
  ri.init(e, t), z.init(e, t);
}), Ms = /* @__PURE__ */ u("ZodCUID2", (e, t) => {
  oi.init(e, t), z.init(e, t);
}), Zs = /* @__PURE__ */ u("ZodULID", (e, t) => {
  ii.init(e, t), z.init(e, t);
}), Us = /* @__PURE__ */ u("ZodXID", (e, t) => {
  ai.init(e, t), z.init(e, t);
}), Bs = /* @__PURE__ */ u("ZodKSUID", (e, t) => {
  si.init(e, t), z.init(e, t);
}), qs = /* @__PURE__ */ u("ZodIPv4", (e, t) => {
  di.init(e, t), z.init(e, t);
}), Fs = /* @__PURE__ */ u("ZodIPv6", (e, t) => {
  mi.init(e, t), z.init(e, t);
}), Gs = /* @__PURE__ */ u("ZodCIDRv4", (e, t) => {
  fi.init(e, t), z.init(e, t);
}), Vs = /* @__PURE__ */ u("ZodCIDRv6", (e, t) => {
  hi.init(e, t), z.init(e, t);
}), Ks = /* @__PURE__ */ u("ZodBase64", (e, t) => {
  gi.init(e, t), z.init(e, t);
}), Js = /* @__PURE__ */ u("ZodBase64URL", (e, t) => {
  bi.init(e, t), z.init(e, t);
}), Ws = /* @__PURE__ */ u("ZodE164", (e, t) => {
  _i.init(e, t), z.init(e, t);
}), Hs = /* @__PURE__ */ u("ZodJWT", (e, t) => {
  Ii.init(e, t), z.init(e, t);
}), Un = /* @__PURE__ */ u("ZodNumber", (e, t) => {
  jn.init(e, t), x.init(e, t), e._zod.processJSONSchema = (r, o, a) => Fa(e, r, o), e.gt = (r, o) => e.check(/* @__PURE__ */ Nt(r, o)), e.gte = (r, o) => e.check(/* @__PURE__ */ Le(r, o)), e.min = (r, o) => e.check(/* @__PURE__ */ Le(r, o)), e.lt = (r, o) => e.check(/* @__PURE__ */ Ot(r, o)), e.lte = (r, o) => e.check(/* @__PURE__ */ $e(r, o)), e.max = (r, o) => e.check(/* @__PURE__ */ $e(r, o)), e.int = (r) => e.check($t(r)), e.safe = (r) => e.check($t(r)), e.positive = (r) => e.check(/* @__PURE__ */ Nt(0, r)), e.nonnegative = (r) => e.check(/* @__PURE__ */ Le(0, r)), e.negative = (r) => e.check(/* @__PURE__ */ Ot(0, r)), e.nonpositive = (r) => e.check(/* @__PURE__ */ $e(0, r)), e.multipleOf = (r, o) => e.check(/* @__PURE__ */ Ct(r, o)), e.step = (r, o) => e.check(/* @__PURE__ */ Ct(r, o)), e.finite = () => e;
  const n = e._zod.bag;
  e.minValue = Math.max(n.minimum ?? Number.NEGATIVE_INFINITY, n.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null, e.maxValue = Math.min(n.maximum ?? Number.POSITIVE_INFINITY, n.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null, e.isInt = (n.format ?? "").includes("int") || Number.isSafeInteger(n.multipleOf ?? 0.5), e.isFinite = !0, e.format = n.format ?? null;
});
function te(e) {
  return /* @__PURE__ */ va(Un, e);
}
const Xs = /* @__PURE__ */ u("ZodNumberFormat", (e, t) => {
  wi.init(e, t), Un.init(e, t);
});
function $t(e) {
  return /* @__PURE__ */ Ia(Xs, e);
}
const Ys = /* @__PURE__ */ u("ZodBoolean", (e, t) => {
  ki.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ga(e, n, r);
});
function k(e) {
  return /* @__PURE__ */ wa(Ys, e);
}
const Qs = /* @__PURE__ */ u("ZodNull", (e, t) => {
  Ti.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Va(e, n, r);
});
function ec(e) {
  return /* @__PURE__ */ ka(Qs, e);
}
const tc = /* @__PURE__ */ u("ZodUnknown", (e, t) => {
  Si.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ja();
});
function Pe() {
  return /* @__PURE__ */ Ta(tc);
}
const nc = /* @__PURE__ */ u("ZodNever", (e, t) => {
  Ai.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ka(e, n, r);
});
function rc(e) {
  return /* @__PURE__ */ Sa(nc, e);
}
const oc = /* @__PURE__ */ u("ZodArray", (e, t) => {
  Pi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Qa(e, n, r, o), e.element = t.element, e.min = (n, r) => e.check(/* @__PURE__ */ Se(n, r)), e.nonempty = (n) => e.check(/* @__PURE__ */ Se(1, n)), e.max = (n, r) => e.check(/* @__PURE__ */ Nn(n, r)), e.length = (n, r) => e.check(/* @__PURE__ */ Cn(n, r)), e.unwrap = () => e.element;
});
function L(e, t) {
  return /* @__PURE__ */ $a(oc, e, t);
}
const ic = /* @__PURE__ */ u("ZodObject", (e, t) => {
  Ei.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => es(e, n, r, o), S(e, "shape", () => t.shape), e.keyof = () => A(Object.keys(e._zod.def.shape)), e.catchall = (n) => e.clone({ ...e._zod.def, catchall: n }), e.passthrough = () => e.clone({ ...e._zod.def, catchall: Pe() }), e.loose = () => e.clone({ ...e._zod.def, catchall: Pe() }), e.strict = () => e.clone({ ...e._zod.def, catchall: rc() }), e.strip = () => e.clone({ ...e._zod.def, catchall: void 0 }), e.extend = (n) => Kr(e, n), e.safeExtend = (n) => Jr(e, n), e.merge = (n) => Wr(e, n), e.pick = (n) => Gr(e, n), e.omit = (n) => Vr(e, n), e.partial = (...n) => Hr(qn, e, n[0]), e.required = (...n) => Xr(Fn, e, n[0]);
});
function T(e, t) {
  const n = {
    type: "object",
    shape: e ?? {},
    ..._(t)
  };
  return new ic(n);
}
const ac = /* @__PURE__ */ u("ZodUnion", (e, t) => {
  ji.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ts(e, n, r, o), e.options = t.options;
});
function dt(e, t) {
  return new ac({
    type: "union",
    options: e,
    ..._(t)
  });
}
const sc = /* @__PURE__ */ u("ZodIntersection", (e, t) => {
  zi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ns(e, n, r, o);
});
function cc(e, t) {
  return new sc({
    type: "intersection",
    left: e,
    right: t
  });
}
const lc = /* @__PURE__ */ u("ZodRecord", (e, t) => {
  Di.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => rs(e, n, r, o), e.keyType = t.keyType, e.valueType = t.valueType;
});
function ne(e, t, n) {
  return new lc({
    type: "record",
    keyType: e,
    valueType: t,
    ..._(n)
  });
}
const Ve = /* @__PURE__ */ u("ZodEnum", (e, t) => {
  Oi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (r, o, a) => Wa(e, r, o), e.enum = t.entries, e.options = Object.values(t.entries);
  const n = new Set(Object.keys(t.entries));
  e.extract = (r, o) => {
    const a = {};
    for (const i of r)
      if (n.has(i))
        a[i] = t.entries[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new Ve({
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
    return new Ve({
      ...t,
      checks: [],
      ..._(o),
      entries: a
    });
  };
});
function A(e, t) {
  const n = Array.isArray(e) ? Object.fromEntries(e.map((r) => [r, r])) : e;
  return new Ve({
    type: "enum",
    entries: n,
    ..._(t)
  });
}
const pc = /* @__PURE__ */ u("ZodLiteral", (e, t) => {
  Ni.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ha(e, n, r), e.values = new Set(t.values), Object.defineProperty(e, "value", {
    get() {
      if (t.values.length > 1)
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      return t.values[0];
    }
  });
});
function G(e, t) {
  return new pc({
    type: "literal",
    values: Array.isArray(e) ? e : [e],
    ..._(t)
  });
}
const uc = /* @__PURE__ */ u("ZodTransform", (e, t) => {
  Ci.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Ya(e, n), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new hn(e.constructor.name);
    n.addIssue = (a) => {
      if (typeof a == "string")
        n.issues.push(_e(a, n.value, t));
      else {
        const i = a;
        i.fatal && (i.continue = !1), i.code ?? (i.code = "custom"), i.input ?? (i.input = n.value), i.inst ?? (i.inst = e), n.issues.push(_e(i));
      }
    };
    const o = t.transform(n.value, n);
    return o instanceof Promise ? o.then((a) => (n.value = a, n)) : (n.value = o, n);
  };
});
function Bn(e) {
  return new uc({
    type: "transform",
    transform: e
  });
}
const qn = /* @__PURE__ */ u("ZodOptional", (e, t) => {
  On.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Mn(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Lt(e) {
  return new qn({
    type: "optional",
    innerType: e
  });
}
const dc = /* @__PURE__ */ u("ZodExactOptional", (e, t) => {
  Ri.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Mn(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function mc(e) {
  return new dc({
    type: "optional",
    innerType: e
  });
}
const fc = /* @__PURE__ */ u("ZodNullable", (e, t) => {
  $i.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => os(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Mt(e) {
  return new fc({
    type: "nullable",
    innerType: e
  });
}
const hc = /* @__PURE__ */ u("ZodDefault", (e, t) => {
  Li.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => as(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function gc(e, t) {
  return new hc({
    type: "default",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : bn(t);
    }
  });
}
const yc = /* @__PURE__ */ u("ZodPrefault", (e, t) => {
  Mi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ss(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function bc(e, t) {
  return new yc({
    type: "prefault",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : bn(t);
    }
  });
}
const Fn = /* @__PURE__ */ u("ZodNonOptional", (e, t) => {
  Zi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => is(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function _c(e, t) {
  return new Fn({
    type: "nonoptional",
    innerType: e,
    ..._(t)
  });
}
const vc = /* @__PURE__ */ u("ZodCatch", (e, t) => {
  Ui.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => cs(e, n, r, o), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function Ic(e, t) {
  return new vc({
    type: "catch",
    innerType: e,
    catchValue: typeof t == "function" ? t : () => t
  });
}
const wc = /* @__PURE__ */ u("ZodPipe", (e, t) => {
  Bi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ls(e, n, r, o), e.in = t.in, e.out = t.out;
});
function Ke(e, t) {
  return new wc({
    type: "pipe",
    in: e,
    out: t
    // ...util.normalizeParams(params),
  });
}
const kc = /* @__PURE__ */ u("ZodReadonly", (e, t) => {
  qi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => ps(e, n, r, o), e.unwrap = () => e._zod.def.innerType;
});
function Tc(e) {
  return new kc({
    type: "readonly",
    innerType: e
  });
}
const Sc = /* @__PURE__ */ u("ZodLazy", (e, t) => {
  Fi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => us(e, n, r, o), e.unwrap = () => e._zod.def.getter();
});
function Gn(e) {
  return new Sc({
    type: "lazy",
    getter: e
  });
}
const Ac = /* @__PURE__ */ u("ZodCustom", (e, t) => {
  Gi.init(e, t), x.init(e, t), e._zod.processJSONSchema = (n, r, o) => Xa(e, n);
});
function Pc(e, t = {}) {
  return /* @__PURE__ */ La(Ac, e, t);
}
function xc(e) {
  return /* @__PURE__ */ Ma(e);
}
function mt(e, t) {
  return Ke(Bn(e), t);
}
const re = {
  custom: "custom"
};
Q({ jitless: !0 });
const Ec = /^\d{4}-\d{2}-\d{2}$/, jc = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, zc = /^data:image\/(svg\+xml|png|jpeg|webp)(;charset=[^;,]+)?(;base64)?,/i, N = m().regex(Ec), Dc = mt(
  (e) => e === "" ? null : e,
  N.nullable().optional()
), h = te().finite(), K = te().int(), de = te().finite().min(0), b = m().trim().min(1), Oc = m().trim().min(1).nullable(), D = m().trim().min(1).nullable().optional(), Nc = mt(
  (e) => e === void 0 ? null : e,
  Oc
), Vn = m().regex(jc), Cc = m().regex(zc), Kn = A(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]), Jn = A([
  "classic",
  "neutral"
]), Wn = A([
  "invoice-left-logo-right",
  "invoice-center-logo-center",
  "invoice-right-logo-left"
]), xe = Gn(() => dt([
  m(),
  h,
  k(),
  ec(),
  L(xe),
  ne(m(), xe)
])), Hn = Gn(() => T({
  type: b,
  attrs: ne(m(), xe).nullable().optional(),
  content: L(Hn).optional(),
  marks: L(T({
    type: b,
    attrs: ne(m(), xe).nullable().optional()
  }).passthrough()).optional(),
  text: m().optional()
}).passthrough()), Zt = T({
  version: G(1),
  type: G("tiptap-json"),
  content: Hn,
  plainTextPreview: m().optional(),
  updatedAt: h
}).passthrough(), Rc = mt((e) => {
  if (e == null)
    return e;
  const t = Zt.safeParse(e);
  if (t.success)
    return t.data;
}, Zt.nullable().optional()), $c = T({
  type: A(["weekly", "monthly", "yearly"]),
  weeklyDays: L(te().int().min(0).max(6)).optional(),
  monthlyType: A(["first", "last", "specific"]).optional(),
  monthlyDay: te().int().min(1).max(31).optional(),
  yearlyDate: N.optional()
}).passthrough();
T({
  id: b,
  title: b,
  createdAt: h.optional(),
  updatedAt: h.optional(),
  description: m().optional(),
  notes: Rc,
  hourlyRate: h.nullable().optional(),
  flatRate: k().optional(),
  preferredClientId: D,
  isPersonal: k().optional(),
  archived: k().optional(),
  archivedOnDate: N.nullable().optional(),
  lastBilledAt: h.nullable().optional(),
  color: m().nullable().optional(),
  invoiceIds: L(b).optional(),
  billableTimeIncrementMinutes: te().int().positive().nullable().optional(),
  taskView: A(["list", "kanban"]).optional(),
  taskSort: A(["createdAt", "lastActive", "name", "manual"]).optional(),
  statusMode: A(["active", "quote"]).optional(),
  deadline: N.nullable().optional(),
  deadlineResolvedAt: h.nullable().optional(),
  budgetAmount: de.nullable().optional()
}).passthrough();
T({
  id: b,
  projectId: D,
  parentTaskId: D,
  title: b,
  note: m().nullable().optional(),
  completed: k().optional(),
  archived: k().optional(),
  archivedOnDate: N.nullable().optional(),
  billable: k().optional(),
  billableSetByUser: k().optional(),
  sortOrder: h.nullable().optional(),
  sortOrderUpdatedAt: h.nullable().optional(),
  lastActive: h.optional(),
  createdAt: h.optional(),
  lastBilledAt: h.nullable().optional(),
  startDate: N.nullable().optional(),
  recurring: $c.nullable().optional(),
  promptTimeEntry: k().optional(),
  skipUntilNextRecurring: k().optional(),
  skippedOccurrenceDate: N.nullable().optional(),
  completedDatesByYear: ne(m(), ne(m(), L(te().int().min(1).max(31)))).optional(),
  completedOnDate: N.nullable().optional(),
  estimatedHours: de.nullable().optional(),
  estimatedFlatAmount: de.nullable().optional(),
  quotedAmountBilling: T({
    invoiceId: b,
    billedAt: h,
    total: de
  }).nullable().optional()
}).passthrough();
T({
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
  billedInvoiceId: D,
  billedDurationMs: de.nullable().optional(),
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
T({
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
  custom: L(T({ label: m(), value: m() })).optional(),
  disableTax: k().optional(),
  defaultHourlyRate: h.nullable().optional(),
  hourlyRate: h.nullable().optional(),
  flatRate: k().optional(),
  defaultCurrency: m().optional(),
  archived: k().optional(),
  archivedOnDate: N.nullable().optional(),
  color: m().nullable().optional()
}).passthrough();
T({
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
  custom: L(T({ label: m(), value: m() })).optional(),
  taxId: m().optional(),
  logo: m().optional(),
  isDefault: k().optional(),
  taxEnabled: k().optional(),
  taxLabel: m().optional(),
  taxRate: h.optional(),
  branding: T({
    primaryColor: Vn.nullable().optional(),
    logoAssetId: D
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
T({
  id: b,
  businessInfoId: b,
  kind: G("logo"),
  dataUrl: Cc,
  mimeType: Kn,
  fileName: m().nullable().optional(),
  width: K.positive(),
  height: K.positive(),
  byteSize: K.positive(),
  contentHash: b,
  createdAt: h,
  updatedAt: h.nullable().optional(),
  archivedAt: h.nullable().optional()
}).passthrough();
const Lc = T({
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
}).passthrough(), Xn = T({
  capturedAt: h,
  sourceCurrency: b,
  sourceAmount: h,
  preferredCurrencyAtPayment: b,
  preferredCurrencyAmount: h
}).passthrough(), Mc = T({
  projectId: b,
  projectTitle: b,
  clientId: b,
  pricingMode: A(["hourly", "flat", "mixed"]),
  tasks: L(ne(m(), Pe())).optional(),
  expenseItems: L(ne(m(), Pe())).optional(),
  totalHours: h,
  subtotal: h,
  allocatedDiscount: h.optional(),
  allocatedShipping: h.optional(),
  allocatedTax: h.optional(),
  allocatedTotal: h.optional()
}).passthrough(), Zc = T({
  version: G(1),
  capturedAt: h,
  taskLastBilledAt: ne(m(), h.nullable())
}).passthrough(), Uc = T({
  version: G(1),
  capturedAt: h,
  invoiceCurrency: b,
  entries: L(T({
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
  tasks: L(T({
    taskId: b,
    title: b,
    pricingMode: A(["hourly", "flat"]),
    quantity: h.nonnegative(),
    rate: h,
    amount: h,
    quotedAmount: h.nullable()
  })),
  expenses: L(T({
    expenseId: b,
    title: b,
    sourceAmount: h,
    sourceCurrency: b,
    invoiceAmount: h,
    invoiceCurrency: b,
    exchangeRate: h.positive()
  }))
}).passthrough();
T({
  id: b,
  projectId: Nc,
  projectIds: L(b).optional(),
  projectBreakdowns: L(Mc).optional(),
  clientId: b,
  createdAt: h.optional(),
  updatedAt: h.optional(),
  businessInfoId: D,
  invoiceNumber: b,
  date: N,
  dueDate: N.nullable().optional(),
  status: A(["draft", "sent", "paid", "overdue", "canceled"]),
  items: L(Lc),
  subtotal: h,
  tax: h.optional(),
  taxRate: h.optional(),
  total: h,
  notes: m().optional(),
  paymentMethodId: D,
  billingPeriodPreset: A(["last-month", "month", "all-time", "custom"]).optional(),
  billingPeriodStart: N.nullable().optional(),
  billingPeriodEnd: N.nullable().optional(),
  currency: m().optional(),
  paidAt: h.nullable().optional(),
  paymentCurrencySnapshot: Xn.nullable().optional(),
  sentAt: h.nullable().optional(),
  sentToEmail: m().nullable().optional(),
  canceledAt: h.positive().nullable().optional(),
  cancellationReason: m().trim().min(1).max(500).nullable().optional(),
  billingStateSnapshot: Zc.nullable().optional(),
  billingSelectionSnapshot: Uc.nullable().optional(),
  brandingSnapshot: T({
    businessInfoId: D,
    templateId: D,
    layoutStyle: Jn.optional(),
    logoPlacement: Wn,
    showBusinessLogo: k(),
    useBusinessPrimaryColor: k(),
    primaryColor: Vn.nullable().optional(),
    logoAssetId: D,
    logoAssetMeta: T({
      mimeType: Kn,
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
T({
  id: b,
  name: b,
  prefix: m().optional(),
  useSequentialNumbers: k().optional(),
  currentSequentialNumber: K.optional(),
  defaultNotes: m().optional(),
  defaultTaxRate: h.optional(),
  defaultDueDays: K.optional(),
  isDefault: k().optional(),
  brandingOptions: T({
    showBusinessLogo: k().optional(),
    useBusinessPrimaryColor: k().optional()
  }).passthrough().optional(),
  layoutStyle: Jn.optional(),
  logoPlacement: Wn.optional(),
  showBillingPeriod: k().optional(),
  showProjectTitle: k().optional()
}).passthrough();
T({
  id: b,
  name: b,
  type: A(["invoice", "quote"]),
  fromName: m().max(200).optional(),
  replyTo: m().email().max(320).optional(),
  subject: m().max(500),
  sendBody: m().max(5e3),
  reminderBody: m().max(5e3),
  attachmentTitle: m().max(200),
  isDefault: k().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
T({
  id: b,
  title: b,
  fullName: m().optional(),
  bank: m().optional(),
  iban: m().optional(),
  swift: m().optional(),
  bankAddress: m().optional(),
  paypal: m().optional(),
  custom: L(T({ label: m(), value: m() })).default([]),
  instructions: m().optional(),
  isDefault: k().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional(),
  name: m().optional()
}).passthrough();
T({
  id: b,
  title: b,
  note: m().nullable().optional(),
  date: N,
  supplierName: m().nullable().optional(),
  receiptNumber: m().nullable().optional(),
  currency: b,
  amount: h,
  paidOn: Dc,
  paidBy: m().nullable().optional(),
  paymentStatus: A(["unpaid", "paid"]),
  paymentMode: A(["manual", "auto"]).optional().default("manual"),
  clientId: D,
  projectId: D,
  businessId: D,
  categoryId: D,
  isPersonal: k(),
  billable: k(),
  billingStatus: A(["unbilled", "billed"]).default("unbilled"),
  invoiceId: D,
  billedAt: h.nullable().optional(),
  isRecurring: k().default(!1),
  recurrenceId: D,
  amountType: A(["fixed", "variable"]).nullable().optional(),
  taxNumber: m().nullable().optional(),
  isTaxExempt: k().default(!1),
  amountExcludingTax: h.nullable().optional(),
  taxLabel: m().nullable().optional(),
  taxRate: h.nullable().optional(),
  taxClaimStatus: A(["unclaimed", "claimed", "excluded"]).nullable().optional(),
  taxClaimPeriodId: D,
  taxClaimedAt: h.nullable().optional(),
  paymentCurrencySnapshot: Xn.nullable().optional().catch(null),
  isPreview: k().optional(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
T({
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
  startDate: N,
  endDate: N.nullable().optional(),
  clientId: D,
  projectId: D,
  businessId: D,
  categoryId: D,
  isPersonal: k(),
  billable: k(),
  taxNumber: m().nullable().optional(),
  isTaxExempt: k(),
  amountExcludingTax: h.nullable().optional(),
  taxLabel: m().nullable().optional(),
  taxRate: h.nullable().optional(),
  lastGeneratedDate: N.nullable().optional(),
  active: k(),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
T({
  id: b,
  name: b,
  group: m().nullable().optional(),
  isDefault: k().default(!1),
  archived: k().default(!1),
  createdAt: h.optional(),
  updatedAt: h.optional()
}).passthrough();
T({
  id: b,
  title: b,
  type: A(["vat", "income-tax", "sales-tax", "other"]),
  startDate: N,
  endDate: N,
  businessInfoId: D,
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
T({
  id: b,
  type: A(["client", "project", "task"]),
  referenceId: b,
  mode: A(["static", "date", "weekday"]),
  date: N.nullable().optional(),
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
T({
  id: b,
  weekday: K.min(0).max(6),
  targetHours: h.nullable().optional(),
  targetEarnings: h.nullable().optional(),
  createdAt: h,
  updatedAt: h.nullable().optional()
}).passthrough();
T({
  currency: m().optional(),
  dateFormat: m().optional(),
  timeFormat: m().optional(),
  theme: A(["light", "dark", "system"]).optional(),
  defaultView: m().optional(),
  weekStartsOn: dt([
    G(0),
    G(1),
    G(2),
    G(3),
    G(4),
    G(5),
    G(6)
  ]).optional(),
  autoHideTotalsOnRevisit: k().optional(),
  showCompletedTasks: k().optional(),
  defaultBillable: k().optional(),
  projectSort: A(["createdAt", "lastActive", "name"]).optional(),
  clientSort: A(["createdAt", "lastActive", "name"]).optional(),
  autoSyncEnabled: k().optional(),
  autoSyncMode: A(["backup", "sync"]).optional(),
  weeklyGoalTargetHours: h.nullable().optional(),
  weeklyGoalTargetEarnings: h.nullable().optional(),
  systemNotificationsEnabled: k().optional(),
  systemNotificationTime: m().regex(/^\d{2}:\d{2}$/).optional(),
  backupEnabled: k().optional(),
  backupFrequencyHours: K.min(1).optional()
}).passthrough();
T({
  projectId: b,
  taskId: b,
  timerInstanceId: b.optional(),
  startTime: h,
  paused: k().optional(),
  pausedElapsedTime: de.optional(),
  note: m().optional(),
  lastActive: h.optional()
}).passthrough();
const Bc = "1.5";
Array.from(/* @__PURE__ */ new Set(["1.0", "1.1", "1.3", "1.4", Bc]));
const Je = (e, t) => t.some((n) => e instanceof n);
let Ut, Bt;
function qc() {
  return Ut || (Ut = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Fc() {
  return Bt || (Bt = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const We = /* @__PURE__ */ new WeakMap(), Me = /* @__PURE__ */ new WeakMap(), Re = /* @__PURE__ */ new WeakMap();
function Gc(e) {
  const t = new Promise((n, r) => {
    const o = () => {
      e.removeEventListener("success", a), e.removeEventListener("error", i);
    }, a = () => {
      n(Ee(e.result)), o();
    }, i = () => {
      r(e.error), o();
    };
    e.addEventListener("success", a), e.addEventListener("error", i);
  });
  return Re.set(t, e), t;
}
function Vc(e) {
  if (We.has(e))
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
  We.set(e, t);
}
let He = {
  get(e, t, n) {
    if (e instanceof IDBTransaction) {
      if (t === "done")
        return We.get(e);
      if (t === "store")
        return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
    }
    return Ee(e[t]);
  },
  set(e, t, n) {
    return e[t] = n, !0;
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
  }
};
function Yn(e) {
  He = e(He);
}
function Kc(e) {
  return Fc().includes(e) ? function(...t) {
    return e.apply(Xe(this), t), Ee(this.request);
  } : function(...t) {
    return Ee(e.apply(Xe(this), t));
  };
}
function Jc(e) {
  return typeof e == "function" ? Kc(e) : (e instanceof IDBTransaction && Vc(e), Je(e, qc()) ? new Proxy(e, He) : e);
}
function Ee(e) {
  if (e instanceof IDBRequest)
    return Gc(e);
  if (Me.has(e))
    return Me.get(e);
  const t = Jc(e);
  return t !== e && (Me.set(e, t), Re.set(t, e)), t;
}
const Xe = (e) => Re.get(e), Wc = ["get", "getKey", "getAll", "getAllKeys", "count"], Hc = ["put", "add", "delete", "clear"], Ze = /* @__PURE__ */ new Map();
function qt(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string"))
    return;
  if (Ze.get(t))
    return Ze.get(t);
  const n = t.replace(/FromIndex$/, ""), r = t !== n, o = Hc.includes(n);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(o || Wc.includes(n))
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
  return Ze.set(t, a), a;
}
Yn((e) => ({
  ...e,
  get: (t, n, r) => qt(t, n) || e.get(t, n, r),
  has: (t, n) => !!qt(t, n) || e.has(t, n)
}));
const Xc = ["continue", "continuePrimaryKey", "advance"], Ft = {}, Ye = /* @__PURE__ */ new WeakMap(), Qn = /* @__PURE__ */ new WeakMap(), Yc = {
  get(e, t) {
    if (!Xc.includes(t))
      return e[t];
    let n = Ft[t];
    return n || (n = Ft[t] = function(...r) {
      Ye.set(this, Qn.get(this)[t](...r));
    }), n;
  }
};
async function* Qc(...e) {
  let t = this;
  if (t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)
    return;
  t = t;
  const n = new Proxy(t, Yc);
  for (Qn.set(n, t), Re.set(n, Xe(t)); t; )
    yield n, t = await (Ye.get(n) || t.continue()), Ye.delete(n);
}
function Gt(e, t) {
  return t === Symbol.asyncIterator && Je(e, [IDBIndex, IDBObjectStore, IDBCursor]) || t === "iterate" && Je(e, [IDBIndex, IDBObjectStore]);
}
Yn((e) => ({
  ...e,
  get(t, n, r) {
    return Gt(t, n) ? Qc : e.get(t, n, r);
  },
  has(t, n) {
    return Gt(t, n) || e.has(t, n);
  }
}));
Promise.resolve(void 0);
const el = [
  { value: "last-month", label: "Last Month" },
  { value: "month", label: "This Month" },
  { value: "all-time", label: "All Time" },
  { value: "custom", label: "Custom Range" }
];
new Set(
  el.map((e) => e.value)
);
const tl = [
  "Needs review",
  "Not due",
  "1-30 days",
  "31-60 days",
  "61-90 days",
  "90+ days"
];
tl.reduce((e, t, n) => (e.set(t, n), e), /* @__PURE__ */ new Map());
const V = 1, nl = "tasktime.agent.browser-reconnect";
function rl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_control" && t.protocolVersion === V && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && t.action === "revoke";
}
function me(e) {
  return typeof e == "string" && e.trim().length > 0;
}
function ol(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_register" && t.protocolVersion === V && me(t.sessionToken) && !!t.publicKeyJwk && typeof t.publicKeyJwk == "object";
}
function il(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_proof" && t.protocolVersion === V && me(t.keyId) && me(t.challengeId) && me(t.signature);
}
function al(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_forget" && t.protocolVersion === V && me(t.sessionToken) && me(t.keyId);
}
function sl(e) {
  const t = {
    domain: nl,
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
function cl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.grant;
  return t.type === "agent_bridge_approval_grant" && t.protocolVersion === V && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && !!n && typeof n == "object" && typeof n.id == "string" && n.id.trim().length > 0 && typeof n.clientId == "string" && n.clientId.trim().length > 0 && (n.label === void 0 || typeof n.label == "string") && Array.isArray(n.scopes) && n.scopes.every((r) => typeof r == "string") && typeof n.secretKeyBase64Url == "string" && n.secretKeyBase64Url.trim().length > 0 && typeof n.createdAt == "number" && Number.isFinite(n.createdAt) && (n.expiresAt === void 0 || n.expiresAt === null || typeof n.expiresAt == "number" && Number.isFinite(n.expiresAt));
}
function ll(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_approval_grant_revoke" && t.protocolVersion === V && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && typeof t.grantId == "string" && t.grantId.trim().length > 0 && typeof t.revokedAt == "number" && Number.isFinite(t.revokedAt);
}
const er = [
  "https://tasktime.pro",
  "https://www.tasktime.pro",
  "http://localhost:3101",
  "http://127.0.0.1:3101",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
], pl = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]"
]);
function ul(e) {
  return e.trim().toLowerCase();
}
function dl(e) {
  const t = ul(e);
  if (pl.has(t))
    return !0;
  const n = t.split(".");
  return n.length !== 4 || n[0] !== "127" ? !1 : n.every((r) => {
    if (!/^\d+$/.test(r))
      return !1;
    const o = Number(r);
    return o >= 0 && o <= 255;
  });
}
function ml(e) {
  if (!dl(e))
    throw new j("INVALID_INPUT", "Agent bridge server must bind to a loopback host.", { host: e });
}
function Vt(e) {
  try {
    return new URL(e).origin;
  } catch {
    return null;
  }
}
function fl(e, t = er) {
  if (!e)
    return !1;
  const n = Vt(e);
  return n ? new Set(Array.from(t).map((r) => Vt(r)).filter(Boolean)).has(n) : !1;
}
function hl(e, t) {
  if (!fl(e, t))
    throw new j("PERMISSION_DENIED", "Origin is not allowed to connect to the TaskTime Pro agent bridge.", {
      origin: e || null
    });
}
const gl = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", yl = "/tasktime-agent", bl = 12e4, _l = 3e4;
class vl {
  constructor(t, n, r, o = null, a = !1) {
    this.id = n, this.origin = r, this.session = o, this.reconnectPending = a, this.socket = t;
  }
  sendJson(t) {
    this.socket.destroyed || this.socket.write(wl(JSON.stringify(t)));
  }
  close() {
    this.socket.destroy();
  }
}
function Il(e) {
  return dn("sha1").update(`${e}${gl}`).digest("base64");
}
function wl(e) {
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
function kl(e) {
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
function Tl(e) {
  const t = e.headers.host || "127.0.0.1";
  return new URL(e.url || "/", `http://${t}`);
}
function Sl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.response;
  return t.protocolVersion === V && typeof t.requestId == "string" && !!n && typeof n == "object" && typeof n.command == "string" && typeof n.ok == "boolean";
}
class Al {
  constructor(t) {
    this.clients = /* @__PURE__ */ new Set(), this.pendingResponses = /* @__PURE__ */ new Map(), this.sessions = /* @__PURE__ */ new Map(), this.reconnectAuthorizations = /* @__PURE__ */ new Map(), this.reconnectChallenges = /* @__PURE__ */ new Map(), this.sessionReconnectKeyIds = /* @__PURE__ */ new Map(), this.bridgeInstanceId = pe(), this.server = null, this.nextClientId = 0, this.authoritativeClientId = null, ml(t.host), this.options = t, this.auditLog = t.auditLog ?? new mn();
  }
  async start() {
    if (this.server)
      return;
    const t = vr();
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
      }, n.timeoutMs ?? bl);
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
    if (!r || t.sessionToken !== r.sessionToken || _t(r, o) || n.origin.length === 0) {
      n.close();
      return;
    }
    const a = await this.importReconnectPublicKey(t.publicKeyJwk);
    if (!a) {
      n.close();
      return;
    }
    const i = pe(), c = {
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
    const o = pe(), a = {
      type: "agent_bridge_reconnect_challenge",
      protocolVersion: V,
      bridgeInstanceId: this.bridgeInstanceId,
      keyId: n.keyId,
      challengeId: o,
      nonce: un(32).toString("base64url"),
      origin: n.origin,
      expiresAt: Math.min(r + _l, n.expiresAt)
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
        new TextEncoder().encode(sl(r.message))
      );
    } catch {
      i = !1;
    }
    if (!i) {
      n.close();
      return;
    }
    const c = this.options.pairing, l = bt({
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
      if (!d || _t(d, r))
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
    const l = n.store.consume(i, c, r), p = bt({
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
      hl(t.headers.origin, this.options.allowedOrigins || er);
      const r = new URL(String(t.headers.origin)).origin, o = Tl(t);
      if (o.pathname !== (this.options.path || yl))
        throw new Error("Invalid agent bridge WebSocket path.");
      const a = t.headers["sec-websocket-key"];
      if (typeof a != "string" || !a.trim())
        throw new Error("Missing WebSocket key.");
      const i = this.createSessionConnection(o);
      n.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${Il(a)}`,
        "",
        ""
      ].join(`\r
`));
      const c = new vl(
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
        for (const p of kl(l)) {
          let d;
          try {
            d = JSON.parse(p);
          } catch {
            d = p;
          }
          if (!(Sl(d) && this.resolvePendingResponse(d, c)) && !(rl(d) && this.handleControlMessage(d, c))) {
            if (ol(d)) {
              this.handleReconnectRegisterMessage(d, c);
              continue;
            }
            if (il(d)) {
              this.handleReconnectProofMessage(d, c);
              continue;
            }
            al(d) && this.handleReconnectForgetMessage(d, c) || cl(d) && this.handleApprovalGrantMessage(d, c) || ll(d) && this.handleApprovalGrantRevocationMessage(d, c) || this.options.onMessage?.(d, c);
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
class Pl {
  constructor(t) {
    this.pairingStore = new Nr(), this.approvalGrants = /* @__PURE__ */ new Map(), this.options = t, this.auditLog = t.auditLog ?? new mn();
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
    this.server = new Al(n);
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
    const n = xl(t.scopes), r = this.options.now ? this.options.now() : Date.now(), o = t.grantId ? this.approvalGrants.get(t.grantId) ?? null : Array.from(this.approvalGrants.values()).find((a) => this.isGrantBoundToConfiguredAgent(a) && Kt(a.scopes, n)) ?? null;
    if (!o)
      throw new j("UNAVAILABLE", "No trusted TaskTime Pro approval grant is available for this bridge process.");
    if (!this.isGrantBoundToConfiguredAgent(o))
      throw new j("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant belongs to a different agent identity.");
    if (o.expiresAt != null && o.expiresAt <= r)
      throw new j("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant expired.");
    if (!Kt(o.scopes, n))
      throw new j("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant does not cover the requested scopes.");
    return xr({
      grant: o,
      command: t.command,
      inputHash: t.inputHash,
      scopes: n,
      category: t.category ?? El(t.command, n),
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
    return `ws://${jl(this.options.host, t)}:${t.port}${n}`;
  }
  isGrantBoundToConfiguredAgent(t) {
    return !this.options.agentId || t.clientId === this.options.agentId;
  }
}
function xl(e) {
  return [...new Set(e)];
}
function Kt(e, t) {
  const n = new Set(e);
  return t.every((r) => n.has(r));
}
function El(e, t) {
  return t.includes("billing") ? "billing" : t.includes("email") ? "email" : t.includes("export") ? "export" : e.startsWith("delete_") || e.startsWith("cascade_delete_") || e.startsWith("restore_") || e === "undo_latest_invoice" ? "destructive" : "sensitive";
}
function jl(e, t) {
  return e === "::1" || t.family === "IPv6" ? "[::1]" : e;
}
const s = { type: "string" }, I = { type: "number" }, g = { type: "boolean" }, f = { type: ["string", "null"] }, Jt = {
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
}, Qe = {
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
    items: Jt
  },
  additionalTasks: {
    type: "array",
    items: Jt
  }
}, Wt = {
  ...Qe,
  emailTemplateId: f,
  to: f,
  fromName: f,
  replyTo: f,
  subject: f,
  body: f,
  attachmentTitle: f,
  forwardToSelf: g
}, B = {
  type: "object",
  properties: {},
  additionalProperties: !1
}, ft = [
  {
    name: "get_pairing_status",
    description: "Return the active local TaskTime Pro bridge endpoint, launch URL, pairing expiry, stable agent identity, and app-session status. This tool works before the browser app is paired.",
    scopes: [],
    inputSchema: B,
    bridgeLocal: !0
  },
  {
    name: "refresh_pairing",
    description: "Create a fresh local TaskTime Pro pairing challenge and launch URL for the same bridge process when the previous pairing code expired or was consumed. This tool works before the browser app is paired.",
    scopes: [],
    inputSchema: B,
    bridgeLocal: !0
  }
], tr = [
  {
    name: "list_projects",
    description: "List active TaskTime Pro projects visible to the paired app session.",
    scopes: ["read"],
    inputSchema: B
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
    inputSchema: B
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
    inputSchema: B
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
    inputSchema: B
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
    inputSchema: B
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
    inputSchema: B
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
    inputSchema: B
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
      properties: Qe,
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
        ...Qe,
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
      properties: Wt,
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
        ...Wt,
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
    description: "Get a bounded summary of current work and canonical invoice-eligible time across complete local history.",
    scopes: ["read"],
    inputSchema: B
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
    name: "list_drive_backups",
    description: "List TaskTime Pro backup snapshots available in Google Drive without returning backup contents.",
    scopes: ["read", "export"],
    inputSchema: B
  },
  {
    name: "create_drive_backup",
    description: "Create a TaskTime Pro backup snapshot in Google Drive using the existing backup manager.",
    scopes: ["read", "export"],
    inputSchema: B
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
    inputSchema: B
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
        backupFrequencyHours: I,
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
    inputSchema: B
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
    inputSchema: B
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
function zl(e) {
  return [
    ...ft,
    ...tr.filter((t) => t.scopes.every((n) => e.has(n)))
  ].sort((t, n) => t.name.localeCompare(n.name));
}
function Ht(e) {
  return ft.find((t) => t.name === e) ?? tr.find((t) => t.name === e) ?? null;
}
function Xt(e) {
  return ft.some((t) => t.name === e);
}
const Dl = (e) => e === null ? "null" : Array.isArray(e) ? "array" : typeof e;
function Yt(e, t) {
  const n = [];
  return et(e, t, "$", n), { valid: n.length === 0, errors: n };
}
function et(e, t, n, r) {
  if (!e || typeof e != "object") return;
  const o = Array.isArray(e.type) ? e.type : e.type ? [e.type] : [], a = Dl(t);
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
      d ? et(d, p, `${n}.${l}`, r) : e.additionalProperties === !1 && r.push(`${n}.${l} is not allowed`);
    }
  }
  if (a === "array") {
    const i = t;
    typeof e.minItems == "number" && i.length < e.minItems && r.push(`${n} must contain at least ${e.minItems} item(s)`), e.items && i.forEach((c, l) => et(e.items, c, `${n}[${l}]`, r));
  }
}
const Ol = "2025-11-25", je = "2.0", Nl = 120, Cl = 6e4, Rl = 5 * 6e4;
class $l {
  constructor(t) {
    if (this.toolCallCount = 0, this.nextRequestId = 0, this.bridge = t.bridge, this.scopes = new Set(t.scopes), this.commandTimeoutMs = t.commandTimeoutMs, this.requestIdFactory = t.requestIdFactory ?? (() => `mcp-request-${this.nextRequestId++}`), this.toolCallRateLimit = t.toolCallRateLimit ?? Nl, this.toolCallRateWindowMs = t.toolCallRateWindowMs ?? Cl, this.now = t.now ?? (() => Date.now()), !Number.isInteger(this.toolCallRateLimit) || this.toolCallRateLimit < 0)
      throw new Error("toolCallRateLimit must be a non-negative integer.");
    if (!Number.isInteger(this.toolCallRateWindowMs) || this.toolCallRateWindowMs <= 0)
      throw new Error("toolCallRateWindowMs must be a positive integer.");
    this.toolCallWindowStartedAt = this.now();
  }
  async handleMessage(t) {
    if (!Fl(t))
      return this.error(null, -32600, "Invalid JSON-RPC request.");
    if (t.id === void 0)
      return null;
    switch (t.method) {
      case "initialize":
        return this.result(t.id, {
          protocolVersion: Ol,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "tasktime-local-bridge",
            version: "1.0.0"
          }
        });
      case "ping":
        return this.result(t.id, {});
      case "tools/list":
        return this.result(t.id, {
          tools: zl(this.scopes).map((n) => ({
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
      return R("INVALID_INPUT", "tools/call requires a string tool name.");
    const r = Ht(n.name);
    if (!r)
      return R("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.name}`);
    const o = n.arguments ?? {}, a = Yt(r.inputSchema, o);
    if (!a.valid)
      return R("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: a.errors
      });
    if (Xt(r.name))
      return this.callBridgeSetupTool(r.name);
    const i = r.scopes.find((p) => !this.scopes.has(p));
    if (i)
      return R("PERMISSION_DENIED", `Missing ${i} permission.`, {
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
        Ll(n.approval)
      );
    } catch (p) {
      return p instanceof j ? R(p.code, p.message, Qt(p)) : R(
        "UNAVAILABLE",
        p instanceof Error ? p.message : "TaskTime Pro app session is unavailable.",
        nr()
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
    return t === "get_pairing_status" ? this.bridge.getPairingStatus ? en(t, this.bridge.getPairingStatus()) : R("UNAVAILABLE", "TaskTime Pro bridge pairing status is unavailable.") : this.bridge.refreshPairing ? en(t, this.bridge.refreshPairing()) : R("UNAVAILABLE", "TaskTime Pro bridge pairing refresh is unavailable.");
  }
  async createApprovalToken(t) {
    if (!this.bridge.createApprovalToken)
      return R("UNAVAILABLE", "TaskTime Pro approval-token signing is unavailable.");
    const n = t;
    if (!n || typeof n != "object" || typeof n.command != "string")
      return R("INVALID_INPUT", "tasktime/create_approval_token requires a string command.");
    const r = Ht(n.command);
    if (!r)
      return R("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.command}`);
    if (Xt(r.name))
      return R("INVALID_INPUT", `TaskTime Pro setup tool does not require approval tokens: ${n.command}`);
    const o = n.arguments ?? {}, a = Yt(r.inputSchema, o);
    if (!a.valid)
      return R("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: a.errors
      });
    const i = Ml(n.scopes, r.scopes);
    if (!i)
      return R("INVALID_INPUT", "Approval token scopes must be an array of strings.");
    const c = i.find((p) => !this.scopes.has(p));
    if (c)
      return R("PERMISSION_DENIED", `Missing ${c} permission.`, {
        scope: c
      });
    const l = Ul(n.ttlMs);
    if (l === null)
      return R("INVALID_INPUT", "Approval token ttlMs must be a positive integer no greater than 300000.");
    try {
      const p = typeof n.inputHash == "string" ? n.inputHash : Zl(o);
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
      return p instanceof j ? R(p.code, p.message, Qt(p)) : R("UNAVAILABLE", p instanceof Error ? p.message : "TaskTime Pro approval-token signing failed.");
    }
  }
  consumeToolCallBudget(t) {
    if (this.toolCallRateLimit <= 0)
      return null;
    const n = this.now();
    if (n - this.toolCallWindowStartedAt >= this.toolCallRateWindowMs && (this.toolCallWindowStartedAt = n, this.toolCallCount = 0), this.toolCallCount >= this.toolCallRateLimit) {
      const r = Math.max(0, this.toolCallRateWindowMs - (n - this.toolCallWindowStartedAt));
      return R("RATE_LIMITED", "TaskTime Pro MCP tool call rate limit exceeded.", {
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
      jsonrpc: je,
      id: t,
      result: n
    };
  }
  error(t, n, r, o) {
    return {
      jsonrpc: je,
      id: t,
      error: {
        code: n,
        message: r,
        data: o
      }
    };
  }
}
function Ll(e) {
  if (!e || typeof e != "object")
    return;
  const t = e;
  if (!(typeof t.token != "string" || t.token.trim().length === 0))
    return t;
}
function Ml(e, t) {
  return e === void 0 ? t : !Array.isArray(e) || !e.every((n) => typeof n == "string") ? null : e;
}
function tt(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => tt(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, tt(n)])
  ) : null;
}
function Zl(e) {
  const t = JSON.stringify(tt(e ?? {}));
  return `sha256:${dn("sha256").update(t).digest("hex")}`;
}
function Ul(e) {
  if (e !== void 0)
    return !Number.isInteger(e) || e <= 0 || e > Rl ? null : e;
}
function Qt(e) {
  return e.code !== "UNAVAILABLE" ? e.details : {
    ...e.details,
    ...nr()
  };
}
function nr() {
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
function en(e, t) {
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
function R(e, t, n) {
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
function Bl(e) {
  let t = "";
  const n = (r) => {
    for (t += r.toString(); t.includes(`
`); ) {
      const o = t.indexOf(`
`), a = t.slice(0, o).trim();
      t = t.slice(o + 1), a && ql(a, e);
    }
  };
  return e.input.on("data", n), () => {
    e.input.off("data", n);
  };
}
async function ql(e, t) {
  try {
    const n = await t.server.handleMessage(JSON.parse(e));
    n && t.output.write(`${JSON.stringify(n)}
`);
  } catch (n) {
    const r = n instanceof Error ? n : new Error("MCP stdio message handling failed.");
    t.onError?.(r), t.output.write(`${JSON.stringify({
      jsonrpc: je,
      id: null,
      error: {
        code: -32700,
        message: r.message
      }
    })}
`);
  }
}
function Fl(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.jsonrpc === je && typeof t.method == "string";
}
const Gl = "127.0.0.1", tn = 0, rr = "/tasktime-agent", nt = ["read", "write", "navigation"], Ue = 300 * 1e3, nn = 12e4, rn = 120, on = 6e4, ze = "tasktime.agent.local-bridge", rt = "Local agent bridge", De = ["read", "write", "billing", "export", "email", "navigation"];
function Vl(e, t = process.env) {
  const n = {
    host: t.TASKTIME_AGENT_BRIDGE_HOST || Gl,
    port: H(t.TASKTIME_AGENT_BRIDGE_PORT, tn, "TASKTIME_AGENT_BRIDGE_PORT"),
    path: t.TASKTIME_AGENT_BRIDGE_PATH || rr,
    scopes: ar(t.TASKTIME_AGENT_BRIDGE_SCOPES) ?? nt,
    allowedOrigins: ir(t.TASKTIME_AGENT_BRIDGE_ORIGINS),
    agentId: se(t.TASKTIME_AGENT_ID, ze, "TASKTIME_AGENT_ID"),
    agentLabel: se(t.TASKTIME_AGENT_LABEL, rt, "TASKTIME_AGENT_LABEL"),
    pairingTtlMs: H(t.TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS, Ue, "TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS"),
    sessionTtlMs: ep(t.TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS, "TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS"),
    commandTimeoutMs: H(t.TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS, nn, "TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS"),
    toolCallRateLimit: H(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT, rn, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT"),
    toolCallRateWindowMs: pn(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS, on, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS"),
    appUrl: tp(t.TASKTIME_APP_URL, "TASKTIME_APP_URL"),
    statusFile: np(t.TASKTIME_AGENT_BRIDGE_STATUS_FILE, "TASKTIME_AGENT_BRIDGE_STATUS_FILE"),
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
        n.port = H(Z(e, ++a, i), tn, i);
        break;
      case "--path":
        n.path = ln(Z(e, ++a, i));
        break;
      case "--scopes":
        n.scopes = Ql(Z(e, ++a, i), i);
        break;
      case "--scope":
        r.push(sr(Z(e, ++a, i), i));
        break;
      case "--origin":
        o.push(Z(e, ++a, i));
        break;
      case "--agent-id":
        n.agentId = se(Z(e, ++a, i), ze, i);
        break;
      case "--agent-label":
        n.agentLabel = se(Z(e, ++a, i), rt, i);
        break;
      case "--pairing-ttl-ms":
        n.pairingTtlMs = H(Z(e, ++a, i), Ue, i);
        break;
      case "--session-ttl-ms":
        n.sessionTtlMs = H(Z(e, ++a, i), Ue, i);
        break;
      case "--command-timeout-ms":
        n.commandTimeoutMs = H(Z(e, ++a, i), nn, i);
        break;
      case "--tool-rate-limit":
        n.toolCallRateLimit = H(Z(e, ++a, i), rn, i);
        break;
      case "--tool-rate-window-ms":
        n.toolCallRateWindowMs = pn(Z(e, ++a, i), on, i);
        break;
      case "--app-url":
        n.appUrl = ht(Z(e, ++a, i), i);
        break;
      case "--status-file":
        n.statusFile = se(Z(e, ++a, i), "", i);
        break;
      default:
        throw new Error(`Unsupported option: ${i}`);
    }
  }
  return r.length > 0 && (n.scopes = ot(r)), o.length > 0 && (n.allowedOrigins = o), n.path = ln(n.path), n.scopes = ot(n.scopes), n;
}
function Kl() {
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
function Jl() {
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
        defaultPath: rr,
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
      defaultScopes: nt,
      optionalScopes: De.filter((e) => !nt.includes(e)),
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
function or(e, t) {
  const n = new URL(ht(t, "app URL"));
  return n.pathname = "/account", n.search = "", n.hash = "", n.searchParams.set("section", "agent"), n.searchParams.set("agentBridgeEndpoint", e.endpoint), n.searchParams.set("agentBridgePairingId", e.id), n.searchParams.set("agentBridgePairingCode", e.code), n.searchParams.set("agentBridgeScopes", e.scopes.join(",")), e.agentId && n.searchParams.set("agentBridgeAgentId", e.agentId), e.agentLabel && n.searchParams.set("agentBridgeAgentLabel", e.agentLabel), n.toString();
}
function Wl(e, t) {
  const n = [
    "TaskTime Pro local agent bridge is running.",
    `App endpoint: ${e.endpoint}`,
    `Pairing ID: ${e.id}`,
    `Pairing code: ${e.code}`,
    `Agent: ${e.agentLabel || rt} (${e.agentId || ze})`,
    `Scopes: ${e.scopes.join(",")}`,
    `Pairing expires at: ${new Date(e.expiresAt).toISOString()}`
  ];
  return t && n.push(`TaskTime Pro launch URL: ${or(e, t)}`), n.push(
    "",
    "Open TaskTime Pro and connect the agent bridge using the endpoint, pairing ID, and pairing code above."
  ), n.join(`
`);
}
async function Hl(e, t) {
  let n = null, r = null, o = null;
  const a = (/* @__PURE__ */ new Date()).toISOString(), i = e.statusFile ? fr(e.statusFile) : void 0, c = () => {
    if (!(!i || !r || !o))
      try {
        const $ = an({
          bridge: o,
          challenge: r,
          appUrl: e.appUrl,
          agentId: e.agentId,
          agentLabel: e.agentLabel,
          startedAt: a,
          activeSessionExpiresAt: n
        }), ye = sn(i, $.bridgeInstanceId);
        ur(hr(i), { recursive: !0, mode: 448 }), dr(ye, `${JSON.stringify(Xl($), null, 2)}
`, {
          mode: 384
        }), yt(ye, 384), mr(ye, i), yt(i, 384);
      } catch ($) {
        t.stderr.write(`TaskTime Pro bridge status file write failed: ${$ instanceof Error ? $.message : String($)}
`);
      }
  }, l = ($) => {
    $.action === "pairing_succeeded" && (n = typeof $.details?.expiresAt == "number" ? $.details.expiresAt : null), $.action === "session_disconnected" && o?.getClientCount() === 0 && (n = null), c();
  };
  o = new Pl({
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
  }), c(), r), y = () => an({
    bridge: p,
    challenge: r ?? d(),
    appUrl: e.appUrl,
    agentId: e.agentId,
    agentLabel: e.agentLabel,
    startedAt: a,
    activeSessionExpiresAt: n
  }), v = () => (d(), y()), w = d(), M = new $l({
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
  }), C = Bl({
    input: t.stdin,
    output: t.stdout,
    server: M,
    onError: ($) => {
      t.stderr.write(`TaskTime Pro MCP bridge error: ${$.message}
`);
    }
  });
  return t.stderr.write(`${Wl(w, e.appUrl)}
`), {
    bridge: p,
    challenge: w,
    getStatus: y,
    refreshPairing: v,
    stop: async () => {
      C(), await p.stop(), cn(i), i && cn(sn(i, p.getBridgeInstanceId()));
    }
  };
}
function an(e) {
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
    launchUrl: e.appUrl ? or(e.challenge, e.appUrl) : void 0,
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
function Xl(e) {
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
function sn(e, t) {
  return `${e}.${process.pid}.${t}.tmp`;
}
function cn(e) {
  if (e)
    try {
      pr(e);
    } catch {
    }
}
async function Yl(e = process.argv.slice(2), t = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
}, n = process.env) {
  const r = Vl(e, n);
  if (r.help)
    return t.stderr.write(`${Kl()}
`), null;
  if (r.manifest)
    return t.stdout.write(`${JSON.stringify(Jl(), null, 2)}
`), null;
  const o = await Hl(r, t), a = async () => {
    await o.stop(), process.exit(0);
  };
  return process.once("SIGINT", () => {
    a();
  }), process.once("SIGTERM", () => {
    a();
  }), o;
}
function ir(e) {
  if (!e)
    return;
  const t = e.split(",").map((n) => n.trim()).filter(Boolean);
  return t.length > 0 ? t : void 0;
}
function Ql(e, t) {
  const n = ar(e);
  if (!n || n.length === 0)
    throw new Error(`${t} must include at least one scope.`);
  return n;
}
function ar(e) {
  const t = ir(e);
  if (t)
    return ot(t.map((n) => sr(n, "scope")));
}
function sr(e, t) {
  if (De.includes(e))
    return e;
  throw new Error(`${t} must be one of: ${De.join(", ")}`);
}
function ot(e) {
  return De.filter((t) => e.includes(t));
}
function ln(e) {
  return e.startsWith("/") ? e : `/${e}`;
}
function Z(e, t, n) {
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
function ep(e, t) {
  if (!(e === void 0 || e === ""))
    return H(e, 0, t);
}
function pn(e, t, n) {
  const r = H(e, t, n);
  if (r <= 0)
    throw new Error(`${n} must be a positive integer.`);
  return r;
}
function tp(e, t) {
  if (e)
    return ht(e, t);
}
function np(e, t) {
  if (!(e === void 0 || e === ""))
    return se(e, "", t);
}
function se(e, t, n) {
  const r = e === void 0 ? t : e;
  if (!r.trim())
    throw new Error(`${n} must be a non-empty string.`);
  return r.trim();
}
function ht(e, t) {
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
function rp() {
  const e = process.argv[1];
  if (!e)
    return !1;
  try {
    return gt(e) === gt(gr(import.meta.url));
  } catch {
    return import.meta.url === yr(e).href;
  }
}
rp() && Yl().catch((e) => {
  process.stderr.write(`TaskTime Pro local agent bridge failed: ${e instanceof Error ? e.message : String(e)}
`), process.exitCode = 1;
});
export {
  or as buildTaskTimeAgentBridgeLaunchUrl,
  Wl as formatPairingInstructions,
  Kl as getTaskTimeAgentBridgeCliUsage,
  Jl as getTaskTimeAgentBridgeManifest,
  Vl as parseTaskTimeAgentBridgeCliOptions,
  Yl as runTaskTimeAgentBridgeCli,
  Hl as startTaskTimeAgentBridgeCli
};
