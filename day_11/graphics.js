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
    this.fill = fill;
    this.stroke = stroke;
    this.strokeWidth = strokeWidth;
  }
  draw(ctx) {
    if (this.fill && this.fill.visible) {
      this.fill.setFillStyle(ctx);
      ctx.fill();
    }
    if (this.stroke && this.stroke.a > 0) {
      this.stroke.setStrokeStyle(ctx);
      ctx.stroke();
    }
  }
}

const PATH_MOVE_TO = 1;
const PATH_LINE_TO = 2;
const PATH_CURVE_TO = 3;
const PATH_CLOSE = 4;
const PATH_CTRL = 5;

export const CIRCLE_EPSILON = (4 / 3) * Math.tan(Math.PI / 8);

const ATTRIBUTE_TYPE_U8 = 'u8';
const ATTRIBUTE_TYPE_I16 = 'i16';
const ATTRIBUTE_TYPE_F32 = 'f32';

class Attribute {
  constructor(name, type, initialCapacity = 32) {
    this.name = name;
    this.type = type;
    this._expand(initialCapacity);
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

  addAttributeType(name, type) {
    this.table[name] = new Attribute(name, type, this.capacity);
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
      console.assert(attribute, `Attribute ${key} not found.`);
      attribute.data[this.size] = data[key];
    }
    this.size++;
  }

  set(index, data) {
    console.assert(index < this.size, `Set is called with index out of bounds (${index} >= ${this.size})`);
    for (const key in data) {
      const attribute = this.table[key];
      console.assert(attribute, `Attribute ${key} not found.`);
      attribute.data[index] = data[key];
    }
  }

  get(index, key) {
    console.assert(index < this.size, `Get is called with index out of bounds (${index} >= ${this.size})`);
    const attribute = this.table[key];
    console.assert(attribute, `Attribute ${key} not found.`);
    return attribute.data[index];
  }
}

export class Geometry {
  constructor(initialCapacity = 32) {
    this.contours = new AttributeTable(8);
    this.contours.addAttributeType('offset', ATTRIBUTE_TYPE_I16);
    this.contours.addAttributeType('closed', ATTRIBUTE_TYPE_U8);
    this.contours.addAttributeType('style', ATTRIBUTE_TYPE_I16);

    this.styles = [];
    this.currentStyleIndex = -1;

    // this.styles = new AttributeTable(8);
    // this.styles.addAttributeType('fill[r]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('fill[g]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('fill[b]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('fill[a]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('stroke[r]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('stroke[g]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('stroke[b]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('stroke[a]', ATTRIBUTE_TYPE_F32);
    // this.styles.addAttributeType('strokeWidth', ATTRIBUTE_TYPE_F32);

    this.commands = new AttributeTable(initialCapacity);
    this.commands.addAttributeType('verb', ATTRIBUTE_TYPE_U8);
    this.commands.addAttributeType('point[x]', ATTRIBUTE_TYPE_F32);
    this.commands.addAttributeType('point[y]', ATTRIBUTE_TYPE_F32);
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
    this.commands.append({ verb: PATH_MOVE_TO, 'point[x]': x, 'point[y]': y });
  }

  lineTo(x, y) {
    this.commands.append({ verb: PATH_LINE_TO, 'point[x]': x, 'point[y]': y });
  }

  curveTo(cx1, cy1, cx2, cy2, x, y) {
    this.commands.append({ verb: PATH_CURVE_TO, 'point[x]': x, 'point[y]': y });
    this.commands.append({ verb: PATH_CTRL, 'point[x]': cx1, 'point[y]': cy1 });
    this.commands.append({ verb: PATH_CTRL, 'point[x]': cx2, 'point[y]': cy2 });
  }

  close() {
    console.assert(this.contours.size > 0, `Close command called but there is no current path.`);
    this.contours.set(this.contours.size - 1, { closed: 1 });
  }

  addStyle(style) {
    this.styles.push(style);
    this.currentStyleIndex = this.styles.length - 1;
  }

  addRect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.close();
  }

  // addStyle(fill, stroke, strokeWidth=1) {

  // }

  draw(ctx) {
    const { contours, commands, styles } = this;
    for (let i = 0; i < contours.size; i++) {
      const offset = contours.get(i, 'offset');
      const closed = contours.get(i, 'closed');
      const style = contours.get(i, 'style');
      const nextOffset = i < contours.size - 1 ? contours.get(i + 1, 'offset') : this.size;
      for (let j = offset; j < nextOffset; j++) {
        const verb = commands.get(j, 'verb');
        if (verb === PATH_MOVE_TO) {
          const x = commands.get(j, 'point[x]');
          const y = commands.get(j, 'point[y]');
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else if (verb === PATH_LINE_TO) {
          const x = commands.get(j, 'point[x]');
          const y = commands.get(j, 'point[y]');
          ctx.lineTo(x, y);
        } else if (verb === PATH_CURVE_TO) {
          const x = commands.get(j, 'point[x]');
          const y = commands.get(j, 'point[y]');
          const cx1 = commands.get(j + 1, 'point[x]');
          const cy1 = commands.get(j + 1, 'point[y]');
          const cx2 = commands.get(j + 2, 'point[x]');
          const cy2 = commands.get(j + 2, 'point[y]');
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
        }
      }
      if (!!closed) {
        ctx.closePath();
      }
      const drawStyle = styles[style];
      drawStyle.draw(ctx);
    }
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
