/* ===========================================================================
   Sidereal Time and Hour Angle Demonstrator  --  Accessible HTML5 port
   Ported from siderealTimeAndHourAngleDemo004 (Adobe Flash / AS1).

   GROUND TRUTH for behaviour is the decompiled ActionScript. All geometry,
   constants and the number formatting below are copied verbatim from that
   source (CelestialSphere.as + "2..9 CS *.as", "Hour Angle Demo.as",
   "Draggable Star.as", "toFixed.as"). The 3-D sphere engine is reproduced on an
   HTML5 <canvas>; controls are native and keyboard-operable; equations and unit
   symbols are typeset by MathJax.

   The engine keeps the exact projection math:
     theta = viewer azimuth rotation of the sphere   (radians internally)
     phi   = viewer altitude / tilt                  (radians)
     lat   = observer latitude (user controlled)     (radians)
     sTime = sidereal time (user controlled)         (radians)
   Matrices: a* world(horizon)->screen, m* celestial->world, b* celestial->screen.
   =========================================================================== */
(() => {
  'use strict';

  // --- angle / unit constants (verbatim radians-per-unit from the AS) -------
  const D2R = 0.017453292519943295;   // deg -> rad
  const R2D = 57.29577951308232;      // rad -> deg
  const H2R = 0.2617993877991494;     // hours -> rad (15 deg)
  const R2H = 3.819718634205488;      // rad -> hours
  const TWO_PI = 6.283185307179586;
  const HALF_PI = 1.5707963267948966;
  const PI = 3.141592653589793;

  // Original Flash colours (decimal RGB) from "Hour Angle Demo.as".
  const RA_COLOR  = 16777215;   // raColor         #FFFFFF (white)
  const DEC_COLOR = 16728128;   // decColor        #FF4040 (red)
  const HA_COLOR  = 16763749;   // hourAngleColor  #FFCB65 (gold)
  const AXIS_COLOR = 7711231;   // #75A9FF pole axes + observer meridian (blue)
  const YELLOW    = 16769909;   // #FFE375 celestial equator + zero-hours circle
  const WHITE     = 16777215;   // faint white guide circles

  function intToCss(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }
  function mod(n, m) { return ((n % m) + m) % m; }

  // toFixed polyfill copied from toFixed.as so on-screen numbers round and
  // format exactly like the original (round-half-up, fixed decimal places).
  function toFixedAS(x, f) {
    f = Math.trunc(f);
    if (f < 0 || f > 20 || isNaN(x) || !isFinite(x)) return '...';
    let s = '';
    if (x < 0) { s = '-'; x = -x; }
    let out = '';
    if (x < 1e21) {
      const n = Math.round(x * Math.pow(10, f));
      out = (n === 0) ? '0' : n.toString();
      if (f > 0) {
        let k = out.length;
        if (k <= f) { let z = ''; for (let i = 0; i < f + 1 - k; i++) z += '0'; out = z + out; k = f + 1; }
        out = out.substr(0, k - f) + '.' + out.substr(k - f);
      }
    } else { out = x.toString(); }
    return s + out;
  }

  // Spoken form of a value: a leading "-" glyph is routinely dropped by screen
  // readers, so render it as the word "minus".
  function spoken(x, d) {
    const t = toFixedAS(x, d);
    return (t.charAt(0) === '-') ? 'minus ' + t.slice(1) : t;
  }

  /* =========================================================================
     CelestialSphere  -  the projection engine (CelestialSphere.as +
     "2 CS Getter Setter", "3 CS Geometry"). Latitude and sidereal time are
     user-controlled here, so the celestial<->world matrix (m*) and the
     celestial->screen matrix (b*) rebuild whenever they change.
     ========================================================================= */
  class CelestialSphere {
    constructor() {
      this.c = {};
      this.c.r = 150;
      this.c.r2 = this.c.r * this.c.r;
      this.maxPhi = 90;
      this.minPhi = -90;
      this.showUnder = true;
      this.theta = 0;
      this.phi = 0.5235987755982988;
      this.lat = 0;
      this.sTime = 0;
      this.setThetaAndPhi(90, 30);
      this.setLatitude(41);
      this.setSiderealTime(0);
    }
    getTheta() { return R2D * this.theta; }
    getPhi()   { return R2D * this.phi; }
    getViewerAzimuth() { return mod(360 - this.getTheta(), 360); }
    setSize(arg) { this.c.r = arg / 2; this.c.r2 = this.c.r * this.c.r; this.doA(); this.doB(); }
    setMinPhi(v) { this.minPhi = (v > 90 || v < -90) ? 90 : v; }
    setMaxPhi(v) { this.maxPhi = (v > 90 || v < -90) ? 90 : v; }
    setThetaAndPhi(newTheta, newPhi) {
      this.theta = D2R * mod(newTheta, 360);
      let p = newPhi;
      if (p > this.maxPhi) p = this.maxPhi; else if (p < this.minPhi) p = this.minPhi;
      this.phi = p * D2R;
      this.doA(); this.doB();
    }
    setViewerAzimuth(az) { this.setTheta(360 - az); }
    setTheta(arg) { this.theta = D2R * mod(arg, 360); this.doA(); this.doB(); }
    setLatitude(arg) {
      let v = arg;
      if (v > 90) v = 90; else if (v < -90) v = -90;
      this.lat = v * D2R; this.doM(); this.doB();
    }
    getLatitude() { return R2D * this.lat; }
    setSiderealTime(arg) { this.sTime = mod(arg, 24) * H2R; this.doM(); this.doB(); }
    getSiderealTime() { return this.sTime * R2H; }

    // ---- matrices (3 CS Geometry: doA / doM / doB) ----
    doA() {
      const c = this.c;
      const ct = Math.cos(this.theta), st = Math.sin(this.theta);
      const cp = Math.cos(this.phi),  sp = Math.sin(this.phi);
      c.a0 = -c.r * st;      c.a1 =  c.r * ct;
      c.a3 =  c.r * ct * sp; c.a4 =  c.r * st * sp; c.a5 = -c.r * cp;
      c.a6 =  c.r * ct * cp; c.a7 =  c.r * st * cp; c.a8 =  c.r * sp;
    }
    doM() {
      const c = this.c;
      c.m2 = Math.cos(this.lat);
      c.m3 = Math.sin(this.sTime);
      c.m4 = -Math.cos(this.sTime);
      c.m8 = Math.sin(this.lat);
      c.m0 = c.m4 * c.m8; c.m1 = -c.m3 * c.m8;
      c.m6 = -c.m2 * c.m4; c.m7 = c.m2 * c.m3;
    }
    doB() {
      const c = this.c;
      c.b0 = c.a0 * c.m0 + c.a1 * c.m3;
      c.b1 = c.a0 * c.m1 + c.a1 * c.m4;
      c.b2 = c.a0 * c.m2;
      c.b3 = c.a3 * c.m0 + c.a4 * c.m3 + c.a5 * c.m6;
      c.b4 = c.a3 * c.m1 + c.a4 * c.m4 + c.a5 * c.m7;
      c.b5 = c.a3 * c.m2 + c.a5 * c.m8;
      c.b6 = c.a6 * c.m0 + c.a7 * c.m3 + c.a8 * c.m6;
      c.b7 = c.a6 * c.m1 + c.a7 * c.m4 + c.a8 * c.m7;
      c.b8 = c.a6 * c.m2 + c.a8 * c.m8;
    }

    // ---- point parsing + transforms (3 CS Geometry) ----
    parsePointInput(inP, out) {
      if (inP.az !== undefined && inP.alt !== undefined) {
        out.sys = 0; out.system = 'horizon';
        const r = (inP.r !== undefined) ? inP.r : 1;
        const d = r * Math.cos(inP.alt * D2R);
        out.x = d * Math.cos(inP.az * D2R);
        out.y = d * Math.sin(-inP.az * D2R);
        out.z = r * Math.sin(inP.alt * D2R);
        out.r = Math.abs(r);
      } else if (inP.ra !== undefined && inP.dec !== undefined) {
        out.sys = 1; out.system = 'celestial';
        const r = (inP.r !== undefined) ? inP.r : 1;
        const d = r * Math.cos(inP.dec * D2R);
        out.x = d * Math.cos(inP.ra * H2R);
        out.y = d * Math.sin(inP.ra * H2R);
        out.z = r * Math.sin(inP.dec * D2R);
        out.r = Math.abs(r);
      } else if (inP.x !== undefined && inP.y !== undefined && inP.z !== undefined) {
        if (inP.system === 'horizon') { out.sys = 0; out.system = 'horizon'; }
        else if (inP.system === 'celestial') { out.sys = 1; out.system = 'celestial'; }
        else { out.sys = -1; out.system = 'unknown'; }
        out.x = inP.x; out.y = inP.y; out.z = inP.z;
        out.r = Math.sqrt(inP.x * inP.x + inP.y * inP.y + inP.z * inP.z);
        if (out.r < 1.000001 && out.r > 0.999999) out.r = 1;
      } else { out.sys = null; out.x = out.y = out.z = out.r = null; }
    }
    WtoSz(p, sp) {
      const c = this.c;
      sp.x = p.x * c.a0 + p.y * c.a1;
      sp.y = p.x * c.a3 + p.y * c.a4 + p.z * c.a5;
      sp.z = p.x * c.a6 + p.y * c.a7 + p.z * c.a8;
    }
    CtoSz(p, sp) {
      const c = this.c;
      sp.x = p.x * c.b0 + p.y * c.b1 + p.z * c.b2;
      sp.y = p.x * c.b3 + p.y * c.b4 + p.z * c.b5;
      sp.z = p.x * c.b6 + p.y * c.b7 + p.z * c.b8;
    }
    CtoW(p, wp) {
      const c = this.c;
      wp.x = p.x * c.m0 + p.y * c.m1 + p.z * c.m2;
      wp.y = p.x * c.m3 + p.y * c.m4;
      wp.z = p.x * c.m6 + p.y * c.m7 + p.z * c.m8;
    }
    // screen -> mounted-horizon spherical (radians) -- StoMH
    StoMH(sp, hp) {
      const r = this.c.r;
      let d = Math.sqrt(sp.x * sp.x + sp.y * sp.y) / r;
      if (d > 1) d = 1;
      const b = Math.asin(d);
      const A = Math.atan2(sp.x, -sp.y);
      if (this.phi === HALF_PI) { hp.alt = HALF_PI - b; hp.az = this.theta + PI - A; }
      else if (this.phi === -HALF_PI) { hp.alt = -HALF_PI + b; hp.az = this.theta + A; }
      else {
        const cc = HALF_PI - this.phi, ccos = Math.cos(cc), csin = Math.sin(cc);
        const cb = Math.cos(b), sb = Math.sin(b);
        const ca = cb * ccos + sb * csin * Math.cos(A);
        hp.alt = HALF_PI - Math.acos(ca);
        hp.az = this.theta + Math.atan2(sb * Math.sin(A), (cb - ca * ccos) / csin);
      }
      hp.az = mod(hp.az, TWO_PI);
    }
    // mounted-horizon (radians) -> celestial (radians) -- MHtoC
    MHtoC(hp, cp) {
      const salt = Math.sin(hp.alt), calt = Math.cos(hp.alt);
      const saz = Math.sin(hp.az), caz = Math.cos(hp.az);
      const sl = Math.sin(this.lat), cl = Math.cos(this.lat);
      const sh = calt * saz, ch = salt * cl - calt * sl * caz;
      cp.ra = (ch === 0) ? 0 : mod(this.sTime - Math.atan2(sh, ch), TWO_PI);
      cp.dec = Math.asin(salt * sl + calt * caz * cl);
    }
    // screen px (sphere-centred) -> {ra hours, dec deg} -- getMouseRaDec
    screenToRaDec(x, y) {
      if (Math.sqrt(x * x + y * y) > this.c.r) return null;
      const hp = {}, cp = {};
      this.StoMH({ x: x, y: y }, hp);
      this.MHtoC(hp, cp);
      return { ra: cp.ra * R2H, dec: cp.dec * R2D };
    }
  }

  /* =========================================================================
     Circle  -  a great/small circle or arc on the sphere (8 CS Circles.as).
     Handles BOTH the horizon system (az/alt/tilt, projected with a*) and the
     celestial system (ra/dec/tilt, projected with b*). update() recomputes the
     projected ellipse and splits [gS,gE] into front-/back-facing pieces exactly
     as the AS does, so depth ordering against the sphere matches the original.
     ========================================================================= */
  class Circle {
    constructor(sphere, style) {
      this.sphere = sphere;
      this.c = {};
      this.gS = 0; this.gE = 0;
      this.beta = 0; this.tilt = 0; this.lambda = 0;
      this.sys = 0;
      this.visible = true;
      this.color = 16711680; this.thick = 1; this.alpha = 80;
      this.minStep = 0.7853981633974483;   // pi/4
      this.front = []; this.back = [];
      if (style) this.setStyle(style.thickness, style.color, style.alpha);
    }
    setStyle(t, col, a) {
      if (t !== undefined) this.thick = t;
      if (col !== undefined) this.color = col;
      if (a !== undefined) this.alpha = a;
    }
    doW() {
      const st = Math.sin(this.tilt), ct = Math.cos(this.tilt);
      const sb = Math.sin(this.beta), cb = Math.cos(this.beta);
      const cl = Math.cos(this.lambda), sl = Math.sin(this.lambda);
      const c = this.c;
      c.w0 = cl * cb;  c.w1 = -cl * sb * ct;  c.w2 = sl * sb * st;
      c.w3 = cl * sb;  c.w4 = cl * cb * ct;   c.w5 = -sl * cb * st;
      c.w7 = cl * st;  c.w8 = sl * ct;
    }
    // setCircleParameters / setParameters (both systems)
    setParameters(arg) {
      if (arg.az !== undefined && arg.alt !== undefined && arg.tilt !== undefined) {
        this.sys = 0;
        if (isFinite(arg.tilt))  this.tilt = (arg.tilt < 0 ? 0 : arg.tilt > 180 ? PI : arg.tilt * D2R);
        if (isFinite(arg.alt))   this.lambda = (arg.alt < -90 ? -PI : arg.alt > 90 ? PI : arg.alt * D2R);
        if (isFinite(arg.az))    this.beta = D2R * mod(-arg.az, 360);
        if (isFinite(arg.gammaStart)) this.gS = D2R * mod(arg.gammaStart, 360);
        if (isFinite(arg.gammaEnd))   this.gE = D2R * mod(arg.gammaEnd, 360);
      } else if (arg.ra !== undefined && arg.dec !== undefined && arg.tilt !== undefined) {
        this.sys = 1;
        if (isFinite(arg.tilt))  this.tilt = (arg.tilt < 0 ? 0 : arg.tilt > 180 ? PI : arg.tilt * D2R);
        if (isFinite(arg.dec))   this.lambda = (arg.dec < -90 ? -PI : arg.dec > 90 ? PI : arg.dec * D2R);
        if (isFinite(arg.ra))    this.beta = H2R * mod(arg.ra, 24);
        if (isFinite(arg.gammaStart)) this.gS = D2R * mod(arg.gammaStart, 360);
        if (isFinite(arg.gammaEnd))   this.gE = D2R * mod(arg.gammaEnd, 360);
      }
      this.doW();
    }
    // Set only the gamma extents (deg). Used by onLatitudeChanged for the
    // observer's meridian, which changes its start/end with latitude.
    setGamma(gStartDeg, gEndDeg) {
      this.gS = D2R * mod(gStartDeg, 360);
      this.gE = D2R * mod(gEndDeg, 360);
    }
    gSort(a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); }

    update() {
      this.front.length = 0;
      this.back.length = 0;
      if (!this.visible) return;

      const tc = this.c, pc = this.sphere.c;
      let v0, v1, v2, v3, v4, v5, v6, v7, v8;
      if (this.sys === 0) {
        v0 = pc.a0 * tc.w0 + pc.a1 * tc.w3;  v1 = pc.a0 * tc.w1 + pc.a1 * tc.w4;  v2 = pc.a0 * tc.w2 + pc.a1 * tc.w5;
        v3 = pc.a3 * tc.w0 + pc.a4 * tc.w3;  v4 = pc.a3 * tc.w1 + pc.a4 * tc.w4 + pc.a5 * tc.w7;  v5 = pc.a3 * tc.w2 + pc.a4 * tc.w5 + pc.a5 * tc.w8;
        v6 = pc.a6 * tc.w0 + pc.a7 * tc.w3;  v7 = pc.a6 * tc.w1 + pc.a7 * tc.w4 + pc.a8 * tc.w7;  v8 = pc.a6 * tc.w2 + pc.a7 * tc.w5 + pc.a8 * tc.w8;
      } else {
        v0 = pc.b0 * tc.w0 + pc.b1 * tc.w3;  v1 = pc.b0 * tc.w1 + pc.b1 * tc.w4 + pc.b2 * tc.w7;  v2 = pc.b0 * tc.w2 + pc.b1 * tc.w5 + pc.b2 * tc.w8;
        v3 = pc.b3 * tc.w0 + pc.b4 * tc.w3;  v4 = pc.b3 * tc.w1 + pc.b4 * tc.w4 + pc.b5 * tc.w7;  v5 = pc.b3 * tc.w2 + pc.b4 * tc.w5 + pc.b5 * tc.w8;
        v6 = pc.b6 * tc.w0 + pc.b7 * tc.w3;  v7 = pc.b6 * tc.w1 + pc.b7 * tc.w4 + pc.b8 * tc.w7;  v8 = pc.b6 * tc.w2 + pc.b7 * tc.w5 + pc.b8 * tc.w8;
      }

      const minStep = this.minStep;
      const frontArr = this.front, backArr = this.back;

      function drawArc(g1, g2, bucket) {
        if (g2 < g1) g2 += TWO_PI;
        let arc = g2 - g1;
        if (arc === 0) arc = TWO_PI;
        const n = Math.ceil(arc / minStep);
        const step = arc / n;
        const halfStep = step / 2;
        const cRad = 1 / Math.cos(halfStep);
        let ax = Math.cos(g1), ay = Math.sin(g1);
        const path = { move: [v0 * ax + v1 * ay + v2, v3 * ax + v4 * ay + v5], curves: [] };
        let aAngle = g1 + step, cAngle = aAngle - halfStep;
        for (let i = 0; i < n; i++) {
          ax = Math.cos(aAngle); ay = Math.sin(aAngle);
          const cx = cRad * Math.cos(cAngle), cy = cRad * Math.sin(cAngle);
          path.curves.push([v0 * cx + v1 * cy + v2, v3 * cx + v4 * cy + v5,
                            v0 * ax + v1 * ay + v2, v3 * ax + v4 * ay + v5]);
          aAngle += step; cAngle += step;
        }
        bucket.push(path);
      }

      const A = Math.sqrt(v6 * v6 + v7 * v7);
      if (A === 0) {
        if (v8 < 0) drawArc(this.gS, this.gE, backArr); else drawArc(this.gS, this.gE, frontArr);
        return;
      }
      const sj = -v8 / A;
      if (sj <= -1) { drawArc(this.gS, this.gE, frontArr); return; }
      if (sj >= 1)  { drawArc(this.gS, this.gE, backArr); return; }

      const j = Math.asin(sj), t = Math.atan2(v6, v7);
      let gDesc, gAsc;
      if (Math.cos(j) < 0) { gDesc = mod(j - t, TWO_PI); gAsc = mod(PI - j - t, TWO_PI); }
      else { gDesc = mod(PI - j - t, TWO_PI); gAsc = mod(j - t, TWO_PI); }
      if (this.gS === this.gE) { drawArc(gAsc, gDesc, frontArr); drawArc(gDesc, gAsc, backArr); return; }

      const gArray = [[gAsc, 0], [gDesc, 1], [this.gS, 2], [this.gE, 3]];
      gArray.sort(this.gSort);
      let draw = false, front = true;
      for (let k = 0; k < 4; k++) {
        const code = gArray[k][1];
        if (code === 0) front = true; else if (code === 1) front = false;
        else if (code === 2) draw = true; else draw = false;
      }
      let prev = gArray[3];
      for (let i = 0; i < 4; i++) {
        const g1 = prev; prev = gArray[i];
        if (draw && g1[0] !== prev[0]) { if (front) drawArc(g1[0], prev[0], frontArr); else drawArc(g1[0], prev[0], backArr); }
        const code = prev[1];
        if (code === 0) front = true; else if (code === 1) front = false;
        else if (code === 2) draw = true; else draw = false;
      }
    }
  }

  /* =========================================================================
     Line  -  a straight segment split by the sphere boundary and horizon plane
     into front/back pieces (9 CS Lines.as). Used for the NCP/SCP pole stubs.
     Buckets: front = external-front + inner-above, back = external-back +
     inner-below.
     ========================================================================= */
  class Line {
    constructor(sphere, style, head, tail) {
      this.sphere = sphere;
      this.thick = 1; this.color = 255; this.alpha = 100;
      if (style) this.setStyle(style.thickness, style.color, style.alpha);
      this.visible = true;
      this.head = {}; this.tail = {};
      this.setHeadPoint(head); this.setTailPoint(tail);
      this.front = []; this.back = [];
    }
    setStyle(t, col, a) {
      if (t !== undefined) this.thick = t;
      if (col !== undefined) this.color = col;
      if (a !== undefined) this.alpha = a;
    }
    setHeadPoint(h) { this.sphere.parsePointInput(h, this.head); if (this.head.sys === -1) this.head.sys = 0; }
    setTailPoint(t) { this.sphere.parsePointInput(t, this.tail); if (this.tail.sys === -1) this.tail.sys = 0; }

    update() {
      this.front.length = 0; this.back.length = 0;
      if (!this.visible) return;
      const S = this.sphere;
      const head = {}, tail = {};
      if (this.head.sys === 0) S.WtoSz(this.head, head); else if (this.head.sys === 1) S.CtoSz(this.head, head); else return;
      if (this.tail.sys === 0) S.WtoSz(this.tail, tail); else if (this.tail.sys === 1) S.CtoSz(this.tail, tail); else return;

      const mx = head.x - tail.x, my = head.y - tail.y, mz = head.z - tail.z;
      const A = mx * mx + my * my + mz * mz;
      const B = 2 * (mx * tail.x + my * tail.y + mz * tail.z);
      const C = tail.x * tail.x + tail.y * tail.y + tail.z * tail.z;
      const rad = S.c.r, rad2 = rad * rad;
      const phi = S.phi;
      const stmp = [];
      const Dsc = B * B - 4 * A * (C - rad2);
      if (Dsc > 0) { const sD = Math.sqrt(Dsc); stmp.push((-B + sD) / (2 * A)); stmp.push((-B - sD) / (2 * A)); }
      let tp;
      if (phi > -HALF_PI && phi < HALF_PI) {
        tp = Math.tan(phi);
        if (my !== tp * mz) stmp.push((tp * tail.z - tail.y) / (my - tp * mz));
        if (mz !== 0) { const tmp = -tail.z / mz; if (tmp * (tmp * A + B) + C >= rad2) stmp.push(tmp); }
      } else if (mz !== 0) { stmp.push(-tail.z / mz); }
      const s = [0, 1];
      for (let i = 0; i < stmp.length; i++) {
        if (stmp[i] > 0 && stmp[i] < 1) { let k = 1; while (stmp[i] > s[k]) k++; if (stmp[i] !== s[k]) s.splice(k, 0, stmp[i]); }
      }
      const push = (bucket, s1, s2) => bucket.push({
        move: [s1 * mx + tail.x, s1 * my + tail.y], line: [s2 * mx + tail.x, s2 * my + tail.y]
      });
      for (let i = 0; i < s.length - 1; i++) {
        const s1 = s[i], s2 = s[i + 1];
        const m = s1 + (s2 - s1) / 2;
        const r2 = m * (m * A + B) + C;
        let toFront;
        if (r2 < rad2) {
          if (phi === -HALF_PI) toFront = !((m * mz + tail.z) > 0);
          else if (phi === HALF_PI) toFront = ((m * mz + tail.z) > 0);
          else toFront = !((m * my + tail.y - (m * mz + tail.z) * tp) > 1e-9);
        } else { toFront = !((m * mz + tail.z) < 0); }
        push(toFront ? this.front : this.back, s1, s2);
      }
    }
  }

  /* =========================================================================
     App  -  the controller (Hour Angle Demo.as) + canvas renderer + UI wiring.
     ========================================================================= */
  class App {
    constructor() {
      this.S = new CelestialSphere();
      this.S.setSize(320);              // sphereMC.size = 320  -> r = 160
      this.S.setMinPhi(7);              // minViewerAltitude = 7
      this.S.setMaxPhi(90);

      this.STAGE = 440;                 // canvas internal size (square)
      this.CENTER = 220;
      this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

      // demo state (star in celestial coords; sTime/lat for the observer)
      this.star = { ra: 4, dec: 30, sp: { x: 0, y: 0, z: 0 }, p: null };
      this.siderealTime = 2;
      this.latitude = 41;
      this.showHaArc = false;
      this.hourAngle = 0;

      this.buildScene();
      this.cacheDom();
      this.loadAssets();
      this.bindEvents();
      this.reset();                     // p.reset()
    }

    // --- build the fixed circles / lines / objects (Hour Angle Demo.init) ---
    buildScene() {
      const S = this.S;

      // pole axis stubs (celestial), light blue
      this.ncpAxis = new Line(S, { thickness: 2, color: AXIS_COLOR, alpha: 100 }, { ra: 0, dec: 90, r: 1 }, { ra: 0, dec: 90, r: 1.2 });
      this.scpAxis = new Line(S, { thickness: 2, color: AXIS_COLOR, alpha: 100 }, { ra: 0, dec: -90, r: 1 }, { ra: 0, dec: -90, r: 1.2 });
      this.lines = [this.ncpAxis, this.scpAxis];

      // observer's meridian (horizon system): semicircle whose extents track latitude
      this.observerMeridian = new Circle(S, { thickness: 2, color: AXIS_COLOR, alpha: 100 });
      this.observerMeridian.setParameters({ az: 0, alt: 0, tilt: 90, gammaStart: 0, gammaEnd: 180 });
      // faint white meridians (celestial guide great circles)
      this.meridian1 = new Circle(S, { thickness: 1, color: WHITE, alpha: 10 });
      this.meridian1.setParameters({ ra: 0, dec: 0, tilt: 90 });
      this.meridian2 = new Circle(S, { thickness: 1, color: WHITE, alpha: 10 });
      this.meridian2.setParameters({ ra: 6, dec: 0, tilt: 90 });
      // zero-hours circle + celestial equator (pale yellow)
      this.zeroHoursCircle = new Circle(S, { thickness: 1, color: YELLOW, alpha: 70 });
      this.zeroHoursCircle.setParameters({ ra: 0, dec: 0, tilt: 90, gammaStart: -90, gammaEnd: 90 });
      this.celestialEquator = new Circle(S, { thickness: 1, color: YELLOW, alpha: 70 });
      this.celestialEquator.setParameters({ ra: 0, dec: 0, tilt: 0 });
      // guide circles for the star's RA / dec (faint white)
      this.raCircle = new Circle(S, { thickness: 1, color: WHITE, alpha: 30 });
      this.raCircle.setParameters({ ra: 0, dec: 0, tilt: 90 });
      this.decCircle = new Circle(S, { thickness: 1, color: WHITE, alpha: 30 });
      this.decCircle.setParameters({ ra: 0, dec: 0, tilt: 90 });
      // coloured accent arcs: RA (white), dec (red), hour angle (gold)
      this.raArc = new Circle(S, { thickness: 3, color: RA_COLOR, alpha: 100 });
      this.raArc.setParameters({ ra: 0, dec: 0, tilt: 0 });
      this.decArc = new Circle(S, { thickness: 3, color: DEC_COLOR, alpha: 100 });
      this.decArc.setParameters({ ra: 0, dec: 0, tilt: 90 });
      this.hourAngleArc = new Circle(S, { thickness: 3, color: HA_COLOR, alpha: 100 });
      this.hourAngleArc.setParameters({ ra: 0, dec: 0, tilt: 0 });

      // Draw order (matches the AS depth banding: guides first, accents last).
      this.circles = [this.observerMeridian, this.meridian1, this.meridian2,
                      this.zeroHoursCircle, this.celestialEquator,
                      this.raCircle, this.decCircle,
                      this.raArc, this.decArc, this.hourAngleArc];
    }

    cacheDom() {
      this.canvas = document.getElementById('sky');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = this.STAGE * this.dpr;
      this.canvas.height = this.STAGE * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);

      this.el = {
        N: document.getElementById('lblN'), E: document.getElementById('lblE'),
        S: document.getElementById('lblS'), W: document.getElementById('lblW'),
        ra: document.getElementById('lblRa'), dec: document.getElementById('lblDec'),
        ha: document.getElementById('lblHa')
      };
      this.stSlider = document.getElementById('stSlider');
      this.stNumber = document.getElementById('stNumber');
      this.latSlider = document.getElementById('latSlider');
      this.latNumber = document.getElementById('latNumber');
      this.raSlider = document.getElementById('raSlider');
      this.raNumber = document.getElementById('raNumber');
      this.decSlider = document.getElementById('decSlider');
      this.decNumber = document.getElementById('decNumber');
      this.chkHaArc = document.getElementById('chkHaArc');
      this.desc = document.getElementById('diagramDesc');
      this.starHandle = document.getElementById('starHandle');
    }

    loadAssets() {
      this.imgStar = new Image();
      this.imgStarHover = new Image();
      this.imgStick = new Image();
      let pending = 3;
      const done = () => { if (--pending === 0) this.render(); };
      this.imgStar.onload = done; this.imgStar.onerror = done;
      this.imgStarHover.onload = done; this.imgStarHover.onerror = done;
      this.imgStick.onload = done; this.imgStick.onerror = done;
      this.imgStar.src = 'assets/star.png';
      this.imgStarHover.src = 'assets/star-hover.png';
      this.imgStick.src = 'assets/stickfigure.png';
      this.starHovered = false;
    }

    // ----------------------------------------------------------------------
    // Controller methods (ported from Hour Angle Demo.as)
    // ----------------------------------------------------------------------
    reset() {
      this.showHaArc = false;
      this.chkHaArc.checked = false;
      this.S.setViewerAzimuth(160);     // viewerAzimuth = 160  -> theta = 200
      this.S.setThetaAndPhi(this.S.getTheta(), 35);   // viewerAltitude = 35
      this.latitude = 41;
      this.onLatitudeChanged(41, true);
      this.siderealTime = 2;
      this.onSiderealTimeChanged(2, true);
      this.setStarLocation({ ra: 4, dec: 30 }, false);
      this.render();
      this.desc.textContent = 'View reset. ' + this.starDescription();
    }

    // p.onLatitudeChanged: observer meridian extents track latitude; the sphere's
    // celestial<->world mapping (m*, b*) also depends on latitude.
    onLatitudeChanged(lat, quiet) {
      this.latitude = lat;
      this.observerMeridian.setGamma(lat, lat + 180);
      this.S.setLatitude(lat);
      this.latSlider.value = lat;
      this.latNumber.value = toFixedAS(lat, 1);
      this.latSlider.setAttribute('aria-valuetext', 'Latitude ' + spoken(lat, 1) + ' degrees');
      if (!quiet) { this.render(); this.desc.textContent = 'Observer latitude ' + spoken(lat, 1) + ' degrees. ' + this.hourAngleDescription(); }
    }

    // p.onSiderealTimeChanged
    onSiderealTimeChanged(st, quiet) {
      this.siderealTime = st;
      this.S.setSiderealTime(st);
      this.stSlider.value = st;
      this.stNumber.value = toFixedAS(st, 2);
      this.stSlider.setAttribute('aria-valuetext', 'Sidereal time ' + spoken(st, 2) + ' hours');
      this.updateHourAngle();
      if (!quiet) { this.render(); this.desc.textContent = 'Sidereal time ' + spoken(st, 2) + ' hours. ' + this.hourAngleDescription(); }
    }

    // p.setStarLocation -- faithful port (celestial system)
    setStarLocation(pt, skipSliderSync) {
      const S = this.S;
      this.star.ra = pt.ra;
      this.star.dec = pt.dec;

      // RA arc (white): from 0h to the star's RA, along the celestial equator
      if (pt.ra !== 0) {
        this.raArc.setParameters({ ra: 0, dec: 0, tilt: 0, gammaStart: 0, gammaEnd: 15 * pt.ra });
        this.raArc.visible = true;
      } else { this.raArc.visible = false; }
      this.raCircle.setParameters({ ra: pt.ra, dec: 0, tilt: 90, gammaStart: -90, gammaEnd: 90 });

      // dec arc (red): vertical from the equator up/down to the star
      if (pt.dec < 0) {
        this.decArc.setParameters({ ra: pt.ra, dec: 0, tilt: 90, gammaStart: pt.dec, gammaEnd: 0 });
        this.decArc.visible = true;
      } else if (pt.dec > 0) {
        this.decArc.setParameters({ ra: pt.ra, dec: 0, tilt: 90, gammaStart: 0, gammaEnd: pt.dec });
        this.decArc.visible = true;
      } else { this.decArc.visible = false; }
      this.decCircle.setParameters({ ra: 0, dec: pt.dec, tilt: 0 });

      if (!skipSliderSync) {
        this.raSlider.value = pt.ra;
        this.decSlider.value = pt.dec;
        this.raNumber.value = toFixedAS(pt.ra, 2);
        this.decNumber.value = toFixedAS(pt.dec, 1);
      }
      this.raSlider.setAttribute('aria-valuetext', 'Right ascension ' + spoken(pt.ra, 2) + ' hours');
      this.decSlider.setAttribute('aria-valuetext', 'Declination ' + spoken(pt.dec, 1) + ' degrees');

      this.updateHourAngle();
    }

    // p.updateHourAngle
    updateHourAngle() {
      let ha = mod(this.siderealTime - this.star.ra + 24, 24);
      if (ha > 12) ha -= 24;
      this.hourAngle = ha;

      if (this.showHaArc) {
        const stv = this.siderealTime;
        // hour angle arc (gold) swept along the star's declination parallel
        if (ha < 0) {
          this.hourAngleArc.setParameters({ ra: stv, dec: this.star.dec, tilt: 0, gammaStart: 0, gammaEnd: 360 - 15 * ha });
          this.hourAngleArc.visible = true;
        } else if (ha > 0) {
          this.hourAngleArc.setParameters({ ra: stv, dec: this.star.dec, tilt: 0, gammaStart: -15 * ha, gammaEnd: 0 });
          this.hourAngleArc.visible = true;
        } else { this.hourAngleArc.visible = false; }
      } else {
        this.hourAngleArc.visible = false;
      }
      this.syncHourAngleReadout();
    }

    // ----------------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------------
    render() {
      const S = this.S, ctx = this.ctx, r = S.c.r;

      for (const c of this.circles) c.update();
      for (const l of this.lines) l.update();

      // star screen position (celestial -> screen)
      const starP = {}; S.parsePointInput({ ra: this.star.ra, dec: this.star.dec, r: 1 }, starP);
      this.star.p = starP;
      S.CtoSz(starP, this.star.sp);

      ctx.clearRect(0, 0, this.STAGE, this.STAGE);
      ctx.save();
      ctx.translate(this.CENTER, this.CENTER);

      const starBelowPlane = this.starWorldZ() < 0;

      // 1. FAR-SIDE geometry (behind the sphere centre), dimmed.
      this.drawCircleBucket('back');
      this.drawLineBucket('back');
      if (starBelowPlane) this.drawStar();

      // 2. Translucent sphere body between far and near halves (celestial "bowl"
      //    shading + faint rim), so far-side lines read fainter through it.
      this.drawGlass();

      // 3. Horizon plane (green ellipse) -- opaque, occludes the under side.
      this.drawHorizonPlane();

      // 4. NEAR-SIDE geometry (in front of the sphere centre), full strength.
      this.drawCircleBucket('front');
      this.drawLineBucket('front');
      this.drawStick();                 // observer stands on the plane
      if (!starBelowPlane) this.drawStar();

      ctx.restore();

      this.positionOverlay();
      this.updateCanvasDescription();
    }

    // World-space z of the star (above/below the horizon plane) -- CtoW.z.
    starWorldZ() {
      const w = {}; this.S.CtoW(this.star.p, w); return w.z;
    }

    drawCircleBucket(which) {
      const ctx = this.ctx;
      const dim = (which === 'back') ? 0.55 : 1;
      for (const c of this.circles) {
        const paths = c[which];
        if (!paths.length) continue;
        ctx.lineWidth = Math.max(1, c.thick);
        ctx.strokeStyle = intToCss(c.color);
        ctx.globalAlpha = (c.alpha / 100) * dim;
        for (const p of paths) {
          ctx.beginPath();
          ctx.moveTo(p.move[0], p.move[1]);
          for (const cu of p.curves) ctx.quadraticCurveTo(cu[0], cu[1], cu[2], cu[3]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    drawLineBucket(which) {
      const ctx = this.ctx;
      const dim = (which === 'back') ? 0.55 : 1;
      for (const l of this.lines) {
        const segs = l[which];
        if (!segs.length) continue;
        ctx.lineWidth = Math.max(1, l.thick);
        ctx.strokeStyle = intToCss(l.color);
        ctx.globalAlpha = (l.alpha / 100) * dim;
        for (const s of segs) {
          ctx.beginPath(); ctx.moveTo(s.move[0], s.move[1]); ctx.lineTo(s.line[0], s.line[1]); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Celestial "bowl" body: translucent radial shade (clear centre -> darker rim)
    // plus a faint outline, approximating the AS gradient-disk + edge shading on
    // the black field. Painted after the far side so back-side lines read muted.
    drawGlass() {
      const ctx = this.ctx, r = this.S.c.r;
      // A grey sphere body (lit from the upper-left) so the ball stands out from
      // the black field, as in the original. Kept translucent enough that far-side
      // lines/labels still read faintly through it -- the depth cue the original
      // conveyed with masked gradient shading.
      const g = ctx.createRadialGradient(-r * 0.32, -r * 0.36, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0,    'rgba(96,100,108,0.72)');
      g.addColorStop(0.55, 'rgba(64,67,76,0.76)');
      g.addColorStop(1,    'rgba(30,32,40,0.84)');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(160,165,175,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI); ctx.stroke();
    }

    // Horizon plane: the alt=0 disc. Its orthographic projection is an
    // axis-aligned ellipse -- full width (semi-axis r) and vertical semi-axis
    // r*sin(phi) -- matching the AS (_hP._xscale=r, _yscale=r*sin(phi)); the disc
    // art is radially symmetric so the theta rotation only repositions the
    // (separately drawn) direction labels.
    drawHorizonPlane() {
      const ctx = this.ctx, S = this.S, r = S.c.r;
      const yscale = Math.sin(S.phi);
      ctx.save();
      ctx.scale(1, yscale);
      const above = S.phi > 0;
      const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
      if (above) {                        // CSAboveHorizonPlane (bright green)
        g.addColorStop(0, '#46b446'); g.addColorStop(0.75, '#3da53d'); g.addColorStop(1, '#2f8a2f');
      } else {                            // CSBelowHorizonPlane (dark green)
        g.addColorStop(0, '#0a7a14'); g.addColorStop(1, '#005000');
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TWO_PI);
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }

    // Port of CSObjects "absolute" orientation (7 CS Objects, p.update oType 2):
    // a flat sprite at point p with unit normal n and up-vector u is foreshortened
    // (yscale = normal's screen-z / r) and rotated to lie tangent to the sphere.
    // sys 0 uses WtoSz + a-matrix; sys 1 uses CtoSz + b-matrix.
    absOrient(sys, p, n, u) {
      const S = this.S, c = S.c;
      const sp = {}, sp_n = {}, sp_u = {};
      let npz;
      if (sys === 1) {
        S.CtoSz(p, sp);
        S.CtoSz({ x: p.x + n.x, y: p.y + n.y, z: p.z + n.z }, sp_n);
        S.CtoSz({ x: p.x + u.x, y: p.y + u.y, z: p.z + u.z }, sp_u);
        npz = (n.x * c.b6 + n.y * c.b7 + n.z * c.b8) / c.r;
      } else {
        S.WtoSz(p, sp);
        S.WtoSz({ x: p.x + n.x, y: p.y + n.y, z: p.z + n.z }, sp_n);
        S.WtoSz({ x: p.x + u.x, y: p.y + u.y, z: p.z + u.z }, sp_u);
        npz = (n.x * c.a6 + n.y * c.a7 + n.z * c.a8) / c.r;
      }
      const A = Math.atan2(sp_n.y - sp.y, sp_n.x - sp.x) + HALF_PI;
      const cA = Math.cos(A), sA = Math.sin(A);
      const x0 = sp_u.x - sp.x, y0 = sp_u.y - sp.y;
      const x1 = cA * x0 + sA * y0, y1 = -sA * x0 + cA * y0;
      const instRot = Math.atan2(y1 / npz, x1) + HALF_PI;
      return { sp, yscale: npz, shellRot: A, instRot };
    }

    // Stick figure (observer) at the sphere centre. setOrientationType
    // ("absolute", normal (-1,0,0), up = zenith (0,0,1)) at 95% scale.
    drawStick() {
      const ctx = this.ctx;
      if (!this.imgStick.naturalWidth) return;
      const sc = 0.95;                    // _xscale/_yscale = 95
      const w = this.imgStick.naturalWidth * sc, h = this.imgStick.naturalHeight * sc;
      const o = this.absOrient(0, { x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
      ctx.save();
      ctx.translate(o.sp.x, o.sp.y);
      ctx.rotate(o.shellRot);
      ctx.scale(1, o.yscale === 0 ? 0.001 : o.yscale);
      ctx.rotate(o.instRot);
      ctx.drawImage(this.imgStick, -w / 2, -h, w, h);   // feet at the origin
      ctx.restore();
    }

    // Star (celestial). setOrientationType("absolute") with no args -> normal =
    // radial (the star's own direction), so the sprite lies flat on the sphere
    // and foreshortens toward the limb.
    drawStar() {
      const ctx = this.ctx;
      const img = (this.starHovered && this.star.sp.z > 0) ? this.imgStarHover : this.imgStar;
      if (!img.naturalWidth) return;
      const w = img.naturalWidth, h = img.naturalHeight;
      const p = this.star.p;
      const n = { x: p.x, y: p.y, z: p.z };
      let u;
      if (!(n.x === 0 && n.y === 0)) {
        const ux = -n.x * n.z, uy = -n.z * n.y, uz = n.x * n.x + n.y * n.y;
        const m = Math.sqrt(ux * ux + uy * uy + uz * uz);
        u = { x: ux / m, y: uy / m, z: uz / m };
      } else { u = { x: 0, y: 1, z: 0 }; }
      const o = this.absOrient(1, p, n, u);
      ctx.save();
      ctx.translate(o.sp.x, o.sp.y);
      ctx.rotate(o.shellRot);
      ctx.scale(1, o.yscale === 0 ? 0.001 : o.yscale);
      ctx.rotate(o.instRot);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // Position the HTML overlay labels (percent of the stage) over the scaled
    // canvas: cardinal directions on the horizon, and the RA / dec / hour-angle
    // read-outs riding on the sphere (positions from setStarLocation /
    // updateHourAngle). Labels behind the sphere are dimmed.
    positionOverlay() {
      const S = this.S;
      const placeW = (el, pt, show) => {   // horizon-system point
        if (!show) { el.style.display = 'none'; return; }
        const o = {}, sp = {}; S.parsePointInput(pt, o); S.WtoSz(o, sp);
        el.style.display = 'block';
        el.style.left = ((this.CENTER + sp.x) / this.STAGE * 100) + '%';
        el.style.top = ((this.CENTER + sp.y) / this.STAGE * 100) + '%';
        el.style.opacity = sp.z < 0 ? '0.45' : '1';
      };
      const placeC = (el, pt, show) => {   // celestial-system point
        if (!show) { el.style.display = 'none'; return; }
        const o = {}, sp = {}; S.parsePointInput(pt, o); S.CtoSz(o, sp);
        el.style.display = 'block';
        el.style.left = ((this.CENTER + sp.x) / this.STAGE * 100) + '%';
        el.style.top = ((this.CENTER + sp.y) / this.STAGE * 100) + '%';
        el.style.opacity = sp.z < 0 ? '0.45' : '1';
      };

      // Cardinal directions on the horizon (always shown), just outside the rim.
      placeW(this.el.N, { az: 0, alt: 0, r: 1.06 }, true);
      placeW(this.el.E, { az: 90, alt: 0, r: 1.06 }, true);
      placeW(this.el.S, { az: 180, alt: 0, r: 1.06 }, true);
      placeW(this.el.W, { az: 270, alt: 0, r: 1.06 }, true);

      // RA / dec read-out labels riding next to the star (always visible).
      this.el.ra.textContent = toFixedAS(this.star.ra, 1) + 'h';
      placeC(this.el.ra, { ra: this.star.ra - 0.9, dec: 5, r: 1.001 }, true);
      this.el.dec.textContent = toFixedAS(this.star.dec, 1) + '°';
      placeC(this.el.dec, { ra: this.star.ra + 0.9, dec: this.star.dec / 2, r: 1.001 }, true);

      // Hour-angle label (only when the arc is shown).
      if (this.showHaArc) {
        this.el.ha.textContent = toFixedAS(this.hourAngle, 1) + 'h';
        placeC(this.el.ha, { ra: this.siderealTime - this.hourAngle / 2, dec: this.star.dec + 5, r: 1 }, true);
      } else { this.el.ha.style.display = 'none'; }

      // Keyboard handle tracks the star's screen position + current coordinates.
      this.starHandle.style.left = ((this.CENTER + this.star.sp.x) / this.STAGE * 100) + '%';
      this.starHandle.style.top = ((this.CENTER + this.star.sp.y) / this.STAGE * 100) + '%';
      this.starHandle.setAttribute('aria-label',
        'Star position. Right ascension ' + spoken(this.star.ra, 2) + ' hours, declination ' + spoken(this.star.dec, 1) + ' degrees.');
    }

    updateCanvasDescription() {
      this.canvas.setAttribute('aria-label',
        'Celestial sphere diagram. Observer latitude ' + spoken(this.latitude, 1) +
        ' degrees, sidereal time ' + spoken(this.siderealTime, 2) + ' hours. Star at right ascension ' +
        spoken(this.star.ra, 2) + ' hours, declination ' + spoken(this.star.dec, 1) + ' degrees. ' +
        this.hourAngleDescription());
    }

    hourAngleDescription() {
      return 'Hour angle ' + spoken(this.hourAngle, 2) + ' hours.';
    }
    starDescription() {
      return 'Star at right ascension ' + spoken(this.star.ra, 2) + ' hours, declination ' +
             spoken(this.star.dec, 1) + ' degrees. ' + this.hourAngleDescription();
    }

    // ----------------------------------------------------------------------
    // MathJax read-outs (hour angle value + defining relation) and a11y text
    // ----------------------------------------------------------------------
    syncHourAngleReadout() {
      // Plain-text read-out (matches the original "hour angle: -0.37 h" field).
      const r = document.getElementById('haReadout');
      if (r) r.textContent = 'hour angle: ' + toFixedAS(this.hourAngle, 2) + ' h';
      const sr = document.getElementById('haEqnSr');   // units-complete spoken form
      if (sr) sr.textContent = 'Hour angle ' + spoken(this.hourAngle, 2) + ' hours.';
    }
    // ----------------------------------------------------------------------
    // Pointer + keyboard interaction
    // ----------------------------------------------------------------------
    pointerToStage(ev) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (ev.clientX - rect.left) / rect.width * this.STAGE - this.CENTER;
      const sy = (ev.clientY - rect.top) / rect.height * this.STAGE - this.CENTER;
      return { x: sx, y: sy };
    }

    bindEvents() {
      document.addEventListener('sim-reset', () => this.reset());

      // Sliders + text fields (both mutate the same state).
      const clampToRange = (v, slider) => Math.max(Number(slider.min), Math.min(Number(slider.max), v));

      this.stSlider.addEventListener('input', () => this.onSiderealTimeChanged(Number(this.stSlider.value)));
      this.stNumber.addEventListener('change', () => {
        let v = parseFloat(this.stNumber.value); if (!isFinite(v)) { v = this.siderealTime; }
        this.onSiderealTimeChanged(clampToRange(v, this.stSlider));
      });

      this.latSlider.addEventListener('input', () => this.onLatitudeChanged(Number(this.latSlider.value)));
      this.latNumber.addEventListener('change', () => {
        let v = parseFloat(this.latNumber.value); if (!isFinite(v)) { v = this.latitude; }
        this.onLatitudeChanged(clampToRange(v, this.latSlider));
      });

      this.raSlider.addEventListener('input', () => { this.setStarLocation({ ra: Number(this.raSlider.value), dec: this.star.dec }, true); this.raNumber.value = toFixedAS(this.star.ra, 2); this.render(); });
      this.raSlider.addEventListener('change', () => { this.desc.textContent = this.starDescription(); });
      this.raNumber.addEventListener('change', () => {
        let v = parseFloat(this.raNumber.value); if (!isFinite(v)) v = this.star.ra;
        this.setStarLocation({ ra: clampToRange(v, this.raSlider), dec: this.star.dec }, false); this.render(); this.desc.textContent = this.starDescription();
      });

      this.decSlider.addEventListener('input', () => { this.setStarLocation({ ra: this.star.ra, dec: Number(this.decSlider.value) }, true); this.decNumber.value = toFixedAS(this.star.dec, 1); this.render(); });
      this.decSlider.addEventListener('change', () => { this.desc.textContent = this.starDescription(); });
      this.decNumber.addEventListener('change', () => {
        let v = parseFloat(this.decNumber.value); if (!isFinite(v)) v = this.star.dec;
        this.setStarLocation({ ra: this.star.ra, dec: clampToRange(v, this.decSlider) }, false); this.render(); this.desc.textContent = this.starDescription();
      });

      this.chkHaArc.addEventListener('change', () => {
        this.showHaArc = this.chkHaArc.checked;
        this.updateHourAngle(); this.render();
        this.desc.textContent = this.showHaArc ? 'Hour angle arc shown. ' + this.hourAngleDescription() : 'Hour angle arc hidden.';
      });

      // Canvas pointer drag: front-facing star -> move star; else rotate sphere.
      this.dragMode = null;
      this.canvas.addEventListener('pointermove', (ev) => this.onPointerHover(ev));
      this.canvas.addEventListener('pointerdown', (ev) => this.onPointerDown(ev));
      window.addEventListener('pointermove', (ev) => this.onPointerDrag(ev));
      window.addEventListener('pointerup', () => this.onPointerUp());

      this.canvas.addEventListener('keydown', (ev) => this.onCanvasKey(ev));
      this.starHandle.addEventListener('keydown', (ev) => this.onStarKey(ev));

      window.addEventListener('resize', () => this.render());
    }

    nearStar(stage) {
      const dx = stage.x - this.star.sp.x, dy = stage.y - this.star.sp.y;
      return (dx * dx + dy * dy) <= 14 * 14;
    }
    onPointerHover(ev) {
      if (this.dragMode) return;
      const stage = this.pointerToStage(ev);
      const over = this.nearStar(stage) && this.star.sp.z > 0;
      if (over !== this.starHovered) { this.starHovered = over; this.render(); }
    }
    onPointerDown(ev) {
      const stage = this.pointerToStage(ev);
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(ev.pointerId);
      // Draggable Star.onPress: front-facing star -> drag star, else the sphere.
      if (this.nearStar(stage) && this.star.sp.z > 0) { this.dragMode = 'star'; this.starHandle.focus(); }
      else {
        this.dragMode = 'sphere';
        this.dragXMouse = stage.x; this.dragYMouse = stage.y;
        this.dragTheta = this.S.theta; this.dragPhi = this.S.phi;
        this.canvas.focus();
      }
      this.canvas.classList.add('dragging');
      ev.preventDefault();
    }
    onPointerDrag(ev) {
      if (!this.dragMode) return;
      const stage = this.pointerToStage(ev);
      if (this.dragMode === 'star') {
        // Draggable Star.onMouseMoveFunc -> getMouseRaDec -> setStarLocation
        const rd = this.S.screenToRaDec(stage.x, stage.y);
        if (rd) { this.setStarLocation({ ra: rd.ra, dec: rd.dec }, false); this.render(); }
      } else {
        // CelestialSphere.updateSimpleDragging
        const r = this.S.c.r;
        this.S.setThetaAndPhi(
          R2D * (this.dragTheta - (stage.x - this.dragXMouse) / r),
          R2D * (this.dragPhi + (stage.y - this.dragYMouse) / r));
        this.render();
      }
    }
    onPointerUp() {
      if (!this.dragMode) return;
      const wasStar = this.dragMode === 'star';
      this.dragMode = null;
      this.canvas.classList.remove('dragging');
      this.desc.textContent = wasStar ? this.starDescription() : this.viewDescription();
    }

    // Arrow keys rotate the view; Shift = finer step, Page keys move phi in 15deg.
    onCanvasKey(ev) {
      const step = ev.shiftKey ? 1 : 5;
      let dTheta = 0, dPhi = 0;
      switch (ev.key) {
        case 'ArrowLeft':  dTheta = step;  break;
        case 'ArrowRight': dTheta = -step; break;
        case 'ArrowUp':    dPhi = -step;   break;
        case 'ArrowDown':  dPhi = step;    break;
        case 'PageUp':     dPhi = -15;     break;
        case 'PageDown':   dPhi = 15;      break;
        default: return;
      }
      ev.preventDefault();
      this.S.setThetaAndPhi(this.S.getTheta() + dTheta, this.S.getPhi() + dPhi);
      this.render();
      this.desc.textContent = this.viewDescription();
    }

    // Arrow keys move the star (RA/dec). Shift = finer; Page keys move dec by 15.
    onStarKey(ev) {
      const raStep = ev.shiftKey ? 0.1 : 0.5, decStep = ev.shiftKey ? 1 : 5;
      let dRa = 0, dDec = 0;
      switch (ev.key) {
        case 'ArrowLeft':  dRa = -raStep;  break;
        case 'ArrowRight': dRa = raStep;   break;
        case 'ArrowUp':    dDec = decStep; break;
        case 'ArrowDown':  dDec = -decStep; break;
        case 'PageUp':     dDec = 15;      break;
        case 'PageDown':   dDec = -15;     break;
        default: return;
      }
      ev.preventDefault();
      let ra = this.star.ra + dRa;
      if (ra > 23.99) ra = 23.99; else if (ra < 0) ra = 0;
      let dec = this.star.dec + dDec;
      if (dec > 90) dec = 90; else if (dec < -90) dec = -90;
      this.setStarLocation({ ra: ra, dec: dec }, false);
      this.render();
      this.desc.textContent = this.starDescription();
    }

    viewDescription() {
      return 'View rotated. Viewing azimuth ' + spoken(this.S.getViewerAzimuth(), 0) +
             ' degrees, viewing altitude ' + spoken(this.S.getPhi(), 0) + ' degrees.';
    }
  }

  // Initialise once the foundation helper (kl-unl.js) is ready. We redefine
  // klunlInitEqn (per the foundation convention) to boot the sim and typeset the
  // static relation; the hour-angle read-out is typeset from updateHourAngle.
  function boot() {
    if (window.haApp) return;
    window.haApp = new App();
    window.haApp.syncHourAngleReadout();
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise().catch((e) => console.error(e));
  }

  const priorInit = window.klunlInitEqn;
  window.klunlInitEqn = function () { if (typeof priorInit === 'function') { /* superseded */ } boot(); };

  // Boot even if MathJax/foundation ordering varies.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
    MathJax.startup.promise.then(() => { if (window.haApp) { window.haApp.syncHourAngleReadout(); } });
  }
})();
