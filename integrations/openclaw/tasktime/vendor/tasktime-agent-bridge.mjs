#!/usr/bin/env node
import { realpathSync as cn, unlinkSync as qi, mkdirSync as Fi, writeFileSync as Gi, chmodSync as un, renameSync as Ki } from "node:fs";
import { resolve as Vi, dirname as Ji } from "node:path";
import { fileURLToPath as Wi, pathToFileURL as Hi } from "node:url";
import { randomUUID as Ie, randomBytes as _r, createHmac as Xi, randomInt as Yi, createHash as vr } from "node:crypto";
import { Buffer as ie } from "node:buffer";
import { createServer as Qi } from "node:http";
class R extends Error {
  constructor(t, n, r) {
    super(n), this.name = "AgentCommandError", this.code = t, this.details = r;
  }
}
const eo = 500;
function to(e) {
  return e.startsWith("export_") || e === "create_cloud_backup" || e === "create_drive_backup" || e === "download_cloud_backup_json" || e === "download_drive_backup_json" ? "export" : e.startsWith("open_") || e.startsWith("focus_") ? "navigation" : e.includes("invoice") || e.includes("billed") || e.includes("billing") ? e.includes("email") ? "email" : "billing" : e.startsWith("list_") || e.startsWith("get_") || e.startsWith("find_") || e.startsWith("preview_") ? "read" : e.startsWith("create_") || e.startsWith("update_") || e.startsWith("complete_") || e.startsWith("archive_") || e.startsWith("unarchive_") || e.startsWith("start_") || e.startsWith("pause_") || e.startsWith("stop_") || e.startsWith("add_") || e.startsWith("mark_") || e.startsWith("finalize_") || e.startsWith("restore_") || e.startsWith("delete_") ? "write" : "unknown";
}
class Ir {
  constructor(t = {}) {
    this.events = [], this.nextId = 0, this.maxEvents = t.maxEvents ?? eo, this.now = t.now ?? Date.now, this.idFactory = t.idFactory ?? (() => `bridge-audit-${this.nextId++}`);
  }
  append(t) {
    const n = {
      id: this.idFactory(),
      timestamp: this.now(),
      action: t.action
    }, r = t.commandCategory ?? (t.command ? to(t.command) : void 0);
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
const no = "tasktime-hmac-sha256-v1", ro = 6e4;
function wr(e) {
  return [...new Set(e)].sort();
}
function _t(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => _t(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, _t(n)])
  ) : null;
}
function io(e) {
  return JSON.stringify(_t({
    ...e,
    scopes: wr(e.scopes)
  }));
}
function oo(e) {
  const t = e.replace(/-/g, "+").replace(/_/g, "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return Buffer.from(n, "base64");
}
function so(e, t) {
  return Xi("sha256", oo(t)).update(io(e)).digest("base64url");
}
function ao(e) {
  const t = e.now ? e.now() : Date.now(), n = t + (e.ttlMs ?? ro), r = e.nonce ?? (typeof Ie == "function" ? Ie() : _r(16).toString("base64url")), i = {
    format: no,
    grantId: e.grant.id,
    command: e.command,
    inputHash: e.inputHash,
    category: e.category,
    scopes: wr(e.scopes),
    nonce: r,
    issuedAt: t,
    expiresAt: n
  };
  return {
    format: i.format,
    grantId: i.grantId,
    token: so(i, e.grant.secretKeyBase64Url),
    issuedAt: i.issuedAt,
    expiresAt: i.expiresAt,
    nonce: i.nonce,
    command: i.command,
    inputHash: i.inputHash,
    scopes: i.scopes,
    category: i.category
  };
}
const co = 300 * 1e3, uo = 6;
function lo(e) {
  let t = "";
  for (let n = 0; n < e; n += 1)
    t += String(Yi(0, 10));
  return t;
}
function po(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? co, r = e.codeLength ?? uo;
  return {
    id: e.idFactory ? e.idFactory() : Ie(),
    code: e.codeFactory ? e.codeFactory(r) : lo(r),
    endpoint: e.endpoint,
    scopes: [...e.scopes],
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function fo(e, t = Date.now()) {
  return t >= e.expiresAt;
}
class mo {
  constructor() {
    this.challenges = /* @__PURE__ */ new Map();
  }
  create(t) {
    const n = po(t);
    return this.challenges.set(n.id, n), n;
  }
  get(t) {
    return this.challenges.get(t) || null;
  }
  consume(t, n, r = Date.now()) {
    const i = this.challenges.get(t);
    if (!i)
      throw new R("NOT_FOUND", "Pairing challenge not found.", { id: t });
    if (fo(i, r))
      throw this.challenges.delete(t), new R("PERMISSION_DENIED", "Pairing challenge expired.", { id: t });
    if (i.code !== n)
      throw new R("PERMISSION_DENIED", "Pairing code is invalid.", { id: t });
    return this.challenges.delete(t), i;
  }
  delete(t) {
    this.challenges.delete(t);
  }
}
const ho = 1440 * 60 * 1e3, go = 32;
function yo() {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error("Secure random token generation is unavailable.");
  return globalThis.crypto;
}
function bo(e = go) {
  const t = new Uint8Array(e);
  return yo().getRandomValues(t), Array.from(t).map((n) => n.toString(16).padStart(2, "0")).join("");
}
function ln(e) {
  const t = e.now ? e.now() : Date.now(), n = e.ttlMs ?? ho;
  return {
    sessionToken: e.tokenFactory ? e.tokenFactory(e.tokenBytes) : bo(e.tokenBytes),
    scopes: new Set(e.scopes),
    createdAt: t,
    expiresAt: t + n,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  };
}
function dn(e, t = Date.now()) {
  return t >= e.expiresAt;
}
function vt(e) {
  const t = Object.values(e).filter((r) => typeof r == "number");
  return Object.entries(e).filter(([r, i]) => t.indexOf(+r) === -1).map(([r, i]) => i);
}
function pn(e, t = "|") {
  return e.map((n) => Er(n)).join(t);
}
function It(e, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
class _o {
  constructor(t) {
    this._getter = t, this._value = void 0;
  }
  get value() {
    const t = this._getter;
    return t !== void 0 && (this._value = t(), this._getter = void 0), this._value;
  }
}
function Ut(e) {
  return new _o(e);
}
function vo(e) {
  return e == null;
}
function Bt(e) {
  const t = e.startsWith("^") ? 1 : 0, n = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(t, n);
}
function Io(e, t) {
  const n = e / t, r = Math.round(n), i = 4 * Number.EPSILON * Math.max(Math.abs(n), 1);
  return Math.abs(n - r) < i ? 0 : n - r;
}
const fn = /* @__PURE__ */ Symbol("evaluating");
function wo(e, t, n) {
  let r;
  Object.defineProperty(e, t, {
    get() {
      if (r !== fn)
        return r === void 0 && (r = fn, r = n()), r;
    },
    set(i) {
      Object.defineProperty(e, t, {
        value: i
        // configurable: true,
      });
    },
    configurable: !0
  });
}
function me(e, t, n) {
  Object.defineProperty(e, t, {
    value: n,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function kr(e) {
  const t = Object.getOwnPropertyDescriptor(e, "shape");
  return t?.get ? t.get.raw : t?.value;
}
function se(e) {
  return kr(e._zod.def) ?? e._zod.def.shape;
}
function Tr(e, t, n) {
  Object.defineProperty(e, t, {
    get() {
      const r = n();
      return me(this, t, r), r;
    },
    enumerable: !0,
    configurable: !0
  });
}
function Sr(e, t, n) {
  t in e ? me(e, t, n) : e[t] = n;
}
function ye(e, t, n, r) {
  const i = se(t);
  for (const o of n) {
    const s = Object.getOwnPropertyDescriptor(i, o);
    s.enumerable && (s.get ? Tr(e, o, () => {
      const a = t._zod.def.shape[o];
      return r ? r(a, o) : a;
    }) : Sr(e, o, r ? r(s.value, o) : s.value));
  }
}
function ko(e, t) {
  for (const n of Reflect.ownKeys(t)) {
    const r = Object.getOwnPropertyDescriptor(t, n);
    r.enumerable && (r.get ? Tr(e, n, () => t[n]) : Sr(e, n, r.value));
  }
}
function V(...e) {
  const t = {};
  for (const n of e) {
    const r = Object.getOwnPropertyDescriptors(n);
    Object.assign(t, r);
  }
  return Object.defineProperties({}, t);
}
function To(e) {
  return JSON.stringify(e);
}
function So(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const Ar = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function Fe(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
const Ao = /* @__PURE__ */ Ut(() => {
  if (te.jitless || typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare"))
    return !1;
  try {
    const e = Function;
    return new e(""), !0;
  } catch {
    return !1;
  }
});
function Te(e) {
  if (Fe(e) === !1)
    return !1;
  const t = e.constructor;
  if (t === void 0 || typeof t != "function")
    return !0;
  const n = t.prototype;
  return !(Fe(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function Pr(e) {
  return Te(e) ? { ...e } : Array.isArray(e) ? [...e] : e instanceof Map ? new Map(e) : e instanceof Set ? new Set(e) : e;
}
const Po = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function Se(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function he(e, t, n) {
  const r = new e._zod.constr(t ?? e._zod.def);
  return (!t || n?.parent) && (r._zod.parent = e), r;
}
function k(e) {
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
function Er(e) {
  return typeof e == "bigint" ? e.toString() + "n" : typeof e == "string" ? `"${e}"` : `${e}`;
}
function Eo(e) {
  return Object.keys(e).filter((t) => e[t]._zod.optin !== void 0 && e[t]._zod.optout === "optional");
}
const xr = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}, xo = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function Oo(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const o = {};
  return ye(o, e, rt(e, t)), he(e, V(n, { shape: o, checks: [] }));
}
function rt(e, t) {
  const n = se(e), r = [];
  for (const i of Reflect.ownKeys(t)) {
    if (!Object.getOwnPropertyDescriptor(n, i)?.enumerable)
      throw new Error(`Unrecognized key: "${String(i)}"`);
    t[i] && r.push(i);
  }
  return r;
}
function jo(e, t) {
  const n = e._zod.def, r = n.checks;
  if (r && r.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const o = new Set(rt(e, t)), s = {};
  return ye(s, e, Reflect.ownKeys(se(e)).filter((a) => !o.has(a))), he(e, V(n, { shape: s, checks: [] }));
}
function No(e, t) {
  if (!Te(t))
    throw new Error("Invalid input to extend: expected a plain object");
  const n = e._zod.def.checks;
  if (n && n.length > 0) {
    const i = se(e);
    for (const o of Reflect.ownKeys(t))
      if (Object.getOwnPropertyDescriptor(i, o) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  return he(e, V(e._zod.def, { shape: Or(e, t) }));
}
function Or(e, t) {
  const n = {};
  return ye(n, e, Reflect.ownKeys(se(e))), ko(n, t), n;
}
function Do(e, t) {
  if (!Te(t))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  return he(e, V(e._zod.def, { shape: Or(e, t) }));
}
function zo(e, t) {
  if (!t?._zod?.def)
    throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
  if (e._zod.def.checks?.length)
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  const n = {};
  ye(n, e, Reflect.ownKeys(se(e))), ye(n, t, Reflect.ownKeys(se(t)));
  const r = V(e._zod.def, {
    shape: n,
    get catchall() {
      return t._zod.def.catchall;
    },
    checks: t._zod.def.checks ?? []
  });
  return he(e, r);
}
function mn(e, t, n, r = "partial") {
  const o = t._zod.def.checks;
  if (o && o.length > 0)
    throw new Error(`.${r}() cannot be used on object schemas containing refinements`);
  const a = n ? new Set(rt(t, n)) : void 0, u = {};
  return ye(u, t, Reflect.ownKeys(se(t)), e && ((l, d) => a && !a.has(d) ? l : new e({ type: "optional", innerType: l }))), he(t, V(t._zod.def, { shape: u, checks: [] }));
}
function Ro(e, t, n) {
  const r = n ? new Set(rt(t, n)) : void 0, i = {};
  return ye(i, t, Reflect.ownKeys(se(t)), (o, s) => (
    // overwrite with non-optional
    r && !r.has(s) ? o : new e({ type: "nonoptional", innerType: o })
  )), he(t, V(t._zod.def, { shape: i }));
}
function oe(e, t = 0) {
  if (e.aborted === !0)
    return !0;
  for (let n = t; n < e.issues.length; n++)
    if (e.issues[n]?.continue !== !0)
      return !0;
  return !1;
}
function Co(e, t = 0) {
  if (e.aborted === !0)
    return !0;
  for (let n = t; n < e.issues.length; n++)
    if (e.issues[n]?.continue === !1)
      return !0;
  return !1;
}
function ve(e, t) {
  return t.map((n) => {
    var r;
    return (r = n).path ?? (r.path = []), n.path.unshift(e), n;
  });
}
function je(e) {
  return typeof e == "string" ? e : e?.message;
}
function hn(e) {
  const t = [];
  for (const n of e ?? []) {
    const r = n._zod.def;
    if (!/_(length|size)$|_equals$/.test(r.check))
      break;
    const i = r.maximum ?? r.length ?? r.size;
    i >= 0 && t.push([i, n]);
  }
  return t;
}
function wt(e, t, n) {
  var r;
  for (let i = t; i < e.length; i++)
    (r = e[i]).schema ?? (r.schema = n);
}
function ce(e, t, n) {
  var r;
  const i = e.inst?._zod?.traits;
  i?.has("$ZodType") && (i.has("$ZodCheck") ? (r = e).schema ?? (r.schema = e.inst) : e.schema = e.inst);
  const o = e.schema !== e.inst ? e.schema?._zod.def?.error : void 0, s = e.message ? e.message : je(e.inst?._zod.def?.error?.(e)) ?? je(o?.(e)) ?? je(t?.error?.(e)) ?? je(n.customError?.(e)) ?? je(n.localeError?.(e)) ?? "Invalid input", a = {};
  for (const u of Object.keys(e))
    u === "inst" || u === "schema" || u === "continue" || u === "input" || u === "__proto__" || (a[u] = e[u]);
  return a.path ?? (a.path = []), a.message = s, t?.reportInput && (a.input = e.input), a;
}
const $o = /[\uD800-\uDBFF]/;
function qt(e) {
  const t = e.length;
  if (!$o.test(e))
    return t;
  let n = t;
  for (let r = 0; r < t - 1; r++)
    (e.charCodeAt(r) & 64512) === 55296 && (e.charCodeAt(r + 1) & 64512) === 56320 && (n--, r++);
  return n;
}
function Ft(e) {
  return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function Lo(e) {
  const t = typeof e;
  switch (t) {
    case "number":
      return Number.isNaN(e) ? "nan" : "number";
    case "object": {
      if (e === null)
        return "null";
      if (Array.isArray(e))
        return "array";
      const n = e;
      if (n && Object.getPrototypeOf(n) !== Object.prototype && "constructor" in n && n.constructor)
        return n.constructor.name;
    }
  }
  return t;
}
function Ce(...e) {
  const [t, n, r] = e;
  return typeof t == "string" ? {
    message: t,
    code: "custom",
    input: n,
    inst: r
  } : { ...t };
}
function Mo(e, t) {
  for (const n in t) {
    const r = Object.getOwnPropertyDescriptor(t, n);
    r.get ? Object.defineProperty(e, n, { ...r, enumerable: !1 }) : Zo(e, n, r.value);
  }
}
function ue(e, t, n, r = !0) {
  return Object.defineProperty(e, t, { configurable: !0, writable: !0, enumerable: r, value: n }), n;
}
function jr(e, t, n) {
  return ue(e, t, n, !1);
}
function Nr(e, t) {
  for (const n in e) {
    const r = e[n];
    Object.defineProperty(t, n, {
      configurable: !0,
      enumerable: !0,
      get() {
        return ue(this, n, r(this));
      },
      set(i) {
        ue(this, n, i);
      }
    });
  }
  return t;
}
function Zo(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    get() {
      return this == null ? n : ue(this, t, n.bind(this));
    },
    set(r) {
      ue(this, t, r);
    }
  });
}
function Uo(e, t) {
  const n = Object.getPrototypeOf(e);
  return t in n ? void 0 : n;
}
let lt, ae = !1;
const Bo = {
  configurable: !0,
  get() {
    ae = !0;
  }
};
function x(e, t, n) {
  const r = Object.getPrototypeOf(e._zod);
  if (t in r && lt !== e._zod) {
    lt = void 0;
    return;
  }
  lt = e._zod, Object.defineProperty(r, t, {
    configurable: !0,
    get() {
      Object.defineProperty(this, t, Bo);
      const i = ae;
      ae = !1;
      try {
        const o = n(this);
        return ae ? delete this[t] : Object.defineProperty(this, t, { configurable: !0, writable: !0, value: o }), ae = ae || i, o;
      } catch (o) {
        throw delete this[t], ae = ae || i, o;
      }
    },
    set(i) {
      Object.defineProperty(this, t, { configurable: !0, writable: !0, value: i });
    }
  });
}
function qo(e, t, n, r) {
  const i = Uo(e, t);
  i && Object.defineProperty(i, t, {
    configurable: !0,
    get() {
      const o = { configurable: !0, writable: !0, enumerable: r, value: void 0 };
      return Object.defineProperty(this, t, o), o.value = n(this), Object.defineProperty(this, t, o), o.value;
    },
    set(o) {
      Object.defineProperty(this, t, { configurable: !0, writable: !0, enumerable: r, value: o });
    }
  });
}
const Fo = "~constantCatch";
function Go(e) {
  const t = () => e;
  return t[Fo] = !0, t;
}
var gn;
const dt = { value: void 0, enumerable: !1 };
let yn = "captureStackTrace" in Error ? Error : null;
function Ko(e) {
  const t = yn;
  if (t) {
    const n = t.stackTraceLimit;
    if (typeof n == "number") {
      try {
        t.stackTraceLimit = 0;
      } catch {
        return yn = null, new e();
      }
      try {
        return new e();
      } finally {
        t.stackTraceLimit = n;
      }
    }
  }
  return new e();
}
function p(e, t, n, r) {
  const i = {};
  function o(b) {
    this.def = b, this.constr = h, this.traits = /* @__PURE__ */ new Set();
  }
  o.prototype = i;
  const s = n, a = s && /* @__PURE__ */ new WeakSet();
  function u(b, y) {
    if (b._zod) {
      if (b._zod.traits.has(e))
        return;
    } else {
      dt.value = new o(y);
      try {
        Object.defineProperty(b, "_zod", dt);
      } finally {
        dt.value = void 0;
      }
    }
    if (b._zod.traits.add(e), t(b, y), a) {
      const T = Object.getPrototypeOf(b), I = b._zod.constr.prototype;
      let O = T;
      for (; O && O !== I; )
        O = Object.getPrototypeOf(O);
      const J = O ?? T;
      a.has(J) || (a.add(J), Mo(J, s));
    }
    const _ = h.prototype;
    for (const T in _)
      Object.prototype.hasOwnProperty.call(_, T) && (T in b || (b[T] = _[T].bind(b)));
  }
  const l = r?.Parent ?? Object;
  class d extends l {
  }
  Object.defineProperty(d, "name", { value: e });
  function h(b) {
    const y = r?.Parent ? Ko(d) : this;
    u(y, b);
    const _ = y._zod.deferred;
    if (_) {
      for (const I of _)
        I();
      y._zod.deferred = void 0;
    }
    const T = globalThis.__zod_globalConfig?.postProcessor;
    return T && T(y), y;
  }
  return Object.defineProperty(h, "init", { value: u }), Object.defineProperty(h, Symbol.hasInstance, {
    value: (b) => r?.Parent && b instanceof r.Parent ? !0 : b?._zod?.traits?.has(e)
  }), Object.defineProperty(h, "name", { value: e }), h;
}
class ge extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class Dr extends Error {
  constructor(t) {
    super(`Encountered unidirectional transform during encode: ${t}`), this.name = "ZodEncodeError";
  }
}
(gn = globalThis).__zod_globalConfig ?? (gn.__zod_globalConfig = {});
const te = globalThis.__zod_globalConfig;
function ne(e) {
  return e && Object.assign(te, e), te;
}
function Vo() {
  const e = this._zod;
  return e.message ?? (e.message = JSON.stringify(e.def, It, 2)), e.message;
}
function Jo(e) {
  this._zod.message = e;
}
const Wo = {
  get: Vo,
  set: Jo,
  enumerable: !0,
  configurable: !0
}, pt = { value: void 0, enumerable: !1 }, bn = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]), Ho = (e, t) => {
  e.name = "$ZodError", pt.value = t, Object.defineProperty(e, "issues", pt), pt.value = void 0, Object.defineProperty(e, "message", Wo);
  const n = Object.getPrototypeOf(e);
  bn.has(n) || (bn.add(n), Object.defineProperty(n, "toString", {
    configurable: !0,
    enumerable: !1,
    get() {
      const r = () => this.message;
      return Object.defineProperty(this, "toString", { value: r, configurable: !0, writable: !0 }), r;
    },
    set(r) {
      Object.defineProperty(this, "toString", { value: r, configurable: !0, writable: !0 });
    }
  }));
}, Xo = p("$ZodError", Ho);
function Yo(e, t, n) {
  return Object.prototype.hasOwnProperty.call(e, t) || (t === "__proto__" ? Object.defineProperty(e, t, { value: n(), writable: !0, enumerable: !0, configurable: !0 }) : e[t] = n()), e[t];
}
function Qo(e, t = (n) => n.message) {
  const n = {}, r = [];
  for (const i of e.issues)
    i.path.length > 0 ? Yo(n, i.path[0], () => []).push(t(i)) : r.push(t(i));
  return { formErrors: r, fieldErrors: n };
}
function es(e, t = (n) => n.message) {
  const n = { _errors: [] }, r = (i, o = []) => {
    for (const s of i.issues)
      if (s.code === "invalid_union" && s.errors.length)
        s.errors.map((a) => r({ issues: a }, [...o, ...s.path]));
      else if (s.code === "invalid_key")
        r({ issues: s.issues }, [...o, ...s.path]);
      else if (s.code === "invalid_element")
        r({ issues: s.issues }, [...o, ...s.path]);
      else {
        const a = [...o, ...s.path];
        if (a.length === 0)
          n._errors.push(t(s));
        else {
          let u = n, l = 0;
          for (; l < a.length; ) {
            const d = a[l], h = l === a.length - 1;
            if (d === "_errors") {
              h && u._errors.push(t(s)), l++;
              continue;
            }
            Object.prototype.hasOwnProperty.call(u, d) || Object.defineProperty(u, d, {
              value: { _errors: [] },
              enumerable: !0,
              writable: !0,
              configurable: !0
            });
            const b = u[d];
            h && b._errors.push(t(s)), u = b, l++;
          }
        }
      }
  };
  return r(e), n;
}
function it(e, t) {
  return { callee: t?.callee ?? e, Err: t?.Err };
}
const Gt = (e) => {
  const t = (n, r, i, o) => {
    const s = i ? { ...i, async: !1 } : { async: !1 }, a = n._zod.run({ value: r, issues: [] }, s);
    if (a instanceof Promise)
      throw new ge();
    if (a.issues.length) {
      const u = new (o?.Err ?? e)(a.issues.map((l) => ce(l, s, ne())));
      throw Ar(u, o?.callee ?? t), u;
    }
    return a.value;
  };
  return t;
}, Kt = (e) => {
  const t = async (n, r, i, o) => {
    const s = i ? { ...i, async: !0 } : { async: !0 };
    let a = n._zod.run({ value: r, issues: [] }, s);
    if (a instanceof Promise && (a = await a), a.issues.length) {
      const u = new (o?.Err ?? e)(a.issues.map((l) => ce(l, s, ne())));
      throw Ar(u, o?.callee ?? t), u;
    }
    return a.value;
  };
  return t;
}, Vt = (e) => (t, n, r) => {
  const i = r ? { ...r, async: !1 } : { async: !1 }, o = t._zod.run({ value: n, issues: [] }, i);
  if (o instanceof Promise)
    throw new ge();
  return o.issues.length ? zr(e, o.issues, i) : { success: !0, data: o.value };
};
function zr(e, t, n) {
  let r;
  return {
    success: !1,
    get error() {
      return r || (r = new e(t.map((i) => ce(i, n, ne()))), t = void 0, n = void 0), r;
    },
    set error(i) {
      r = i, t = void 0, n = void 0;
    }
  };
}
const Jt = (e) => async (t, n, r) => {
  const i = r ? { ...r, async: !0 } : { async: !0 };
  let o = t._zod.run({ value: n, issues: [] }, i);
  return o instanceof Promise && (o = await o), o.issues.length ? zr(e, o.issues, i) : { success: !0, data: o.value };
}, ts = /* @__PURE__ */ Symbol.for("zod.compile.invalid"), ns = /* @__PURE__ */ Symbol.for("zod.compile.fallback"), rs = ((e, t, n) => {
  const r = e._zod.bag.validator;
  if (r !== void 0) {
    if (r(t) !== ts)
      return !0;
    if (r.definite === !0 && n === void 0)
      return !1;
  }
  return is(e, t, n);
});
function is(e, t, n) {
  const r = n ? { ...n, async: !1, abortEarly: !0 } : { async: !1, abortEarly: !0 }, i = e._zod.bag.fallbackRun;
  let o;
  if (i ? (r[ns] = !0, o = i({ value: t, issues: [] }, r)) : o = e._zod.run({ value: t, issues: [] }, r), o instanceof Promise)
    throw new ge();
  return o.issues.length === 0;
}
const os = async (e, t, n) => {
  const r = n ? { ...n, async: !0, abortEarly: !0 } : { async: !0, abortEarly: !0 };
  let i = e._zod.run({ value: t, issues: [] }, r);
  return i instanceof Promise && (i = await i), i.issues.length === 0;
}, ss = (e) => {
  const t = Gt(e), n = (r, i, o, s) => {
    const a = o ? { ...o, direction: "backward" } : { direction: "backward" };
    return t(r, i, a, it(n, s));
  };
  return n;
}, as = (e) => {
  const t = Gt(e), n = (r, i, o, s) => t(r, i, o, it(n, s));
  return n;
}, cs = (e) => {
  const t = Kt(e), n = async (r, i, o, s) => {
    const a = o ? { ...o, direction: "backward" } : { direction: "backward" };
    return await t(r, i, a, it(n, s));
  };
  return n;
}, us = (e) => {
  const t = Kt(e), n = async (r, i, o, s) => await t(r, i, o, it(n, s));
  return n;
}, ls = (e) => (t, n, r) => {
  const i = r ? { ...r, direction: "backward" } : { direction: "backward" };
  return Vt(e)(t, n, i);
}, ds = (e) => (t, n, r) => Vt(e)(t, n, r), ps = (e) => async (t, n, r) => {
  const i = r ? { ...r, direction: "backward" } : { direction: "backward" };
  return Jt(e)(t, n, i);
}, fs = (e) => async (t, n, r) => Jt(e)(t, n, r), ms = /^[cC][0-9a-z]{6,}$/, hs = /^[0-9a-z]+$/, gs = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/, ys = /^[0-9a-vA-V]{20}$/, bs = /^[A-Za-z0-9]{27}$/, _s = /^[a-zA-Z0-9_-]{21}$/;
function vs(e) {
  return new RegExp(`^[a-zA-Z0-9_-]{${e}}$`);
}
const Is = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, ws = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, _n = (e) => e ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, ks = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, Ts = "^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$";
function Ss() {
  return new RegExp(Ts, "u");
}
const As = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Ps = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, Es = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, xs = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, Os = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, js = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/, Ns = /^https?$/, Ds = /^\+[1-9]\d{6,14}$/, Rr = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
function zs(e) {
  return new RegExp(`^${e}$`);
}
const Rs = /* @__PURE__ */ zs(Rr);
function kt(e) {
  const t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : e.seconds ? `${t}:[0-5]\\d(?:\\.\\d+)?` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function Cs(e) {
  return new RegExp(`^${kt(e)}$`);
}
function $s(e) {
  const t = ["Z"];
  e.offset && t.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const n = `${kt({ precision: e.precision, seconds: !0 })}(?:${t.join("|")})`, r = e.local ? `${n}|${kt({ precision: e.precision })}` : n;
  return new RegExp(`^${Rr}T(?:${r})$`);
}
const Ls = /^[\s\S]{0,}$/, Ms = /^-?\d+$/, Wt = /^-?\d+(?:\.\d+)?$/, Zs = /^(?:true|false)$/i, Us = /^null$/i, Bs = /^[^A-Z]*$/, qs = /^[^a-z]*$/, K = /* @__PURE__ */ p("$ZodCheck", (e, t) => {
  var n;
  e._zod ?? (e._zod = {}), e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), Ht = (e) => {
  const t = e.value;
  return !vo(t) && t.length !== void 0;
}, Ge = {
  number: "number",
  bigint: "bigint",
  object: "date"
}, Cr = /* @__PURE__ */ p("$ZodCheckLessThan", (e, t) => {
  K.init(e, t);
  const n = Ge[typeof t.value];
  e._zod.check = (r) => {
    (t.inclusive ? r.value <= t.value : r.value < t.value) || r.issues.push({
      origin: Ge[typeof r.value] ?? n,
      code: "too_big",
      maximum: typeof t.value == "object" ? t.value.getTime() : t.value,
      input: r.value,
      inclusive: t.inclusive,
      inst: e,
      continue: !t.abort
    });
  };
}), $r = /* @__PURE__ */ p("$ZodCheckGreaterThan", (e, t) => {
  K.init(e, t);
  const n = Ge[typeof t.value];
  e._zod.check = (r) => {
    (t.inclusive ? r.value >= t.value : r.value > t.value) || r.issues.push({
      origin: Ge[typeof r.value] ?? n,
      code: "too_small",
      minimum: typeof t.value == "object" ? t.value.getTime() : t.value,
      input: r.value,
      inclusive: t.inclusive,
      inst: e,
      continue: !t.abort
    });
  };
}), Fs = /* @__PURE__ */ p("$ZodCheckMultipleOf", (e, t) => {
  K.init(e, t), e._zod.check = (n) => {
    if (typeof n.value != typeof t.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    (typeof n.value == "bigint" ? (
      // `value % 0n` throws, and nothing is a multiple of zero — the number branch already fails this way via NaN
      t.value !== BigInt(0) && n.value % t.value === BigInt(0)
    ) : Io(n.value, t.value) === 0) || n.issues.push({
      origin: typeof n.value,
      code: "not_multiple_of",
      divisor: t.value,
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Gs = /* @__PURE__ */ p("$ZodCheckNumberFormat", (e, t) => {
  K.init(e, t), t.format = t.format || "float64";
  const n = t.format?.includes("int"), r = n ? "int" : "number", [i, o] = xr[t.format];
  e._zod.check = (s) => {
    const a = s.value;
    if (n) {
      if (!Number.isInteger(a)) {
        s.issues.push({
          expected: r,
          format: t.format,
          code: "invalid_type",
          continue: !1,
          input: a,
          inst: e
        });
        return;
      }
      if (!Number.isSafeInteger(a)) {
        a > 0 ? s.issues.push({
          input: a,
          code: "too_big",
          maximum: Number.MAX_SAFE_INTEGER,
          note: "Integers must be within the safe integer range.",
          inst: e,
          origin: r,
          inclusive: !0,
          continue: !t.abort
        }) : s.issues.push({
          input: a,
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
    a < i && s.issues.push({
      origin: "number",
      input: a,
      code: "too_small",
      minimum: i,
      inclusive: !0,
      inst: e,
      continue: !t.abort
    }), a > o && s.issues.push({
      origin: "number",
      input: a,
      code: "too_big",
      maximum: o,
      inclusive: !0,
      inst: e,
      continue: !t.abort
    });
  };
}), Ks = /* @__PURE__ */ p("$ZodCheckMaxLength", (e, t) => {
  var n;
  K.init(e, t), (n = e._zod.def).when ?? (n.when = Ht), e._zod.check = (r) => {
    const i = r.value, o = i.length;
    if ((typeof i == "string" && o > t.maximum ? qt(i) : o) <= t.maximum)
      return;
    const a = Ft(i);
    r.issues.push({
      origin: a,
      code: "too_big",
      maximum: t.maximum,
      inclusive: !0,
      input: i,
      inst: e,
      continue: !t.abort
    });
  };
}), Vs = /* @__PURE__ */ p("$ZodCheckMinLength", (e, t) => {
  var n;
  K.init(e, t), (n = e._zod.def).when ?? (n.when = Ht), e._zod.check = (r) => {
    const i = r.value, o = i.length;
    if ((typeof i == "string" && o >= t.minimum && o < t.minimum * 2 ? qt(i) : o) >= t.minimum)
      return;
    const a = Ft(i);
    r.issues.push({
      origin: a,
      code: "too_small",
      minimum: t.minimum,
      inclusive: !0,
      input: i,
      inst: e,
      continue: !t.abort
    });
  };
}), Js = /* @__PURE__ */ p("$ZodCheckLengthEquals", (e, t) => {
  var n;
  K.init(e, t), (n = e._zod.def).when ?? (n.when = Ht), e._zod.check = (r) => {
    const i = r.value, o = i.length, s = typeof i == "string" && o >= t.length && o <= t.length * 2 ? qt(i) : o;
    if (s === t.length)
      return;
    const a = Ft(i), u = s > t.length;
    r.issues.push({
      origin: a,
      ...u ? { code: "too_big", maximum: t.length } : { code: "too_small", minimum: t.length },
      inclusive: !0,
      exact: !0,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), ot = /* @__PURE__ */ p("$ZodCheckStringFormat", (e, t) => {
  var n, r;
  K.init(e, t), t.pattern ? (n = e._zod).check ?? (n.check = (i) => {
    t.pattern.lastIndex = 0, !t.pattern.test(i.value) && i.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t.format,
      input: i.value,
      ...t.pattern ? { pattern: t.pattern.toString() } : {},
      inst: e,
      continue: !t.abort
    });
  }) : (r = e._zod).check ?? (r.check = () => {
  });
}), Ws = /* @__PURE__ */ p("$ZodCheckRegex", (e, t) => {
  ot.init(e, t), e._zod.check = (n) => {
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
}), Hs = /* @__PURE__ */ p("$ZodCheckLowerCase", (e, t) => {
  t.pattern ?? (t.pattern = Bs), ot.init(e, t);
}), Xs = /* @__PURE__ */ p("$ZodCheckUpperCase", (e, t) => {
  t.pattern ?? (t.pattern = qs), ot.init(e, t);
}), Ys = /* @__PURE__ */ p("$ZodCheckIncludes", (e, t) => {
  K.init(e, t);
  const n = Se(t.includes), r = new RegExp(typeof t.position == "number" ? `^.{${t.position},}${n}` : n);
  t.pattern = r, e._zod.check = (i) => {
    i.value.includes(t.includes, t.position) || i.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t.includes,
      input: i.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Qs = /* @__PURE__ */ p("$ZodCheckStartsWith", (e, t) => {
  K.init(e, t);
  const n = new RegExp(`^${Se(t.prefix)}.*`);
  t.pattern ?? (t.pattern = n), e._zod.check = (r) => {
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
}), ea = /* @__PURE__ */ p("$ZodCheckEndsWith", (e, t) => {
  K.init(e, t);
  const n = new RegExp(`.*${Se(t.suffix)}$`);
  t.pattern ?? (t.pattern = n), e._zod.check = (r) => {
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
}), ta = /* @__PURE__ */ p("$ZodCheckOverwrite", (e, t) => {
  K.init(e, t), e._zod.check = (n) => {
    n.value = t.tx(n.value);
  };
});
class na {
  constructor(t = [], n = {}) {
    this.content = [], this.indent = 0, this.args = t, this.closed = n;
  }
  // the compiler catches a child's throw and keeps writing into this doc, so the indent has to unwind with it
  indented(t) {
    this.indent += 1;
    try {
      t(this);
    } finally {
      this.indent -= 1;
    }
  }
  write(t) {
    if (typeof t == "function") {
      t(this, { execution: "sync" }), t(this, { execution: "async" });
      return;
    }
    const r = t.split(`
`).filter((s) => s), i = Math.min(...r.map((s) => s.length - s.trimStart().length)), o = r.map((s) => s.slice(i)).map((s) => " ".repeat(this.indent * 2) + s);
    for (const s of o)
      this.content.push(s);
  }
  compile() {
    const t = Function, n = this?.content ?? [""];
    return new t(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${n.join(`
`)}
};`)(...Object.values(this.closed));
  }
}
const ra = {
  major: 4,
  minor: 6,
  patch: 7
}, N = /* @__PURE__ */ p("$ZodType", (e, t) => {
  var n;
  e ?? (e = {}), e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = ra;
  const r = e._zod.def.checks, i = e._zod.traits.has("$ZodCheck") ? [e, ...r ?? []] : r?.length ? [...r] : [];
  for (const o of i)
    for (const s of o._zod.onattach)
      s(e);
  if (i.length === 0)
    (n = e._zod).deferred ?? (n.deferred = []), e._zod.deferred?.push(() => {
      e._zod.run = e._zod.parse;
    });
  else {
    const o = (a, u, l) => {
      if (a.memo)
        return a;
      let d = oe(a), h;
      for (const b of u) {
        if (b._zod.def.when) {
          if (Co(a) || !b._zod.def.when(a))
            continue;
        } else if (d)
          continue;
        const y = a.issues.length, _ = b._zod.check(a);
        if (_ instanceof Promise && l?.async === !1)
          throw new ge();
        if (h || _ instanceof Promise)
          h = (h ?? Promise.resolve()).then(async () => {
            await _, a.issues.length !== y && (wt(a.issues, y, e), d || (d = oe(a, y)));
          });
        else {
          if (a.issues.length === y)
            continue;
          wt(a.issues, y, e), d || (d = oe(a, y));
        }
      }
      return h ? h.then(() => a) : a;
    }, s = (a, u, l) => {
      if (oe(a))
        return a.aborted = !0, a;
      const d = o(u, i, l);
      if (d instanceof Promise) {
        if (l.async === !1)
          throw new ge();
        return d.then((h) => e._zod.parse(h, l));
      }
      return e._zod.parse(d, l);
    };
    e._zod.run = (a, u) => {
      if (u.skipChecks)
        return e._zod.parse(a, u);
      if (u.direction === "backward") {
        const d = e._zod.parse({ value: a.value, issues: [] }, { ...u, skipChecks: !0 });
        return d instanceof Promise ? d.then((h) => s(h, a, u)) : s(d, a, u);
      }
      const l = e._zod.parse(a, u);
      if (l instanceof Promise) {
        if (u.async === !1)
          throw new ge();
        return l.then((d) => o(d, i, u));
      }
      return o(l, i, u);
    };
  }
}, {
  // Wrappers extend this by installing a richer factory over it; reading it eagerly would defeat the laziness.
  get "~standard"() {
    return jr(this, "~standard", Mr(this));
  },
  set "~standard"(e) {
    ue(this, "~standard", e);
  }
}), Lr = (e, t) => e.issues.length ? { issues: e.issues.map((n) => ce(n, t, ne())) } : { value: e.value };
async function ia(e, t) {
  const n = { async: !0 };
  return Lr(await e._zod.run({ value: t, issues: [] }, n), n);
}
function Mr(e) {
  return {
    validate: (t) => {
      const n = { async: !1 };
      try {
        const r = e._zod.run({ value: t, issues: [] }, n);
        if (!(r instanceof Promise))
          return Lr(r, n);
      } catch {
      }
      return ia(e, t);
    },
    vendor: "zod",
    version: 1
  };
}
const Xt = /* @__PURE__ */ p("$ZodString", (e, t) => {
  N.init(e, t), e._zod.pattern = t.pattern ?? Ls, e._zod.parse = (n, r) => {
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
}), z = /* @__PURE__ */ p("$ZodStringFormat", (e, t) => {
  ot.init(e, t), Xt.init(e, t);
}), oa = /* @__PURE__ */ p("$ZodGUID", (e, t) => {
  t.pattern ?? (t.pattern = ws), z.init(e, t);
}), sa = /* @__PURE__ */ p("$ZodUUID", (e, t) => {
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
    t.pattern ?? (t.pattern = _n(r));
  } else
    t.pattern ?? (t.pattern = _n());
  z.init(e, t);
}), aa = /* @__PURE__ */ p("$ZodEmail", (e, t) => {
  t.pattern ?? (t.pattern = ks), z.init(e, t);
}), Zr = 1, Ke = 2;
function Ur(e) {
  try {
    return typeof URL < "u" && typeof URL.canParse == "function" ? URL.canParse(e) : (new URL(e), !0);
  } catch {
    return !1;
  }
}
function ca(e, t) {
  return !("normalize" in t) && !("hostname" in t) && !("protocol" in t) ? Ur(e) || Ke : ua(e, t);
}
function ua(e, t) {
  if (!t.normalize && t.protocol?.source === Ns.source && !/^https?:\/\//i.test(e))
    return Zr;
  try {
    if (typeof URL < "u") {
      const n = URL;
      if (typeof n.parse == "function")
        return n.parse(e) ?? Ke;
    }
    return new URL(e);
  } catch {
    return Ke;
  }
}
const la = /[\t\n\r]/g;
function vn(e) {
  return e.replace(la, "");
}
function da(e, t) {
  return t.lastIndex = 0, t.test(e.hostname);
}
function pa(e, t) {
  return t.lastIndex = 0, t.test(e.protocol.endsWith(":") ? e.protocol.slice(0, -1) : e.protocol);
}
const fa = /* @__PURE__ */ p("$ZodURL", (e, t) => {
  z.init(e, t), e._zod.check = (n) => {
    try {
      const r = n.value.trim(), i = ca(r, t);
      if (i === Zr) {
        n.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid URL format",
          input: n.value,
          inst: e,
          continue: !t.abort
        });
        return;
      }
      if (i === Ke) {
        n.issues.push({
          code: "invalid_format",
          format: "url",
          input: n.value,
          inst: e,
          continue: !t.abort
        });
        return;
      }
      if (i === !0) {
        n.value = vn(r);
        return;
      }
      t.hostname && !da(i, t.hostname) && n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: t.hostname.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      }), t.protocol && !pa(i, t.protocol) && n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t.protocol.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      }), n.value = t.normalize ? i.href : vn(r);
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
}), ma = /* @__PURE__ */ p("$ZodEmoji", (e, t) => {
  t.pattern ?? (t.pattern = Ss()), z.init(e, t);
}), ha = /* @__PURE__ */ p("$ZodNanoID", (e, t) => {
  if (t.length !== void 0 && (!Number.isInteger(t.length) || t.length < 1))
    throw new Error(`Invalid nanoid length: ${t.length}`);
  t.pattern ?? (t.pattern = t.length === void 0 ? _s : vs(t.length)), z.init(e, t);
}), ga = /* @__PURE__ */ p("$ZodCUID", (e, t) => {
  t.pattern ?? (t.pattern = ms), z.init(e, t);
}), ya = /* @__PURE__ */ p("$ZodCUID2", (e, t) => {
  t.pattern ?? (t.pattern = hs), z.init(e, t);
}), ba = /* @__PURE__ */ p("$ZodULID", (e, t) => {
  t.pattern ?? (t.pattern = gs), z.init(e, t);
}), _a = /* @__PURE__ */ p("$ZodXID", (e, t) => {
  t.pattern ?? (t.pattern = ys), z.init(e, t);
}), va = /* @__PURE__ */ p("$ZodKSUID", (e, t) => {
  t.pattern ?? (t.pattern = bs), z.init(e, t);
}), Ia = /* @__PURE__ */ p("$ZodISODateTime", (e, t) => {
  t.pattern ?? (t.pattern = $s(t)), z.init(e, t);
}), wa = /* @__PURE__ */ p("$ZodISODate", (e, t) => {
  t.pattern ?? (t.pattern = Rs), z.init(e, t);
}), ka = /* @__PURE__ */ p("$ZodISOTime", (e, t) => {
  t.pattern ?? (t.pattern = Cs(t)), z.init(e, t);
}), Ta = /* @__PURE__ */ p("$ZodISODuration", (e, t) => {
  t.pattern ?? (t.pattern = Is), z.init(e, t);
}), Sa = /* @__PURE__ */ p("$ZodIPv4", (e, t) => {
  t.pattern ?? (t.pattern = As), z.init(e, t);
}), Aa = /^[0-9a-fA-F:.]+$/;
function Br(e) {
  return Aa.test(e) ? Ur(`http://[${e}]`) : !1;
}
const Pa = /* @__PURE__ */ p("$ZodIPv6", (e, t) => {
  t.pattern ?? (t.pattern = Ps), z.init(e, t), e._zod.check = (n) => {
    Br(n.value) || n.issues.push({
      code: "invalid_format",
      format: "ipv6",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Ea = /* @__PURE__ */ p("$ZodCIDRv4", (e, t) => {
  t.pattern ?? (t.pattern = Es), z.init(e, t);
});
function xa(e) {
  const t = e.split("/");
  if (t.length !== 2)
    return !1;
  const [n, r] = t;
  if (!r)
    return !1;
  const i = Number(r);
  return `${i}` !== r || i < 0 || i > 128 ? !1 : Br(n);
}
const Oa = /* @__PURE__ */ p("$ZodCIDRv6", (e, t) => {
  t.pattern ?? (t.pattern = xs), z.init(e, t), e._zod.check = (n) => {
    xa(n.value) || n.issues.push({
      code: "invalid_format",
      format: "cidrv6",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
});
function qr(e) {
  if (e === "")
    return !0;
  if (/\s/.test(e) || e.length % 4 !== 0)
    return !1;
  try {
    return atob(e), !0;
  } catch {
    return !1;
  }
}
const Fr = /^[0-9a-zA-Z+/]*={0,2}$/, ja = /* @__PURE__ */ p("$ZodBase64", (e, t) => {
  t.pattern ?? (t.pattern = Fr), z.init(e, t), e._zod.check = (n) => {
    qr(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Yt = /^[A-Za-z0-9_-]*$/;
function Na(e) {
  if (!Yt.test(e))
    return !1;
  const t = e.replace(/[-_]/g, (r) => r === "-" ? "+" : "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return qr(n);
}
const Da = /* @__PURE__ */ p("$ZodBase64URL", (e, t) => {
  t.pattern ?? (t.pattern = Yt), z.init(e, t), e._zod.check = (n) => {
    Na(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), za = /* @__PURE__ */ p("$ZodE164", (e, t) => {
  t.pattern ?? (t.pattern = Ds), z.init(e, t);
});
function Ra(e, t = null) {
  try {
    const n = e.split(".");
    if (n.length !== 3)
      return !1;
    const [r] = n;
    if (!r)
      return !1;
    const i = JSON.parse(atob(r));
    return !("typ" in i && i?.typ !== "JWT" || !i.alg || t && (!("alg" in i) || i.alg !== t));
  } catch {
    return !1;
  }
}
const Ca = /* @__PURE__ */ p("$ZodJWT", (e, t) => {
  z.init(e, t), e._zod.check = (n) => {
    Ra(n.value, t.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Gr = /* @__PURE__ */ p("$ZodNumber", (e, t) => {
  N.init(e, t), e._zod.pattern = Wt, e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = Number(n.value);
      } catch {
      }
    const i = n.value;
    if (typeof i == "number" && !Number.isNaN(i) && Number.isFinite(i))
      return n;
    const o = typeof i == "number" ? Number.isNaN(i) ? "NaN" : Number.isFinite(i) ? void 0 : String(i) : void 0;
    return n.issues.push({
      expected: "number",
      code: "invalid_type",
      input: i,
      inst: e,
      ...o ? { received: o } : {}
    }), n;
  };
}), $a = /* @__PURE__ */ p("$ZodNumberFormat", (e, t) => {
  Gs.init(e, t), Gr.init(e, t);
}), La = /* @__PURE__ */ p("$ZodBoolean", (e, t) => {
  N.init(e, t), e._zod.pattern = Zs, e._zod.parse = (n, r) => {
    if (t.coerce)
      try {
        n.value = !!n.value;
      } catch {
      }
    const i = n.value;
    return typeof i == "boolean" || n.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input: i,
      inst: e
    }), n;
  };
}), Ma = /* @__PURE__ */ p("$ZodNull", (e, t) => {
  N.init(e, t), e._zod.pattern = Us, e._zod.values = /* @__PURE__ */ new Set([null]), e._zod.parse = (n, r) => {
    const i = n.value;
    return i === null || n.issues.push({
      expected: "null",
      code: "invalid_type",
      input: i,
      inst: e
    }), n;
  };
}), Za = /* @__PURE__ */ p("$ZodUnknown", (e, t) => {
  N.init(e, t), e._zod.parse = (n) => n;
}), Ua = /* @__PURE__ */ p("$ZodNever", (e, t) => {
  N.init(e, t), e._zod.parse = (n, r) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: e
  }), n);
});
function Ba(e, t) {
  const n = hn(e._zod.def.checks);
  if (!n.length)
    return;
  const r = Math.min(...n.map((o) => o[0])), i = e._zod.parse;
  e._zod.parse = (o, s) => {
    const a = t(o.value);
    if (a > r && !s?.skipChecks && s?.direction !== "backward") {
      for (const [u, l] of hn(e._zod.def.checks))
        if (a > u && l._zod.def.when(o)) {
          const d = o.issues.length;
          return l._zod.check(o), o.issues[d].continue = !1, wt(o.issues, d, e), o;
        }
    }
    return i(o, s);
  };
}
const qa = (e) => Array.isArray(e) ? e.length : -1;
function In(e, t, n) {
  e.issues.length && t.issues.push(...ve(n, e.issues)), t.value[n] = e.value;
}
const Fa = /* @__PURE__ */ p("$ZodArray", (e, t) => {
  N.init(e, t);
  const n = te.memoizer;
  n?.attach(e), e._zod.parse = (r, i) => {
    const o = r.value;
    if (!Array.isArray(o))
      return r.issues.push({
        expected: "array",
        code: "invalid_type",
        input: o,
        inst: e
      }), r;
    r.value = n ? n.alloc(e, r, Array(o.length), i) : Array(o.length);
    const s = [], a = i?.abortEarly;
    for (let u = 0; u < o.length; u++) {
      const l = o[u], d = t.element._zod.run({
        value: l,
        issues: []
      }, i);
      if (d instanceof Promise)
        s.push(d.then((h) => In(h, r, u)));
      else if (In(d, r, u), a && d.issues.length !== 0 && oe(d))
        break;
    }
    return s.length ? Promise.all(s).then(() => r) : r;
  }, Ba(e, qa);
});
function Ve(e, t, n, r, i, o) {
  const s = n in r, a = o === "optional";
  if (!(!s && a && i === "optional")) {
    if (e.issues.length) {
      if (i !== void 0 && a && !s)
        return;
      t.issues.push(...ve(n, e.issues));
    }
    if (!s && i === void 0) {
      e.issues.length || t.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [n]
      });
      return;
    }
    e.value === void 0 ? (s || i === "defaulted" && !a) && (t.value[n] = void 0) : t.value[n] = e.value;
  }
}
const Ga = [];
function Kr(e) {
  const t = Object.keys(e.shape), n = Object.getOwnPropertySymbols(e.shape), r = n.length ? n : Ga, i = r.length ? [...t, ...r] : t;
  for (const s of i)
    if (!e.shape?.[s]?._zod?.traits?.has("$ZodType"))
      throw new Error(`Invalid element at key "${String(s)}": expected a Zod schema`);
  const o = Eo(e.shape);
  return {
    ...e,
    allKeys: i,
    symbolKeys: r,
    // string-only: handleCatchall matches it against `for...in`, which never yields a symbol
    keySet: new Set(t),
    numKeys: t.length,
    optionalKeys: new Set(o)
  };
}
function Vr(e, t, n, r, i, o, s) {
  const a = [], u = i.keySet, l = i.catchall._zod, d = l.def.type, h = l.optin, b = l.optout;
  let y = 0;
  for (const _ in t) {
    if (s && n.issues.length !== y) {
      if (oe(n, y))
        break;
      y = n.issues.length;
    }
    if (u.has(_))
      continue;
    if (_ === "__proto__") {
      d === "never" && a.push(_);
      continue;
    }
    if (d === "never") {
      a.push(_);
      continue;
    }
    const T = l.run({ value: t[_], issues: [] }, r);
    T instanceof Promise ? e.push(T.then((I) => Ve(I, n, _, t, h, b))) : Ve(T, n, _, t, h, b);
  }
  return a.length && n.issues.push({
    code: "unrecognized_keys",
    keys: a,
    input: t,
    inst: o,
    // Describes the shape of the input, not the validity of the parsed value, so it never aborts. The parse still fails; the schema's own checks just get to run first, and an enclosing intersection can reconcile the key against a sibling operand.
    continue: !0
  }), e.length ? Promise.all(e).then(() => n) : n;
}
const Ka = /* @__PURE__ */ p("$ZodObject", (e, t) => {
  N.init(e, t);
  const n = Object.getOwnPropertyDescriptor(t, "shape"), r = n?.get ? n.get.raw : t.shape ?? {};
  if (r) {
    const l = () => {
      const d = { ...r };
      return Object.defineProperty(t, "shape", { value: d }), l.raw = d, d;
    };
    l.raw = r, Object.defineProperty(t, "shape", { get: l });
  }
  const i = Ut(() => Kr(t));
  x(e, "propValues", (l) => {
    const d = l.def.shape, h = {};
    for (const b in d) {
      const y = d[b]._zod;
      if (y.values) {
        Object.prototype.hasOwnProperty.call(h, b) || me(h, b, /* @__PURE__ */ new Set());
        for (const _ of y.values)
          h[b].add(_);
        y.optin !== void 0 && h[b].add(void 0);
      }
    }
    return h;
  });
  const o = Fe, s = t.catchall;
  let a;
  const u = te.memoizer;
  u?.attach(e), e._zod.parse = (l, d) => {
    a ?? (a = i.value);
    const h = l.value;
    if (!o(h))
      return l.issues.push({
        expected: "object",
        code: "invalid_type",
        input: h,
        inst: e
      }), l;
    l.value = u ? u.alloc(e, l, {}, d) : {};
    const b = [], y = a.shape, _ = d?.abortEarly;
    let T = l.issues.length;
    for (const I of a.allKeys) {
      if (_ && l.issues.length !== T) {
        if (oe(l, T))
          break;
        T = l.issues.length;
      }
      if (I === "__proto__")
        continue;
      const O = y[I], J = O._zod.optin, xe = O._zod.optout, Oe = O._zod.run({ value: h[I], issues: [] }, d);
      Oe instanceof Promise ? b.push(Oe.then((Z) => Ve(Z, l, I, h, J, xe))) : Ve(Oe, l, I, h, J, xe);
    }
    return s ? Vr(b, h, l, d, i.value, e, _ === !0) : b.length ? Promise.all(b).then(() => l) : l;
  };
}), Va = /* @__PURE__ */ p("$ZodObjectJIT", (e, t) => {
  Ka.init(e, t);
  const n = e._zod.parse, r = Ut(() => Kr(t)), i = te.memoizer, o = (y) => {
    const _ = r.value, T = _.symbolKeys, I = new na(["payload", "ctx"], { shape: y, inst: e, memo: i, syms: T }), O = (Z) => `shape[${Z}]._zod.run({ value: input[${Z}], issues: [] }, ctx)`, J = (Z, j) => `
          let ${Z}_ab = false;
          for (let i = 0; i < ${Z}.issues.length; i++) {
            const iss = ${Z}.issues[i];
            iss.path = iss.path ? [${j}, ...iss.path] : [${j}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${Z}_ab = true;
          }
          if (${Z}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
    I.write("const input = payload.value;");
    const xe = /* @__PURE__ */ Object.create(null);
    let Oe = 0;
    for (const Z of _.allKeys)
      xe[Z] = `key_${Oe++}`;
    I.write(i ? "const newResult = memo.alloc(inst, payload, {}, ctx);" : "const newResult = {};");
    for (const Z of _.allKeys) {
      if (Z === "__proto__")
        continue;
      const j = xe[Z], re = typeof Z == "symbol" ? `syms[${T.indexOf(Z)}]` : To(Z), ct = `${re} in input`, sn = y[Z], ut = sn?._zod?.optin, an = ut !== void 0, Ui = sn?._zod?.optout === "optional";
      if (I.write(`const ${j} = ${O(re)};`), an && Ui) {
        const Bi = ut === "optional" ? `${j}_present` : `${j}.value !== undefined || ${j}_present`;
        I.write(`
        const ${j}_present = ${ct};
        if (!${j}.issues.length || ${j}_present) {
          if (${j}.issues.length) {${J(j, re)}
          }

          if (${Bi}) {
            newResult[${re}] = ${j}.value;
          }
        }

      `);
      } else an ? (I.write(`
        if (${j}.issues.length) {${J(j, re)}
        }
      `), ut === "defaulted" ? I.write(`newResult[${re}] = ${j}.value;`) : I.write(`
        if (${j}.value !== undefined || ${ct}) {
          newResult[${re}] = ${j}.value;
        }
      `)) : I.write(`
        const ${j}_present = ${ct};
        if (${j}.issues.length) {${J(j, re)}
        }
        if (!${j}_present && !${j}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${re}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${j}_present) {
          newResult[${re}] = ${j}.value;
        }

      `);
    }
    return I.write("payload.value = newResult;"), I.write("return payload;"), I.compile();
  };
  let s;
  const a = Fe, u = !te.jitless, d = u && Ao.value, h = t.catchall;
  let b;
  e._zod.parse = (y, _) => {
    b ?? (b = r.value);
    const T = y.value;
    return a(T) ? u && d && _?.async === !1 && _.jitless !== !0 ? (s || (s = o(t.shape)), y = s(y, _), h ? Vr([], T, y, _, b, e, _?.abortEarly === !0) : y) : n(y, _) : (y.issues.push({
      expected: "object",
      code: "invalid_type",
      input: T,
      inst: e
    }), y);
  };
});
function wn(e, t, n, r) {
  for (const o of e)
    if (o.issues.length === 0)
      return t.value = o.value, t;
  const i = e.filter((o) => !oe(o));
  return i.length === 1 ? (t.value = i[0].value, i[0]) : (t.issues.push({
    code: "invalid_union",
    input: t.value,
    inst: n,
    errors: e.map((o) => o.issues.map((s) => ce(s, r, ne())))
  }), t);
}
const Ja = /* @__PURE__ */ p("$ZodUnion", (e, t) => {
  N.init(e, t), x(e, "optin", (r) => r.def.options.some((i) => i._zod.optin === "defaulted") ? "defaulted" : r.def.options.some((i) => i._zod.optin !== void 0) ? "optional" : void 0), x(e, "optout", (r) => r.def.options.some((i) => i._zod.optout === "optional") ? "optional" : void 0), x(e, "values", (r) => {
    if (r.def.options.every((i) => i._zod.values))
      return new Set(r.def.options.flatMap((i) => Array.from(i._zod.values)));
  }), x(e, "pattern", (r) => {
    if (r.def.options.every((i) => i._zod.pattern)) {
      const i = r.def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${i.map((o) => Bt(o.source)).join("|")})$`);
    }
  });
  const n = t.options.length === 1 ? t.options[0]._zod.run : null;
  e._zod.parse = (r, i) => {
    if (n)
      return n(r, i);
    let o = !1;
    const s = [];
    for (const a of t.options) {
      const u = a._zod.run({
        value: r.value,
        issues: []
      }, i);
      if (u instanceof Promise)
        s.push(u), o = !0;
      else {
        if (u.issues.length === 0)
          return u;
        s.push(u);
      }
    }
    return o ? Promise.all(s).then((a) => wn(a, r, e, i)) : wn(s, r, e, i);
  };
}), Wa = /* @__PURE__ */ p("$ZodIntersection", (e, t) => {
  N.init(e, t), e._zod.parse = (n, r) => {
    const i = n.value, o = t.left._zod.run({ value: i, issues: [] }, r), s = t.right._zod.run({ value: i, issues: [] }, r);
    return o instanceof Promise || s instanceof Promise ? Promise.all([o, s]).then(([u, l]) => kn(n, u, l)) : kn(n, o, s);
  };
});
function Tt(e, t) {
  if (e === t)
    return { valid: !0, data: e };
  if (e instanceof Date && t instanceof Date && +e == +t)
    return { valid: !0, data: e };
  if (Te(e) && Te(t)) {
    const n = Object.keys(t), r = Object.keys(e).filter((o) => n.indexOf(o) !== -1), i = { ...e, ...t };
    Object.prototype.hasOwnProperty.call(i, "__proto__") && delete i.__proto__;
    for (const o of r) {
      if (o === "__proto__")
        continue;
      const s = Tt(e[o], t[o]);
      if (!s.valid)
        return {
          valid: !1,
          mergeErrorPath: [o, ...s.mergeErrorPath]
        };
      i[o] = s.data;
    }
    return { valid: !0, data: i };
  }
  if (Array.isArray(e) && Array.isArray(t)) {
    if (e.length !== t.length)
      return { valid: !1, mergeErrorPath: [] };
    const n = [];
    for (let r = 0; r < e.length; r++) {
      const i = e[r], o = t[r], s = Tt(i, o);
      if (!s.valid)
        return {
          valid: !1,
          mergeErrorPath: [r, ...s.mergeErrorPath]
        };
      n.push(s.data);
    }
    return { valid: !0, data: n };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function kn(e, t, n) {
  const r = /* @__PURE__ */ new Map();
  let i;
  const o = /* @__PURE__ */ new Map(), s = (l, d) => {
    let h;
    if (l.code === "unrecognized_keys" && !l.path?.length)
      i ?? (i = l), h = l.keys;
    else if (l.code === "invalid_key" && l.origin === "record" && l.path?.length === 1) {
      const b = String(l.path[0]);
      o.has(b) || o.set(b, l), h = [b];
    } else
      return !1;
    for (const b of h)
      r.has(b) || r.set(b, {}), r.get(b)[d] = !0;
    return !0;
  };
  for (const l of t.issues)
    s(l, "l") || e.issues.push(l);
  for (const l of n.issues)
    s(l, "r") || e.issues.push(l);
  const a = [...r].filter(([, l]) => l.l && l.r).map(([l]) => l);
  if (a.length) {
    const l = i ? a.filter((d) => i.keys.includes(d)) : [];
    l.length && e.issues.push({ ...i, keys: l });
    for (const d of a)
      !l.includes(d) && o.has(d) && e.issues.push(o.get(d));
  }
  const u = Tt(t.value, n.value);
  if (!u.valid) {
    if (oe(e))
      return e;
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(u.mergeErrorPath)}`);
  }
  return e.value = u.data, e;
}
const Ha = /* @__PURE__ */ p("$ZodRecord", (e, t) => {
  N.init(e, t);
  const n = te.memoizer;
  n?.attach(e), e._zod.parse = (r, i) => {
    const o = r.value;
    if (!Te(o))
      return r.issues.push({
        expected: "record",
        code: "invalid_type",
        input: o,
        inst: e
      }), r;
    const s = [], a = t.keyType._zod.values;
    if (a && !t.partial) {
      r.value = n ? n.alloc(e, r, {}, i) : {};
      const u = /* @__PURE__ */ new Set();
      for (const d of a)
        if (typeof d == "string" || typeof d == "number" || typeof d == "symbol") {
          if (u.add(typeof d == "number" ? d.toString() : d), d === "__proto__")
            continue;
          const h = t.keyType._zod.run({ value: d, issues: [] }, i);
          if (h instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          if (h.issues.length) {
            r.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: h.issues.map((_) => ce(_, i, ne())),
              input: d,
              path: [d],
              inst: e
            });
            continue;
          }
          const b = h.value;
          if (b === "__proto__")
            continue;
          const y = t.valueType._zod.run({ value: o[d], issues: [] }, i);
          y instanceof Promise ? s.push(y.then((_) => {
            _.issues.length && r.issues.push(...ve(d, _.issues)), r.value[b] = _.value;
          })) : (y.issues.length && r.issues.push(...ve(d, y.issues)), r.value[b] = y.value);
        }
      let l;
      for (const d in o)
        if (!u.has(d))
          if (t.mode === "loose") {
            if (d === "__proto__")
              continue;
            r.value[d] = o[d];
          } else
            l = l ?? [], l.push(d);
      l && l.length > 0 && r.issues.push({
        code: "unrecognized_keys",
        input: o,
        inst: e,
        keys: l,
        continue: !0
      });
    } else {
      r.value = n ? n.alloc(e, r, {}, i) : {};
      let u;
      for (const l of Reflect.ownKeys(o)) {
        if (l === "__proto__" || !Object.prototype.propertyIsEnumerable.call(o, l))
          continue;
        let d = t.keyType._zod.run({ value: l, issues: [] }, i);
        if (d instanceof Promise)
          throw new Error("Async schemas not supported in object keys currently");
        if (typeof l == "string" && Wt.test(l) && d.issues.length) {
          const _ = t.keyType._zod.run({ value: Number(l), issues: [] }, i);
          if (_ instanceof Promise)
            throw new Error("Async schemas not supported in object keys currently");
          _.issues.length === 0 && (d = _);
        }
        if (d.issues.length) {
          t.mode === "loose" ? r.value[l] = o[l] : a ? (u = u ?? [], u.push(l)) : r.issues.push({
            code: "invalid_key",
            origin: "record",
            issues: d.issues.map((_) => ce(_, i, ne())),
            input: l,
            path: [l],
            inst: e
          });
          continue;
        }
        const b = d.value;
        if (b === "__proto__")
          continue;
        const y = t.valueType._zod.run({ value: o[l], issues: [] }, i);
        y instanceof Promise ? s.push(y.then((_) => {
          _.issues.length && r.issues.push(...ve(l, _.issues)), r.value[b] = _.value;
        })) : (y.issues.length && r.issues.push(...ve(l, y.issues)), r.value[b] = y.value);
      }
      u && u.length > 0 && r.issues.push({
        code: "unrecognized_keys",
        input: o,
        inst: e,
        keys: u,
        continue: !0
      });
    }
    return s.length ? Promise.all(s).then(() => r) : r;
  };
}), Xa = /* @__PURE__ */ p("$ZodEnum", (e, t) => {
  N.init(e, t);
  const n = vt(t.entries), r = new Set(n);
  e._zod.values = r, x(e, "pattern", (i) => {
    const o = vt(i.def.entries).filter((s) => Po.has(typeof s));
    return new RegExp(o.length ? `^(${o.map((s) => Se(s.toString())).join("|")})$` : "^[^\\s\\S]$");
  }), e._zod.parse = (i, o) => {
    const s = i.value;
    return r.has(s) || i.issues.push({
      code: "invalid_value",
      values: n,
      input: s,
      inst: e
    }), i;
  };
}), Ya = /* @__PURE__ */ p("$ZodLiteral", (e, t) => {
  N.init(e, t);
  const n = new Set(t.values);
  e._zod.values = n, x(e, "pattern", (r) => {
    const i = r.def.values;
    return new RegExp(i.length ? `^(${i.map((o) => typeof o == "string" ? Se(o) : o ? Se(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
  }), e._zod.parse = (r, i) => {
    const o = r.value;
    return n.has(o) || r.issues.push({
      code: "invalid_value",
      values: t.values,
      input: o,
      inst: e
    }), r;
  };
}), Qa = /* @__PURE__ */ p("$ZodTransform", (e, t) => {
  N.init(e, t), e._zod.optin = "optional", te.memoizer?.guard(e), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new Dr(e.constructor.name);
    const i = t.transform(n.value, n);
    if (r.async)
      return (i instanceof Promise ? i : Promise.resolve(i)).then((s) => (n.value = s, n));
    if (i instanceof Promise)
      throw new ge();
    return n.value = i, n;
  };
});
function Tn(e, t) {
  return e.value = t.issues.length ? void 0 : t.value, e;
}
const Jr = /* @__PURE__ */ p("$ZodOptional", (e, t) => {
  N.init(e, t), x(e, "optin", (n) => n.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional"), e._zod.optout = "optional", x(e, "values", (n) => {
    const r = n.def.innerType._zod.values;
    return r ? /* @__PURE__ */ new Set([...r, void 0]) : void 0;
  }), x(e, "pattern", (n) => {
    const r = n.def.innerType._zod.pattern;
    return r ? new RegExp(`^(${Bt(r.source)})?$`) : void 0;
  }), e._zod.parse = (n, r) => {
    if (n.value === void 0) {
      if (t.innerType._zod.optin !== "defaulted")
        return n;
      const i = t.innerType._zod.run({ value: n.value, issues: [] }, r);
      return i instanceof Promise ? i.then((o) => Tn(n, o)) : Tn(n, i);
    }
    return t.innerType._zod.run(n, r);
  };
}), ec = /* @__PURE__ */ p("$ZodExactOptional", (e, t) => {
  Jr.init(e, t), x(e, "values", (n) => n.def.innerType._zod.values), x(e, "pattern", (n) => n.def.innerType._zod.pattern), e._zod.parse = (n, r) => t.innerType._zod.run(n, r);
}), tc = /* @__PURE__ */ p("$ZodNullable", (e, t) => {
  N.init(e, t), x(e, "optin", (n) => n.def.innerType._zod.optin), x(e, "optout", (n) => n.def.innerType._zod.optout), x(e, "pattern", (n) => {
    const r = n.def.innerType._zod.pattern;
    return r ? new RegExp(`^(${Bt(r.source)}|null)$`) : void 0;
  }), x(e, "values", (n) => n.def.innerType._zod.values ? /* @__PURE__ */ new Set([...n.def.innerType._zod.values, null]) : void 0), e._zod.parse = (n, r) => n.value === null ? n : t.innerType._zod.run(n, r);
}), nc = /* @__PURE__ */ p("$ZodDefault", (e, t) => {
  N.init(e, t), e._zod.optin = "defaulted", x(e, "values", (n) => n.def.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    if (n.value === void 0)
      return n.value = t.defaultValue, n;
    const i = t.innerType._zod.run(n, r);
    return i instanceof Promise ? i.then((o) => Sn(o, t)) : Sn(i, t);
  };
});
function Sn(e, t) {
  return e.value === void 0 && (e.value = t.defaultValue), e;
}
const rc = /* @__PURE__ */ p("$ZodPrefault", (e, t) => {
  N.init(e, t), e._zod.optin = "defaulted", x(e, "values", (n) => n.def.innerType._zod.values), e._zod.parse = (n, r) => (r.direction === "backward" || n.value === void 0 && (n.value = t.defaultValue), t.innerType._zod.run(n, r));
}), ic = /* @__PURE__ */ p("$ZodNonOptional", (e, t) => {
  N.init(e, t), x(e, "values", (n) => {
    const r = n.def.innerType._zod.values;
    return r ? new Set([...r].filter((i) => i !== void 0)) : void 0;
  }), e._zod.parse = (n, r) => {
    const i = t.innerType._zod.run(n, r);
    return i instanceof Promise ? i.then((o) => An(o, e)) : An(i, e);
  };
});
function An(e, t) {
  return !e.issues.length && e.value === void 0 && e.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e.value,
    inst: t
  }), e;
}
function Pn(e, t, n, r) {
  return t.issues.length ? (e.value = n.catchValue({
    ...t,
    value: e.value,
    error: {
      issues: t.issues.map((i) => ce(i, r, ne()))
    },
    input: e.value
  }), e) : (e.value = t.value, t.memo && (e.memo = !0), e);
}
const oc = /* @__PURE__ */ p("$ZodCatch", (e, t) => {
  N.init(e, t), x(e, "optin", (n) => n.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional"), x(e, "optout", (n) => n.def.innerType._zod.optout), x(e, "values", (n) => n.def.innerType._zod.values), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const i = t.innerType._zod.run({ value: n.value, issues: [] }, r);
    return i instanceof Promise ? i.then((o) => Pn(n, o, t, r)) : Pn(n, i, t, r);
  };
}), Wr = /* @__PURE__ */ p("$ZodPipe", (e, t) => {
  N.init(e, t), x(e, "values", (n) => n.def.in._zod.values), x(e, "optin", (n) => n.def.in._zod.optin), x(e, "optout", (n) => n.def.out._zod.optout), x(e, "propValues", (n) => n.def.in._zod.propValues), e._zod.parse = (n, r) => {
    if (r.direction === "backward") {
      const o = t.out._zod.run(n, r);
      return o instanceof Promise ? o.then((s) => $e(s, t.in, r)) : $e(o, t.in, r);
    }
    const i = t.in._zod.run(n, r);
    return i instanceof Promise ? i.then((o) => $e(o, t.out, r)) : $e(i, t.out, r);
  };
});
function $e(e, t, n) {
  return e.issues.some((r) => r.code !== "unrecognized_keys") ? (e.aborted = !0, e) : t._zod.run({ value: e.value, issues: e.issues }, n);
}
const sc = /* @__PURE__ */ p("$ZodPreprocess", (e, t) => {
  Wr.init(e, t);
}), ac = /* @__PURE__ */ p("$ZodReadonly", (e, t) => {
  N.init(e, t), x(e, "propValues", (n) => n.def.innerType._zod.propValues), x(e, "values", (n) => n.def.innerType._zod.values), x(e, "optin", (n) => n.def.innerType?._zod?.optin), x(e, "optout", (n) => n.def.innerType?._zod?.optout), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      return t.innerType._zod.run(n, r);
    const i = t.innerType._zod.run(n, r);
    return i instanceof Promise ? i.then(En) : En(i);
  };
});
function En(e) {
  return e.memo || (e.value = Object.freeze(e.value)), e;
}
const cc = /* @__PURE__ */ p("$ZodLazy", (e, t) => {
  N.init(e, t), wo(e._zod, "innerType", () => {
    const n = t;
    return n._cachedInner || (n._cachedInner = t.getter()), n._cachedInner;
  }), x(e, "pattern", (n) => n.innerType?._zod?.pattern), x(e, "propValues", (n) => n.innerType?._zod?.propValues), x(e, "optin", (n) => n.innerType?._zod?.optin ?? void 0), x(e, "optout", (n) => n.innerType?._zod?.optout ?? void 0), e._zod.parse = (n, r) => e._zod.innerType._zod.run(n, r);
}), uc = /* @__PURE__ */ p("$ZodCustom", (e, t) => {
  K.init(e, t), N.init(e, t), e._zod.parse = (n, r) => n, e._zod.check = (n) => {
    const r = n.value, i = t.fn(r);
    if (i instanceof Promise)
      return i.then((o) => xn(o, n, r, e));
    xn(i, n, r, e);
  };
});
function xn(e, t, n, r) {
  if (!e) {
    const i = {
      code: "custom",
      input: n,
      inst: r,
      // incorporates params.error into issue reporting
      path: [...r._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !r._zod.def.abort
      // params: inst._zod.def.params,
    };
    r._zod.def.params && (i.params = r._zod.def.params), t.issues.push(Ce(i));
  }
}
class lc extends Error {
  constructor() {
    super("Cannot parse a reference cycle that closes through a transform"), this.name = "ZodCyclicError";
  }
}
const St = "~memo", On = [];
function Hr(e) {
  return e !== null && typeof e == "object";
}
function ft(e) {
  return e.map((t) => t.path ? { ...t, path: t.path.slice() } : { ...t });
}
const Xr = /* @__PURE__ */ new WeakMap(), Ne = 0, Be = 1, ze = 2;
function qe(e, t, n) {
  const r = Xr.get(e);
  if (r !== void 0)
    return r ? ze : Ne;
  if (t.has(e))
    return ze;
  t.add(e);
  let i = Ne;
  const o = (d) => {
    if (i !== ze && d?._zod) {
      const h = qe(d, t);
      h > i && (i = h);
    }
  }, s = (d, h) => {
    let b = Ne;
    for (const y of Reflect.ownKeys(d)) {
      const _ = Object.getOwnPropertyDescriptor(d, y);
      if (!_.enumerable)
        continue;
      const T = _.get ? Be : _.value?._zod ? qe(_.value, t) : Ne;
      T > b && (b = T);
    }
    return b;
  }, a = (d) => {
    d > i && (i = d);
  }, u = e._zod.def;
  switch (u.type) {
    case "object": {
      const d = kr(u);
      a(d ? s(d) : Be), o(u.catchall);
      break;
    }
    case "array":
      o(u.element);
      break;
    case "tuple":
      for (const d of u.items)
        o(d);
      o(u.rest);
      break;
    case "record":
    case "map":
      o(u.keyType), o(u.valueType);
      break;
    case "set":
      o(u.valueType);
      break;
    case "union":
      for (const d of u.options)
        o(d);
      break;
    case "intersection":
      o(u.left), o(u.right);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
    case "promise":
    case "success":
      o(u.innerType);
      break;
    case "pipe":
      o(u.in), o(u.out);
      break;
    case "function":
      o(u.input), o(u.output);
      break;
    // `$ZodLazy` caches its inner on the def, so a resolved edge is followed exactly
    case "lazy": {
      const d = u._cachedInner ?? void 0;
      a(d ? qe(d, t) : Be);
      break;
    }
    // a leaf by choice: `parts` are regex fragments, not data positions
    case "template_literal":
    // leaves
    case "string":
    case "number":
    case "int":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
    case "null":
    case "void":
    case "never":
    case "any":
    case "unknown":
    case "date":
    case "nan":
    case "enum":
    case "literal":
    case "file":
    case "transform":
    case "custom":
      break;
    default:
      for (const d in u) {
        const h = Object.getOwnPropertyDescriptor(u, d);
        if (!h || h.get)
          continue;
        const b = h.value;
        if (!(!b || typeof b != "object")) {
          if (b._zod)
            o(b);
          else if (Array.isArray(b))
            for (const y of b)
              o(y);
        }
      }
  }
  return t.delete(e), dc(e, i);
}
function dc(e, t) {
  return t !== Be && Xr.set(e, t === ze), t;
}
function pc(e, t) {
  let n = e.buckets.get(t);
  return n || (n = /* @__PURE__ */ new WeakMap(), e.buckets.set(t, n)), n;
}
let Le;
const Me = [], fc = {
  alloc(e, t, n) {
    const r = Le;
    if (!r)
      return n;
    Le = void 0;
    const i = { value: n, issues: null };
    return r.set(t.value, i), Me.push(i), n;
  },
  guard(e) {
    var t;
    (t = e._zod).deferred ?? (t.deferred = []), e._zod.deferred.push(() => {
      const n = e._zod.parse, r = (i, o) => {
        if (o.direction !== "backward" && hc(o, i.value))
          throw new lc();
        return n(i, o);
      };
      e._zod.parse = r, e._zod.run === n && (e._zod.run = r);
    });
  },
  attach(e) {
    var t;
    let n, r = !1, i, o;
    (t = e._zod).deferred ?? (t.deferred = []), e._zod.deferred.push(() => {
      const s = e._zod.parse, a = (u, l) => {
        if (n === void 0) {
          const O = qe(e, /* @__PURE__ */ new Set());
          if (O === Ne)
            return e._zod.parse = s, e._zod.run === a && (e._zod.run = s), s(u, l);
          O === ze || r ? n = !0 : r = !0;
        }
        const d = u.value;
        if (!Hr(d))
          return s(u, l);
        let h = l[St];
        h || (h = { buckets: /* @__PURE__ */ new WeakMap(), backEdges: void 0 }, l[St] = h);
        let b;
        i === l ? b = o : (b = pc(h, e), i = l, o = b);
        const y = b.get(d);
        if (y)
          return u.value = y.value, y.issues ? y.issues.length && u.issues.push(...ft(y.issues)) : (u.memo = !0, h.backEdges ?? (h.backEdges = /* @__PURE__ */ new WeakSet()), h.backEdges.add(y.value)), u;
        Le = b;
        const _ = Me.length, T = s(u, l);
        Le = void 0;
        const I = Me.length > _ ? Me.pop() : void 0;
        return T instanceof Promise ? T.then((O) => (I && (I.issues = O.issues.length ? ft(O.issues) : On), O)) : (I && (I.issues = T.issues.length ? ft(T.issues) : On), T);
      };
      e._zod.parse = a, e._zod.run === s && (e._zod.run = a);
    });
  }
};
function mc() {
  return fc;
}
function hc(e, t) {
  const n = e[St]?.backEdges;
  return n !== void 0 && Hr(t) && n.has(t);
}
const gc = () => {
  const e = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function t(o) {
    return e[o] ?? null;
  }
  const n = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    currency_code: "currency code",
    credit_card: "credit card number",
    iban: "IBAN",
    jwt: "JWT",
    template_literal: "input"
  }, r = {
    // Compatibility: "nan" -> "NaN" for display
    nan: "NaN"
    // All other type names omitted - they fall back to raw values via ?? operator
  };
  function i(o, s) {
    return o === "number" && typeof s == "number" && !Number.isFinite(s) ? String(s) : r[o] ?? o;
  }
  return (o) => {
    switch (o.code) {
      case "invalid_type": {
        const s = i(o.expected), a = Lo(o.input), u = i(a, o.input);
        return `Invalid input: expected ${s}, received ${u}`;
      }
      case "invalid_value":
        return o.values.length === 1 ? `Invalid input: expected ${Er(o.values[0])}` : `Invalid option: expected one of ${pn(o.values, "|")}`;
      case "too_big": {
        const s = o.exact ? "exactly " : o.inclusive ? "<=" : "<", a = t(o.origin);
        return a ? `Too big: expected ${o.origin ?? "value"} to have ${s}${o.maximum.toString()} ${a.unit ?? "elements"}` : `Too big: expected ${o.origin ?? "value"} to be ${s}${o.maximum.toString()}`;
      }
      case "too_small": {
        const s = o.exact ? "exactly " : o.inclusive ? ">=" : ">", a = t(o.origin);
        return a ? `Too small: expected ${o.origin} to have ${s}${o.minimum.toString()} ${a.unit}` : `Too small: expected ${o.origin} to be ${s}${o.minimum.toString()}`;
      }
      case "invalid_format": {
        const s = o;
        return s.format === "starts_with" ? `Invalid string: must start with "${s.prefix}"` : s.format === "ends_with" ? `Invalid string: must end with "${s.suffix}"` : s.format === "includes" ? `Invalid string: must include "${s.includes}"` : s.format === "regex" ? `Invalid string: must match pattern ${s.pattern}` : `Invalid ${n[s.format] ?? o.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${o.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${o.keys.length > 1 ? "s" : ""}: ${pn(o.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${o.origin}`;
      case "invalid_union":
        return o.options && Array.isArray(o.options) && o.options.length > 0 ? `Invalid discriminator value. Expected ${o.options.map((a) => `'${a}'`).join(" | ")}` : o.inclusive === !1 ? "Invalid input: more than one option matched" : "Invalid input";
      case "invalid_element":
        return `Invalid value in ${o.origin}`;
      default:
        return "Invalid input";
    }
  };
};
function yc() {
  return {
    localeError: gc()
  };
}
var jn;
class bc {
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
      const i = { ...r, ...this._map.get(t) };
      return Object.keys(i).length ? i : void 0;
    }
    return this._map.get(t);
  }
  has(t) {
    return this._map.has(t);
  }
}
function _c() {
  return new bc();
}
(jn = globalThis).__zod_globalRegistry ?? (jn.__zod_globalRegistry = _c());
const De = globalThis.__zod_globalRegistry;
function Yr(e) {
  return e.checks && (e.checks = [...e.checks]), e;
}
// @__NO_SIDE_EFFECTS__
function vc(e, t) {
  return new e(Yr({ type: "string", ...k(t) }));
}
// @__NO_SIDE_EFFECTS__
function Ic(e, t) {
  return new e({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function wc(e, t) {
  return new e({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function kc(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Tc(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v4",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Sc(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v6",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ac(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v7",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Pc(e, t) {
  return new e({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ec(e, t) {
  return new e({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function xc(e, t) {
  return new e({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Oc(e, t) {
  return new e({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function jc(e, t) {
  return new e({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Nc(e, t) {
  return new e({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Dc(e, t) {
  return new e({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function zc(e, t) {
  return new e({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Rc(e, t) {
  return new e({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Cc(e, t) {
  return new e({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function $c(e, t) {
  return new e({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Lc(e, t) {
  return new e({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Mc(e, t) {
  return new e({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Zc(e, t) {
  return new e({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Uc(e, t) {
  return new e({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Bc(e, t) {
  return new e({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function qc(e, t) {
  return new e({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Fc(e, t) {
  return new e({
    type: "string",
    format: "date",
    check: "string_format",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Gc(e, t) {
  return new e({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Kc(e, t) {
  return new e({
    type: "string",
    format: "duration",
    check: "string_format",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Vc(e, t) {
  return new e(Yr({ type: "number", checks: [], ...k(t) }));
}
// @__NO_SIDE_EFFECTS__
function Jc(e, t) {
  return new e({
    type: "number",
    check: "number_format",
    abort: !1,
    format: "safeint",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Wc(e, t) {
  return new e({
    type: "boolean",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Hc(e, t) {
  return new e({
    type: "null",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Xc(e) {
  return new e({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function Yc(e, t) {
  return new e({
    type: "never",
    ...k(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Nn(e, t) {
  return new Cr({
    check: "less_than",
    ...k(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function mt(e, t) {
  return new Cr({
    check: "less_than",
    ...k(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function Dn(e, t) {
  return new $r({
    check: "greater_than",
    ...k(t),
    value: e,
    inclusive: !1
  });
}
// @__NO_SIDE_EFFECTS__
function ht(e, t) {
  return new $r({
    check: "greater_than",
    ...k(t),
    value: e,
    inclusive: !0
  });
}
// @__NO_SIDE_EFFECTS__
function zn(e, t) {
  return new Fs({
    check: "multiple_of",
    ...k(t),
    value: e
  });
}
// @__NO_SIDE_EFFECTS__
function Qr(e, t) {
  return new Ks({
    check: "max_length",
    ...k(t),
    maximum: e
  });
}
// @__NO_SIDE_EFFECTS__
function Je(e, t) {
  return new Vs({
    check: "min_length",
    ...k(t),
    minimum: e
  });
}
// @__NO_SIDE_EFFECTS__
function ei(e, t) {
  return new Js({
    check: "length_equals",
    ...k(t),
    length: e
  });
}
// @__NO_SIDE_EFFECTS__
function Qc(e, t) {
  return new Ws({
    check: "string_format",
    format: "regex",
    ...k(t),
    pattern: e
  });
}
// @__NO_SIDE_EFFECTS__
function eu(e) {
  return new Hs({
    check: "string_format",
    format: "lowercase",
    ...k(e)
  });
}
// @__NO_SIDE_EFFECTS__
function tu(e) {
  return new Xs({
    check: "string_format",
    format: "uppercase",
    ...k(e)
  });
}
// @__NO_SIDE_EFFECTS__
function nu(e, t) {
  return new Ys({
    check: "string_format",
    format: "includes",
    ...k(t),
    includes: e
  });
}
// @__NO_SIDE_EFFECTS__
function ru(e, t) {
  return new Qs({
    check: "string_format",
    format: "starts_with",
    ...k(t),
    prefix: e
  });
}
// @__NO_SIDE_EFFECTS__
function iu(e, t) {
  return new ea({
    check: "string_format",
    format: "ends_with",
    ...k(t),
    suffix: e
  });
}
// @__NO_SIDE_EFFECTS__
function Ee(e) {
  return new ta({
    check: "overwrite",
    tx: e
  });
}
// @__NO_SIDE_EFFECTS__
function ou(e) {
  return /* @__PURE__ */ Ee((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function su() {
  return /* @__PURE__ */ Ee((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function au() {
  return /* @__PURE__ */ Ee((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function cu() {
  return /* @__PURE__ */ Ee((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function uu() {
  return /* @__PURE__ */ Ee((e) => So(e));
}
// @__NO_SIDE_EFFECTS__
function lu(e, t, n) {
  return new e({
    type: "array",
    element: t,
    // get element() {
    //   return element;
    // },
    ...k(n)
  });
}
// @__NO_SIDE_EFFECTS__
function du(e, t, n) {
  return new e({
    type: "custom",
    check: "custom",
    fn: t,
    ...k(n)
  });
}
// @__NO_SIDE_EFFECTS__
function pu(e, t) {
  const n = /* @__PURE__ */ fu((r) => (r.addIssue = (i) => {
    if (typeof i == "string")
      r.issues.push(Ce(i, r.value, n._zod.def));
    else {
      const o = i;
      o.fatal && (o.continue = !1), o.code ?? (o.code = "custom"), "input" in o || (o.input = r.value), o.inst ?? (o.inst = n), o.continue ?? (o.continue = !n._zod.def.abort), r.issues.push(Ce(o));
    }
  }, e(r.value, r)), t);
  return n;
}
// @__NO_SIDE_EFFECTS__
function fu(e, t) {
  const n = new K({
    check: "custom",
    ...k(t)
  });
  return n._zod.check = e, n;
}
function Re(e, ...t) {
  for (const n of t)
    for (const r of Reflect.ownKeys(n))
      Object.prototype.propertyIsEnumerable.call(n, r) && me(e, r, n[r]);
  return e;
}
function ti(e) {
  let t = e?.target ?? "draft-2020-12";
  return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
    processors: e.processors ?? {},
    metadataRegistry: e?.metadata ?? De,
    target: t,
    unrepresentable: e?.unrepresentable ?? "throw",
    override: e?.override ?? (() => {
    }),
    io: e?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    sharedDefsExtractedFor: void 0,
    sharedEmitDoneFor: void 0,
    cycles: e?.cycles ?? "ref",
    reused: e?.reused ?? "inline",
    intersections: [],
    deferred: [],
    external: e?.external ?? void 0
  };
}
function le(e, t, n, r, i) {
  const o = typeof t.unrepresentable == "function" ? t.unrepresentable({ zodSchema: e, path: r.path, message: i }) : t.unrepresentable;
  if (o === "any")
    return !1;
  if (o === void 0 || o === "throw")
    throw new Error(i);
  return Object.assign(n, o), !0;
}
function M(e, t, n = { path: [], schemaPath: [] }) {
  var r;
  const i = e._zod.def, o = t.seen.get(e);
  if (o)
    return o.count++, n.schemaPath.includes(e) && (o.cycle = n.path), o.schema;
  const s = { schema: {}, count: 1, cycle: void 0, path: n.path };
  t.seen.set(e, s), t.sharedDefsExtractedFor = void 0, t.sharedEmitDoneFor = void 0;
  const a = e._zod.toJSONSchema?.();
  if (a)
    s.schema = a;
  else {
    const d = {
      ...n,
      schemaPath: [...n.schemaPath, e],
      path: n.path
    };
    if (e._zod.processJSONSchema)
      e._zod.processJSONSchema(t, s.schema, d);
    else {
      const b = s.schema, y = t.processors[i.type];
      if (!y)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${i.type}`);
      y(e, t, b, d);
    }
    const h = e._zod.parent;
    h && (s.ref || (s.ref = h), M(h, t, d), t.seen.get(h).isParent = !0);
  }
  const u = t.metadataRegistry.get(e);
  return u && Re(s.schema, u), t.io === "input" && G(e) && (delete s.schema.examples, delete s.schema.default), t.io === "input" && "_prefault" in s.schema && ((r = s.schema).default ?? (r.default = s.schema._prefault)), delete s.schema._prefault, t.seen.get(e).schema;
}
function Rn(e) {
  return e.replace(/~/g, "~0").replace(/\//g, "~1");
}
function ni(e, t) {
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  if (e.external && e.sharedDefsExtractedFor === e.external)
    return;
  const r = /* @__PURE__ */ new Map();
  for (const s of e.seen.entries()) {
    const a = e.metadataRegistry.get(s[0])?.id;
    if (a) {
      const u = r.get(a);
      if (u && u !== s[0])
        throw new Error(`Duplicate schema id "${a}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      r.set(a, s[0]);
    }
  }
  const i = (s) => {
    const a = e.target === "draft-2020-12" ? "$defs" : "definitions";
    if (e.external) {
      const h = e.external.registry.get(s[0])?.id, b = e.external.uri ?? ((_) => _);
      if (h)
        return { ref: b(h) };
      const y = s[1].defId ?? s[1].schema.id ?? `schema${e.counter++}`;
      return s[1].defId = y, { defId: y, ref: `${b("__shared")}#/${a}/${Rn(y)}` };
    }
    const u = "#", l = `${u}/${a}/`;
    if (s[1] === n && !s[1].schema.id)
      return { ref: u };
    const d = s[1].schema.id ?? `__schema${e.counter++}`;
    return { defId: d, ref: l + Rn(d) };
  }, o = (s) => {
    if (s[1].schema.$ref)
      return;
    const a = s[1], { ref: u, defId: l } = i(s);
    a.def = { ...a.schema }, l && (a.defId = l);
    const d = a.schema;
    for (const h in d)
      delete d[h];
    d.$ref = u;
  };
  if (e.cycles === "throw")
    for (const s of e.seen.entries()) {
      const a = s[1];
      if (a.cycle)
        throw new Error(`Cycle detected: #/${a.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (const s of e.seen.entries()) {
    const a = s[1];
    if (t === s[0]) {
      o(s);
      continue;
    }
    if (e.external) {
      const l = e.external.registry.get(s[0])?.id;
      if (t !== s[0] && l) {
        o(s);
        continue;
      }
    }
    if (e.metadataRegistry.get(s[0])?.id) {
      o(s);
      continue;
    }
    if (a.cycle) {
      o(s);
      continue;
    }
    a.count > 1 && e.reused === "ref" && o(s);
  }
  e.external && (e.sharedDefsExtractedFor = e.external);
}
function ri(e) {
  const t = e.anyOf;
  if (!Array.isArray(t) || t.length === 0 || e.type !== void 0)
    return;
  const n = [];
  for (const r of t) {
    if (!r || typeof r != "object")
      return;
    ri(r);
    const i = Object.keys(r);
    if (i.length !== 1 || i[0] !== "type")
      return;
    const o = r.type;
    for (const s of Array.isArray(o) ? o : [o]) {
      if (typeof s != "string")
        return;
      n.includes(s) || n.push(s);
    }
  }
  delete e.anyOf, e.type = n.length === 1 ? n[0] : n;
}
const ii = /* @__PURE__ */ new Set(["type", "properties", "required", "additionalProperties"]), Cn = ["oneOf", "anyOf"];
function $n(e) {
  const t = e.additionalProperties;
  return t === void 0 || t === !1 || typeof t != "object" || t === null ? null : Object.keys(t).length ? t : null;
}
function At(e) {
  const t = [];
  for (const o of e) {
    if (typeof o != "object" || o.type !== "object")
      return null;
    for (const s in o)
      if (!ii.has(s))
        return null;
    t.push(o);
  }
  const n = {}, r = /* @__PURE__ */ new Set();
  for (const o of t) {
    for (const s in o.properties) {
      if (Object.prototype.hasOwnProperty.call(n, s))
        continue;
      const a = [];
      for (const l of t) {
        const d = l.properties?.[s] ?? $n(l);
        d != null && (a.some((h) => JSON.stringify(h) === JSON.stringify(d)) || a.push(d));
      }
      const u = a.length === 1 ? a[0] : At(a) ?? { allOf: a };
      me(n, s, u);
    }
    for (const s of o.required ?? [])
      r.add(s);
  }
  const i = { type: "object", properties: n };
  if (r.size && (i.required = [...r]), t.every((o) => o.additionalProperties === !1))
    i.additionalProperties = !1;
  else {
    const o = [];
    for (const s of t) {
      const a = $n(s);
      a && !o.some((u) => JSON.stringify(u) === JSON.stringify(a)) && o.push(a);
    }
    o.length === 1 ? i.additionalProperties = o[0] : o.length > 1 && (i.additionalProperties = { allOf: o });
  }
  return i;
}
function mu(e) {
  const t = e.allOf;
  if (!Array.isArray(t) || t.length < 2)
    return;
  for (const i of ii)
    if (i in e)
      return;
  const n = t.filter((i) => Cn.some((o) => Array.isArray(i[o])));
  let r = null;
  if (!n.length)
    r = At(t);
  else {
    const i = n[0], o = Cn.find((u) => Array.isArray(i[u]));
    if (Object.keys(i).length !== 1)
      return;
    const s = t.filter((u) => u !== i), a = i[o].map((u) => At([...s, u]));
    if (a.some((u) => !u))
      return;
    r = { [o]: a };
  }
  r && (delete e.allOf, Re(e, r));
}
function oi(e, t) {
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const r = (a) => {
    const u = e.seen.get(a);
    if (u.ref === null)
      return;
    const l = u.def ?? u.schema, d = { ...l }, h = u.ref;
    if (u.ref = null, h) {
      r(h);
      const y = e.seen.get(h), _ = y.schema;
      if (_.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (l.allOf = l.allOf ?? [], l.allOf.push(_)) : Re(l, _), Re(l, d), a._zod.parent === h)
        for (const I in l)
          I === "$ref" || I === "allOf" || I in d || delete l[I];
      if (_.$ref && y.def)
        for (const I in l)
          I === "$ref" || I === "allOf" || I in y.def && JSON.stringify(l[I]) === JSON.stringify(y.def[I]) && delete l[I];
    }
    const b = a._zod.parent;
    if (b && b !== h) {
      r(b);
      const y = e.seen.get(b);
      if (y?.schema.$ref && (l.$ref = y.schema.$ref, y.def))
        for (const _ in l)
          _ === "$ref" || _ === "allOf" || _ in y.def && JSON.stringify(l[_]) === JSON.stringify(y.def[_]) && delete l[_];
    }
    e.override({
      zodSchema: a,
      jsonSchema: l,
      path: u.path ?? []
    });
  };
  if (!e.external || e.sharedEmitDoneFor !== e.external) {
    for (const a of [...e.seen.entries()].reverse())
      r(a[0]);
    if (e.target !== "openapi-3.0")
      for (const a of e.seen.entries())
        ri(a[1].def ?? a[1].schema);
    for (const a of e.deferred)
      a();
    if (e.intersections.length) {
      const a = /* @__PURE__ */ new Map();
      for (const u of e.seen.values())
        for (const l of [u.schema, u.def]) {
          const d = l?.allOf;
          if (!Array.isArray(d))
            continue;
          const h = a.get(d);
          h ? h.push(l) : a.set(d, [l]);
        }
      for (const u of e.intersections)
        for (const l of a.get(u) ?? [])
          mu(l);
    }
  }
  const i = {};
  if (e.target === "draft-2020-12" ? i.$schema = "https://json-schema.org/draft/2020-12/schema" : e.target === "draft-07" ? i.$schema = "http://json-schema.org/draft-07/schema#" : e.target === "draft-04" ? i.$schema = "http://json-schema.org/draft-04/schema#" : e.target, e.external?.uri) {
    const a = e.external.registry.get(t)?.id;
    if (!a)
      throw new Error("Schema is missing an `id` property");
    i.$id = e.external.uri(a);
  }
  Re(i, n.defId ? n.schema : n.def ?? n.schema);
  const o = e.metadataRegistry.get(t)?.id;
  o !== void 0 && i.id === o && delete i.id;
  const s = e.external?.defs ?? {};
  if (!e.external || e.sharedEmitDoneFor !== e.external)
    for (const a of e.seen.entries()) {
      const u = a[1];
      u.def && u.defId && (u.def.id === u.defId && delete u.def.id, me(s, u.defId, u.def));
    }
  e.external && (e.sharedEmitDoneFor = e.external), e.external || Object.keys(s).length > 0 && (e.target === "draft-2020-12" ? i.$defs = s : i.definitions = s);
  try {
    const a = JSON.parse(JSON.stringify(i));
    return Object.defineProperty(a, "~standard", {
      value: {
        ...t["~standard"],
        jsonSchema: {
          input: We(t, "input", e.processors),
          output: We(t, "output", e.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), a;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function G(e, t) {
  const n = t ?? { seen: /* @__PURE__ */ new Set() };
  if (n.seen.has(e))
    return !1;
  n.seen.add(e);
  const r = e._zod.def;
  if (r.type === "transform")
    return !0;
  if (r.type === "array")
    return G(r.element, n);
  if (r.type === "set")
    return G(r.valueType, n);
  if (r.type === "lazy")
    return G(r.getter(), n);
  if (r.type === "promise" || r.type === "optional" || r.type === "nonoptional" || r.type === "nullable" || r.type === "readonly" || r.type === "default" || r.type === "prefault" || r.type === "catch")
    return G(r.innerType, n);
  if (r.type === "intersection")
    return G(r.left, n) || G(r.right, n);
  if (r.type === "record" || r.type === "map")
    return G(r.keyType, n) || G(r.valueType, n);
  if (r.type === "pipe")
    return e._zod.traits.has("$ZodCodec") ? !0 : G(r.in, n) || G(r.out, n);
  if (r.type === "object") {
    for (const i in r.shape)
      if (G(r.shape[i], n))
        return !0;
    return !1;
  }
  if (r.type === "union") {
    for (const i of r.options)
      if (G(i, n))
        return !0;
    return !1;
  }
  if (r.type === "tuple") {
    for (const i of r.items)
      if (G(i, n))
        return !0;
    return !!(r.rest && G(r.rest, n));
  }
  return !1;
}
const hu = (e, t = {}) => (n) => {
  const r = ti({ ...n, processors: t });
  return M(e, r), ni(r, e), oi(r, e);
}, We = (e, t, n = {}) => (r) => {
  const { libraryOptions: i, target: o } = r ?? {}, s = ti({ ...i ?? {}, target: o, io: t, processors: n });
  return M(e, s), ni(s, e), oi(s, e);
}, Ae = (e, t, n) => {
  (e[t] === void 0 || n > e[t]) && (e[t] = n);
}, Pe = (e, t, n) => {
  (e[t] === void 0 || n < e[t]) && (e[t] = n);
}, Ln = (e, t) => {
  Ae(e, "minimum", t), Pe(e, "maximum", t);
}, si = (e, t) => {
  e.multipleOf ?? (e.multipleOf = []), e.multipleOf.includes(t) || e.multipleOf.push(t);
}, ai = (e, t) => {
  e.patterns ?? (e.patterns = /* @__PURE__ */ new Set()), e.patterns.add(t);
}, ci = (e, t) => {
  e.mime = e.mime ? e.mime.filter((n) => t.includes(n)) : [...t];
}, ui = (e, t) => {
  e.format = t, t.includes("int") && (e.isInt = !0);
}, Mn = (e, t) => Ae(e, "minimum", t.minimum), Zn = (e, t) => Pe(e, "maximum", t.maximum), Un = (e) => (t, n) => {
  ui(t, n.format);
  const [r, i] = e[n.format];
  Ae(t, "minimum", r), Pe(t, "maximum", i);
}, gu = {
  greater_than: (e, t) => Ae(e, t.inclusive ? "minimum" : "exclusiveMinimum", t.value),
  less_than: (e, t) => Pe(e, t.inclusive ? "maximum" : "exclusiveMaximum", t.value),
  multiple_of: (e, t) => si(e, t.value),
  number_format: Un(xr),
  bigint_format: Un(xo),
  min_length: Mn,
  max_length: Zn,
  length_equals: (e, t) => Ln(e, t.length),
  min_size: Mn,
  max_size: Zn,
  size_equals: (e, t) => Ln(e, t.size),
  string_format: (e, t) => {
    ui(e, t.format), t.pattern && ai(e, t.pattern), (t.format === "base64" || t.format === "base64url") && (e.contentEncoding = t.format), (t.local || t.precision === -1) && (e.laxFormat = !0);
  },
  mime_type: (e, t) => ci(e, t.mime)
};
function ee(e) {
  const t = {}, n = e._zod.def, r = e._zod.traits.has("$ZodCheck") ? [e, ...n.checks ?? []] : n.checks ?? [];
  for (const o of r)
    gu[o._zod.def.check]?.(t, o._zod.def);
  const i = e._zod.bag;
  i.minimum !== void 0 && Ae(t, "minimum", i.minimum), i.exclusiveMinimum !== void 0 && Ae(t, "exclusiveMinimum", i.exclusiveMinimum), i.maximum !== void 0 && Pe(t, "maximum", i.maximum), i.exclusiveMaximum !== void 0 && Pe(t, "exclusiveMaximum", i.exclusiveMaximum), i.multipleOf !== void 0 && si(t, i.multipleOf), i.format !== void 0 && (t.format ?? (t.format = i.format), i.format.includes("int") && (t.isInt = !0)), i.mime && ci(t, i.mime);
  for (const o of i.patterns ?? [])
    ai(t, o);
  return t;
}
const yu = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, bu = /* @__PURE__ */ new Map([
  [Fr, Os],
  [Yt, js]
]), li = (e) => bu.get(e) ?? e, _u = (e, t, n, r) => {
  const i = n;
  i.type = "string";
  const { minimum: o, maximum: s, format: a, patterns: u, contentEncoding: l, laxFormat: d } = ee(e);
  if (typeof o == "number" && (i.minLength = o), typeof s == "number" && (i.maxLength = s), a && (i.format = yu[a] ?? a, i.format === "" && delete i.format, (a === "time" || d) && delete i.format), l && (i.contentEncoding = l), u && u.size > 0) {
    const h = [...u].map(li);
    h.length === 1 ? i.pattern = h[0].source : h.length > 1 && (i.allOf = [
      ...h.map((b) => ({
        ...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: b.source
      }))
    ]);
  }
}, vu = (e, t, n, r) => {
  const i = n, { minimum: o, maximum: s, multipleOf: a, exclusiveMaximum: u, exclusiveMinimum: l, isInt: d } = ee(e);
  i.type = d ? "integer" : "number";
  const h = typeof l == "number" && l >= (o ?? Number.NEGATIVE_INFINITY), b = typeof u == "number" && u <= (s ?? Number.POSITIVE_INFINITY), y = t.target === "draft-04" || t.target === "openapi-3.0";
  if (h ? y ? (i.minimum = l, i.exclusiveMinimum = !0) : i.exclusiveMinimum = l : typeof o == "number" && (i.minimum = o), b ? y ? (i.maximum = u, i.exclusiveMaximum = !0) : i.exclusiveMaximum = u : typeof s == "number" && (i.maximum = s), a) {
    const _ = /* @__PURE__ */ new Set();
    for (const O of a)
      Number.isFinite(O) && O !== 0 ? _.add(Math.abs(O)) : le(e, t, i, r, `A multipleOf divisor of ${O} cannot be represented in JSON Schema`);
    const [T, ...I] = _;
    T !== void 0 && (i.multipleOf = T), I.length && (i.allOf = [...i.allOf ?? [], ...I.map((O) => ({ multipleOf: O }))]);
  }
}, Iu = (e, t, n, r) => {
  n.type = "boolean";
}, wu = (e, t, n, r) => {
  t.target === "openapi-3.0" ? (n.type = "string", n.nullable = !0, n.enum = [null]) : n.type = "null";
}, ku = (e, t, n, r) => {
  n.not = {};
}, Tu = (e, t, n, r) => {
}, Su = (e, t, n, r) => {
  const i = e._zod.def, o = vt(i.entries);
  if (o.length === 0) {
    n.not = {};
    return;
  }
  o.every((s) => typeof s == "number") && (n.type = "number"), o.every((s) => typeof s == "string") && (n.type = "string"), n.enum = o;
}, Au = (e, t, n, r) => {
  const i = e._zod.def;
  if (i.values.length === 0) {
    n.not = {};
    return;
  }
  const o = [];
  for (const s of i.values)
    if (s === void 0) {
      if (le(e, t, n, r, "Literal `undefined` cannot be represented in JSON Schema"))
        return;
    } else if (typeof s == "bigint") {
      if (le(e, t, n, r, "BigInt literals cannot be represented in JSON Schema"))
        return;
      o.push(Number(s));
    } else
      o.push(s);
  if (o.length !== 0) if (o.length === 1) {
    const s = o[0];
    n.type = s === null ? "null" : typeof s, t.target === "draft-04" || t.target === "openapi-3.0" ? n.enum = [s] : n.const = s;
  } else
    o.every((s) => typeof s == "number") && (n.type = "number"), o.every((s) => typeof s == "string") && (n.type = "string"), o.every((s) => typeof s == "boolean") && (n.type = "boolean"), o.every((s) => s === null) && (n.type = "null"), n.enum = o;
}, Pu = (e, t, n, r) => {
  le(e, t, n, r, "Custom types cannot be represented in JSON Schema");
}, Eu = (e, t, n, r) => {
  le(e, t, n, r, "Transforms cannot be represented in JSON Schema");
}, xu = (e, t, n, r) => {
  const i = n, o = e._zod.def, { minimum: s, maximum: a } = ee(e);
  typeof s == "number" && (i.minItems = s), typeof a == "number" && (i.maxItems = a), i.type = "array", i.items = M(o.element, t, {
    ...r,
    path: [...r.path, "items"]
  });
};
function He(e) {
  const t = e._zod.def;
  return t.type === "pipe" && t.in._zod.traits.has("$ZodTransform") ? He(t.out) : t.type === "catch" ? He(t.innerType) : e._zod.optin;
}
const Ou = (e, t, n, r) => {
  const i = n, o = e._zod.def, s = o.shape;
  if (Object.getOwnPropertySymbols(s).length && le(e, t, i, r, "Symbol keys cannot be represented in JSON Schema"))
    return;
  i.type = "object", i.properties = {};
  for (const l in s)
    me(i.properties, l, M(s[l], t, {
      ...r,
      path: [...r.path, "properties", l]
    }));
  const u = [];
  for (const l of Object.keys(s)) {
    const d = o.shape[l];
    (t.io === "input" ? He(d) === void 0 : d._zod.optout === void 0) && u.push(l);
  }
  u.length > 0 && (i.required = u), o.catchall?._zod.def.type === "never" ? i.additionalProperties = !1 : o.catchall ? o.catchall && (i.additionalProperties = M(o.catchall, t, {
    ...r,
    path: [...r.path, "additionalProperties"]
  })) : t.io === "output" && (i.additionalProperties = !1);
}, ju = (e, t, n, r) => {
  const i = e._zod.def, o = i.inclusive === !1, s = i.options.map((a, u) => M(a, t, {
    ...r,
    path: [...r.path, o ? "oneOf" : "anyOf", u]
  }));
  o ? n.oneOf = s : n.anyOf = s;
}, Nu = (e, t, n, r) => {
  const i = e._zod.def, o = M(i.left, t, {
    ...r,
    path: [...r.path, "allOf", 0]
  }), s = M(i.right, t, {
    ...r,
    path: [...r.path, "allOf", 1]
  }), a = (l) => "allOf" in l && Object.keys(l).length === 1, u = [
    ...a(o) ? o.allOf : [o],
    ...a(s) ? s.allOf : [s]
  ];
  n.allOf = u, t.intersections.push(u);
};
function Pt(e, t, n) {
  if (t.$ref) {
    if (n.has(t))
      return t;
    n.add(t);
    const _ = e.get(t)?.def;
    if (!_)
      return t;
    const T = Pt(e, _, n);
    return T === _ ? t : T;
  }
  for (const _ of ["anyOf", "oneOf"]) {
    const T = t[_];
    if (!Array.isArray(T))
      continue;
    const I = T.map((O) => Pt(e, O, n));
    I.some((O, J) => O !== T[J]) && (t = { ...t, [_]: I });
  }
  const r = Array.isArray(t.type) ? t.type : [t.type], i = !r.includes("string") && r.some((_) => _ === "number" || _ === "integer"), o = t.enum ?? (t.const !== void 0 ? [t.const] : void 0);
  if (!i && !o?.some((_) => typeof _ == "number"))
    return t;
  const { minimum: s, maximum: a, exclusiveMinimum: u, exclusiveMaximum: l, multipleOf: d, format: h, id: b, ...y } = t;
  return y.enum ? y.enum = y.enum.map((_) => typeof _ == "number" ? String(_) : _) : typeof y.const == "number" && (y.const = String(y.const)), i && (y.type = "string", o || (y.pattern = (r.includes("number") ? Wt : Ms).source)), y;
}
const Et = /* @__PURE__ */ new WeakMap();
function Du(e) {
  const t = /* @__PURE__ */ new Map();
  for (const r of e.seen.values())
    r.def && !t.has(r.schema) && t.set(r.schema, r);
  const n = /* @__PURE__ */ new Map();
  for (const r of Et.get(e) ?? []) {
    const i = e.seen.get(r), o = (i?.def ?? i?.schema)?.propertyNames;
    if (!o || o === !0 || n.has(o))
      continue;
    const s = Pt(t, o, /* @__PURE__ */ new Set());
    s !== o && n.set(o, s);
  }
  if (n.size)
    for (const r of e.seen.values())
      for (const i of [r.schema, r.def]) {
        const o = i && n.get(i.propertyNames);
        o && (i.propertyNames = o);
      }
}
const zu = (e, t, n, r) => {
  const i = n, o = e._zod.def;
  i.type = "object";
  const s = o.keyType, a = ee(s).patterns;
  if (o.mode === "loose" && a && a.size > 0) {
    const d = M(o.valueType, t, {
      ...r,
      path: [...r.path, "patternProperties", "*"]
    });
    i.patternProperties = {};
    for (const h of a)
      me(i.patternProperties, li(h).source, d);
  } else {
    if (t.target === "draft-07" || t.target === "draft-2020-12") {
      i.propertyNames = M(o.keyType, t, {
        ...r,
        path: [...r.path, "propertyNames"]
      });
      let d = Et.get(t);
      d || (d = [], Et.set(t, d), t.deferred.push(() => Du(t))), d.push(e);
    }
    i.additionalProperties = M(o.valueType, t, {
      ...r,
      path: [...r.path, "additionalProperties"]
    });
  }
  const u = s._zod.values, l = t.io === "input" && He(o.valueType) !== void 0;
  if (u && !o.partial && !l) {
    const d = [...u].filter((h) => typeof h == "string" || typeof h == "number");
    d.length > 0 && (i.required = d.map(String));
  }
}, Ru = (e, t, n, r) => {
  const i = e._zod.def, o = M(i.innerType, t, r), s = t.seen.get(e);
  t.target === "openapi-3.0" ? (s.ref = i.innerType, n.nullable = !0) : n.anyOf = [o, { type: "null" }];
}, Cu = (e, t, n, r) => {
  const i = e._zod.def;
  M(i.innerType, t, r);
  const o = t.seen.get(e);
  o.ref = i.innerType;
}, Qt = /* @__PURE__ */ Symbol();
function di(e, t, n, r, i) {
  let o = !1;
  const s = JSON.stringify(e, (a, u) => typeof u != "bigint" ? u : (o = !0, null));
  return o ? (le(t, n, r, i, "BigInt defaults cannot be represented in JSON Schema"), Qt) : JSON.parse(s);
}
const $u = (e, t, n, r) => {
  const i = e._zod.def;
  M(i.innerType, t, r);
  const o = t.seen.get(e);
  o.ref = i.innerType;
  const s = di(i.defaultValue, e, t, n, r);
  s !== Qt && (n.default = s);
}, Lu = (e, t, n, r) => {
  const i = e._zod.def;
  M(i.innerType, t, r);
  const o = t.seen.get(e);
  if (o.ref = i.innerType, t.io !== "input")
    return;
  const s = di(i.defaultValue, e, t, n, r);
  s !== Qt && (n._prefault = s);
}, Mu = (e, t, n, r) => {
  const i = e._zod.def;
  M(i.innerType, t, r);
  const o = t.seen.get(e);
  o.ref = i.innerType;
  let s;
  try {
    s = i.catchValue(void 0);
  } catch {
    le(e, t, n, r, "Dynamic catch values are not supported in JSON Schema");
    return;
  }
  n.default = s;
}, Zu = (e, t, n, r) => {
  const i = e._zod.def, o = i.in._zod.traits.has("$ZodTransform"), s = t.io === "input" ? o ? i.out : i.in : i.out;
  M(s, t, r);
  const a = t.seen.get(e);
  a.ref = s;
}, Uu = (e, t, n, r) => {
  const i = e._zod.def;
  M(i.innerType, t, r);
  const o = t.seen.get(e);
  o.ref = i.innerType, n.readOnly = !0;
}, pi = (e, t, n, r) => {
  const i = e._zod.def;
  M(i.innerType, t, r);
  const o = t.seen.get(e);
  o.ref = i.innerType;
}, Bu = (e, t, n, r) => {
  const i = e._zod.innerType;
  M(i, t, r);
  const o = t.seen.get(e);
  o.ref = i;
}, Bn = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function Ze(e, t, n) {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    get() {
      const r = n(this);
      return Object.defineProperty(this, t, { value: r, configurable: !0, writable: !0 }), r;
    },
    set(r) {
      Object.defineProperty(this, t, { value: r, configurable: !0, writable: !0 });
    }
  });
}
const qu = (e, t) => {
  Xo.init(e, t), e.name = "ZodError";
  const n = Object.getPrototypeOf(e);
  Bn.has(n) || (Bn.add(n), Ze(n, "format", (r) => (i) => es(r, i)), Ze(n, "flatten", (r) => (i) => Qo(r, i)), Ze(n, "addIssue", (r) => (i) => {
    r.issues.push(i), r.message = JSON.stringify(r.issues, It, 2);
  }), Ze(n, "addIssues", (r) => (i) => {
    r.issues.push(...i), r.message = JSON.stringify(r.issues, It, 2);
  }), Object.defineProperty(n, "isEmpty", {
    configurable: !0,
    enumerable: !1,
    get() {
      return this.issues.length === 0;
    }
  }));
}, Y = /* @__PURE__ */ p("ZodError", qu, void 0, {
  Parent: Error
}), Fu = /* @__PURE__ */ Gt(Y), Gu = /* @__PURE__ */ Kt(Y), Ku = /* @__PURE__ */ Vt(Y), Vu = /* @__PURE__ */ Jt(Y), Ju = /* @__PURE__ */ ss(Y), Wu = /* @__PURE__ */ as(Y), Hu = /* @__PURE__ */ cs(Y), Xu = /* @__PURE__ */ us(Y), Yu = /* @__PURE__ */ ls(Y), Qu = /* @__PURE__ */ ds(Y), el = /* @__PURE__ */ ps(Y), tl = /* @__PURE__ */ fs(Y);
function nl() {
  te.localeError || ne(yc());
}
function st() {
  te.memoizer || ne({ memoizer: mc() });
}
const D = /* @__PURE__ */ p("ZodType", (e, t) => (nl(), N.init(e, t), e.def = t, e.type = t.type, e), {
  check(...e) {
    const t = this.def;
    return this.clone(V(t, {
      checks: [
        ...t.checks ?? [],
        ...e.map((n) => typeof n == "function" ? { _zod: { check: n, def: { check: "custom" }, onattach: [] } } : n)
      ]
    }), { parent: !0 });
  },
  with(...e) {
    return this.check(...e);
  },
  clone(e, t) {
    return he(this, e, t);
  },
  brand() {
    return this;
  },
  register(e, t) {
    return e.add(this, t), this;
  },
  refine(e, t) {
    return this.check(ed(e, t));
  },
  superRefine(e, t) {
    return this.check(td(e, t));
  },
  overwrite(e) {
    return this.check(/* @__PURE__ */ Ee(e));
  },
  optional() {
    return Gn(this);
  },
  exactOptional() {
    return Zl(this);
  },
  nullable() {
    return Kn(this);
  },
  nullish() {
    return Gn(Kn(this));
  },
  nonoptional(e) {
    return Kl(this, e);
  },
  array() {
    return B(this);
  },
  or(e) {
    return en([this, e]);
  },
  and(e) {
    return $l(this, e);
  },
  transform(e) {
    return Vn(this, hi(e));
  },
  default(e) {
    return ql(this, e);
  },
  prefault(e) {
    return Gl(this, e);
  },
  catch(e) {
    return Jl(this, e);
  },
  pipe(e) {
    return Vn(this, e);
  },
  readonly() {
    return Xl(this);
  },
  describe(e) {
    const t = this.clone();
    return De.add(t, { description: e }), t;
  },
  meta(...e) {
    if (e.length === 0)
      return De.get(this);
    const t = this.clone();
    return De.add(t, e[0]), t;
  },
  isOptional() {
    return this.safeParse(void 0).success;
  },
  isNullable() {
    return this.safeParse(null).success;
  },
  apply(e, ...t) {
    return t.length === 0 ? e(this) : e(this, ...t);
  },
  // Overrides core's `~standard` to add `jsonSchema`. Must stay a prototype entry: redefining it per instance demotes instances to dictionary mode.
  get "~standard"() {
    return jr(this, "~standard", {
      ...Mr(this),
      jsonSchema: {
        input: We(this, "input"),
        output: We(this, "output")
      }
    });
  },
  set "~standard"(e) {
    ue(this, "~standard", e);
  },
  parse: function e(t, n) {
    return Fu(this, t, n, { callee: e });
  },
  parseAsync: async function e(t, n) {
    return await Gu(this, t, n, { callee: e });
  },
  safeParse(e, t) {
    return Ku(this, e, t);
  },
  async safeParseAsync(e, t) {
    return Vu(this, e, t);
  },
  // `spa` is an alias: same function object as `safeParseAsync`, as before.
  get spa() {
    return this?.safeParseAsync;
  },
  set spa(e) {
    ue(this, "spa", e);
  },
  validate(e, t) {
    return rs(this, e, t);
  },
  validateAsync(e, t) {
    return os(this, e, t);
  },
  encode: function e(t, n) {
    return Ju(this, t, n, { callee: e });
  },
  decode: function e(t, n) {
    return Wu(this, t, n, { callee: e });
  },
  encodeAsync: async function e(t, n) {
    return await Hu(this, t, n, { callee: e });
  },
  decodeAsync: async function e(t, n) {
    return await Xu(this, t, n, { callee: e });
  },
  safeEncode(e, t) {
    return Yu(this, e, t);
  },
  safeDecode(e, t) {
    return Qu(this, e, t);
  },
  async safeEncodeAsync(e, t) {
    return el(this, e, t);
  },
  async safeDecodeAsync(e, t) {
    return tl(this, e, t);
  },
  toJSONSchema(e) {
    return hu(this, {})(e);
  },
  // Reads through to the registry on every access, so it must not cache.
  get description() {
    return De.get(this)?.description;
  },
  // No setter: `schema._def = x` throws, as it did when `_def` was a non-writable own property.
  get _def() {
    return this._zod.def;
  }
}), fi = /* @__PURE__ */ p(
  "_ZodString",
  (e, t) => {
    Xt.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => _u(e, n, r);
  },
  /* @__PURE__ */ Nr({
    format: (e) => ee(e).format ?? null,
    minLength: (e) => ee(e).minimum ?? null,
    maxLength: (e) => ee(e).maximum ?? null
  }, {
    regex(...e) {
      return this.check(/* @__PURE__ */ Qc(...e));
    },
    includes(...e) {
      return this.check(/* @__PURE__ */ nu(...e));
    },
    startsWith(...e) {
      return this.check(/* @__PURE__ */ ru(...e));
    },
    endsWith(...e) {
      return this.check(/* @__PURE__ */ iu(...e));
    },
    min(...e) {
      return this.check(/* @__PURE__ */ Je(...e));
    },
    max(...e) {
      return this.check(/* @__PURE__ */ Qr(...e));
    },
    length(...e) {
      return this.check(/* @__PURE__ */ ei(...e));
    },
    nonempty(...e) {
      return this.check(/* @__PURE__ */ Je(1, ...e));
    },
    lowercase(e) {
      return this.check(/* @__PURE__ */ eu(e));
    },
    uppercase(e) {
      return this.check(/* @__PURE__ */ tu(e));
    },
    trim() {
      return this.check(/* @__PURE__ */ su());
    },
    normalize(...e) {
      return this.check(/* @__PURE__ */ ou(...e));
    },
    toLowerCase() {
      return this.check(/* @__PURE__ */ au());
    },
    toUpperCase() {
      return this.check(/* @__PURE__ */ cu());
    },
    slugify() {
      return this.check(/* @__PURE__ */ uu());
    }
  })
), rl = /* @__PURE__ */ p("ZodString", (e, t) => {
  Xt.init(e, t), fi.init(e, t);
}, {
  email(e) {
    return this.check(/* @__PURE__ */ Ic(cl, e));
  },
  url(e) {
    return this.check(/* @__PURE__ */ Pc(ll, e));
  },
  jwt(e) {
    return this.check(/* @__PURE__ */ Bc(Sl, e));
  },
  emoji(e) {
    return this.check(/* @__PURE__ */ Ec(dl, e));
  },
  guid(e) {
    return this.check(/* @__PURE__ */ wc(ul, e));
  },
  uuid(e) {
    return this.check(/* @__PURE__ */ kc(Ue, e));
  },
  uuidv4(e) {
    return this.check(/* @__PURE__ */ Tc(Ue, e));
  },
  uuidv6(e) {
    return this.check(/* @__PURE__ */ Sc(Ue, e));
  },
  uuidv7(e) {
    return this.check(/* @__PURE__ */ Ac(Ue, e));
  },
  nanoid(e) {
    return this.check(/* @__PURE__ */ xc(pl, e));
  },
  cuid(e) {
    return this.check(/* @__PURE__ */ Oc(fl, e));
  },
  cuid2(e) {
    return this.check(/* @__PURE__ */ jc(ml, e));
  },
  ulid(e) {
    return this.check(/* @__PURE__ */ Nc(hl, e));
  },
  base64(e) {
    return this.check(/* @__PURE__ */ Mc(wl, e));
  },
  base64url(e) {
    return this.check(/* @__PURE__ */ Zc(kl, e));
  },
  xid(e) {
    return this.check(/* @__PURE__ */ Dc(gl, e));
  },
  ksuid(e) {
    return this.check(/* @__PURE__ */ zc(yl, e));
  },
  ipv4(e) {
    return this.check(/* @__PURE__ */ Rc(bl, e));
  },
  ipv6(e) {
    return this.check(/* @__PURE__ */ Cc(_l, e));
  },
  cidrv4(e) {
    return this.check(/* @__PURE__ */ $c(vl, e));
  },
  cidrv6(e) {
    return this.check(/* @__PURE__ */ Lc(Il, e));
  },
  e164(e) {
    return this.check(/* @__PURE__ */ Uc(Tl, e));
  },
  datetime(e) {
    return this.check(/* @__PURE__ */ qc(il, e));
  },
  date(e) {
    return this.check(/* @__PURE__ */ Fc(ol, e));
  },
  time(e) {
    return this.check(/* @__PURE__ */ Gc(sl, e));
  },
  duration(e) {
    return this.check(/* @__PURE__ */ Kc(al, e));
  }
});
function f(e) {
  return /* @__PURE__ */ vc(rl, e);
}
const C = /* @__PURE__ */ p("ZodStringFormat", (e, t) => {
  z.init(e, t), fi.init(e, t);
}), il = /* @__PURE__ */ p("ZodISODateTime", (e, t) => {
  Ia.init(e, t), C.init(e, t);
}), ol = /* @__PURE__ */ p("ZodISODate", (e, t) => {
  wa.init(e, t), C.init(e, t);
}), sl = /* @__PURE__ */ p("ZodISOTime", (e, t) => {
  ka.init(e, t), C.init(e, t);
}), al = /* @__PURE__ */ p("ZodISODuration", (e, t) => {
  Ta.init(e, t), C.init(e, t);
}), cl = /* @__PURE__ */ p("ZodEmail", (e, t) => {
  aa.init(e, t), C.init(e, t);
}), ul = /* @__PURE__ */ p("ZodGUID", (e, t) => {
  oa.init(e, t), C.init(e, t);
}), Ue = /* @__PURE__ */ p("ZodUUID", (e, t) => {
  sa.init(e, t), C.init(e, t);
}), ll = /* @__PURE__ */ p("ZodURL", (e, t) => {
  fa.init(e, t), C.init(e, t);
}), dl = /* @__PURE__ */ p("ZodEmoji", (e, t) => {
  ma.init(e, t), C.init(e, t);
}), pl = /* @__PURE__ */ p("ZodNanoID", (e, t) => {
  ha.init(e, t), C.init(e, t);
}), fl = /* @__PURE__ */ p("ZodCUID", (e, t) => {
  ga.init(e, t), C.init(e, t);
}), ml = /* @__PURE__ */ p("ZodCUID2", (e, t) => {
  ya.init(e, t), C.init(e, t);
}), hl = /* @__PURE__ */ p("ZodULID", (e, t) => {
  ba.init(e, t), C.init(e, t);
}), gl = /* @__PURE__ */ p("ZodXID", (e, t) => {
  _a.init(e, t), C.init(e, t);
}), yl = /* @__PURE__ */ p("ZodKSUID", (e, t) => {
  va.init(e, t), C.init(e, t);
}), bl = /* @__PURE__ */ p("ZodIPv4", (e, t) => {
  Sa.init(e, t), C.init(e, t);
}), _l = /* @__PURE__ */ p("ZodIPv6", (e, t) => {
  Pa.init(e, t), C.init(e, t);
}), vl = /* @__PURE__ */ p("ZodCIDRv4", (e, t) => {
  Ea.init(e, t), C.init(e, t);
}), Il = /* @__PURE__ */ p("ZodCIDRv6", (e, t) => {
  Oa.init(e, t), C.init(e, t);
}), wl = /* @__PURE__ */ p("ZodBase64", (e, t) => {
  ja.init(e, t), C.init(e, t);
}), kl = /* @__PURE__ */ p("ZodBase64URL", (e, t) => {
  Da.init(e, t), C.init(e, t);
}), Tl = /* @__PURE__ */ p("ZodE164", (e, t) => {
  za.init(e, t), C.init(e, t);
}), Sl = /* @__PURE__ */ p("ZodJWT", (e, t) => {
  Ca.init(e, t), C.init(e, t);
}), mi = /* @__PURE__ */ p(
  "ZodNumber",
  (e, t) => {
    Gr.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => vu(e, n, r, i), e.isFinite = !0;
  },
  /* @__PURE__ */ Nr({
    minValue: (e) => {
      const { minimum: t, exclusiveMinimum: n } = ee(e);
      return Math.max(t ?? Number.NEGATIVE_INFINITY, n ?? Number.NEGATIVE_INFINITY);
    },
    maxValue: (e) => {
      const { maximum: t, exclusiveMaximum: n } = ee(e);
      return Math.min(t ?? Number.POSITIVE_INFINITY, n ?? Number.POSITIVE_INFINITY);
    },
    isInt: (e) => {
      const { isInt: t, multipleOf: n } = ee(e);
      return !!t || !!n?.some(Number.isSafeInteger);
    },
    format: (e) => ee(e).format ?? null
  }, {
    gt(e, t) {
      return this.check(/* @__PURE__ */ Dn(e, t));
    },
    gte(e, t) {
      return this.check(/* @__PURE__ */ ht(e, t));
    },
    min(e, t) {
      return this.check(/* @__PURE__ */ ht(e, t));
    },
    lt(e, t) {
      return this.check(/* @__PURE__ */ Nn(e, t));
    },
    lte(e, t) {
      return this.check(/* @__PURE__ */ mt(e, t));
    },
    max(e, t) {
      return this.check(/* @__PURE__ */ mt(e, t));
    },
    int(e) {
      return this.check(qn(e));
    },
    safe(e) {
      return this.check(qn(e));
    },
    positive(e) {
      return this.check(/* @__PURE__ */ Dn(0, e));
    },
    nonnegative(e) {
      return this.check(/* @__PURE__ */ ht(0, e));
    },
    negative(e) {
      return this.check(/* @__PURE__ */ Nn(0, e));
    },
    nonpositive(e) {
      return this.check(/* @__PURE__ */ mt(0, e));
    },
    multipleOf(e, t) {
      return this.check(/* @__PURE__ */ zn(e, t));
    },
    step(e, t) {
      return this.check(/* @__PURE__ */ zn(e, t));
    },
    finite() {
      return this;
    }
  })
);
function de(e) {
  return /* @__PURE__ */ Vc(mi, e);
}
const Al = /* @__PURE__ */ p("ZodNumberFormat", (e, t) => {
  $a.init(e, t), mi.init(e, t);
});
function qn(e) {
  return /* @__PURE__ */ Jc(Al, e);
}
const Pl = /* @__PURE__ */ p("ZodBoolean", (e, t) => {
  La.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Iu(e, n, r);
});
function A(e) {
  return /* @__PURE__ */ Wc(Pl, e);
}
const El = /* @__PURE__ */ p("ZodNull", (e, t) => {
  Ma.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => wu(e, n, r);
});
function xl(e) {
  return /* @__PURE__ */ Hc(El, e);
}
const Ol = /* @__PURE__ */ p("ZodUnknown", (e, t) => {
  Za.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Tu();
});
function Xe() {
  return /* @__PURE__ */ Xc(Ol);
}
const jl = /* @__PURE__ */ p("ZodNever", (e, t) => {
  Ua.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => ku(e, n, r);
});
function Nl(e) {
  return /* @__PURE__ */ Yc(jl, e);
}
const Dl = /* @__PURE__ */ p("ZodArray", (e, t) => {
  st(), Fa.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => xu(e, n, r, i), e.element = t.element;
}, {
  min(e, t) {
    return this.check(/* @__PURE__ */ Je(e, t));
  },
  nonempty(e) {
    return this.check(/* @__PURE__ */ Je(1, e));
  },
  max(e, t) {
    return this.check(/* @__PURE__ */ Qr(e, t));
  },
  length(e, t) {
    return this.check(/* @__PURE__ */ ei(e, t));
  },
  unwrap() {
    return this.element;
  }
});
function B(e, t) {
  return /* @__PURE__ */ lu(Dl, e, t);
}
const zl = /* @__PURE__ */ p("ZodObject", (e, t) => {
  st(), Va.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Ou(e, n, r, i), qo(e, "shape", (n) => n._zod.def.shape, !1);
}, {
  keyof() {
    return E(Object.keys(this._zod.def.shape));
  },
  catchall(e) {
    return this.clone(V(this._zod.def, { catchall: e }));
  },
  passthrough() {
    return this.clone(V(this._zod.def, { catchall: Xe() }));
  },
  loose() {
    return this.clone(V(this._zod.def, { catchall: Xe() }));
  },
  strict() {
    return this.clone(V(this._zod.def, { catchall: Nl() }));
  },
  strip() {
    return this.clone(V(this._zod.def, { catchall: void 0 }));
  },
  extend(e) {
    return No(this, e);
  },
  safeExtend(e) {
    return Do(this, e);
  },
  merge(e) {
    return zo(this, e);
  },
  pick(e) {
    return Oo(this, e);
  },
  omit(e) {
    return jo(this, e);
  },
  partial(...e) {
    return mn(gi, this, e[0]);
  },
  exactPartial(...e) {
    return mn(yi, this, e[0], "exactPartial");
  },
  required(...e) {
    return Ro(bi, this, e[0]);
  }
});
function P(e, t) {
  const n = {
    type: "object",
    shape: e ?? {},
    ...k(t)
  };
  return new zl(n);
}
const Rl = /* @__PURE__ */ p("ZodUnion", (e, t) => {
  Ja.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => ju(e, n, r, i), e.options = t.options;
});
function en(e, t) {
  return new Rl({
    type: "union",
    options: e,
    ...k(t)
  });
}
const Cl = /* @__PURE__ */ p("ZodIntersection", (e, t) => {
  Wa.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Nu(e, n, r, i);
});
function $l(e, t) {
  return new Cl({
    type: "intersection",
    left: e,
    right: t
  });
}
const Fn = /* @__PURE__ */ p("ZodRecord", (e, t) => {
  st(), Ha.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => zu(e, n, r, i), e.keyType = t.keyType, e.valueType = t.valueType;
});
function pe(e, t, n) {
  return !t || !t._zod ? new Fn({
    type: "record",
    keyType: f(),
    valueType: e,
    ...k(t)
  }) : new Fn({
    type: "record",
    keyType: e,
    valueType: t,
    ...k(n)
  });
}
const xt = /* @__PURE__ */ p("ZodEnum", (e, t) => {
  Xa.init(e, t), D.init(e, t), e._zod.processJSONSchema = (r, i, o) => Su(e, r, i), e.enum = t.entries, e.options = [...e._zod.values];
  const n = new Set(Object.keys(t.entries));
  e.extract = (r, i) => {
    const o = {};
    for (const s of r)
      if (n.has(s))
        o[s] = t.entries[s];
      else
        throw new Error(`Key ${s} not found in enum`);
    return new xt({
      ...t,
      checks: [],
      ...k(i),
      entries: o
    });
  }, e.exclude = (r, i) => {
    const o = { ...t.entries };
    for (const s of r)
      if (n.has(s))
        delete o[s];
      else
        throw new Error(`Key ${s} not found in enum`);
    return new xt({
      ...t,
      checks: [],
      ...k(i),
      entries: o
    });
  };
});
function E(e, t) {
  const n = Array.isArray(e) ? Object.fromEntries(e.map((r) => [r, r])) : e;
  return new xt({
    type: "enum",
    entries: n,
    ...k(t)
  });
}
const Ll = /* @__PURE__ */ p("ZodLiteral", (e, t) => {
  Ya.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Au(e, n, r, i), e.values = new Set(t.values), Object.defineProperty(e, "value", {
    get() {
      if (t.values.length > 1)
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      return t.values[0];
    }
  });
});
function W(e, t) {
  return new Ll({
    type: "literal",
    values: Array.isArray(e) ? e : [e],
    ...k(t)
  });
}
const Ml = /* @__PURE__ */ p("ZodTransform", (e, t) => {
  st(), Qa.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Eu(e, n, r, i), e._zod.parse = (n, r) => {
    if (r.direction === "backward")
      throw new Dr(e.constructor.name);
    n.addIssue = (o) => {
      if (typeof o == "string")
        n.issues.push(Ce(o, n.value, t));
      else {
        const s = o;
        s.fatal && (s.continue = !1), s.code ?? (s.code = "custom"), "input" in s || (s.input = n.value), s.inst ?? (s.inst = e), n.issues.push(Ce(s));
      }
    };
    const i = t.transform(n.value, n);
    return i instanceof Promise ? i.then((o) => (n.value = o, n)) : (n.value = i, n);
  };
});
function hi(e) {
  return new Ml({
    type: "transform",
    transform: e
  });
}
const gi = /* @__PURE__ */ p("ZodOptional", (e, t) => {
  Jr.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => pi(e, n, r, i), e.unwrap = () => e._zod.def.innerType;
});
function Gn(e) {
  return new gi({
    type: "optional",
    innerType: e
  });
}
const yi = /* @__PURE__ */ p("ZodExactOptional", (e, t) => {
  ec.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => pi(e, n, r, i), e.unwrap = () => e._zod.def.innerType;
});
function Zl(e) {
  return new yi({
    type: "optional",
    innerType: e
  });
}
const Ul = /* @__PURE__ */ p("ZodNullable", (e, t) => {
  tc.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Ru(e, n, r, i), e.unwrap = () => e._zod.def.innerType;
});
function Kn(e) {
  return new Ul({
    type: "nullable",
    innerType: e
  });
}
const Bl = /* @__PURE__ */ p("ZodDefault", (e, t) => {
  nc.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => $u(e, n, r, i), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function ql(e, t) {
  return new Bl({
    type: "default",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : Pr(t);
    }
  });
}
const Fl = /* @__PURE__ */ p("ZodPrefault", (e, t) => {
  rc.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Lu(e, n, r, i), e.unwrap = () => e._zod.def.innerType;
});
function Gl(e, t) {
  return new Fl({
    type: "prefault",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : Pr(t);
    }
  });
}
const bi = /* @__PURE__ */ p("ZodNonOptional", (e, t) => {
  ic.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Cu(e, n, r, i), e.unwrap = () => e._zod.def.innerType;
});
function Kl(e, t) {
  return new bi({
    type: "nonoptional",
    innerType: e,
    ...k(t)
  });
}
const Vl = /* @__PURE__ */ p("ZodCatch", (e, t) => {
  oc.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Mu(e, n, r, i), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function Jl(e, t) {
  return new Vl({
    type: "catch",
    innerType: e,
    catchValue: typeof t == "function" ? t : Go(t)
  });
}
const _i = /* @__PURE__ */ p("ZodPipe", (e, t) => {
  Wr.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Zu(e, n, r, i), e.in = t.in, e.out = t.out;
});
function Vn(e, t) {
  return new _i({
    type: "pipe",
    in: e,
    out: t
    // ...util.normalizeParams(params),
  });
}
const Wl = /* @__PURE__ */ p("ZodPreprocess", (e, t) => {
  _i.init(e, t), sc.init(e, t);
}), Hl = /* @__PURE__ */ p("ZodReadonly", (e, t) => {
  ac.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Uu(e, n, r, i), e.unwrap = () => e._zod.def.innerType;
});
function Xl(e) {
  return new Hl({
    type: "readonly",
    innerType: e
  });
}
const Yl = /* @__PURE__ */ p("ZodLazy", (e, t) => {
  cc.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Bu(e, n, r, i), e.unwrap = () => e._zod.def.getter();
});
function vi(e) {
  return new Yl({
    type: "lazy",
    getter: e
  });
}
const Ql = /* @__PURE__ */ p("ZodCustom", (e, t) => {
  uc.init(e, t), D.init(e, t), e._zod.processJSONSchema = (n, r, i) => Pu(e, n, r, i);
});
function ed(e, t = {}) {
  return /* @__PURE__ */ du(Ql, e, t);
}
function td(e, t) {
  return /* @__PURE__ */ pu(e, t);
}
function tn(e, t) {
  return new Wl({
    type: "pipe",
    in: hi(e),
    out: t
  });
}
const fe = {
  custom: "custom"
};
ne({ jitless: !0 });
const nd = /^\d{4}-\d{2}-\d{2}$/, rd = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, id = /^data:image\/(svg\+xml|png|jpeg|webp)(;charset=[^;,]+)?(;base64)?,/i, L = f().regex(nd), od = tn(
  (e) => e === "" ? null : e,
  L.nullable().optional()
), g = de().finite(), X = de().int(), we = de().finite().min(0), w = f().trim().min(1), sd = f().trim().min(1).nullable(), $ = f().trim().min(1).nullable().optional(), ad = tn(
  (e) => e === void 0 ? null : e,
  sd
), Ii = f().regex(rd), cd = f().regex(id), wi = E(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]), ki = E([
  "classic",
  "neutral"
]), Ti = E([
  "invoice-left-logo-right",
  "invoice-center-logo-center",
  "invoice-right-logo-left"
]), Ye = vi(() => en([
  f(),
  g,
  A(),
  xl(),
  B(Ye),
  pe(f(), Ye)
])), Si = vi(() => P({
  type: w,
  attrs: pe(f(), Ye).nullable().optional(),
  content: B(Si).optional(),
  marks: B(P({
    type: w,
    attrs: pe(f(), Ye).nullable().optional()
  }).passthrough()).optional(),
  text: f().optional()
}).passthrough()), Jn = P({
  version: W(1),
  type: W("tiptap-json"),
  content: Si,
  plainTextPreview: f().optional(),
  updatedAt: g
}).passthrough(), ud = tn((e) => {
  if (e == null)
    return e;
  const t = Jn.safeParse(e);
  if (t.success)
    return t.data;
}, Jn.nullable().optional()), ld = P({
  paused: A().optional(),
  resumeFrom: L.optional(),
  type: E(["weekly", "monthly", "yearly"]),
  weeklyDays: B(de().int().min(0).max(6)).optional(),
  monthlyType: E(["first", "last", "specific"]).optional(),
  monthlyDay: de().int().min(1).max(31).optional(),
  yearlyDate: L.optional()
}).passthrough();
P({
  id: w,
  title: w,
  createdAt: g.optional(),
  updatedAt: g.optional(),
  description: f().optional(),
  notes: ud,
  hourlyRate: g.nullable().optional(),
  flatRate: A().optional(),
  preferredClientId: $,
  isPersonal: A().optional(),
  archived: A().optional(),
  archivedOnDate: L.nullable().optional(),
  lastBilledAt: g.nullable().optional(),
  color: f().nullable().optional(),
  invoiceIds: B(w).optional(),
  billableTimeIncrementMinutes: de().int().positive().nullable().optional(),
  taskView: E(["list", "kanban"]).optional(),
  taskSort: E(["createdAt", "lastActive", "name", "manual"]).optional(),
  statusMode: E(["active", "quote"]).optional(),
  deadline: L.nullable().optional(),
  deadlineResolvedAt: g.nullable().optional(),
  budgetAmount: we.nullable().optional()
}).passthrough();
P({
  id: w,
  projectId: $,
  parentTaskId: $,
  title: w,
  note: f().nullable().optional(),
  completed: A().optional(),
  archived: A().optional(),
  archivedOnDate: L.nullable().optional(),
  billable: A().optional(),
  billableSetByUser: A().optional(),
  sortOrder: g.nullable().optional(),
  sortOrderUpdatedAt: g.nullable().optional(),
  lastActive: g.optional(),
  createdAt: g.optional(),
  lastBilledAt: g.nullable().optional(),
  startDate: L.nullable().optional(),
  recurring: ld.nullable().optional(),
  promptTimeEntry: A().optional(),
  skipUntilNextRecurring: A().optional(),
  skippedOccurrenceDate: L.nullable().optional(),
  completedDatesByYear: pe(f(), pe(f(), B(de().int().min(1).max(31)))).optional(),
  completedOnDate: L.nullable().optional(),
  estimatedHours: we.nullable().optional(),
  estimatedFlatAmount: we.nullable().optional(),
  quotedAmountBilling: P({
    invoiceId: w,
    billedAt: g,
    total: we
  }).nullable().optional()
}).passthrough();
P({
  id: w,
  taskId: w,
  start: g,
  end: g,
  createdAt: g.optional(),
  updatedAt: g.optional(),
  note: f().optional(),
  source: f().optional(),
  billedHourlyRate: g.nullable().optional(),
  billedAt: g.nullable().optional(),
  billedInvoiceId: $,
  billedDurationMs: we.nullable().optional(),
  billingIncrementMinutes: de().int().positive().nullable().optional(),
  _stoppedTimerKey: w.optional(),
  _stoppedTimerInstanceId: w.optional()
}).superRefine((e, t) => {
  e.end < e.start && t.addIssue({
    code: fe.custom,
    path: ["end"],
    message: "end must be greater than or equal to start"
  });
}).passthrough();
P({
  id: w,
  title: w,
  createdAt: g.optional(),
  updatedAt: g.optional(),
  clientName: f().optional(),
  contactPerson: f().optional(),
  email: f().optional(),
  phone: f().optional(),
  address: f().optional(),
  city: f().optional(),
  state: f().optional(),
  zip: f().optional(),
  country: f().optional(),
  registrationNumber: f().optional(),
  vat: f().optional(),
  taxNumber: f().optional(),
  notes: f().optional(),
  custom: B(P({ label: f(), value: f() })).optional(),
  disableTax: A().optional(),
  defaultHourlyRate: g.nullable().optional(),
  hourlyRate: g.nullable().optional(),
  flatRate: A().optional(),
  defaultCurrency: f().optional(),
  archived: A().optional(),
  archivedOnDate: L.nullable().optional(),
  color: f().nullable().optional()
}).passthrough();
P({
  id: w,
  title: f().trim().min(1).optional(),
  name: f().trim().min(1).optional(),
  businessName: f().trim().min(1).optional(),
  email: f().optional(),
  phone: f().optional(),
  address: f().optional(),
  city: f().optional(),
  state: f().optional(),
  zip: f().optional(),
  country: f().optional(),
  registrationNumber: f().optional(),
  vat: f().optional(),
  taxNumber: f().optional(),
  custom: B(P({ label: f(), value: f() })).optional(),
  taxId: f().optional(),
  logo: f().optional(),
  isDefault: A().optional(),
  taxEnabled: A().optional(),
  taxLabel: f().optional(),
  taxRate: g.optional(),
  branding: P({
    primaryColor: Ii.nullable().optional(),
    logoAssetId: $
  }).passthrough().optional()
}).superRefine((e, t) => {
  !e.title && !e.name && t.addIssue({
    code: fe.custom,
    path: ["title"],
    message: "title or name is required"
  }), !e.businessName && !e.name && t.addIssue({
    code: fe.custom,
    path: ["businessName"],
    message: "businessName or name is required"
  });
}).passthrough();
P({
  id: w,
  businessInfoId: w,
  kind: W("logo"),
  dataUrl: cd,
  mimeType: wi,
  fileName: f().nullable().optional(),
  width: X.positive(),
  height: X.positive(),
  byteSize: X.positive(),
  contentHash: w,
  createdAt: g,
  updatedAt: g.nullable().optional(),
  archivedAt: g.nullable().optional()
}).passthrough();
const dd = P({
  description: f(),
  quantity: g,
  rate: g,
  amount: g,
  projectId: f().optional(),
  taskId: f().optional(),
  expenseId: f().optional(),
  supplierName: f().nullable().optional(),
  originalAmount: g.optional(),
  originalCurrency: f().optional(),
  exchangeRate: g.optional(),
  lineType: E(["project", "project-subtotal", "task", "expense", "custom"]).optional(),
  rateLabel: f().optional(),
  quantityLabel: f().optional(),
  pricingMode: E(["hourly", "flat", "mixed"]).optional()
}).passthrough(), Ai = P({
  capturedAt: g,
  sourceCurrency: w,
  sourceAmount: g,
  preferredCurrencyAtPayment: w,
  preferredCurrencyAmount: g
}).passthrough(), pd = P({
  projectId: w,
  projectTitle: w,
  clientId: w,
  pricingMode: E(["hourly", "flat", "mixed"]),
  tasks: B(pe(f(), Xe())).optional(),
  expenseItems: B(pe(f(), Xe())).optional(),
  totalHours: g,
  subtotal: g,
  allocatedDiscount: g.optional(),
  allocatedShipping: g.optional(),
  allocatedTax: g.optional(),
  allocatedTotal: g.optional()
}).passthrough(), fd = P({
  version: W(1),
  capturedAt: g,
  taskLastBilledAt: pe(f(), g.nullable())
}).passthrough(), md = P({
  version: W(1),
  capturedAt: g,
  invoiceCurrency: w,
  entries: B(P({
    entryId: w,
    taskId: w,
    start: g,
    end: g,
    actualDurationMs: g.nonnegative(),
    billableDurationMs: g.nonnegative(),
    billedHourlyRate: g.nullable()
  }).refine((e) => e.end >= e.start, {
    message: "end must be greater than or equal to start",
    path: ["end"]
  })),
  tasks: B(P({
    taskId: w,
    title: w,
    pricingMode: E(["hourly", "flat"]),
    quantity: g.nonnegative(),
    rate: g,
    amount: g,
    quotedAmount: g.nullable()
  })),
  expenses: B(P({
    expenseId: w,
    title: w,
    sourceAmount: g,
    sourceCurrency: w,
    invoiceAmount: g,
    invoiceCurrency: w,
    exchangeRate: g.positive()
  }))
}).passthrough();
P({
  id: w,
  projectId: ad,
  projectIds: B(w).optional(),
  projectBreakdowns: B(pd).optional(),
  clientId: w,
  createdAt: g.optional(),
  updatedAt: g.optional(),
  businessInfoId: $,
  invoiceNumber: w,
  date: L,
  dueDate: L.nullable().optional(),
  status: E(["draft", "sent", "paid", "overdue", "canceled"]),
  items: B(dd),
  subtotal: g,
  tax: g.optional(),
  taxRate: g.optional(),
  total: g,
  notes: f().optional(),
  paymentMethodId: $,
  billingPeriodPreset: E(["last-month", "month", "all-time", "custom"]).optional(),
  billingPeriodStart: L.nullable().optional(),
  billingPeriodEnd: L.nullable().optional(),
  currency: f().optional(),
  paidAt: g.nullable().optional(),
  paymentCurrencySnapshot: Ai.nullable().optional(),
  sentAt: g.nullable().optional(),
  sentToEmail: f().nullable().optional(),
  canceledAt: g.positive().nullable().optional(),
  cancellationReason: f().trim().min(1).max(500).nullable().optional(),
  billingStateSnapshot: fd.nullable().optional(),
  billingSelectionSnapshot: md.nullable().optional(),
  draftNumberMode: E(["automatic", "manual"]).optional(),
  brandingSnapshot: P({
    businessInfoId: $,
    templateId: $,
    layoutStyle: ki.optional(),
    logoPlacement: Ti,
    showBusinessLogo: A(),
    useBusinessPrimaryColor: A(),
    primaryColor: Ii.nullable().optional(),
    logoAssetId: $,
    logoAssetMeta: P({
      mimeType: wi,
      width: X.positive(),
      height: X.positive(),
      byteSize: X.positive(),
      contentHash: w
    }).nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough().superRefine((e, t) => {
  e.status === "canceled" && (typeof e.canceledAt != "number" && t.addIssue({
    code: fe.custom,
    path: ["canceledAt"],
    message: "canceledAt is required for canceled invoices"
  }), (typeof e.cancellationReason != "string" || !e.cancellationReason.trim()) && t.addIssue({
    code: fe.custom,
    path: ["cancellationReason"],
    message: "cancellationReason is required for canceled invoices"
  }));
});
P({
  id: w,
  name: w,
  prefix: f().optional(),
  useSequentialNumbers: A().optional(),
  currentSequentialNumber: X.optional(),
  defaultNotes: f().optional(),
  defaultTaxRate: g.optional(),
  defaultDueDays: X.optional(),
  isDefault: A().optional(),
  brandingOptions: P({
    showBusinessLogo: A().optional(),
    useBusinessPrimaryColor: A().optional()
  }).passthrough().optional(),
  layoutStyle: ki.optional(),
  logoPlacement: Ti.optional(),
  showBillingPeriod: A().optional(),
  showProjectTitle: A().optional()
}).passthrough();
P({
  id: w,
  name: w,
  type: E(["invoice", "quote"]),
  fromName: f().max(200).optional(),
  replyTo: f().email().max(320).optional(),
  subject: f().max(500),
  sendBody: f().max(5e3),
  reminderBody: f().max(5e3),
  attachmentTitle: f().max(200),
  isDefault: A().optional(),
  createdAt: g.optional(),
  updatedAt: g.optional()
}).passthrough();
P({
  id: w,
  title: w,
  fullName: f().optional(),
  bank: f().optional(),
  iban: f().optional(),
  swift: f().optional(),
  bankAddress: f().optional(),
  paypal: f().optional(),
  custom: B(P({ label: f(), value: f() })).default([]),
  instructions: f().optional(),
  isDefault: A().optional(),
  createdAt: g.optional(),
  updatedAt: g.optional(),
  name: f().optional()
}).passthrough();
P({
  id: w,
  title: w,
  note: f().nullable().optional(),
  date: L,
  supplierName: f().nullable().optional(),
  receiptNumber: f().nullable().optional(),
  currency: w,
  amount: g,
  paidOn: od,
  paidBy: f().nullable().optional(),
  paymentStatus: E(["unpaid", "paid"]),
  paymentMode: E(["manual", "auto"]).optional().default("manual"),
  clientId: $,
  projectId: $,
  businessId: $,
  categoryId: $,
  isPersonal: A(),
  billable: A(),
  billingStatus: E(["unbilled", "billed"]).default("unbilled"),
  invoiceId: $,
  billedAt: g.nullable().optional(),
  isRecurring: A().default(!1),
  recurrenceId: $,
  amountType: E(["fixed", "variable"]).nullable().optional(),
  taxNumber: f().nullable().optional(),
  isTaxExempt: A().default(!1),
  amountExcludingTax: g.nullable().optional(),
  taxLabel: f().nullable().optional(),
  taxRate: g.nullable().optional(),
  taxClaimStatus: E(["unclaimed", "claimed", "excluded"]).nullable().optional(),
  taxClaimPeriodId: $,
  taxClaimedAt: g.nullable().optional(),
  paymentCurrencySnapshot: Ai.nullable().optional().catch(null),
  isPreview: A().optional(),
  createdAt: g.optional(),
  updatedAt: g.optional()
}).passthrough();
P({
  id: w,
  title: w,
  note: f().nullable().optional(),
  supplierName: f().nullable().optional(),
  paidBy: f().nullable().optional(),
  currency: w,
  amount: g,
  amountType: E(["fixed", "variable"]),
  paymentMode: E(["manual", "auto"]).optional(),
  repeat: E(["monthly", "yearly"]),
  monthlyType: E(["first", "last", "specific"]).optional(),
  monthlyDay: X.min(1).max(31).optional(),
  startDate: L,
  endDate: L.nullable().optional(),
  clientId: $,
  projectId: $,
  businessId: $,
  categoryId: $,
  isPersonal: A(),
  billable: A(),
  taxNumber: f().nullable().optional(),
  isTaxExempt: A(),
  amountExcludingTax: g.nullable().optional(),
  taxLabel: f().nullable().optional(),
  taxRate: g.nullable().optional(),
  lastGeneratedDate: L.nullable().optional(),
  active: A(),
  createdAt: g.optional(),
  updatedAt: g.optional()
}).passthrough();
P({
  color: f().nullable().optional(),
  id: w,
  name: w,
  group: f().nullable().optional(),
  isDefault: A().default(!1),
  archived: A().default(!1),
  createdAt: g.optional(),
  updatedAt: g.optional()
}).passthrough();
P({
  id: w,
  title: w,
  type: E(["vat", "income-tax", "sales-tax", "other"]),
  startDate: L,
  endDate: L,
  businessInfoId: $,
  status: E(["draft", "filed", "paid"]).default("draft"),
  filedAt: g.nullable().optional(),
  paidAt: g.nullable().optional(),
  notes: f().nullable().optional(),
  createdAt: g.optional(),
  updatedAt: g.optional()
}).superRefine((e, t) => {
  e.endDate < e.startDate && t.addIssue({
    code: fe.custom,
    path: ["endDate"],
    message: "endDate must be greater than or equal to startDate"
  });
}).passthrough();
P({
  id: w,
  type: E(["client", "project", "task"]),
  referenceId: w,
  mode: E(["static", "date", "weekday"]),
  date: L.nullable().optional(),
  weekday: X.min(0).max(6).nullable().optional(),
  sortOrder: g,
  createdAt: g,
  estimatedHours: g.nullable().optional()
}).superRefine((e, t) => {
  e.mode === "date" && !e.date && t.addIssue({
    code: fe.custom,
    path: ["date"],
    message: "date is required when mode is date"
  }), e.mode === "weekday" && (e.weekday === void 0 || e.weekday === null) && t.addIssue({
    code: fe.custom,
    path: ["weekday"],
    message: "weekday is required when mode is weekday"
  });
}).passthrough();
P({
  id: w,
  weekday: X.min(0).max(6),
  targetHours: g.nullable().optional(),
  targetEarnings: g.nullable().optional(),
  createdAt: g,
  updatedAt: g.nullable().optional()
}).passthrough();
P({
  currency: f().optional(),
  dateFormat: f().optional(),
  timeFormat: f().optional(),
  theme: E(["light", "dark", "system"]).optional(),
  defaultView: f().optional(),
  weekStartsOn: en([
    W(0),
    W(1),
    W(2),
    W(3),
    W(4),
    W(5),
    W(6)
  ]).optional(),
  autoHideTotalsOnRevisit: A().optional(),
  showCompletedTasks: A().optional(),
  defaultBillable: A().optional(),
  projectSort: E(["createdAt", "lastActive", "name"]).optional(),
  clientSort: E(["createdAt", "lastActive", "name"]).optional(),
  autoSyncEnabled: A().optional(),
  autoSyncMode: E(["backup", "sync"]).optional(),
  weeklyGoalTargetHours: g.nullable().optional(),
  weeklyGoalTargetEarnings: g.nullable().optional(),
  systemNotificationsEnabled: A().optional(),
  systemNotificationTime: f().regex(/^\d{2}:\d{2}$/).optional(),
  backupEnabled: A().optional(),
  backupFrequencyHours: X.min(1).optional()
}).passthrough();
P({
  projectId: w,
  taskId: w,
  timerInstanceId: w.optional(),
  startTime: g,
  paused: A().optional(),
  pausedElapsedTime: we.optional(),
  note: f().optional(),
  lastActive: g.optional()
}).passthrough();
const hd = "1.5";
Array.from(/* @__PURE__ */ new Set(["1.0", "1.1", "1.3", "1.4", hd]));
const gd = [
  { value: "last-month", label: "Last Month" },
  { value: "month", label: "This Month" },
  { value: "all-time", label: "All Time" },
  { value: "custom", label: "Custom Range" }
];
new Set(
  gd.map((e) => e.value)
);
const Ot = (e, t) => t.some((n) => e instanceof n);
let Wn, Hn;
function yd() {
  return Wn || (Wn = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function bd() {
  return Hn || (Hn = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const jt = /* @__PURE__ */ new WeakMap(), gt = /* @__PURE__ */ new WeakMap(), at = /* @__PURE__ */ new WeakMap();
function _d(e) {
  const t = new Promise((n, r) => {
    const i = () => {
      e.removeEventListener("success", o), e.removeEventListener("error", s);
    }, o = () => {
      n(Qe(e.result)), i();
    }, s = () => {
      r(e.error), i();
    };
    e.addEventListener("success", o), e.addEventListener("error", s);
  });
  return at.set(t, e), t;
}
function vd(e) {
  if (jt.has(e))
    return;
  const t = new Promise((n, r) => {
    const i = () => {
      e.removeEventListener("complete", o), e.removeEventListener("error", s), e.removeEventListener("abort", s);
    }, o = () => {
      n(), i();
    }, s = () => {
      r(e.error || new DOMException("AbortError", "AbortError")), i();
    };
    e.addEventListener("complete", o), e.addEventListener("error", s), e.addEventListener("abort", s);
  });
  jt.set(e, t);
}
let Nt = {
  get(e, t, n) {
    if (e instanceof IDBTransaction) {
      if (t === "done")
        return jt.get(e);
      if (t === "store")
        return n.objectStoreNames[1] ? void 0 : n.objectStore(n.objectStoreNames[0]);
    }
    return Qe(e[t]);
  },
  set(e, t, n) {
    return e[t] = n, !0;
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store") ? !0 : t in e;
  }
};
function Pi(e) {
  Nt = e(Nt);
}
function Id(e) {
  return bd().includes(e) ? function(...t) {
    return e.apply(Dt(this), t), Qe(this.request);
  } : function(...t) {
    return Qe(e.apply(Dt(this), t));
  };
}
function wd(e) {
  return typeof e == "function" ? Id(e) : (e instanceof IDBTransaction && vd(e), Ot(e, yd()) ? new Proxy(e, Nt) : e);
}
function Qe(e) {
  if (e instanceof IDBRequest)
    return _d(e);
  if (gt.has(e))
    return gt.get(e);
  const t = wd(e);
  return t !== e && (gt.set(e, t), at.set(t, e)), t;
}
const Dt = (e) => at.get(e), kd = ["get", "getKey", "getAll", "getAllKeys", "count"], Td = ["put", "add", "delete", "clear"], yt = /* @__PURE__ */ new Map();
function Xn(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string"))
    return;
  if (yt.get(t))
    return yt.get(t);
  const n = t.replace(/FromIndex$/, ""), r = t !== n, i = Td.includes(n);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(n in (r ? IDBIndex : IDBObjectStore).prototype) || !(i || kd.includes(n))
  )
    return;
  const o = async function(s, ...a) {
    const u = this.transaction(s, i ? "readwrite" : "readonly");
    let l = u.store;
    return r && (l = l.index(a.shift())), (await Promise.all([
      l[n](...a),
      i && u.done
    ]))[0];
  };
  return yt.set(t, o), o;
}
Pi((e) => ({
  ...e,
  get: (t, n, r) => Xn(t, n) || e.get(t, n, r),
  has: (t, n) => !!Xn(t, n) || e.has(t, n)
}));
const Sd = ["continue", "continuePrimaryKey", "advance"], Yn = {}, zt = /* @__PURE__ */ new WeakMap(), Ei = /* @__PURE__ */ new WeakMap(), Ad = {
  get(e, t) {
    if (!Sd.includes(t))
      return e[t];
    let n = Yn[t];
    return n || (n = Yn[t] = function(...r) {
      zt.set(this, Ei.get(this)[t](...r));
    }), n;
  }
};
async function* Pd(...e) {
  let t = this;
  if (t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)
    return;
  t = t;
  const n = new Proxy(t, Ad);
  for (Ei.set(n, t), at.set(n, Dt(t)); t; )
    yield n, t = await (zt.get(n) || t.continue()), zt.delete(n);
}
function Qn(e, t) {
  return t === Symbol.asyncIterator && Ot(e, [IDBIndex, IDBObjectStore, IDBCursor]) || t === "iterate" && Ot(e, [IDBIndex, IDBObjectStore]);
}
Pi((e) => ({
  ...e,
  get(t, n, r) {
    return Qn(t, n) ? Pd : e.get(t, n, r);
  },
  has(t, n) {
    return Qn(t, n) || e.has(t, n);
  }
}));
Promise.resolve(void 0);
function be(e) {
  return e === "true";
}
function xi(e) {
  return e === "localhost" || e === "127.0.0.1" || e === "::1" || e === "[::1]";
}
function Ed(e) {
  return e.isDevelopment && xi(e.hostname) && be(e.sandboxValue);
}
function xd(e) {
  const t = Ed({
    isDevelopment: e.isDevelopment,
    hostname: e.hostname,
    sandboxValue: e.values.VITE_BILLING_SANDBOX_MODE
  }), n = t || be(e.values.VITE_BILLING_UI_ENABLED), r = !t && be(e.values.VITE_BILLING_CANARY_UI_ENABLED);
  return {
    sandbox: t,
    localCatalogFallback: e.isDevelopment && xi(e.hostname) && !t,
    ui: n,
    canaryUi: r,
    status: n,
    trialActivation: t || r,
    checkout: t || r,
    clientLimitEnforcement: t || be(e.values.VITE_ACTIVE_CLIENT_LIMIT_ENFORCEMENT),
    advancedReportsEnforcement: t || be(e.values.VITE_REPORTS_ENTITLEMENT_ENFORCEMENT),
    emailEntitlementEnforcement: t || be(e.values.VITE_EMAIL_ENTITLEMENT_ENFORCEMENT)
  };
}
Object.freeze(xd({
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
const Od = [
  "Needs review",
  "Not due",
  "1-30 days",
  "31-60 days",
  "61-90 days",
  "90+ days"
];
Od.reduce((e, t, n) => (e.set(t, n), e), /* @__PURE__ */ new Map());
const H = 1, jd = "tasktime.agent.browser-reconnect";
function Nd(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_control" && t.protocolVersion === H && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && t.action === "revoke";
}
function ke(e) {
  return typeof e == "string" && e.trim().length > 0;
}
function Dd(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_register" && t.protocolVersion === H && ke(t.sessionToken) && !!t.publicKeyJwk && typeof t.publicKeyJwk == "object";
}
function zd(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_proof" && t.protocolVersion === H && ke(t.keyId) && ke(t.challengeId) && ke(t.signature);
}
function Rd(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_reconnect_forget" && t.protocolVersion === H && ke(t.sessionToken) && ke(t.keyId);
}
function Cd(e) {
  const t = {
    domain: jd,
    protocolVersion: H,
    bridgeInstanceId: e.bridgeInstanceId,
    keyId: e.keyId,
    challengeId: e.challengeId,
    nonce: e.nonce,
    origin: e.origin,
    expiresAt: e.expiresAt
  };
  return JSON.stringify(t);
}
function $d(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.grant;
  return t.type === "agent_bridge_approval_grant" && t.protocolVersion === H && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && !!n && typeof n == "object" && typeof n.id == "string" && n.id.trim().length > 0 && typeof n.clientId == "string" && n.clientId.trim().length > 0 && (n.label === void 0 || typeof n.label == "string") && Array.isArray(n.scopes) && n.scopes.every((r) => typeof r == "string") && typeof n.secretKeyBase64Url == "string" && n.secretKeyBase64Url.trim().length > 0 && typeof n.createdAt == "number" && Number.isFinite(n.createdAt) && (n.expiresAt === void 0 || n.expiresAt === null || typeof n.expiresAt == "number" && Number.isFinite(n.expiresAt));
}
function Ld(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.type === "agent_bridge_approval_grant_revoke" && t.protocolVersion === H && typeof t.sessionToken == "string" && t.sessionToken.trim().length > 0 && typeof t.grantId == "string" && t.grantId.trim().length > 0 && typeof t.revokedAt == "number" && Number.isFinite(t.revokedAt);
}
const Oi = "https://tasktime.pro", ji = "https://app.tasktime.pro", Md = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]"]);
class er extends Error {
  constructor(t) {
    super(t), this.name = "TaskTimeOriginConfigurationError";
  }
}
function Zd(e) {
  if (Md.has(e))
    return !0;
  const t = e.split(".");
  return t.length === 4 && t[0] === "127" && t.every((n) => /^\d+$/u.test(n) && Number(n) <= 255);
}
function nn(e, t) {
  let n;
  try {
    n = new URL(e);
  } catch {
    throw new er(`Invalid ${t} origin configuration.`);
  }
  const r = n.protocol === "https:", i = n.protocol === "http:" && Zd(n.hostname);
  if (e.includes("*") || e !== n.origin || n.username !== "" || n.password !== "" || !r && !i)
    throw new er(`Invalid ${t} origin configuration.`);
  return n.origin;
}
function Ud(e = Oi) {
  return e = nn(e, "agent documentation"), {
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
const Bd = Ud(), Ni = [
  Oi,
  "https://www.tasktime.pro",
  ji,
  "http://localhost:3101",
  "http://127.0.0.1:3101",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
], qd = /* @__PURE__ */ new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]"
]);
function Fd(e) {
  return e.trim().toLowerCase();
}
function Gd(e) {
  const t = Fd(e);
  if (qd.has(t))
    return !0;
  const n = t.split(".");
  return n.length !== 4 || n[0] !== "127" ? !1 : n.every((r) => {
    if (!/^\d+$/.test(r))
      return !1;
    const i = Number(r);
    return i >= 0 && i <= 255;
  });
}
function Kd(e) {
  if (!Gd(e))
    throw new R("INVALID_INPUT", "Agent bridge server must bind to a loopback host.", { host: e });
}
function tr(e) {
  try {
    return nn(e, "agent bridge");
  } catch {
    return null;
  }
}
function Vd(e, t = Ni) {
  if (!e)
    return !1;
  const n = tr(e);
  return n ? new Set(Array.from(t).map((r) => tr(r)).filter(Boolean)).has(n) : !1;
}
function Jd(e, t) {
  if (!Vd(e, t))
    throw new R("PERMISSION_DENIED", "Origin is not allowed to connect to the TaskTime Pro agent bridge.", {
      origin: e || null
    });
}
const Wd = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", Hd = "/tasktime-agent", Xd = 12e4, Yd = 3e4;
class Qd {
  constructor(t, n, r, i = null, o = !1) {
    this.id = n, this.origin = r, this.session = i, this.reconnectPending = o, this.socket = t;
  }
  sendJson(t) {
    this.socket.destroyed || this.socket.write(tp(JSON.stringify(t)));
  }
  close() {
    this.socket.destroy();
  }
}
function ep(e) {
  return vr("sha1").update(`${e}${Wd}`).digest("base64");
}
function tp(e) {
  const t = ie.from(e), n = t.length;
  if (n < 126)
    return ie.concat([
      ie.from([129, n]),
      t
    ]);
  if (n <= 65535) {
    const i = ie.alloc(4);
    return i[0] = 129, i[1] = 126, i.writeUInt16BE(n, 2), ie.concat([i, t]);
  }
  const r = ie.alloc(10);
  return r[0] = 129, r[1] = 127, r.writeBigUInt64BE(BigInt(n), 2), ie.concat([r, t]);
}
function np(e) {
  const t = [];
  let n = 0;
  for (; n + 2 <= e.length; ) {
    const r = e[n], i = e[n + 1], o = r & 15, s = (i & 128) === 128;
    let a = i & 127;
    if (n += 2, a === 126) {
      if (n + 2 > e.length) break;
      a = e.readUInt16BE(n), n += 2;
    } else if (a === 127) {
      if (n + 8 > e.length) break;
      const d = e.readBigUInt64BE(n);
      if (d > BigInt(Number.MAX_SAFE_INTEGER)) break;
      a = Number(d), n += 8;
    }
    let u = null;
    if (s) {
      if (n + 4 > e.length) break;
      u = e.subarray(n, n + 4), n += 4;
    }
    if (n + a > e.length) break;
    const l = ie.from(e.subarray(n, n + a));
    if (n += a, u)
      for (let d = 0; d < l.length; d += 1)
        l[d] ^= u[d % 4];
    o === 1 && t.push(l.toString("utf8"));
  }
  return t;
}
function rp(e) {
  const t = e.headers.host || "127.0.0.1";
  return new URL(e.url || "/", `http://${t}`);
}
function ip(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e, n = t.response;
  return t.protocolVersion === H && typeof t.requestId == "string" && !!n && typeof n == "object" && typeof n.command == "string" && typeof n.ok == "boolean";
}
class op {
  constructor(t) {
    this.clients = /* @__PURE__ */ new Set(), this.pendingResponses = /* @__PURE__ */ new Map(), this.sessions = /* @__PURE__ */ new Map(), this.reconnectAuthorizations = /* @__PURE__ */ new Map(), this.reconnectChallenges = /* @__PURE__ */ new Map(), this.sessionReconnectKeyIds = /* @__PURE__ */ new Map(), this.bridgeInstanceId = Ie(), this.server = null, this.nextClientId = 0, this.authoritativeClientId = null, Kd(t.host), this.options = t, this.auditLog = t.auditLog ?? new Ir();
  }
  async start() {
    if (this.server)
      return;
    const t = Qi();
    this.server = t, t.on("upgrade", (n, r) => {
      this.handleUpgrade(n, r);
    }), await new Promise((n) => {
      t.listen(this.options.port, this.options.host, n);
    });
  }
  async stop() {
    const t = this.server;
    this.server = null, this.rejectPendingResponses(new R("UNAVAILABLE", "Agent bridge server stopped."));
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
    }), this.rejectPendingResponses(new R("PERMISSION_DENIED", "TaskTime Pro agent bridge access was revoked.")), this.sessions.clear(), this.reconnectAuthorizations.clear(), this.reconnectChallenges.clear(), this.sessionReconnectKeyIds.clear();
    for (const n of this.clients)
      n.close();
  }
  createSessionRequest(t, n, r, i, o) {
    if (!t.session)
      throw new R("PERMISSION_DENIED", "TaskTime Pro app session is not paired.");
    const s = {
      protocolVersion: H,
      requestId: n,
      sessionToken: t.session.sessionToken,
      command: r,
      input: i
    };
    return o && (s.approval = o), s;
  }
  sendPairedAppSessionCommand(t, n, r, i = {}) {
    const o = this.getAuthoritativeClient(), s = this.createSessionRequest(o, t, n, r, i.approval);
    return this.sendAppSessionRequest(s, {
      ...i,
      client: o
    });
  }
  sendAppSessionRequest(t, n = {}) {
    const r = n.client || this.getAuthoritativeClient();
    if (this.pendingResponses.has(t.requestId))
      throw new R("CONFLICT", "Agent app-session request ID is already pending.", {
        requestId: t.requestId
      });
    return new Promise((i, o) => {
      const s = setTimeout(() => {
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
        }), o(new R("UNAVAILABLE", "Agent app-session request timed out.", {
          requestId: t.requestId
        }));
      }, n.timeoutMs ?? Xd);
      this.pendingResponses.set(t.requestId, {
        client: r,
        timeoutId: s,
        resolve: i,
        reject: o
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
      throw new R("UNAVAILABLE", "No TaskTime Pro app session is connected.");
    const t = Array.from(this.clients).find((n) => n.id === this.authoritativeClientId);
    if (!t)
      throw new R("UNAVAILABLE", "No authoritative TaskTime Pro app session is available.");
    return t;
  }
  electAuthoritativeClient() {
    this.authoritativeClientId = Array.from(this.clients).find((t) => !t.reconnectPending)?.id ?? null;
  }
  resolvePendingResponse(t, n) {
    const r = t.requestId;
    if (!r)
      return !1;
    const i = this.pendingResponses.get(r);
    if (!i || i.client !== n)
      return !1;
    clearTimeout(i.timeoutId), this.pendingResponses.delete(r), i.resolve(t);
    const o = "error" in t.response ? t.response.error.code : void 0;
    return this.audit({
      action: t.response.ok ? "command_completed" : "command_failed",
      clientId: n.id,
      requestId: r,
      command: t.response.command,
      ok: t.response.ok,
      errorCode: o
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
    for (const [r, i] of this.pendingResponses)
      n && i.client !== n || (clearTimeout(i.timeoutId), this.pendingResponses.delete(r), i.reject(t));
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
    const r = n.session, i = this.options.pairing?.now ? this.options.pairing.now() : Date.now();
    if (!r || t.sessionToken !== r.sessionToken || dn(r, i) || n.origin.length === 0) {
      n.close();
      return;
    }
    const o = await this.importReconnectPublicKey(t.publicKeyJwk);
    if (!o) {
      n.close();
      return;
    }
    const s = Ie(), a = {
      keyId: s,
      publicKey: o,
      origin: n.origin,
      scopes: new Set(r.scopes),
      createdAt: i,
      expiresAt: r.expiresAt,
      agentId: r.agentId,
      agentLabel: r.agentLabel
    };
    this.reconnectAuthorizations.set(s, a), n.sendJson({
      type: "agent_bridge_reconnect_registered",
      protocolVersion: H,
      keyId: s,
      bridgeInstanceId: this.bridgeInstanceId,
      expiresAt: a.expiresAt
    });
  }
  createReconnectChallenge(t, n, r) {
    const i = Ie(), o = {
      type: "agent_bridge_reconnect_challenge",
      protocolVersion: H,
      bridgeInstanceId: this.bridgeInstanceId,
      keyId: n.keyId,
      challengeId: i,
      nonce: _r(32).toString("base64url"),
      origin: n.origin,
      expiresAt: Math.min(r + Yd, n.expiresAt)
    };
    return this.reconnectChallenges.set(i, {
      clientId: t.id,
      message: o
    }), o;
  }
  async handleReconnectProofMessage(t, n) {
    const r = this.reconnectChallenges.get(t.challengeId);
    if (this.reconnectChallenges.delete(t.challengeId), !r) {
      n.close();
      return;
    }
    const i = this.reconnectAuthorizations.get(t.keyId), o = this.options.pairing?.now ? this.options.pairing.now() : Date.now();
    if (!i || r.clientId !== n.id || r.message.keyId !== t.keyId || r.message.bridgeInstanceId !== this.bridgeInstanceId || r.message.origin !== n.origin || r.message.expiresAt <= o || i.expiresAt <= o || i.origin !== n.origin) {
      n.close();
      return;
    }
    let s = !1;
    try {
      s = await globalThis.crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        i.publicKey,
        new Uint8Array(ie.from(t.signature, "base64url")),
        new TextEncoder().encode(Cd(r.message))
      );
    } catch {
      s = !1;
    }
    if (!s) {
      n.close();
      return;
    }
    const a = this.options.pairing, u = ln({
      scopes: i.scopes,
      now: () => o,
      ttlMs: i.expiresAt - o,
      tokenBytes: a?.tokenBytes,
      tokenFactory: a?.tokenFactory,
      agentId: i.agentId,
      agentLabel: i.agentLabel
    });
    this.sessions.set(u.sessionToken, u), this.sessionReconnectKeyIds.set(u.sessionToken, i.keyId), n.session = u, n.reconnectPending = !1, this.authoritativeClientId || (this.authoritativeClientId = n.id), n.sendJson(this.createPairingMessage(u)), this.audit({
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
    for (const [i, o] of this.reconnectChallenges)
      o.message.keyId === t.keyId && this.reconnectChallenges.delete(i);
    const r = /* @__PURE__ */ new Set();
    for (const [i, o] of this.sessionReconnectKeyIds)
      o === t.keyId && (r.add(i), this.sessionReconnectKeyIds.delete(i), this.sessions.delete(i));
    for (const i of this.clients)
      (i === n || i.session && r.has(i.session.sessionToken)) && i.close();
    return !0;
  }
  createSessionConnection(t) {
    const n = this.options.pairing, r = n?.now ? n.now() : Date.now(), i = t.searchParams.get("reconnectKeyId")?.trim();
    if (i) {
      const d = this.reconnectAuthorizations.get(i);
      if (!d || d.expiresAt <= r)
        throw d && this.reconnectAuthorizations.delete(i), new R("PERMISSION_DENIED", "Browser reconnect authorization expired or not found.");
      return {
        reconnectAuthorization: d,
        resumed: !1,
        session: null
      };
    }
    const o = t.searchParams.get("sessionToken")?.trim();
    if (o) {
      const d = this.sessions.get(o);
      if (!d || dn(d, r))
        throw d && this.sessions.delete(o), new R("PERMISSION_DENIED", "Agent bridge session expired or not found.");
      return {
        resumed: !0,
        session: d
      };
    }
    if (!n)
      return null;
    const s = t.searchParams.get("pairingId"), a = t.searchParams.get("pairingCode");
    if (!s || !a) {
      if (n.required === !1)
        return null;
      throw new R("PERMISSION_DENIED", "Pairing credentials are required for the TaskTime Pro agent bridge.");
    }
    const u = n.store.consume(s, a, r), l = ln({
      scopes: u.scopes,
      now: () => r,
      ttlMs: n.sessionTtlMs,
      tokenBytes: n.tokenBytes,
      tokenFactory: n.tokenFactory,
      agentId: u.agentId,
      agentLabel: u.agentLabel
    });
    return this.sessions.set(l.sessionToken, l), { challenge: u, resumed: !1, session: l };
  }
  createPairingMessage(t) {
    const n = {
      type: "agent_bridge_session",
      protocolVersion: H,
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
      Jd(t.headers.origin, this.options.allowedOrigins || Ni);
      const r = new URL(String(t.headers.origin)).origin, i = rp(t);
      if (i.pathname !== (this.options.path || Hd))
        throw new Error("Invalid agent bridge WebSocket path.");
      const o = t.headers["sec-websocket-key"];
      if (typeof o != "string" || !o.trim())
        throw new Error("Missing WebSocket key.");
      const s = this.createSessionConnection(i);
      n.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${ep(o)}`,
        "",
        ""
      ].join(`\r
`));
      const a = new Qd(
        n,
        `client-${this.nextClientId++}`,
        r,
        s?.session ?? null,
        !!s?.reconnectAuthorization
      );
      this.clients.add(a), !this.authoritativeClientId && !a.reconnectPending && (this.authoritativeClientId = a.id), this.audit({
        action: "session_connected",
        clientId: a.id,
        details: {
          paired: !!s?.challenge,
          resumed: !!s?.resumed,
          browserReconnectPending: !!s?.reconnectAuthorization,
          authoritative: this.authoritativeClientId === a.id
        }
      }), s?.session && (a.sendJson(this.createPairingMessage(s.session)), s.challenge && (this.audit({
        action: "pairing_succeeded",
        clientId: a.id,
        details: {
          pairingId: s.challenge.id,
          scopes: s.challenge.scopes,
          expiresAt: s.session.expiresAt
        }
      }), this.options.onSessionCreated?.(s.session, a, s.challenge))), s?.reconnectAuthorization && a.sendJson(this.createReconnectChallenge(
        a,
        s.reconnectAuthorization,
        this.options.pairing?.now ? this.options.pairing.now() : Date.now()
      )), this.options.onClientConnected?.(a), n.on("data", (u) => {
        for (const l of np(u)) {
          let d;
          try {
            d = JSON.parse(l);
          } catch {
            d = l;
          }
          if (!(ip(d) && this.resolvePendingResponse(d, a)) && !(Nd(d) && this.handleControlMessage(d, a))) {
            if (Dd(d)) {
              this.handleReconnectRegisterMessage(d, a);
              continue;
            }
            if (zd(d)) {
              this.handleReconnectProofMessage(d, a);
              continue;
            }
            Rd(d) && this.handleReconnectForgetMessage(d, a) || $d(d) && this.handleApprovalGrantMessage(d, a) || Ld(d) && this.handleApprovalGrantRevocationMessage(d, a) || this.options.onMessage?.(d, a);
          }
        }
      }), n.on("end", () => {
        n.destroy();
      }), n.on("close", () => {
        const u = this.authoritativeClientId === a.id;
        this.clients.delete(a);
        for (const [l, d] of this.reconnectChallenges)
          d.clientId === a.id && this.reconnectChallenges.delete(l);
        u && this.electAuthoritativeClient(), this.rejectPendingResponses(new R("UNAVAILABLE", "TaskTime Pro app session disconnected."), a), this.audit({
          action: "session_disconnected",
          clientId: a.id,
          details: {
            wasAuthoritative: u,
            nextAuthoritativeClientId: this.authoritativeClientId
          }
        }), this.options.onClientDisconnected?.(a);
      });
    } catch {
      n.write(`HTTP/1.1 403 Forbidden\r
Connection: close\r
\r
`), n.destroy();
    }
  }
}
class sp {
  constructor(t) {
    this.pairingStore = new mo(), this.approvalGrants = /* @__PURE__ */ new Map(), this.options = t, this.auditLog = t.auditLog ?? new Ir();
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
    this.server = new op(n);
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
  sendCommand(t, n, r, i, o) {
    return this.server.sendPairedAppSessionCommand(t, n, r, { timeoutMs: i, approval: o });
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
    const n = ap(t.scopes), r = this.options.now ? this.options.now() : Date.now(), i = t.grantId ? this.approvalGrants.get(t.grantId) ?? null : Array.from(this.approvalGrants.values()).find((o) => this.isGrantBoundToConfiguredAgent(o) && nr(o.scopes, n)) ?? null;
    if (!i)
      throw new R("UNAVAILABLE", "No trusted TaskTime Pro approval grant is available for this bridge process.");
    if (!this.isGrantBoundToConfiguredAgent(i))
      throw new R("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant belongs to a different agent identity.");
    if (i.expiresAt != null && i.expiresAt <= r)
      throw new R("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant expired.");
    if (!nr(i.scopes, n))
      throw new R("PERMISSION_DENIED", "Trusted TaskTime Pro approval grant does not cover the requested scopes.");
    return ao({
      grant: i,
      command: t.command,
      inputHash: t.inputHash,
      scopes: n,
      category: t.category ?? cp(t.command, n),
      now: () => r,
      ttlMs: t.ttlMs,
      nonce: t.nonce
    });
  }
  getEndpoint() {
    const t = this.server.getAddress();
    if (!t || typeof t == "string")
      throw new R("UNAVAILABLE", "Local agent bridge must be started before creating a pairing challenge.");
    const n = this.options.path ?? "/tasktime-agent";
    return `ws://${up(this.options.host, t)}:${t.port}${n}`;
  }
  isGrantBoundToConfiguredAgent(t) {
    return !this.options.agentId || t.clientId === this.options.agentId;
  }
}
function ap(e) {
  return [...new Set(e)];
}
function nr(e, t) {
  const n = new Set(e);
  return t.every((r) => n.has(r));
}
function cp(e, t) {
  return t.includes("billing") ? "billing" : t.includes("email") ? "email" : t.includes("export") ? "export" : e.startsWith("delete_") || e.startsWith("cascade_delete_") || e.startsWith("restore_") || e === "undo_latest_invoice" ? "destructive" : "sensitive";
}
function up(e, t) {
  return e === "::1" || t.family === "IPv6" ? "[::1]" : e;
}
const c = { type: "string" }, S = { type: "number" }, v = { type: "boolean" }, m = { type: ["string", "null"] }, rr = {
  type: "object",
  properties: {
    id: c,
    title: c,
    hours: S,
    hourlyRate: S,
    flatRate: S,
    quantity: S,
    useFlatRate: v,
    parentTaskId: m
  },
  required: ["title"],
  additionalProperties: !1
}, Rt = {
  projectId: c,
  clientId: m,
  businessInfoId: m,
  paymentMethodId: m,
  invoiceTemplateId: m,
  note: c,
  quoteDate: c,
  quoteTimestamp: c,
  quoteTasks: {
    type: "array",
    items: rr
  },
  additionalTasks: {
    type: "array",
    items: rr
  }
}, ir = {
  ...Rt,
  emailTemplateId: m,
  to: m,
  fromName: m,
  replyTo: m,
  subject: m,
  body: m,
  attachmentTitle: m,
  forwardToSelf: v
}, q = {
  type: "object",
  properties: {},
  additionalProperties: !1
}, rn = [
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
], Di = [
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
        id: c,
        title: c,
        description: c,
        hourlyRate: { type: ["number", "null"] },
        flatRate: v,
        preferredClientId: m,
        isPersonal: v,
        color: m,
        billableTimeIncrementMinutes: { type: ["number", "null"] },
        taskView: { type: "string", enum: ["list", "kanban"] },
        taskSort: { type: "string", enum: ["createdAt", "lastActive", "name", "manual"] },
        statusMode: { type: "string", enum: ["active", "quote"] },
        deadline: m,
        budgetAmount: { type: ["number", "null"] },
        idempotencyKey: c
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
        projectId: c,
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
        projectId: c
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
        projectId: c
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
        projectId: c,
        includeInvoiceDeletion: v
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
        projectId: c,
        confirmDelete: v,
        confirmationText: c,
        expectedTaskIds: {
          type: "array",
          items: c
        },
        expectedTimeEntryIds: {
          type: "array",
          items: c
        },
        expectedTimerKeys: {
          type: "array",
          items: c
        },
        expectedExpenseIds: {
          type: "array",
          items: c
        },
        expectedRecurrenceIds: {
          type: "array",
          items: c
        },
        expectedPlannerAttachmentIds: {
          type: "array",
          items: c
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
        projectId: c,
        confirmDelete: v,
        confirmationText: c
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
        includeArchived: v
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
        id: c,
        title: c,
        clientName: c,
        contactPerson: c,
        email: c,
        phone: c,
        address: c,
        city: c,
        state: c,
        zip: c,
        country: c,
        registrationNumber: c,
        vat: c,
        taxNumber: c,
        notes: c,
        disableTax: v,
        defaultHourlyRate: { type: ["number", "null"] },
        hourlyRate: { type: ["number", "null"] },
        flatRate: v,
        defaultCurrency: c,
        color: m,
        idempotencyKey: c
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
        clientId: c,
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
        clientId: c
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
        clientId: c
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
        clientId: c,
        alsoDeleteProjects: v,
        includeInvoiceDeletion: v
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
        clientId: c,
        alsoDeleteProjects: v,
        confirmDelete: v,
        confirmationText: c,
        expectedProjectIdsToDelete: {
          type: "array",
          items: c
        },
        expectedProjectIdsToConvertToPersonal: {
          type: "array",
          items: c
        },
        expectedTaskIds: {
          type: "array",
          items: c
        },
        expectedTimeEntryIds: {
          type: "array",
          items: c
        },
        expectedTimerKeys: {
          type: "array",
          items: c
        },
        expectedExpenseIds: {
          type: "array",
          items: c
        },
        expectedRecurrenceIds: {
          type: "array",
          items: c
        },
        expectedPlannerAttachmentIds: {
          type: "array",
          items: c
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
        clientId: c,
        confirmDelete: v,
        confirmationText: c
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
        id: c,
        title: c,
        name: c,
        businessName: c,
        email: c,
        phone: c,
        address: c,
        city: c,
        state: c,
        zip: c,
        country: c,
        registrationNumber: c,
        vat: c,
        taxNumber: c,
        taxId: c,
        isDefault: v,
        taxEnabled: v,
        taxLabel: c,
        taxRate: S,
        branding: { type: "object" },
        idempotencyKey: c
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
        businessInfoId: c,
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
        businessInfoId: c
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
        businessInfoId: c,
        confirmDelete: v,
        confirmationText: c
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
        businessInfoId: c,
        includeArchived: v,
        includeDataUrl: v
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
        id: c,
        businessInfoId: c,
        kind: { type: "string", enum: ["logo"] },
        dataUrl: c,
        mimeType: { type: "string", enum: ["image/svg+xml", "image/png", "image/jpeg", "image/webp"] },
        fileName: m,
        width: S,
        height: S,
        byteSize: S,
        contentHash: c,
        idempotencyKey: c
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
        businessBrandAssetId: c,
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
        businessBrandAssetId: c
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
        businessBrandAssetId: c
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
        businessBrandAssetId: c,
        confirmDelete: v,
        confirmationText: c
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
        id: c,
        title: c,
        fullName: c,
        bank: c,
        iban: c,
        swift: c,
        bankAddress: c,
        paypal: c,
        instructions: c,
        custom: { type: "array" },
        isDefault: v,
        idempotencyKey: c
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
        paymentMethodId: c,
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
        paymentMethodId: c
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
        paymentMethodId: c,
        confirmDelete: v,
        confirmationText: c
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
        id: c,
        name: c,
        prefix: c,
        useSequentialNumbers: v,
        currentSequentialNumber: S,
        defaultNotes: c,
        defaultTaxRate: S,
        defaultDueDays: S,
        isDefault: v,
        brandingOptions: { type: "object" },
        layoutStyle: { type: "string", enum: ["classic", "neutral"] },
        logoPlacement: { type: "string" },
        showBillingPeriod: v,
        showProjectTitle: v,
        idempotencyKey: c
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
        invoiceTemplateId: c,
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
        invoiceTemplateId: c
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
        invoiceTemplateId: c,
        confirmDelete: v,
        confirmationText: c
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
        id: c,
        name: c,
        type: { type: "string", enum: ["invoice", "quote"] },
        fromName: c,
        replyTo: c,
        subject: c,
        sendBody: c,
        reminderBody: c,
        attachmentTitle: c,
        isDefault: v,
        idempotencyKey: c
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
        emailTemplateId: c,
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
        emailTemplateId: c
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
        emailTemplateId: c,
        confirmDelete: v,
        confirmationText: c
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
        includeArchived: v
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
        id: c,
        name: c,
        group: m,
        color: m,
        isDefault: v,
        archived: v,
        idempotencyKey: c
      },
      required: ["name"],
      additionalProperties: !1
    }
  },
  {
    name: "update_expense_category",
    description: "Update expense category metadata such as name, group, color, default flag, and archive state.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        expenseCategoryId: c,
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
        expenseCategoryId: c
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
        expenseCategoryId: c
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
        expenseCategoryId: c,
        confirmDelete: v,
        confirmationText: c
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
            currency: c,
            dateFormat: c,
            timeFormat: c,
            theme: { type: "string", enum: ["light", "dark", "system"] },
            defaultView: c,
            weekStartsOn: S,
            autoHideTotalsOnRevisit: v,
            showCompletedTasks: v,
            defaultBillable: v,
            projectSort: { type: "string", enum: ["createdAt", "lastActive", "name"] },
            clientSort: { type: "string", enum: ["createdAt", "lastActive", "name"] },
            weeklyGoalTargetHours: { type: ["number", "null"] },
            weeklyGoalTargetEarnings: { type: ["number", "null"] },
            systemNotificationsEnabled: v,
            systemNotificationTime: c
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
        projectId: m
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
        title: c,
        projectId: m,
        parentTaskId: m,
        note: m,
        billable: v,
        startDate: m,
        recurring: {
          type: ["object", "null"],
          properties: {
            type: { type: "string", enum: ["weekly", "monthly", "yearly"] },
            paused: v,
            weeklyDays: { type: "array", items: S },
            monthlyType: { type: "string", enum: ["first", "last", "specific"] },
            monthlyDay: S,
            yearlyDate: c
          },
          required: ["type"],
          additionalProperties: !1
        },
        promptTimeEntry: v,
        estimatedHours: { type: ["number", "null"] },
        estimatedFlatAmount: { type: ["number", "null"] },
        idempotencyKey: c
      },
      required: ["title"],
      additionalProperties: !1
    }
  },
  {
    name: "update_task",
    description: "Update a TaskTime Pro task through relationship and task-state invariants. Use complete_task for recurring occurrences. Set updates.recurring.paused to true to pause the schedule or false to resume without catching up; include the recurrence type and schedule. Timer state is unchanged.",
    scopes: ["write"],
    inputSchema: {
      type: "object",
      properties: {
        taskId: c,
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
        taskId: c,
        occurrenceDate: c
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
        taskId: c
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
        taskId: c
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
        taskId: c
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
        taskId: c,
        confirmDelete: v,
        confirmationText: c,
        expectedTaskIds: {
          type: "array",
          items: c
        },
        expectedTimeEntryIds: {
          type: "array",
          items: c
        },
        expectedTimerKeys: {
          type: "array",
          items: c
        },
        expectedPlannerAttachmentIds: {
          type: "array",
          items: c
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
        taskId: c,
        confirmDelete: v,
        confirmationText: c
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
        taskId: c,
        note: c,
        idempotencyKey: c
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
        timerKey: c,
        taskId: c,
        pausedAt: S
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
        timerKey: c,
        taskId: c,
        idempotencyKey: c
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
        timerKey: c,
        taskId: c,
        idempotencyKey: c
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
        timerKey: c,
        taskId: c,
        confirmClear: v,
        confirmationText: c
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
        timerKey: c,
        taskId: c,
        startTime: S,
        note: m
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
        taskId: c,
        start: S,
        end: S,
        note: c,
        billingIncrementMinutes: { type: ["number", "null"] },
        idempotencyKey: c
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
        entryId: c,
        taskId: c,
        start: S,
        end: S,
        note: m,
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
        entryId: c,
        confirmDelete: v,
        confirmationText: c
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
        referenceId: c,
        mode: { type: "string", enum: ["static", "date", "weekday"] },
        date: c,
        weekday: S
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
        referenceId: c,
        mode: { type: "string", enum: ["static", "date", "weekday", "week", "every-week"] },
        date: m,
        weekday: { type: ["number", "null"] },
        weekStartDate: m,
        includeWeekends: v,
        estimatedHours: { type: ["number", "null"] },
        duplicateMode: { type: "string", enum: ["reject", "skip", "overwrite"] },
        idempotencyKey: c
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
        plannerAttachmentId: c,
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
        plannerAttachmentId: c
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
        weekday: S
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
        weekday: S,
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
        weekday: S
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
        projectId: c
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
        projectId: c,
        plainText: c,
        content: {
          type: ["object", "null"],
          additionalProperties: !0
        },
        clear: v
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
        clientId: m,
        projectId: m,
        billableOnly: v
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
        title: c,
        date: c,
        amount: S,
        currency: c,
        isPersonal: v,
        billable: v,
        note: m,
        supplierName: m,
        receiptNumber: m,
        paidOn: m,
        paidBy: m,
        paymentStatus: { type: "string", enum: ["unpaid", "paid"] },
        paymentMode: { type: "string", enum: ["manual", "auto"] },
        clientId: m,
        projectId: m,
        businessId: m,
        categoryId: m,
        isRecurring: v,
        recurrenceId: m,
        amountType: { type: ["string", "null"], enum: ["fixed", "variable", null] },
        taxNumber: m,
        isTaxExempt: v,
        amountExcludingTax: { type: ["number", "null"] },
        taxLabel: m,
        taxRate: { type: ["number", "null"] },
        idempotencyKey: c
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
        expenseId: c,
        confirmDelete: v,
        confirmationText: c
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
        activeOnly: v,
        clientId: m,
        projectId: m
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
        id: c,
        title: c,
        note: m,
        supplierName: m,
        paidBy: m,
        paymentMode: { type: "string", enum: ["manual", "auto"] },
        currency: c,
        amount: S,
        amountType: { type: "string", enum: ["fixed", "variable"] },
        repeat: { type: "string", enum: ["monthly", "yearly"] },
        monthlyType: { type: "string", enum: ["first", "last", "specific"] },
        monthlyDay: S,
        startDate: c,
        endDate: m,
        clientId: m,
        projectId: m,
        businessId: m,
        categoryId: m,
        isPersonal: v,
        billable: v,
        taxNumber: m,
        isTaxExempt: v,
        amountExcludingTax: { type: ["number", "null"] },
        taxLabel: m,
        taxRate: { type: ["number", "null"] },
        active: v,
        generateInitial: v,
        idempotencyKey: c
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
        recurrenceId: c,
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
        recurrenceId: c
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
        recurrenceId: c
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
        recurrenceId: c,
        confirmDelete: v,
        confirmationText: c
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
        expenseId: c,
        amount: S,
        paidOn: m,
        paidBy: m
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
        expenseId: c
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
        id: c,
        title: c,
        type: { type: "string", enum: ["vat", "income-tax", "sales-tax", "other"] },
        startDate: c,
        endDate: c,
        businessInfoId: m,
        status: { type: "string", enum: ["draft", "filed", "paid"] },
        filedAt: { type: ["number", "null"] },
        paidAt: { type: ["number", "null"] },
        notes: m,
        idempotencyKey: c
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
        taxReturnPeriodId: c,
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
        taxReturnPeriodId: c,
        filedAt: S,
        confirmFiled: v
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
        taxReturnPeriodId: c,
        filedAt: S,
        paidAt: S,
        confirmPaid: v
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
          items: c,
          minItems: 1
        },
        taxReturnPeriodId: c,
        confirmClaim: v
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
          items: c,
          minItems: 1
        },
        confirmUnclaim: v
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
        clientId: m,
        projectId: m,
        status: { enum: ["draft", "sent", "paid", "overdue", "canceled"] },
        limit: S
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
        projectId: c,
        billingPeriodStart: c,
        billingPeriodEnd: c,
        includeClientLevelExpenses: v,
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
        projectId: c,
        clientId: c,
        invoiceNumber: c,
        invoiceDate: c,
        dueDate: m,
        templateId: m,
        businessInfoId: m,
        paymentMethodId: m,
        notes: c,
        billingPeriodStart: c,
        billingPeriodEnd: c,
        includeClientLevelExpenses: v,
        exchangeRates: { type: ["object", "null"] },
        idempotencyKey: c
      },
      required: ["projectId"],
      additionalProperties: !1
    }
  },
  {
    name: "update_invoice_draft",
    description: "Edit allowed metadata, line items, totals, and UI composition fields on an existing draft invoice. Set draftNumberMode to automatic or manual; an invoiceNumber edit defaults to manual. This does not mark billing state, update task billing cutoffs, link projects, or advance invoice numbering.",
    scopes: ["read", "write"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: c,
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
    name: "delete_invoice_draft",
    description: "Delete an unissued draft after confirmation. Source time, expenses and numbering remain unchanged.",
    scopes: ["read", "write"],
    inputSchema: {
      type: "object",
      properties: { invoiceId: c, confirmDelete: v },
      required: ["invoiceId", "confirmDelete"],
      additionalProperties: !1
    }
  },
  {
    name: "refresh_invoice_draft",
    description: "Rebuild and save linked work for the draft client/project scope and billing period after confirmation, including client-only expenses. Reset linked task/expense selections, hours, rates and merged rows. Retain manual items, notes, discount, shipping and tax settings. Review the refreshed draft before finalization.",
    scopes: ["read", "write"],
    inputSchema: {
      type: "object",
      properties: { invoiceId: c, confirmRefresh: v, exchangeRates: { type: ["object", "null"] } },
      required: ["invoiceId", "confirmRefresh"],
      additionalProperties: !1
    }
  },
  {
    name: "finalize_invoice",
    description: "Finalize a UI- or agent-created draft invoice after explicit confirmation. This revalidates the saved source selection and marks its time entries and expenses billed, updates task billing cutoffs, links the invoice to the project, advances invoice sequence state, and changes the invoice from draft to sent.",
    scopes: ["read", "write", "billing"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: c,
        confirmFinalize: v,
        finalizedAt: S,
        idempotencyKey: c
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
        invoiceId: c,
        confirmPaid: v,
        paidAt: S,
        exchangeRates: { type: ["object", "null"] },
        idempotencyKey: c
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
        invoiceId: c,
        confirmUnpaid: v,
        referenceAt: S,
        idempotencyKey: c
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
        invoiceId: c,
        reason: { type: "string", minLength: 1, maxLength: 500 },
        confirmCancel: v,
        confirmationText: c,
        canceledAt: S,
        idempotencyKey: c
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
        invoiceId: c,
        confirmUndo: v,
        confirmationText: c,
        undoneAt: S,
        idempotencyKey: c
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
        invoiceId: c,
        filename: c
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
      properties: Rt,
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
        ...Rt,
        filename: c
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
      properties: ir,
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
        ...ir,
        confirmSend: v,
        idempotencyKey: c
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
        invoiceId: c,
        sendType: { type: "string", enum: ["invoice", "reminder", "quote"] },
        templateId: m,
        to: m,
        fromName: m,
        replyTo: m,
        subject: m,
        body: m,
        attachmentTitle: m,
        forwardToSelf: v
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
        invoiceId: c,
        sendType: { type: "string", enum: ["invoice", "reminder", "quote"] },
        templateId: m,
        to: m,
        fromName: m,
        replyTo: m,
        subject: m,
        body: m,
        attachmentTitle: m,
        forwardToSelf: v,
        confirmSend: v,
        idempotencyKey: c
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
      properties: { attemptId: c },
      required: ["attemptId"],
      additionalProperties: !1
    }
  },
  {
    name: "get_dashboard_summary",
    description: "Get a bounded summary of current work and canonical invoice-eligible time across complete local history.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "get_project_overview",
    description: "Get a bounded project summary with canonical invoice-eligible time across complete local history.",
    scopes: ["read"],
    inputSchema: {
      type: "object",
      properties: {
        projectId: c
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
        clientId: c
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
        customStart: m,
        customEnd: m,
        businessId: m,
        clientId: m,
        projectId: m,
        categoryId: m,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        includeRows: v,
        rowLimit: S
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
        customStart: m,
        customEnd: m,
        businessId: m,
        clientId: m,
        projectId: m,
        categoryId: m,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: S,
        filename: c
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
        customStart: m,
        customEnd: m,
        businessId: m,
        clientId: m,
        projectId: m,
        categoryId: m,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: S,
        filename: c
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
        customStart: m,
        customEnd: m,
        businessId: m,
        clientId: m,
        projectId: m,
        categoryId: m,
        invoiceStatus: { type: "string", enum: ["all", "non-draft", "paid", "unpaid", "overdue", "draft", "canceled"] },
        expenseStatus: { type: "string", enum: ["all", "paid", "unpaid", "claimed", "unclaimed", "excluded"] },
        incomeDateBasis: { type: "string", enum: ["invoice-date", "paid-date"] },
        expenseDateBasis: { type: "string", enum: ["expense-date", "paid-date"] },
        rowLimit: S,
        filename: c,
        includeInvoicePdfs: v
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
        filename: c,
        exportDate: c,
        refreshFromCloud: v
      },
      additionalProperties: !1
    }
  },
  {
    name: "list_cloud_backups",
    description: "List TaskTime Pro backup snapshots in the active cloud provider without returning backup contents.",
    scopes: ["read", "export"],
    inputSchema: q
  },
  {
    name: "create_cloud_backup",
    description: "Create a TaskTime Pro backup snapshot in the active cloud provider using the existing backup manager.",
    scopes: ["read", "export"],
    inputSchema: q
  },
  {
    name: "download_cloud_backup_json",
    description: "Download a selected backup from the active cloud provider as a browser JSON file without returning backup contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        backupId: c,
        filename: c
      },
      required: ["backupId"],
      additionalProperties: !1
    }
  },
  {
    name: "list_drive_backups",
    description: "Deprecated Google Drive compatibility alias for list_cloud_backups. List TaskTime Pro backup snapshots in Google Drive without returning backup contents.",
    scopes: ["read", "export"],
    inputSchema: q
  },
  {
    name: "create_drive_backup",
    description: "Deprecated Google Drive compatibility alias for create_cloud_backup. Create a TaskTime Pro backup snapshot in Google Drive.",
    scopes: ["read", "export"],
    inputSchema: q
  },
  {
    name: "download_drive_backup_json",
    description: "Deprecated Google Drive compatibility alias for download_cloud_backup_json. Download a selected Google Drive backup as a browser JSON file without returning backup contents through the bridge.",
    scopes: ["read", "export"],
    inputSchema: {
      type: "object",
      properties: {
        backupId: c,
        filename: c
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
        backupJson: c
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
        backupJson: c,
        confirmRestore: v,
        confirmationText: c
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
        backupId: c,
        confirmRestore: v,
        confirmationText: c
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
        backupId: c,
        confirmRestore: v,
        confirmationText: c
      },
      required: ["backupId", "confirmRestore", "confirmationText"],
      additionalProperties: !1
    }
  },
  {
    name: "get_sync_status",
    description: "Read the active cloud provider, sync status, auto-sync mode, pending changes, and backup preference metadata.",
    scopes: ["read"],
    inputSchema: q
  },
  {
    name: "update_sync_settings",
    description: "Update explicit cloud sync and backup preferences for the active provider. Backup mode requires confirmBackupMode: true. Optional runSync triggers Sync Now after saving.",
    scopes: ["read", "write", "export"],
    inputSchema: {
      type: "object",
      properties: {
        autoSyncEnabled: v,
        autoSyncMode: { type: "string", enum: ["backup", "sync"] },
        backupEnabled: v,
        backupFrequencyHours: S,
        confirmBackupMode: v,
        runSync: v
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
        confirmDelete: v,
        confirmationText: c,
        includeCloudData: v,
        includeDriveData: v
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
        projectId: m,
        taskId: m,
        limit: S
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
        projectId: m,
        taskId: m,
        limit: S
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
        year: S,
        week: S
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
        projectId: c
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
        clientId: c
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
        invoiceId: c
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
        clientId: c,
        projectId: c
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
        timerKey: c,
        taskId: c
      },
      additionalProperties: !1
    }
  }
];
function lp(e) {
  return [
    ...rn,
    ...Di.filter((t) => t.scopes.every((n) => e.has(n)))
  ].sort((t, n) => t.name.localeCompare(n.name));
}
function or(e) {
  return rn.find((t) => t.name === e) ?? Di.find((t) => t.name === e) ?? null;
}
function sr(e) {
  return rn.some((t) => t.name === e);
}
const dp = (e) => e === null ? "null" : Array.isArray(e) ? "array" : typeof e;
function ar(e, t) {
  const n = [];
  return Ct(e, t, "$", n), { valid: n.length === 0, errors: n };
}
function Ct(e, t, n, r) {
  if (!e || typeof e != "object") return;
  const i = Array.isArray(e.type) ? e.type : e.type ? [e.type] : [], o = dp(t);
  if (i.length > 0 && !i.includes(o)) {
    r.push(`${n} must be ${i.join(" or ")}, received ${o}`);
    return;
  }
  if (e.enum && !e.enum.some((s) => Object.is(s, t))) {
    r.push(`${n} must be one of the advertised enum values`);
    return;
  }
  if (o === "object") {
    const s = t, a = e.properties ?? {};
    for (const u of e.required ?? [])
      Object.prototype.hasOwnProperty.call(s, u) || r.push(`${n}.${u} is required`);
    for (const [u, l] of Object.entries(s)) {
      const d = a[u];
      d ? Ct(d, l, `${n}.${u}`, r) : e.additionalProperties === !1 && r.push(`${n}.${u} is not allowed`);
    }
  }
  if (o === "array") {
    const s = t;
    typeof e.minItems == "number" && s.length < e.minItems && r.push(`${n} must contain at least ${e.minItems} item(s)`), e.items && s.forEach((a, u) => Ct(e.items, a, `${n}[${u}]`, r));
  }
}
const pp = "2025-11-25", et = "2.0", fp = 120, mp = 6e4, hp = 5 * 6e4;
class gp {
  constructor(t) {
    if (this.toolCallCount = 0, this.nextRequestId = 0, this.bridge = t.bridge, this.scopes = new Set(t.scopes), this.commandTimeoutMs = t.commandTimeoutMs, this.requestIdFactory = t.requestIdFactory ?? (() => `mcp-request-${this.nextRequestId++}`), this.toolCallRateLimit = t.toolCallRateLimit ?? fp, this.toolCallRateWindowMs = t.toolCallRateWindowMs ?? mp, this.now = t.now ?? (() => Date.now()), !Number.isInteger(this.toolCallRateLimit) || this.toolCallRateLimit < 0)
      throw new Error("toolCallRateLimit must be a non-negative integer.");
    if (!Number.isInteger(this.toolCallRateWindowMs) || this.toolCallRateWindowMs <= 0)
      throw new Error("toolCallRateWindowMs must be a positive integer.");
    this.toolCallWindowStartedAt = this.now();
  }
  async handleMessage(t) {
    if (!kp(t))
      return this.error(null, -32600, "Invalid JSON-RPC request.");
    if (t.id === void 0)
      return null;
    switch (t.method) {
      case "initialize":
        return this.result(t.id, {
          protocolVersion: pp,
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
          tools: lp(this.scopes).map((n) => ({
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
      return U("INVALID_INPUT", "tools/call requires a string tool name.");
    const r = or(n.name);
    if (!r)
      return U("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.name}`);
    const i = n.arguments ?? {}, o = ar(r.inputSchema, i);
    if (!o.valid)
      return U("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: o.errors
      });
    if (sr(r.name))
      return this.callBridgeSetupTool(r.name);
    const s = r.scopes.find((l) => !this.scopes.has(l));
    if (s)
      return U("PERMISSION_DENIED", `Missing ${s} permission.`, {
        scope: s
      });
    const a = this.consumeToolCallBudget(r.name);
    if (a)
      return a;
    let u;
    try {
      u = await this.bridge.sendCommand(
        this.requestIdFactory(),
        r.name,
        i,
        this.commandTimeoutMs,
        yp(n.approval)
      );
    } catch (l) {
      return l instanceof R ? U(l.code, l.message, cr(l)) : U(
        "UNAVAILABLE",
        l instanceof Error ? l.message : "TaskTime Pro app session is unavailable.",
        zi()
      );
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(u.response)
        }
      ],
      structuredContent: u.response,
      isError: !u.response.ok
    };
  }
  callBridgeSetupTool(t) {
    return t === "get_pairing_status" ? this.bridge.getPairingStatus ? ur(t, this.bridge.getPairingStatus()) : U("UNAVAILABLE", "TaskTime Pro bridge pairing status is unavailable.") : this.bridge.refreshPairing ? ur(t, this.bridge.refreshPairing()) : U("UNAVAILABLE", "TaskTime Pro bridge pairing refresh is unavailable.");
  }
  async createApprovalToken(t) {
    if (!this.bridge.createApprovalToken)
      return U("UNAVAILABLE", "TaskTime Pro approval-token signing is unavailable.");
    const n = t;
    if (!n || typeof n != "object" || typeof n.command != "string")
      return U("INVALID_INPUT", "tasktime/create_approval_token requires a string command.");
    const r = or(n.command);
    if (!r)
      return U("INVALID_INPUT", `Unsupported TaskTime Pro tool: ${n.command}`);
    if (sr(r.name))
      return U("INVALID_INPUT", `TaskTime Pro setup tool does not require approval tokens: ${n.command}`);
    const i = n.arguments ?? {}, o = ar(r.inputSchema, i);
    if (!o.valid)
      return U("INVALID_INPUT", `Invalid input for ${r.name}.`, {
        validationErrors: o.errors
      });
    const s = bp(n.scopes, r.scopes);
    if (!s)
      return U("INVALID_INPUT", "Approval token scopes must be an array of strings.");
    const a = s.find((l) => !this.scopes.has(l));
    if (a)
      return U("PERMISSION_DENIED", `Missing ${a} permission.`, {
        scope: a
      });
    const u = vp(n.ttlMs);
    if (u === null)
      return U("INVALID_INPUT", "Approval token ttlMs must be a positive integer no greater than 300000.");
    try {
      const l = typeof n.inputHash == "string" ? n.inputHash : _p(i);
      return {
        approval: this.bridge.createApprovalToken({
          grantId: typeof n.grantId == "string" ? n.grantId : void 0,
          command: n.command,
          inputHash: l,
          scopes: s,
          category: typeof n.category == "string" ? n.category : void 0,
          ttlMs: u,
          nonce: typeof n.nonce == "string" ? n.nonce : void 0
        })
      };
    } catch (l) {
      return l instanceof R ? U(l.code, l.message, cr(l)) : U("UNAVAILABLE", l instanceof Error ? l.message : "TaskTime Pro approval-token signing failed.");
    }
  }
  consumeToolCallBudget(t) {
    if (this.toolCallRateLimit <= 0)
      return null;
    const n = this.now();
    if (n - this.toolCallWindowStartedAt >= this.toolCallRateWindowMs && (this.toolCallWindowStartedAt = n, this.toolCallCount = 0), this.toolCallCount >= this.toolCallRateLimit) {
      const r = Math.max(0, this.toolCallRateWindowMs - (n - this.toolCallWindowStartedAt));
      return U("RATE_LIMITED", "TaskTime Pro MCP tool call rate limit exceeded.", {
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
      jsonrpc: et,
      id: t,
      result: n
    };
  }
  error(t, n, r, i) {
    return {
      jsonrpc: et,
      id: t,
      error: {
        code: n,
        message: r,
        data: i
      }
    };
  }
}
function yp(e) {
  if (!e || typeof e != "object")
    return;
  const t = e;
  if (!(typeof t.token != "string" || t.token.trim().length === 0))
    return t;
}
function bp(e, t) {
  return e === void 0 ? t : !Array.isArray(e) || !e.every((n) => typeof n == "string") ? null : e;
}
function $t(e) {
  return e === void 0 || typeof e == "function" || typeof e == "symbol" ? null : e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? e : Array.isArray(e) ? e.map((t) => $t(t)) : typeof e == "object" ? Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0 && typeof t != "function" && typeof t != "symbol").sort(([t], [n]) => t.localeCompare(n)).map(([t, n]) => [t, $t(n)])
  ) : null;
}
function _p(e) {
  const t = JSON.stringify($t(e ?? {}));
  return `sha256:${vr("sha256").update(t).digest("hex")}`;
}
function vp(e) {
  if (e !== void 0)
    return !Number.isInteger(e) || e <= 0 || e > hp ? null : e;
}
function cr(e) {
  return e.code !== "UNAVAILABLE" ? e.details : {
    ...e.details,
    ...zi()
  };
}
function zi() {
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
function ur(e, t) {
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
function U(e, t, n) {
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
function Ip(e) {
  let t = "";
  const n = (r) => {
    for (t += r.toString(); t.includes(`
`); ) {
      const i = t.indexOf(`
`), o = t.slice(0, i).trim();
      t = t.slice(i + 1), o && wp(o, e);
    }
  };
  return e.input.on("data", n), () => {
    e.input.off("data", n);
  };
}
async function wp(e, t) {
  try {
    const n = await t.server.handleMessage(JSON.parse(e));
    n && t.output.write(`${JSON.stringify(n)}
`);
  } catch (n) {
    const r = n instanceof Error ? n : new Error("MCP stdio message handling failed.");
    t.onError?.(r), t.output.write(`${JSON.stringify({
      jsonrpc: et,
      id: null,
      error: {
        code: -32700,
        message: r.message
      }
    })}
`);
  }
}
function kp(e) {
  if (!e || typeof e != "object")
    return !1;
  const t = e;
  return t.jsonrpc === et && typeof t.method == "string";
}
const Tp = "127.0.0.1", lr = 0, Ri = "/tasktime-agent", Lt = ["read", "write", "navigation"], bt = 300 * 1e3, dr = 12e4, pr = 120, fr = 6e4, tt = "tasktime.agent.local-bridge", Mt = "Local agent bridge", nt = ["read", "write", "billing", "export", "email", "navigation"];
function Sp(e, t = process.env) {
  const n = {
    host: t.TASKTIME_AGENT_BRIDGE_HOST || Tp,
    port: Q(t.TASKTIME_AGENT_BRIDGE_PORT, lr, "TASKTIME_AGENT_BRIDGE_PORT"),
    path: t.TASKTIME_AGENT_BRIDGE_PATH || Ri,
    scopes: Li(t.TASKTIME_AGENT_BRIDGE_SCOPES) ?? Lt,
    allowedOrigins: Rp(t.TASKTIME_AGENT_BRIDGE_ORIGINS, "TASKTIME_AGENT_BRIDGE_ORIGINS"),
    agentId: _e(t.TASKTIME_AGENT_ID, tt, "TASKTIME_AGENT_ID"),
    agentLabel: _e(t.TASKTIME_AGENT_LABEL, Mt, "TASKTIME_AGENT_LABEL"),
    pairingTtlMs: Q(t.TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS, bt, "TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS"),
    sessionTtlMs: Dp(t.TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS, "TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS"),
    commandTimeoutMs: Q(t.TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS, dr, "TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS"),
    toolCallRateLimit: Q(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT, pr, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT"),
    toolCallRateWindowMs: br(t.TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS, fr, "TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS"),
    appUrl: zp(
      t.TASKTIME_APP_URL ?? ji,
      "TASKTIME_APP_URL"
    ),
    statusFile: Cp(t.TASKTIME_AGENT_BRIDGE_STATUS_FILE, "TASKTIME_AGENT_BRIDGE_STATUS_FILE"),
    help: !1,
    manifest: !1
  }, r = [], i = [];
  for (let o = 0; o < e.length; o += 1) {
    const s = e[o];
    switch (s) {
      case "--help":
      case "-h":
        n.help = !0;
        break;
      case "--manifest":
        n.manifest = !0;
        break;
      case "--host":
        n.host = F(e, ++o, s);
        break;
      case "--port":
        n.port = Q(F(e, ++o, s), lr, s);
        break;
      case "--path":
        n.path = yr(F(e, ++o, s));
        break;
      case "--scopes":
        n.scopes = Np(F(e, ++o, s), s);
        break;
      case "--scope":
        r.push(Mi(F(e, ++o, s), s));
        break;
      case "--origin":
        i.push(Zi(F(e, ++o, s), s));
        break;
      case "--agent-id":
        n.agentId = _e(F(e, ++o, s), tt, s);
        break;
      case "--agent-label":
        n.agentLabel = _e(F(e, ++o, s), Mt, s);
        break;
      case "--pairing-ttl-ms":
        n.pairingTtlMs = Q(F(e, ++o, s), bt, s);
        break;
      case "--session-ttl-ms":
        n.sessionTtlMs = Q(F(e, ++o, s), bt, s);
        break;
      case "--command-timeout-ms":
        n.commandTimeoutMs = Q(F(e, ++o, s), dr, s);
        break;
      case "--tool-rate-limit":
        n.toolCallRateLimit = Q(F(e, ++o, s), pr, s);
        break;
      case "--tool-rate-window-ms":
        n.toolCallRateWindowMs = br(F(e, ++o, s), fr, s);
        break;
      case "--app-url":
        n.appUrl = on(F(e, ++o, s), s);
        break;
      case "--status-file":
        n.statusFile = _e(F(e, ++o, s), "", s);
        break;
      default:
        throw new Error(`Unsupported option: ${s}`);
    }
  }
  return r.length > 0 && (n.scopes = Zt(r)), i.length > 0 && (n.allowedOrigins = i), n.path = yr(n.path), n.scopes = Zt(n.scopes), n;
}
function Ap() {
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
function Pp() {
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
      ...Bd
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
        defaultPath: Ri,
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
        defaultAgentId: tt
      },
      defaultScopes: Lt,
      optionalScopes: nt.filter((e) => !Lt.includes(e)),
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
function Ci(e, t) {
  const n = new URL(on(t, "app URL"));
  return n.pathname = "/account", n.search = "", n.hash = "", n.searchParams.set("section", "agent"), n.searchParams.set("agentBridgeEndpoint", e.endpoint), n.searchParams.set("agentBridgePairingId", e.id), n.searchParams.set("agentBridgePairingCode", e.code), n.searchParams.set("agentBridgeScopes", e.scopes.join(",")), e.agentId && n.searchParams.set("agentBridgeAgentId", e.agentId), e.agentLabel && n.searchParams.set("agentBridgeAgentLabel", e.agentLabel), n.toString();
}
function Ep(e, t) {
  const n = [
    "TaskTime Pro local agent bridge is running.",
    `App endpoint: ${e.endpoint}`,
    `Pairing ID: ${e.id}`,
    `Pairing code: ${e.code}`,
    `Agent: ${e.agentLabel || Mt} (${e.agentId || tt})`,
    `Scopes: ${e.scopes.join(",")}`,
    `Pairing expires at: ${new Date(e.expiresAt).toISOString()}`
  ];
  return t && n.push(`TaskTime Pro launch URL: ${Ci(e, t)}`), n.push(
    "",
    "Open TaskTime Pro and connect the agent bridge using the endpoint, pairing ID, and pairing code above."
  ), n.join(`
`);
}
async function xp(e, t) {
  let n = null, r = null, i = null;
  const o = (/* @__PURE__ */ new Date()).toISOString(), s = e.statusFile ? Vi(e.statusFile) : void 0, a = () => {
    if (!(!s || !r || !i))
      try {
        const I = mr({
          bridge: i,
          challenge: r,
          appUrl: e.appUrl,
          agentId: e.agentId,
          agentLabel: e.agentLabel,
          startedAt: o,
          activeSessionExpiresAt: n
        }), O = hr(s, I.bridgeInstanceId);
        Fi(Ji(s), { recursive: !0, mode: 448 }), Gi(O, `${JSON.stringify(Op(I), null, 2)}
`, {
          mode: 384
        }), un(O, 384), Ki(O, s), un(s, 384);
      } catch (I) {
        t.stderr.write(`TaskTime Pro bridge status file write failed: ${I instanceof Error ? I.message : String(I)}
`);
      }
  }, u = (I) => {
    I.action === "pairing_succeeded" && (n = typeof I.details?.expiresAt == "number" ? I.details.expiresAt : null), I.action === "session_disconnected" && i?.getClientCount() === 0 && (n = null), a();
  };
  i = new sp({
    host: e.host,
    port: e.port,
    path: e.path,
    agentId: e.agentId,
    allowedOrigins: e.allowedOrigins,
    sessionTtlMs: e.sessionTtlMs,
    onAudit: u
  }), await i.start();
  const l = i, d = () => (r = l.createPairingChallenge({
    scopes: e.scopes,
    ttlMs: e.pairingTtlMs,
    agentId: e.agentId,
    agentLabel: e.agentLabel
  }), a(), r), h = () => mr({
    bridge: l,
    challenge: r ?? d(),
    appUrl: e.appUrl,
    agentId: e.agentId,
    agentLabel: e.agentLabel,
    startedAt: o,
    activeSessionExpiresAt: n
  }), b = () => (d(), h()), y = d(), _ = new gp({
    bridge: {
      sendCommand: l.sendCommand.bind(l),
      createApprovalToken: l.createApprovalToken.bind(l),
      getPairingStatus: h,
      refreshPairing: b
    },
    scopes: e.scopes,
    commandTimeoutMs: e.commandTimeoutMs,
    toolCallRateLimit: e.toolCallRateLimit,
    toolCallRateWindowMs: e.toolCallRateWindowMs
  }), T = Ip({
    input: t.stdin,
    output: t.stdout,
    server: _,
    onError: (I) => {
      t.stderr.write(`TaskTime Pro MCP bridge error: ${I.message}
`);
    }
  });
  return t.stderr.write(`${Ep(y, e.appUrl)}
`), {
    bridge: l,
    challenge: y,
    getStatus: h,
    refreshPairing: b,
    stop: async () => {
      T(), await l.stop(), gr(s), s && gr(hr(s, l.getBridgeInstanceId()));
    }
  };
}
function mr(e) {
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
    launchUrl: e.appUrl ? Ci(e.challenge, e.appUrl) : void 0,
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
function Op(e) {
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
function hr(e, t) {
  return `${e}.${process.pid}.${t}.tmp`;
}
function gr(e) {
  if (e)
    try {
      qi(e);
    } catch {
    }
}
async function jp(e = process.argv.slice(2), t = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr
}, n = process.env) {
  const r = Sp(e, n);
  if (r.help)
    return t.stderr.write(`${Ap()}
`), null;
  if (r.manifest)
    return t.stdout.write(`${JSON.stringify(Pp(), null, 2)}
`), null;
  const i = await xp(r, t), o = async () => {
    await i.stop(), process.exit(0);
  };
  return process.once("SIGINT", () => {
    o();
  }), process.once("SIGTERM", () => {
    o();
  }), i;
}
function $i(e) {
  if (!e)
    return;
  const t = e.split(",").map((n) => n.trim()).filter(Boolean);
  return t.length > 0 ? t : void 0;
}
function Np(e, t) {
  const n = Li(e);
  if (!n || n.length === 0)
    throw new Error(`${t} must include at least one scope.`);
  return n;
}
function Li(e) {
  const t = $i(e);
  if (t)
    return Zt(t.map((n) => Mi(n, "scope")));
}
function Mi(e, t) {
  if (nt.includes(e))
    return e;
  throw new Error(`${t} must be one of: ${nt.join(", ")}`);
}
function Zt(e) {
  return nt.filter((t) => e.includes(t));
}
function yr(e) {
  return e.startsWith("/") ? e : `/${e}`;
}
function F(e, t, n) {
  const r = e[t];
  if (!r || r.startsWith("--"))
    throw new Error(`${n} requires a value.`);
  return r;
}
function Q(e, t, n) {
  if (e === void 0 || e === "")
    return t;
  const r = Number(e);
  if (!Number.isInteger(r) || r < 0)
    throw new Error(`${n} must be a non-negative integer.`);
  return r;
}
function Dp(e, t) {
  if (!(e === void 0 || e === ""))
    return Q(e, 0, t);
}
function br(e, t, n) {
  const r = Q(e, t, n);
  if (r <= 0)
    throw new Error(`${n} must be a positive integer.`);
  return r;
}
function zp(e, t) {
  if (e)
    return on(e, t);
}
function Zi(e, t) {
  try {
    return nn(e, "agent bridge");
  } catch {
    throw new Error(`${t} must be an exact HTTPS or loopback HTTP origin.`);
  }
}
function Rp(e, t) {
  return $i(e)?.map((r) => Zi(r, t));
}
function Cp(e, t) {
  if (!(e === void 0 || e === ""))
    return _e(e, "", t);
}
function _e(e, t, n) {
  const r = e === void 0 ? t : e;
  if (!r.trim())
    throw new Error(`${n} must be a non-empty string.`);
  return r.trim();
}
function on(e, t) {
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
function $p() {
  const e = process.argv[1];
  if (!e)
    return !1;
  try {
    return cn(e) === cn(Wi(import.meta.url));
  } catch {
    return import.meta.url === Hi(e).href;
  }
}
$p() && jp().catch((e) => {
  process.stderr.write(`TaskTime Pro local agent bridge failed: ${e instanceof Error ? e.message : String(e)}
`), process.exitCode = 1;
});
export {
  Ci as buildTaskTimeAgentBridgeLaunchUrl,
  Ep as formatPairingInstructions,
  Ap as getTaskTimeAgentBridgeCliUsage,
  Pp as getTaskTimeAgentBridgeManifest,
  Sp as parseTaskTimeAgentBridgeCliOptions,
  jp as runTaskTimeAgentBridgeCli,
  xp as startTaskTimeAgentBridgeCli
};
