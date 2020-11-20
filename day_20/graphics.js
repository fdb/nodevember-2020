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

// Transform kept in row-major order
// 0 1 2
// 3 4 5
// 0 0 1
export class Transform {
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

  transformGeometry(geo) {
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

export class Geometry {
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
    const newGeo = new Geometry();
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
