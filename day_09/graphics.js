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

const PATH_MOVE_TO = 'M';
const PATH_LINE_TO = 'L';
const PATH_CURVE_TO = 'C';
const PATH_CLOSE = 'Z';

export const CIRCLE_EPSILON = (4 / 3) * Math.tan(Math.PI / 8);

export class Path {
  constructor() {
    this.fill = new Color();
    this.stroke = null;
    this.strokeWidth = 1;
    this.verbs = [];
    this.points = [];
    this.attrs = [];
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
export class Image {
  constructor(element) {
    this.element = element;
    this.width = this.element.width;
    this.height = this.element.height;
  }
}
