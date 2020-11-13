import Parser from './parser.js';
import Scanner, { TokenType } from './scanner.js';
import Interpreter from './interpreter.js';
import {
  Color,
  Vec2,
  Path,
  CIRCLE_EPSILON,
  toRadians,
  lerp,
  Image,
  Group,
  LinearGradient,
  Transform,
  Geometry,
  Style,
  ATTRIBUTE_TYPE_F32,
} from './graphics.js';

const TWO_PI = Math.PI * 2;

class Lox {
  constructor() {
    this.hadError = false;
  }

  error(line, message) {
    this.report(line, '', message);
  }

  parseError(token, message) {
    if (token.type === TokenType.EOF) {
      this.report(token.line, ' at end', message);
    } else {
      this.report(token.line, " at '" + token.lexeme + "'", message);
    }
  }

  report(line, where, message) {
    console.error(`[line ${line}] Error ${where}: ${message}`);
    this.hadError = true;
  }
}

export const TYPE_VEC2 = 'vec2';
export const TYPE_FLOAT = 'float';
export const TYPE_INT = 'int';
export const TYPE_COLOR = 'color';
export const TYPE_SHAPE = 'shape';
export const TYPE_IMAGE = 'image';
export const TYPE_STRING = 'string';

export class Port {
  constructor(name, type, value) {
    this.name = name;
    this.type = type;
    if (value === undefined) {
      value = Port.defaultValue(type);
    }
    this.value = value;
  }

  static defaultValue(type) {
    switch (type) {
      case TYPE_INT:
        return 0;
      case TYPE_FLOAT:
        return 0.0;
      case TYPE_VEC2:
        return new Vec2();
      case TYPE_COLOR:
        return new Color();
      case TYPE_SHAPE:
        return new Geometry();
    }
  }
}

export class Node {
  constructor(name, outputType) {
    this.name = name;
    this.x = 0;
    this.y = 0;
    this.inputNames = [];
    this.outputNames = [];
    this.inputMap = {};
    this.output = new Port('out', outputType);
    this.dirty = true;
  }

  addInput(name, type, value) {
    const port = new Port(name, type, value);
    this.inputNames.push(name);
    this.inputMap[name] = port;
  }

  inputValue(name) {
    return this.inputMap[name].value;
  }

  setInput(name, value) {
    this.inputMap[name].value = value;
    this.dirty = true;
  }

  outputValue() {
    return this.output.value;
  }

  setOutput(value) {
    this.output.value = value;
  }

  run(scope) {
    console.error('Please override the run method in your custom node.');
  }

  get isTimeDependent() {
    return false;
  }

  runLazy(scope) {
    if (!this.dirty && !this.isTimeDependent) return;
    this.run(scope);
    this.dirty = false;
  }
}

export class Network {
  constructor() {
    this.nodes = [];
    this.connections = [];
    this.renderedNode = null;
    this.scope = {};
  }

  run(scope) {
    this.scope = scope;
    const node = this.nodes.find((node) => node.name === this.renderedNode);
    console.assert(node, `Network.run(): could not find rendered node ${this.renderedNode}.`);
    this.runNode(node);
  }

  runNode(node) {
    // Check if inputs are connected, and run them first.
    for (const inputName of node.inputNames) {
      const conn = this.connections.find((conn) => conn.inNode === node.name && conn.inPort === inputName);
      if (conn) {
        const outNode = this.nodes.find((node) => node.name === conn.outNode);
        console.assert(node, `Could not find output node ${conn.outNode}.`);
        if (outNode.dirty || this.isNodeTimeDependent(outNode)) {
          this.runNode(outNode);
        }
        node.setInput(inputName, outNode.outputValue());
      }
    }
    node.runLazy(this.scope);
  }

  findNode(nodeName, error = true) {
    const node = this.nodes.find((node) => node.name === nodeName);
    if (error) {
      console.assert(node, `Could not find node ${nodeName}.`);
    }
    return node;
  }

  setInput(nodeName, portName, value) {
    const node = this.nodes.find((node) => node.name === nodeName);
    console.assert(node, `Could not find node ${nodeName}.`);
    node.setInput(portName, value);
    this.markDirty(nodeName);
  }

  // Check if the node or any of its dependencies depends on time.
  isNodeTimeDependent(node) {
    if (node.isTimeDependent) return true;
    for (const conn of this.connections) {
      if (conn.inNode === node.name) {
        const outNode = this.findNode(conn.outNode);
        if (this.isNodeTimeDependent(outNode)) return true;
      }
    }
    return false;
  }

  markDirty(nodeName) {
    for (const conn of this.connections) {
      if (conn.outNode !== nodeName) continue;
      const inNode = this.nodes.find((node) => node.name === conn.inNode);
      console.assert(inNode, `Could not find node ${conn.inNode}.`);
      inNode.dirty = true;
      this.markDirty(inNode.name);
    }
  }
}

export class GridNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('position', TYPE_VEC2);
    this.addInput('width', TYPE_FLOAT, 300);
    this.addInput('height', TYPE_FLOAT, 300);
    this.addInput('columns', TYPE_INT, 10);
    this.addInput('rows', TYPE_INT, 10);
  }

  run() {
    const geo = new Geometry();
    const position = this.inputValue('position');
    const width = this.inputValue('width');
    const height = this.inputValue('height');
    const columns = this.inputValue('columns');
    const rows = this.inputValue('rows');

    let first = true;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        let x = (width * j) / (columns - 1);
        let y = (height * i) / (rows - 1);
        if (first) {
          geo.moveTo(position.x + x - width / 2, position.y + y - height / 2);
          first = false;
        } else {
          geo.lineTo(position.x + x - width / 2, position.y + y - height / 2);
        }
      }
    }
    this.setOutput(geo);
  }
}

export class CircleNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('position', TYPE_VEC2);
    this.addInput('radius', TYPE_VEC2, new Vec2(100, 100));
    this.addInput('epsilon', TYPE_FLOAT, 1.0);
    this.addInput('fill', TYPE_COLOR, new Color(1, 1, 1, 1));
    this.addInput('stroke', TYPE_COLOR, null);
    this.addInput('strokeWidth', TYPE_FLOAT, 1);
  }

  run() {
    const geo = new Geometry();
    const position = this.inputValue('position');
    const radius = this.inputValue('radius');
    const fill = this.inputValue('fill');
    const stroke = this.inputValue('stroke');
    const strokeWidth = this.inputValue('strokeWidth');
    const xEpsilon = radius.x * CIRCLE_EPSILON * this.inputValue('epsilon');
    const yEpsilon = radius.y * CIRCLE_EPSILON * this.inputValue('epsilon');

    const p1 = new Vec2(position.x, position.y - radius.y);
    const p2 = new Vec2(position.x + radius.x, position.y);
    const p3 = new Vec2(position.x, position.y + radius.y);
    const p4 = new Vec2(position.x - radius.x, position.y);

    geo.addStyle(new Style(fill, stroke, strokeWidth));
    geo.moveTo(p1.x, p1.y);
    geo.curveTo(p1.x + xEpsilon, p1.y, p2.x, p2.y - yEpsilon, p2.x, p2.y);
    geo.curveTo(p2.x, p2.y + yEpsilon, p3.x + xEpsilon, p3.y, p3.x, p3.y);
    geo.curveTo(p3.x - xEpsilon, p3.y, p4.x, p4.y + yEpsilon, p4.x, p4.y);
    geo.curveTo(p4.x, p4.y - yEpsilon, p1.x - xEpsilon, p1.y, p1.x, p1.y);
    geo.close();
    this.setOutput(geo);
  }
}

export class LineNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('point1', TYPE_VEC2);
    this.addInput('point2', TYPE_VEC2, new Vec2(100, 100));
    this.addInput('segments', TYPE_INT, 2);
    this.addInput('stroke', TYPE_COLOR, new Color(1, 1, 1, 1));
    this.addInput('strokeWidth', TYPE_FLOAT, 1);
  }

  run() {
    const point1 = this.inputValue('point1');
    const point2 = this.inputValue('point2');
    const segments = this.inputValue('segments');
    const stroke = this.inputValue('stroke');
    const strokeWidth = this.inputValue('strokeWidth');

    const geo = new Geometry();
    geo.addStyle(new Style(null, stroke, strokeWidth));

    geo.moveTo(point1.x, point1.y);
    for (let i = 1; i < segments - 1; i++) {
      const t = (1 / segments) * i;
      let x = lerp(point1.x, point2.x, t);
      let y = lerp(point1.y, point2.y, t);
      geo.lineTo(x, y);
    }
    geo.lineTo(point2.x, point2.y);
    this.setOutput(geo);
  }
}

export class PolygonNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('position', TYPE_VEC2);
    this.addInput('radius', TYPE_FLOAT, 100);
    this.addInput('sides', TYPE_INT, 3);
    this.addInput('fill', TYPE_COLOR);
    this.addInput('stroke', TYPE_COLOR, new Color(1, 1, 1, 0));
    this.addInput('strokeWidth', TYPE_FLOAT, 1);
  }

  run() {
    const position = this.inputValue('position');
    const radius = this.inputValue('radius');
    let sides = this.inputValue('sides');
    const fill = this.inputValue('fill');
    const stroke = this.inputValue('stroke');
    const strokeWidth = this.inputValue('strokeWidth');
    const geo = new Geometry();
    geo.addStyle(new Style(fill, stroke, strokeWidth));
    sides = Math.max(sides, 3);
    const theta = TWO_PI / sides;
    let first = true;
    for (let i = 0; i < sides; i++) {
      const x = position.x + Math.sin(Math.PI + i * theta) * radius;
      const y = position.y + Math.cos(Math.PI + i * theta) * radius;
      if (first) {
        geo.moveTo(x, y);
        first = false;
      } else {
        geo.lineTo(x, y);
      }
      // c = geo.coordinates(x, y, (a * i) + da, r);
    }
    geo.close();
    this.setOutput(geo);
  }
}

export class SpiralNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('position', TYPE_VEC2);
    this.addInput('startRadius', TYPE_FLOAT, 10);
    this.addInput('startAngle', TYPE_FLOAT, 0);
    this.addInput('endRadius', TYPE_FLOAT, 100);
    this.addInput('endAngle', TYPE_FLOAT, 360);
    this.addInput('segments', TYPE_INT, 100);
    this.addInput('stroke', TYPE_COLOR, new Color(1, 1, 1));
    this.addInput('strokeWidth', TYPE_FLOAT, 1);
  }

  run() {
    const position = this.inputValue('position');
    const startRadius = this.inputValue('startRadius');
    const startAngle = this.inputValue('startAngle');
    const endRadius = this.inputValue('endRadius');
    const endAngle = this.inputValue('endAngle');
    const segments = this.inputValue('segments');
    const stroke = this.inputValue('stroke');
    const strokeWidth = this.inputValue('strokeWidth');

    const geo = new Geometry();
    geo.addStyle(new Style(null, stroke, strokeWidth));
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const angle = lerp(startAngle, endAngle, t);
      const radius = lerp(startRadius, endRadius, t);

      const x = Math.cos(toRadians(angle)) * radius;
      const y = Math.sin(toRadians(angle)) * radius;
      if (i === 0) {
        geo.moveTo(position.x + x, position.y + y);
      } else {
        geo.lineTo(position.x + x, position.y + y);
      }
    }
    this.setOutput(geo);
  }
}

export class ConnectNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    // this.addInput('', TYPE_STRING);
    // this.addInput('point2', TYPE_VEC2);
  }

  run() {
    // const point1 = this.inputValue('point1');
    // const point2 = this.inputValue('point2');
    // const path = new Path();

    this.setOutput(path);
  }
}

export class CopyToPointsNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('target', TYPE_SHAPE);
    // this.addInput('expressions', TYPE_STRING);
  }

  scalePath(path, scale) {
    for (let pt of path.points) {
      pt.x *= scale;
      pt.y *= scale;
    }
  }

  run() {
    const shape = this.inputValue('shape');
    const target = this.inputValue('target');
    const newPointCount = shape.commands.size * target.commands.size;
    const newShape = new Geometry(newPointCount);
    newShape.styles = shape.styles.map((style) => style.clone());
    newShape.currentStyleIndex = shape.currentStyleIndex;

    const targetPointCount = target.commands.size;
    const txs = target.commands.getArray('point[x]');
    const tys = target.commands.getArray('point[y]');
    const pscales = target.commands.hasAttribute('pscale') ? target.commands.getArray('pscale') : undefined;
    for (let i = 0; i < targetPointCount; i++) {
      const offset = newShape.commands.size;
      for (let j = 0, l = shape.contours.size; j < l; j++) {
        const newOffset = shape.contours.get(j, 'offset') + offset;
        const closed = shape.contours.get(j, 'closed');
        const style = shape.contours.get(j, 'style');
        newShape.contours.append({ offset: newOffset, closed, style });
      }
      for (let j = 0, l = shape.commands.size; j < l; j++) {
        const verb = shape.commands.get(j, 'verb');
        let x = shape.commands.get(j, 'point[x]');
        let y = shape.commands.get(j, 'point[y]');
        if (pscales) {
          x *= pscales[i];
          y *= pscales[i];
        }
        x += txs[i];
        y += tys[i];
        newShape.commands.append({ verb, 'point[x]': x, 'point[y]': y });
      }

      // const transform = target.points[i];
      // const attrs = target.attrs[i];

      // let newPath = shape.clone();
      // if (attrs && attrs.pscale !== undefined) {
      //   this.scalePath(newPath, attrs.pscale);
      // }
      // if (attrs && attrs['F.r'] !== undefined) {
      //   newPath.fill = new Color(attrs['F.r'], attrs['F.r'], attrs['F.r'], 1);
      // }
      // for (const pt of newPath.points) {
      //   pt.x += transform.x;
      //   pt.y += transform.y;
      // }
      // outGroup.add(newPath);
    }
    this.setOutput(newShape);
  }
}

export class CopyAndTransformNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('copies', TYPE_INT, 1);
    this.addInput('order', TYPE_STRING, 'srt');
    this.addInput('translate', TYPE_VEC2);
    this.addInput('rotate', TYPE_FLOAT);
    this.addInput('scale', TYPE_VEC2, new Vec2(1, 1));
  }

  run() {
    const shape = this.inputValue('shape');
    const copies = this.inputValue('copies');
    const order = this.inputValue('order');
    const translate = this.inputValue('translate');
    const rotate = this.inputValue('rotate');
    const scale = this.inputValue('scale');
    const geo = new Geometry();
    const transform = new Transform();
    for (let i = 0; i < copies; i++) {
      transform.scale(scale.x, scale.y);
      transform.rotate(rotate);
      transform.translate(translate.x, translate.y);
      const newShape = shape.clone();
      transform.transformGeometry(newShape);
      geo.extend(newShape);
    }
    this.setOutput(geo);
  }
}

// Scatter normally takes in an arbitrary shape and calculates if the points are in bounds.
// But I won't do the path calculation code today, so the scatter will just happen within a bounding box.
export class ScatterPointsNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('position', TYPE_VEC2);
    this.addInput('width', TYPE_FLOAT, 550);
    this.addInput('height', TYPE_FLOAT, 550);
    this.addInput('amount', TYPE_INT, 50);
    this.addInput('seed', TYPE_INT, 42);
  }

  run() {
    const position = this.inputValue('position');
    const width = this.inputValue('width');
    const height = this.inputValue('height');
    const amount = this.inputValue('amount');
    const seed = this.inputValue('seed');

    Math.seedrandom(seed);
    const geo = new Geometry();
    let first = true;
    for (let i = 0; i < amount; i++) {
      const x = position.x + (Math.random() - 0.5) * width;
      const y = position.y + (Math.random() - 0.5) * height;
      if (first) {
        geo.moveTo(x, y);
      } else {
        geo.lineTo(x, y);
      }
    }
    this.setOutput(geo);
  }
}

export class WrangleNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('expressions', TYPE_STRING);
    this.lox = new Lox();
    this.compiledExpressions = [];
  }

  get isTimeDependent() {
    return this.inputValue('expressions').includes('$time');
  }

  setInput(name, value) {
    super.setInput(name, value);
    if (name === 'expressions') {
      this.compileExpressions();
    }
  }

  compileExpressions() {
    let expressions = this.inputValue('expressions').split('\n');
    expressions = expressions.map((expr) => expr.split('='));
    const compiledExpressions = [];
    for (const [attr, expr] of expressions) {
      const compiledExpression = this.compileExpression(this.lox, expr.trim());
      if (!compiledExpression) return;
      compiledExpressions.push([attr.trim(), compiledExpression]);
    }
    this.compiledExpressions = compiledExpressions;
  }

  compileExpression(lox, expr) {
    const scanner = new Scanner(lox, expr);
    scanner.scanTokens();
    if (this.lox.hadError) return;
    const parser = new Parser(lox, scanner.tokens);
    const expression = parser.parse();
    return expression;
  }

  run(scope) {
    const shape = this.inputValue('shape');
    const interp = new Interpreter(this.lox);
    const simplex = new SimplexNoise(42);
    interp.scope['abs'] = Math.abs;
    interp.scope['sin'] = Math.sin;
    interp.scope['cos'] = Math.cos;
    interp.scope['min'] = Math.min;
    interp.scope['max'] = Math.max;
    interp.scope['noise2d'] = (x, y) => simplex.noise2D(x, y);
    for (const key of Object.keys(scope)) {
      interp.scope[key] = scope[key];
    }

    const newShape = shape.clone();
    for (const [attr, _] of this.compiledExpressions) {
      newShape.commands.addAttributeType(attr, ATTRIBUTE_TYPE_F32);
    }
    const pointCount = newShape.commands.size;
    const xs = newShape.commands.getArray('point[x]');
    const ys = newShape.commands.getArray('point[y]');
    for (let i = 0; i < pointCount; i++) {
      interp.scope['$pt'] = i;
      interp.scope['$pos_x'] = xs[i];
      interp.scope['$pos_y'] = ys[i];
      const attrs = {};
      for (const [attr, expr] of this.compiledExpressions) {
        const result = interp.evaluate(expr);
        attrs[attr] = result;
      }
      newShape.commands.set(i, attrs);
    }
    this.setOutput(newShape);
  }
}

export class SuperformulaNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('radius', TYPE_FLOAT, 300);
    this.addInput('m', TYPE_FLOAT, 8);
    this.addInput('n1', TYPE_FLOAT, 1);
    this.addInput('n2', TYPE_FLOAT, 2);
    this.addInput('n3', TYPE_FLOAT, 0.5);
    this.addInput('a', TYPE_FLOAT, 1);
    this.addInput('b', TYPE_FLOAT, 1);
    this.addInput('segments', TYPE_INT, 50);
  }

  run() {
    const radius = this.inputValue('radius');
    const m = this.inputValue('m');
    const n1 = this.inputValue('n1');
    const n2 = this.inputValue('n2');
    const n3 = this.inputValue('n3');
    const a = this.inputValue('a');
    const b = this.inputValue('b');

    const path = new Path();
    // path.fill = new Color(1, 1, 1);
    path.stroke = new Color(1, 1, 1);
    path.strokeWidth = 2;

    let n = this.inputValue('segments');
    let i = -1;
    const dt = (2 * Math.PI) / n;
    let r = 0;

    const points = [];

    for (let i = 0; i < n; i++) {
      let t = (m * (i * dt - Math.PI)) / 4;
      t = Math.pow(Math.abs(Math.pow(Math.abs(Math.cos(t) / a), n2) + Math.pow(Math.abs(Math.sin(t) / b), n3)), -1 / n1);
      if (t > r) r = t;
      points.push(t);
    }
    // console.log(points);

    r = (radius * Math.SQRT1_2) / r;
    for (let i = 0; i < n; i++) {
      const t = points[i] * r;
      const x = t * Math.sin(i * dt);
      const y = t * Math.cos(i * dt);
      points[i] = [Math.abs(x) < 1e-6 ? 0 : x, Math.abs(y) < 1e-6 ? 0 : y];
    }

    // console.log(points);
    for (let i = 0, l = points.length; i < l; i++) {
      const [x, y] = points[i];
      if (i === 0) {
        path.moveTo(new Vec2(x, y));
      } else {
        path.lineTo(new Vec2(x, y));
      }
      path.close();
    }

    this.setOutput(path);
  }
}

export class WiggleNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('offset', TYPE_VEC2);
    this.addInput('seed', TYPE_INT);
  }

  run() {
    const shape = this.inputValue('shape');
    const offset = this.inputValue('offset');
    const seed = this.inputValue('seed');
    Math.seedrandom(seed);
    const newShape = shape.clone();
    newShape.mapPoints((x, y) => [x + (Math.random() - 0.5) * offset.x, y + (Math.random() - 0.5) * offset.y]);
    this.setOutput(newShape);
  }
}

export class TransformNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('order', TYPE_STRING, 'srt');
    this.addInput('translate', TYPE_VEC2);
    this.addInput('rotate', TYPE_FLOAT);
    this.addInput('scale', TYPE_VEC2, new Vec2(1, 1));
  }

  run() {
    const shape = this.inputValue('shape');
    const order = this.inputValue('order');
    const translate = this.inputValue('translate');
    const rotate = this.inputValue('rotate');
    const scale = this.inputValue('scale');
    const transform = new Transform();
    transform.scale(scale.x, scale.y);
    transform.rotate(rotate);
    transform.translate(translate.x, translate.y);
    const newShape = shape.clone();
    transform.transformGeometry(newShape);
    this.setOutput(newShape);
  }
}

export class MountainNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('offset', TYPE_VEC2);
    this.addInput('scale', TYPE_FLOAT, 1);
    this.addInput('amplitude', TYPE_VEC2, new Vec2(5, 5));
    this.addInput('seed', TYPE_INT, 42);
  }

  run() {
    const shape = this.inputValue('shape');
    const offset = this.inputValue('offset');
    const scale = this.inputValue('scale') / 100;
    const amplitude = this.inputValue('amplitude');
    const seed = this.inputValue('seed');
    const newShape = shape.clone();
    const simplex = new SimplexNoise(seed);
    newShape.mapPoints((x, y, i) => {
      const dx = simplex.noise2D(7919 + offset.x + i * scale, offset.y + i * scale);
      const dy = simplex.noise2D(7873 + offset.x + i * scale, offset.y + i * scale);
      return [x + dx * amplitude.x, y + dy * amplitude.y];
    });
    this.setOutput(newShape);
  }
}

export class MergeNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape1', TYPE_SHAPE);
    this.addInput('shape2', TYPE_SHAPE);
    this.addInput('shape3', TYPE_SHAPE);
    this.addInput('shape4', TYPE_SHAPE);
    this.addInput('shape5', TYPE_SHAPE);
  }

  run() {
    const shape1 = this.inputValue('shape1');
    const shape2 = this.inputValue('shape2');
    const shape3 = this.inputValue('shape3');
    const shape4 = this.inputValue('shape4');
    const shape5 = this.inputValue('shape5');
    const geo = new Geometry();
    if (shape1) geo.extend(shape1);
    if (shape2) geo.extend(shape2);
    if (shape3) geo.extend(shape3);
    if (shape4) geo.extend(shape4);
    if (shape5) geo.extend(shape5);
    this.setOutput(geo);
  }
}

export class ShapeToImageNode extends Node {
  constructor(name) {
    super(name, TYPE_IMAGE);
    this.addInput('shape', TYPE_SHAPE);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 500;
    this.canvas.height = 500;
    this.ctx = this.canvas.getContext('2d');
  }

  run() {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const shape = this.inputValue('shape');
    shape.draw(this.ctx);
    ctx.restore();
    this.setOutput(new Image(canvas));
  }
}

export class HalftoneNode extends Node {
  constructor(name) {
    super(name, TYPE_IMAGE);
    this.addInput('image', TYPE_IMAGE);
    this.addInput('threshold', TYPE_FLOAT, 128);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 500;
    this.canvas.height = 500;
    this.ctx = this.canvas.getContext('2d');
  }

  run() {
    const image = this.inputValue('image');
    const threshold = this.inputValue('threshold');
    const { canvas, ctx } = this;
    const { width, height } = image;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image.element, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const stride = width * 4;
    const method = 'atkinson';
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const pos = y * stride + x * 4;
        if (method === 'none') {
          data[pos] = data[pos] < threshold ? 0 : 255;
        } else if (method === 'atkinson') {
          const px = data[pos];
          const newPx = px < threshold ? 0 : 255;
          const err = Math.floor((px - newPx) / 8);
          data[pos] = newPx;
          data[pos + 4] += err;
          data[pos + 8] += err;
          data[pos + 4 * width - 4] += err;
          data[pos + 4 * width] += err;
          data[pos + 4 * width + 4] += err;
          data[pos + 8 * width] += err;
        }
        data[pos + 1] = data[pos + 2] = data[pos];
        data[pos + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    this.setOutput(new Image(canvas));
  }
}
