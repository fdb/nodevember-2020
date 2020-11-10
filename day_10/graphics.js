import { TYPE_FLOAT, TYPE_INT } from './nodes.js';

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

// 0 1 2
// 3 4 5
// 0 0 1
export class Transform {
  constructor() {
    this.m = [1, 0, 0, 0, 1, 0];
  }

  transformPoint(pt) {
    const m = this.m;
    const x = pt.x;
    const y = pt.y;
    return new Vec2(x * m[0] + y * m[1] + m[2], x * m[3] + y * m[4] + m[5]);
  }

  translate(tx, ty) {
    if (tx instanceof Vec2) {
      ty = tx.y;
      tx = tx.x;
    }
    const m = this.m;
    // this.m[2] = tx;
    // this.m[5] = ty;
    m[0] += tx * m[4];
    m[2] += ty * m[4];
    m[1] += tx * m[5];
    m[3] += ty * m[5];
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
    m[3] *= sy;
    m[4] *= sy;
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

const PATH_MOVE_TO = 1;
const PATH_LINE_TO = 2;
const PATH_CURVE_TO = 3;
const PATH_CLOSE = 4;
const PATH_NONE = 5;

export const CIRCLE_EPSILON = (4 / 3) * Math.tan(Math.PI / 8);

class GeoAttribute {
  constructor(name, type, size) {
    this.name = name;
    this.type = type;
    if (type === TYPE_INT) {
      this.data = new Int16Array(size);
    } else if (type === TYPE_FLOAT) {
      this.data = new Float32Array(size);
    } else {
      throw new Error(`Unknown type ${type}`);
    }
  }
}

export class Geometry {
  constructor(initialCapacity = 32) {
    this.fill = new Color();
    this.stroke = null;
    this.strokeWidth = 1;
    this.attributeMap = {};
    this.capacity = initialCapacity;
    this.size = 0;
    this.attributeMap['V'] = new GeoAttribute('V', TYPE_INT, this.capacity);
    this.attributeMap['P[x]'] = new GeoAttribute('P[x]', TYPE_FLOAT, this.capacity);
    this.attributeMap['P[y]'] = new GeoAttribute('P[y]', TYPE_FLOAT, this.capacity);
  }

  _ensureCapacity(extra) {
    if (this.size + extra > this.capacity) {
      this.capacity *= 2;
      for (const key in this.attributeMap) {
        const attr = this.attributeMap[key];
        const oldData = attr.data;
        let newData;
        if (this.type === TYPE_INT) {
          newData = new Int16Array(this.capacity);
          newData.set(oldData);
        } else if (this.type === TYPE_FLOAT) {
          newData = new Float32Array(this.capacity);
          newData.set(oldData);
        } else {
          throw new Error(`Unknown type ${type}`);
        }
        attr.data = newData;
      }
    }
  }

  moveTo(x, y) {
    this._ensureCapacity(1);
    this.attributeMap['V'].data[this.size] = PATH_MOVE_TO;
    this.attributeMap['P[x]'].data[this.size] = x;
    this.attributeMap['P[y]'].data[this.size] = y;
    this.size++;
  }

  lineTo(x, y) {
    this.attributeMap['V'].data[this.size] = PATH_LINE_TO;
    this.attributeMap['P[x]'].data[this.size] = x;
    this.attributeMap['P[y]'].data[this.size] = y;
    this.size++;
  }

  curveTo(x1, y1, x2, y2, x3, y3) {
    this.attributeMap['V'].data[this.size] = PATH_LINE_TO;
    this.attributeMap['P[x]'].data[this.size] = x1;
    this.attributeMap['P[y]'].data[this.size] = y1;
    this.attributeMap['P[x]'].data[this.size + 1] = x2;
    this.attributeMap['P[y]'].data[this.size + 1] = y2;
    this.attributeMap['P[x]'].data[this.size + 2] = x3;
    this.attributeMap['P[y]'].data[this.size + 2] = y3;
    this.size += 3;
  }
  close() {
    this.attributeMap['V'].data[this.size] = PATH_CLOSE;
  }
}

export class Path {
  constructor() {
    this.fill = new Color();
    this.stroke = null;
    this.strokeWidth = 1;
    this.verbs = [];
    this.points = [];
    this.attrs = [];
  }

  clone() {
    const newPath = new Path();
    newPath.fill = this.fill ? this.fill.clone() : null;
    newPath.stroke = this.stroke ? this.stroke.clone() : null;
    newPath.strokeWidth = this.strokeWidth;
    newPath.verbs = this.verbs.slice();
    newPath.points = this.points.map((pt) => pt.clone());
    newPath.attrs = this.attrs.map((attr) => JSON.parse(JSON.stringify(attr)));
    return newPath;
  }

  moveTo(pt, attrs) {
    this.verbs.push(PATH_MOVE_TO);
    this.points.push(pt);
    attrs && this.attrs.push(attrs);
  }

  lineTo(pt, attrs) {
    this.verbs.push(PATH_LINE_TO);
    this.points.push(pt);
    attrs && this.attrs.push(attrs);
  }

  curveTo(ctrl1, ctrl2, pt, attrs) {
    this.verbs.push(PATH_CURVE_TO);
    this.points.push(ctrl1);
    this.points.push(ctrl2);
    this.points.push(pt);
    attrs && this.attrs.push(attrs);
    attrs && this.attrs.push(attrs);
    attrs && this.attrs.push(attrs);
  }

  close(attrs) {
    this.verbs.push(PATH_CLOSE);
    attrs && this.attrs.push(attrs);
  }

  draw(ctx) {
    let i = 0;
    const pts = this.points;
    ctx.beginPath();
    for (const verb of this.verbs) {
      switch (verb) {
        case PATH_MOVE_TO:
          ctx.moveTo(pts[i].x, pts[i].y);
          i++;
          break;
        case PATH_LINE_TO:
          ctx.lineTo(pts[i].x, pts[i].y);
          i++;
          break;
        case PATH_CURVE_TO:
          ctx.bezierCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y);
          i += 3;
          break;
        case PATH_CLOSE:
          // FIXME: closePath is super slow in Chrome
          // ctx.closePath();
          break;
      }
    }
    if (this.fill) {
      this.fill.setFillStyle(ctx);
      //ctx.fillStyle = this.fill.toRgba();
      ctx.fill();
    }
    if (this.stroke) {
      this.stroke.setStrokeStyle(ctx);
      // ctx.strokeStyle = this.stroke.toRgba();
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }
  }
}

export class Group {
  constructor() {
    this.shapes = [];
  }
  add(shape) {
    this.shapes.push(shape);
  }
  draw(ctx) {
    for (const shape of this.shapes) {
      shape.draw(ctx);
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
