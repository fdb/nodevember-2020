export function toRadians(deg) {
  return deg * (Math.PI / 180);
}

export function lerp(a, b, t) {
  return a * (1.0 - t) + b * t;
}

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  clone() {
    return new Vec2(this.x, this.y);
  }
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  sub(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  divideScalar(n) {
    this.x /= n;
    this.y /= n;
    this.z /= n;
    return this;
  }

  static crossProduct(a, b) {
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const bx = b.x;
    const by = b.y;
    const bz = b.z;
    return new Vec3(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize() {
    return this.divideScalar(this.length() || 1);
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
}

// AffineTransfom kept in row-major order
// 0 1 2
// 3 4 5
// 0 0 1
export class AffineTransfom {
  constructor() {
    this.m = [1, 0, 0, 0, 1, 0];
  }

  identity() {
    this.m[0] = 1;
    this.m[1] = 0;
    this.m[2] = 0;
    this.m[3] = 0;
    this.m[4] = 1;
    this.m[5] = 0;
  }

  transformPoint(pt) {
    const [m11, m12, m13, m21, m22, m23] = this.m;
    const x = pt.x;
    const y = pt.y;
    return new Vec2(m11 * x + m12 * y + m13, m21 * x + m22 * y + m23);
  }

  transformShape(geo) {
    const [m11, m12, m13, m21, m22, m23] = this.m;
    const xs = geo.commands.getArray('p[x]');
    const ys = geo.commands.getArray('p[y]');
    for (let i = 0, l = geo.commands.size; i < l; i++) {
      const x = xs[i];
      const y = ys[i];
      xs[i] = m11 * x + m12 * y + m13;
      ys[i] = m21 * x + m22 * y + m23;
    }
  }

  transformXY(x, y) {
    const [m11, m12, m13, m21, m22, m23] = this.m;
    return [m11 * x + m12 * y + m13, m21 * x + m22 * y + m23];
  }

  translate(tx, ty) {
    if (tx instanceof Vec2) {
      ty = tx.y;
      tx = tx.x;
    }
    const [m11, m12, m13, m21, m22, m23] = this.m;
    this.m[2] = tx * m11 + ty * m12 + m13;
    this.m[5] = tx * m21 + ty * m22 + m23;
    // this.m[2] = m13 + tx;
    // this.m[5] = m23 + ty;
    return this;
  }

  scale(sx, sy) {
    if (sx instanceof Vec2) {
      sy = sx.y;
      sx = sx.x;
    }
    const m = this.m;
    m[0] *= sx;
    m[1] *= sy;
    //m[2] *= sx;
    m[3] *= sx;
    m[4] *= sy;
    // m[5] *= sy;
    return this;
  }

  // Rotate clockwise with given degrees.
  rotate(degrees) {
    const theta = toRadians(degrees);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    const m = this.m;
    const [m11, m12, m13, m21, m22, m23] = m;

    m[0] = c * m11 + s * m12;
    m[1] = -s * m11 + c * m12;
    // m[2] = m13; // c * m13 + -s * m23;

    m[3] = c * m21 + s * m22;
    m[4] = -s * m21 + c * m22;
    // m[5] = m23; // s * m13 + c * m23;

    // m[0] = c * m11 + -s * m21;
    // m[1] = c * m12 + -s * m22;
    // m[2] = c * m13 + -s * m23;

    // m[3] = s * m11 + c * m21;
    // m[4] = s * m12 + c * m22;
    // m[5] = s * m13 + c * m23;

    return this;
  }

  shear(shx, shy) {
    const m = this.m;
    const [m11, m12, m13, m21, m22, m23] = m;
    m[0] = m11 + m12 * shy;
    m[1] = m11 * shx + m12;
    m[3] = m21 + m22 * shy;
    m[4] = m21 * shx + m22;
    return this;
  }
}

export class Matrix4 {
  // prettier-ignore
  constructor() {
    this.m = [
      1, 0, 0, 0, 
      0, 1, 0, 0, 
      0, 0, 1, 0, 
      0, 0, 0, 1
    ];
  }

  // prettier-ignore
  set(m11, m12, m13, m14, m21, m22, m23, m24, m31, m32, m33, m34, m41, m42, m43, m44) {
    const m = this.m;
    m[ 0] = m11; m[ 1] = m12; m[ 2] = m13; m[ 3] = m14;
    m[ 4] = m21; m[ 5] = m22; m[ 6] = m23; m[ 7] = m24;
    m[ 8] = m31; m[ 9] = m32; m[10] = m33; m[11] = m34;
    m[12] = m41; m[13] = m42; m[14] = m43; m[15] = m44;
  }

  // prettier-ignore
  identity() {
    this.set(
      1, 0, 0, 0, 
      0, 1, 0, 0, 
      0, 0, 1, 0, 
      0, 0, 0, 1
    );
    return this;
  }

  // prettier-ignore
  fromArray(arr) {
    const m = this.m;
    m[ 0] = arr[ 0]; m[ 1] = arr[ 1]; m[ 2] = arr[ 2]; m[ 3] = arr[ 3];
    m[ 4] = arr[ 4]; m[ 5] = arr[ 5]; m[ 6] = arr[ 6]; m[ 7] = arr[ 7];
    m[ 8] = arr[ 8]; m[ 9] = arr[ 9]; m[10] = arr[10]; m[11] = arr[11];
    m[12] = arr[12]; m[13] = arr[13]; m[14] = arr[14]; m[15] = arr[15];
  }

  // prettier-ignore
  toUniformMatrix(arr = [], offset = 0) {
    const m = this.m;

    arr[offset] = m[ 0];
    arr[offset + 1] = m[ 4];
    arr[offset + 2] = m[ 8];
    arr[offset + 3] = m[12];

    arr[offset + 4] = m[ 1];
    arr[offset + 5] = m[ 5];
    arr[offset + 6] = m[ 9];
    arr[offset + 7] = m[13];

    arr[offset + 8] = m[ 2];
    arr[offset + 9] = m[ 6];
    arr[offset + 10] = m[10];
    arr[offset + 11] = m[14];

    arr[offset + 12] = m[ 3];
    arr[offset + 13] = m[ 7];
    arr[offset + 14] = m[ 11];
    arr[offset + 15] = m[ 15];

    return arr;
  }

  clone() {
    return new Matrix4().fromArray(this.m);
  }

  // prettier-ignore
  scale(v) {
    const m = this.m;
    const x = v.x, y = v.y, z = v.z;
    m[ 0] *= x; m[ 1] *= y; m[ 2] *= z;
    m[ 4] *= x; m[ 5] *= y; m[ 6] *= z;
    m[ 8] *= x; m[ 9] *= y; m[10] *= z;
    m[12] *= x; m[ 7] *= y; m[15] *= z;
    return this;
  }

  // prettier-ignore
  makePerspective(left, right, top, bottom, near, far) {
    const m = this.m;
    const x = 2 * near / ( right - left );
    const y = 2 * near / ( top - bottom );

    const a = ( right + left ) / ( right - left );
    const b = ( top + bottom ) / ( top - bottom );
    const c = - ( far + near ) / ( far - near );
    const d = - 2 * far * near / ( far - near );

    m[ 0] = x;  m[ 1] = 0;  m[ 2] = a;  m[ 3] = 0;
    m[ 4] = 0;  m[ 5] = y;  m[ 6] = b;  m[ 7] = 0;
    m[ 8] = 0;  m[ 9] = 0;  m[10] = c;  m[11] = d;
    m[12] = 0;  m[13] = 0;  m[14] = -1; m[15] = 0;

    return this;
  }

  makePerspectiveCamera(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    const zoom = 1;
    const top = (near * Math.tan(toRadians(fov) * 0.5)) / zoom;
    const height = 2 * top;
    const width = aspect * height;
    const left = -0.5 * width;

    this.makePerspective(left, left + width, top, top - height, near, far);
    this.invert();
    return this;
  }

  // prettier-ignore
  makeOrthographic(left, right, top, bottom, near, far) {
    const m = this.m;
    const w = 1.0 / (right - left);
    const h = 1.0 / (top - bottom);
    const p = 1.0 / (far - near);

    const x = (right + left) * w;
    const y = (top + bottom) * h;
    const z = (far + near) * p;

    m[ 0] = 2 * w; m[ 1] = 0;     m[ 2] =  0;     m[ 3] = -x; 
    m[ 4] = 0;     m[ 5] = 2 * h; m[ 6] = 0;      m[ 7] = -y; 
    m[ 8] = 0;     m[ 9] = 0;     m[10] = -2 * p; m[11] = -z;
    m[12] = 0;     m[13] = 0;     m[14] = 0;      m[15] = 1;

    return this;
  }

  makeOrthographicCamera(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
    const zoom = 1;
    const dx = (right - left) / (2 * zoom);
    const dy = (top - bottom) / (2 * zoom);
    const cx = (right + left) / 2;
    const cy = (top + bottom) / 2;

    left = cx - dx;
    right = cx + dx;
    top = cy + dy;
    bottom = cy - dy;

    this.makeOrthographic(left, right, top, bottom, near, far);
    this.invert();
    return this;
  }

  // prettier-ignore
  makeTranslation(tx, ty, tz) {
    this.set(
      1, 0, 0, tx,
      0, 1, 0, ty, 
      0, 0, 1, tz,
      0, 0, 0, 1
    );
    return this;
  }

  // prettier-ignore
  makeRotationX(r) {
    const c = Math.cos(r);
    const s = Math.sin(r);
    this.set(
      1, 0,  0, 0,
      0, c, -s, 0, 
      0, s,  c, 0,
      0, 0,  0, 1
    );
    return this;
  }

  // prettier-ignore
  makeRotationY(r) {
    const c = Math.cos(r);
    const s = Math.sin(r);
    this.set(
      c, 0, s, 0,
      0, 1, 0, 0, 
     -s, 0, c, 0,
      0, 0, 0, 1
    );
    return this;
  }

  // prettier-ignore
  makeRotationZ(r) {
    const c = Math.cos(r);
    const s = Math.sin(r);
    this.set(
      c, -s, 0, 0,
      s,  c, 0, 0, 
      0,  0, 1, 0,
      0,  0, 0, 1
    );
    return this;
  }

  multiply(m) {
    return this.multiplyInto(this, m);
  }

  premultiply(m) {
    return this.multiplyInto(m, this);
  }

  // prettier-ignore
  multiplyInto(a, b) {
    const am = a.m;
    const bm = b.m;
    const m = this.m;

    const a11 = am[ 0], a12 = am[ 1], a13 = am[ 2], a14 = am[ 3];
    const a21 = am[ 4], a22 = am[ 5], a23 = am[ 6], a24 = am[ 7];
    const a31 = am[ 8], a32 = am[ 9], a33 = am[10], a34 = am[11];
    const a41 = am[12], a42 = am[13], a43 = am[14], a44 = am[15];

    const b11 = bm[ 0], b12 = bm[ 1], b13 = bm[ 2], b14 = bm[ 3];
    const b21 = bm[ 4], b22 = bm[ 5], b23 = bm[ 6], b24 = bm[ 7];
    const b31 = bm[ 8], b32 = bm[ 9], b33 = bm[10], b34 = bm[11];
    const b41 = bm[12], b42 = bm[13], b43 = bm[14], b44 = bm[15];

    m[ 0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    m[ 1] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    m[ 2] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    m[ 3] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    m[ 4] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    m[ 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    m[ 6] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    m[ 7] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    m[ 8] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    m[ 9] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    m[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    m[11] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    m[12] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    m[13] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    m[14] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    m[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    return this;
  }

  // prettier-ignore
  invert() {
    const m = this.m;
    const m11 = m[ 0], m12 = m[ 1], m13 = m[ 2], m14 = m[ 3];
    const m21 = m[ 4], m22 = m[ 5], m23 = m[ 6], m24 = m[ 7];
    const m31 = m[ 8], m32 = m[ 9], m33 = m[10], m34 = m[11];
    const m41 = m[12], m42 = m[13], m43 = m[14], m44 = m[15];

    const t11 = m23 * m34 * m42 - m24 * m33 * m42 + m24 * m32 * m43 - m22 * m34 * m43 - m23 * m32 * m44 + m22 * m33 * m44;
    const t12 = m14 * m33 * m42 - m13 * m34 * m42 - m14 * m32 * m43 + m12 * m34 * m43 + m13 * m32 * m44 - m12 * m33 * m44;
    const t13 = m13 * m24 * m42 - m14 * m23 * m42 + m14 * m22 * m43 - m12 * m24 * m43 - m13 * m22 * m44 + m12 * m23 * m44;
    const t14 = m14 * m23 * m32 - m13 * m24 * m32 - m14 * m22 * m33 + m12 * m24 * m33 + m13 * m22 * m34 - m12 * m23 * m34;

    const det = m11 * t11 + m21 * t12 + m31 * t13 + m41 * t14;
    if (det === 0) return this.set( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 );
    const detInv = 1 / det;
    m[ 0] = t11 * detInv;
    m[ 4] = t12 * detInv;
    m[ 8] = t13 * detInv;
    m[12] = t14 * detInv;

    m[ 1] = ( m24 * m33 * m41 - m23 * m34 * m41 - m24 * m31 * m43 + m21 * m34 * m43 + m23 * m31 * m44 - m21 * m33 * m44 ) * detInv;
    m[ 5] = ( m13 * m34 * m41 - m14 * m33 * m41 + m14 * m31 * m43 - m11 * m34 * m43 - m13 * m31 * m44 + m11 * m33 * m44 ) * detInv;
    m[ 9] = ( m14 * m23 * m41 - m13 * m24 * m41 - m14 * m21 * m43 + m11 * m24 * m43 + m13 * m21 * m44 - m11 * m23 * m44 ) * detInv;
    m[13] = ( m13 * m24 * m31 - m14 * m23 * m31 + m14 * m21 * m33 - m11 * m24 * m33 - m13 * m21 * m34 + m11 * m23 * m34 ) * detInv;

    m[ 2] = ( m22 * m34 * m41 - m24 * m32 * m41 + m24 * m31 * m42 - m21 * m34 * m42 - m22 * m31 * m44 + m21 * m32 * m44 ) * detInv;
    m[ 6] = ( m14 * m32 * m41 - m12 * m34 * m41 - m14 * m31 * m42 + m11 * m34 * m42 + m12 * m31 * m44 - m11 * m32 * m44 ) * detInv;
    m[10] = ( m12 * m24 * m41 - m14 * m22 * m41 + m14 * m21 * m42 - m11 * m24 * m42 - m12 * m21 * m44 + m11 * m22 * m44 ) * detInv;
    m[14] = ( m14 * m22 * m31 - m12 * m24 * m31 - m14 * m21 * m32 + m11 * m24 * m32 + m12 * m21 * m34 - m11 * m22 * m34 ) * detInv;

    m[ 3] = ( m23 * m32 * m41 - m22 * m33 * m41 - m23 * m31 * m42 + m21 * m33 * m42 + m22 * m31 * m43 - m21 * m32 * m43 ) * detInv;
    m[ 7] = ( m12 * m33 * m41 - m13 * m32 * m41 + m13 * m31 * m42 - m11 * m33 * m42 - m12 * m31 * m43 + m11 * m32 * m43 ) * detInv;
    m[11] = ( m13 * m22 * m41 - m12 * m23 * m41 - m13 * m21 * m42 + m11 * m23 * m42 + m12 * m21 * m43 - m11 * m22 * m43 ) * detInv;
    m[15] = ( m12 * m23 * m31 - m13 * m22 * m31 + m13 * m21 * m32 - m11 * m23 * m32 - m12 * m21 * m33 + m11 * m22 * m33 ) * detInv;
    
    return this;
  }
}

export class Color {
  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  equals(other) {
    if (!other) return false;
    return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
  }

  get visible() {
    return this.a > 0;
  }

  toRgba() {
    return `rgba(${this.r * 255}, ${this.g * 255}, ${this.b * 255}, ${this.a})`;
  }
  setFillStyle(ctx) {
    ctx.fillStyle = this.toRgba();
  }
  setStrokeStyle(ctx) {
    ctx.strokeStyle = this.toRgba();
  }
  clone() {
    return new Color(this.r, this.g, this.b, this.a);
  }
}

export class LinearGradient {
  constructor(r1 = 0, g1 = 0, b1 = 0, a1 = 1, r2 = 1, g2 = 1, b2 = 1, a2 = 1) {
    this.r1 = r1;
    this.g1 = g1;
    this.b1 = b1;
    this.a1 = a1;
    this.r2 = r2;
    this.g2 = g2;
    this.b2 = b2;
    this.a2 = a2;
  }

  get visible() {
    return true;
  }

  createGradient(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 500);
    const clr1 = `rgba(${this.r1 * 255}, ${this.g1 * 255}, ${this.b1 * 255}, ${this.a1})`;
    const clr2 = `rgba(${this.r2 * 255}, ${this.g2 * 255}, ${this.b2 * 255}, ${this.a2})`;
    gradient.addColorStop(0, clr1);
    gradient.addColorStop(1, clr2);
    return gradient;
  }
  setFillStyle(ctx) {
    ctx.fillStyle = this.createGradient(ctx);
  }
  setStrokeStyle(ctx) {
    ctx.strokeStyle = this.createGradient(ctx);
  }
  clone() {
    return new LinearGradient(this.r1, this.g1, this.b1, this.a1, this.r2, this.g2, this.b2, this.a2);
  }
}

export class Style {
  constructor(fill, stroke, strokeWidth = 1) {
    this.fill = fill ? fill.clone() : null;
    this.stroke = stroke ? stroke.clone() : null;
    this.strokeWidth = strokeWidth;
  }

  clone() {
    const newStyle = new Style(this.fill, this.stroke, this.strokeWidth);
    return newStyle;
  }

  equals(other) {
    return (
      ((!this.fill && !other.fill) || this.fill.equals(other.fill)) &&
      ((!this.stroke && !other.stroke) || this.stroke.equals(other.stroke)) &&
      this.strokeWidth === other.strokeWidth
    );
  }

  draw(ctx) {
    if (this.fill && this.fill.visible) {
      this.fill.setFillStyle(ctx);
      ctx.fill();
    }
    if (this.stroke && this.stroke.a > 0) {
      this.stroke.setStrokeStyle(ctx);
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }
  }
}

export const PATH_MOVE_TO = 1;
export const PATH_LINE_TO = 2;
export const PATH_CURVE_TO = 3;
export const PATH_CLOSE = 4;
export const PATH_CTRL = 5;

export const CIRCLE_EPSILON = (4 / 3) * Math.tan(Math.PI / 8);

export const ATTRIBUTE_TYPE_U8 = 'u8';
export const ATTRIBUTE_TYPE_I16 = 'i16';
export const ATTRIBUTE_TYPE_F32 = 'f32';

class Attribute {
  constructor(name, type, initialCapacity = 32) {
    this.name = name;
    this.type = type;
    this._expand(initialCapacity);
  }

  clone(capacity) {
    const newAttribute = new Attribute(this.name, this.type, capacity);
    if (this.type === ATTRIBUTE_TYPE_U8) {
      newAttribute.data = Uint8Array.from(this.data);
    } else if (this.type === ATTRIBUTE_TYPE_I16) {
      newAttribute.data = Int16Array.from(this.data);
    } else if (this.type === ATTRIBUTE_TYPE_F32) {
      newAttribute.data = Float32Array.from(this.data);
    } else {
      throw new Error(`Unknown type ${this.type}`);
    }
    return newAttribute;
  }

  _expand(newCapacity) {
    this.capacity = newCapacity;
    let newData;
    if (this.type === ATTRIBUTE_TYPE_U8) {
      newData = new Uint8Array(this.capacity);
      this.data && newData.set(this.data);
    } else if (this.type === ATTRIBUTE_TYPE_I16) {
      newData = new Int16Array(this.capacity);
      this.data && newData.set(this.data);
    } else if (this.type === ATTRIBUTE_TYPE_F32) {
      newData = new Float32Array(this.capacity);
      this.data && newData.set(this.data);
    } else {
      throw new Error(`Unknown type ${this.type}`);
    }
    this.data = newData;
  }
}

class AttributeTable {
  constructor(initialCapacity) {
    this.table = {};
    this.size = 0;
    this.capacity = initialCapacity;
  }

  clone() {
    const newTable = new AttributeTable(this.capacity);
    for (const key in this.table) {
      newTable.table[key] = this.table[key].clone(this.capacity);
    }
    newTable.size = this.size;
    return newTable;
  }

  addAttributeType(name, type) {
    this.table[name] = new Attribute(name, type, this.capacity);
  }

  hasAttribute(name) {
    return name in this.table;
  }

  ensureCapacity(requiredSize) {
    if (requiredSize > this.capacity) {
      this.capacity *= 2;
      for (const attr in this.table) {
        this.table[attr]._expand(this.capacity);
      }
    }
  }

  increaseCapacity(newCapacity) {
    this.ensureCapacity(this.size + newCapacity);
  }

  append(data) {
    this.increaseCapacity(1);
    for (const key in data) {
      const attribute = this.table[key];
      if (!attribute) {
        throw new Error(`Attribute ${key} not found.`);
      }
      attribute.data[this.size] = data[key];
    }
    this.size++;
  }

  set(index, data) {
    if (index >= this.size) {
      throw new Error(`Set is called with index out of bounds (${index} >= ${this.size})`);
    }
    for (const key in data) {
      const attribute = this.table[key];
      if (!attribute) {
        throw new Error(`Attribute ${key} not found.`);
      }
      attribute.data[index] = data[key];
    }
  }

  getObject(index) {
    if (index >= this.size) {
      throw new Error(`Get is called with index out of bounds (${index} >= ${this.size})`);
    }
    const obj = {};
    for (const key in this.table) {
      obj[key] = this.table[key].data[index];
    }
    return obj;
  }

  get(index, key) {
    if (index >= this.size) {
      throw new Error(`Get is called with index out of bounds (${index} >= ${this.size})`);
    }
    const attribute = this.table[key];
    if (!attribute) {
      throw new Error(`Attribute ${key} not found.`);
    }
    return attribute.data[index];
  }

  getArray(key) {
    const attribute = this.table[key];
    if (!attribute) {
      throw new Error(`Attribute ${key} not found.`);
    }
    return attribute.data;
  }
}

let simplex = new SimplexNoise(100);

export class Shape {
  constructor(initialCapacity = 32) {
    this.contours = new AttributeTable(8);
    this.contours.addAttributeType('offset', ATTRIBUTE_TYPE_I16);
    this.contours.addAttributeType('closed', ATTRIBUTE_TYPE_U8);
    this.contours.addAttributeType('style', ATTRIBUTE_TYPE_I16);

    this.commands = new AttributeTable(initialCapacity);
    this.commands.addAttributeType('verb', ATTRIBUTE_TYPE_U8);
    this.commands.addAttributeType('p[x]', ATTRIBUTE_TYPE_F32);
    this.commands.addAttributeType('p[y]', ATTRIBUTE_TYPE_F32);

    this.styles = [];
    this.currentStyleIndex = -1;
  }

  clone() {
    const newGeo = new Shape();
    newGeo.contours = this.contours.clone();
    newGeo.commands = this.commands.clone();
    newGeo.styles = this.styles.map((style) => style.clone());
    newGeo.currentStyleIndex = this.currentStyleIndex;
    return newGeo;
  }

  extend(geo) {
    // Each contour has a style index, so we'll store the current offset.
    const styleOffset = this.styles.length;

    // Extend contours
    const contoursSize = geo.contours.size;
    const offset = geo.contours.getArray('offset');
    const closed = geo.contours.getArray('closed');
    const style = geo.contours.getArray('style');
    for (let i = 0; i < contoursSize; i++) {
      const newContour = { offset: offset[i] + this.commands.size, closed: closed[i], style: style[i] + styleOffset };
      this.contours.append(newContour);
    }

    // Extend commands
    const commandsSize = geo.commands.size;
    for (let i = 0; i < commandsSize; i++) {
      const newCommand = geo.commands.getObject(i);
      this.commands.append(newCommand);
    }

    // Extends styles
    for (const style of geo.styles) {
      this.styles.push(style.clone());
    }
    this.currentStyleIndex = this.styles.length - 1;
  }

  mapPoints(fn) {
    const size = this.commands.size;
    const xs = this.commands.getArray('p[x]');
    const ys = this.commands.getArray('p[y]');
    for (let i = 0; i < size; i++) {
      const [x, y] = fn(xs[i], ys[i], i, size);
      xs[i] = x;
      ys[i] = y;
    }
  }

  moveTo(x, y) {
    // this.contours.increaseCapacity(1);
    const offset = this.commands.size;
    if (this.styles.length === 0) {
      // Add a default path style.
      this.styles.push(new Style(new Color(0, 0, 0, 1), new Color(0, 0, 0, 0), 1));
      this.currentStyleIndex = 0;
    }
    this.contours.append({ offset, closed: 0, style: this.currentStyleIndex });
    this.commands.append({ verb: PATH_MOVE_TO, 'p[x]': x, 'p[y]': y });
  }

  lineTo(x, y) {
    this.commands.append({ verb: PATH_LINE_TO, 'p[x]': x, 'p[y]': y });
  }

  curveTo(cx1, cy1, cx2, cy2, x, y) {
    this.commands.append({ verb: PATH_CURVE_TO, 'p[x]': x, 'p[y]': y });
    this.commands.append({ verb: PATH_CTRL, 'p[x]': cx1, 'p[y]': cy1 });
    this.commands.append({ verb: PATH_CTRL, 'p[x]': cx2, 'p[y]': cy2 });
  }

  close() {
    console.assert(this.contours.size > 0, `Close command called but there is no current path.`);
    this.contours.set(this.contours.size - 1, { closed: 1 });
  }

  addRect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.close();
  }

  addStyle(style) {
    this.styles.push(style);
    this.currentStyleIndex = this.styles.length - 1;
  }

  draw(ctx) {
    const { contours, commands, styles } = this;
    if (contours.size > 0) {
      this._drawShapes(ctx, contours, commands, styles);
    } else if (commands.size > 0) {
      this._drawPoints(ctx, commands);
    }
  }

  _drawShapes(ctx, contours, commands, styles) {
    ctx.beginPath();
    for (let i = 0; i < contours.size; i++) {
      const offset = contours.get(i, 'offset');
      const closed = contours.get(i, 'closed');
      const style = contours.get(i, 'style');
      const nextOffset = i < contours.size - 1 ? contours.get(i + 1, 'offset') : commands.size;
      for (let j = offset; j < nextOffset; j++) {
        const verb = commands.get(j, 'verb');
        if (verb === PATH_MOVE_TO) {
          const x = commands.get(j, 'p[x]');
          const y = commands.get(j, 'p[y]');
          ctx.beginPath(); // perf hack
          ctx.moveTo(x, y);
        } else if (verb === PATH_LINE_TO) {
          const x = commands.get(j, 'p[x]');
          const y = commands.get(j, 'p[y]');
          ctx.lineTo(x, y);
        } else if (verb === PATH_CURVE_TO) {
          const x = commands.get(j, 'p[x]');
          const y = commands.get(j, 'p[y]');
          const cx1 = commands.get(j + 1, 'p[x]');
          const cy1 = commands.get(j + 1, 'p[y]');
          const cx2 = commands.get(j + 2, 'p[x]');
          const cy2 = commands.get(j + 2, 'p[y]');
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
        }
      }
      if (!!closed) {
        ctx.closePath();
      }
      const drawStyle = styles[style];
      if (!drawStyle) {
        throw new Error(`Style ${style} not found in styles.`);
      }
      drawStyle.draw(ctx);
    }
  }

  _drawPoints(ctx, commands) {
    ctx.fillStyle = `#ddd`;
    ctx.beginPath();
    const pointCount = commands.size;
    const xs = commands.table['p[x]'].data;
    const ys = commands.table['p[y]'].data;
    let deads;
    if (commands.hasAttribute('dead')) {
      deads = commands.table['dead'].data;
    }
    for (let i = 0; i < pointCount; i++) {
      if (deads && deads[i]) continue;
      ctx.moveTo(xs[i], ys[i]);
      ctx.arc(xs[i], ys[i], 2, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

export class Geo {
  constructor(initialCapacity = 32) {
    this.points = new AttributeTable(initialCapacity);
    this.points.addAttributeType('p[x]', ATTRIBUTE_TYPE_F32);
    this.points.addAttributeType('p[y]', ATTRIBUTE_TYPE_F32);
    this.points.addAttributeType('p[z]', ATTRIBUTE_TYPE_F32);

    this.faces = new AttributeTable(initialCapacity);
    this.faces.addAttributeType('f[0]', ATTRIBUTE_TYPE_I16);
    this.faces.addAttributeType('f[1]', ATTRIBUTE_TYPE_I16);
    this.faces.addAttributeType('f[2]', ATTRIBUTE_TYPE_I16);
  }

  clone() {
    const newGeo = new Geo();
    newGeo.points = this.points.clone();
    newGeo.faces = this.faces.clone();
    return newGeo;
  }

  extend(geo) {
    const offset = this.points.size;

    // Extend points
    const pointsSize = geo.points.size;
    for (let i = 0, l = geo.points.size; i < l; i++) {
      const newPoint = geo.points.getObject(i);
      this.points.append(newPoint);
    }

    // Extend faces
    for (let i = 0, l = geo.faces.size; i < l; i++) {
      const newFace = geo.faces.getObject(i);
      newFace['f[0]'] += offset;
      newFace['f[1]'] += offset;
      newFace['f[2]'] += offset;
      this.faces.append(newFace);
    }
  }

  mapPoints(fn) {
    const size = this.points.size;
    const xs = this.points.getArray('p[x]');
    const ys = this.points.getArray('p[y]');
    const zs = this.points.getArray('p[y]');
    for (let i = 0; i < size; i++) {
      const [x, y, z] = fn(xs[i], ys[i], zs[i], i, size);
      xs[i] = x;
      ys[i] = y;
      zs[i] = z;
    }
  }
}

export class Image {
  constructor(element) {
    this.element = element;
    this.width = this.element.width;
    this.height = this.element.height;
  }
}
