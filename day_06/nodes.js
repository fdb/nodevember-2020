import Parser from './parser.js';
import Scanner, { TokenType } from './scanner.js';
import Interpreter from './interpreter.js';
import { Color, Vec2, Path, CIRCLE_EPSILON, toRadians, lerp } from './graphics.js';

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
        return new Path();
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
  }

  outputValue() {
    return this.output.value;
  }

  setOutput(value) {
    this.output.value = value;
  }

  run() {
    console.error('Please override the run method in your custom node.');
  }
}

export class Network {
  constructor() {
    this.nodes = [];
    this.connections = [];
    this.renderedNode = null;
  }

  run() {
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
        this.runNode(outNode);
        node.setInput(inputName, outNode.outputValue());
      }
    }
    node.run();
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
    const path = new Path();
    const position = this.inputValue('position');
    const width = this.inputValue('width');
    const height = this.inputValue('height');
    const columns = this.inputValue('columns');
    const rows = this.inputValue('rows');

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        let x = (width * j) / columns;
        let y = (height * i) / rows;
        path.moveTo(new Vec2(position.x + x - width / 2, position.y + y - height / 2));
      }
    }
    this.setOutput(path);
  }
}

export class CircleNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('position', TYPE_VEC2);
    this.addInput('radius', TYPE_FLOAT, 100);
    this.addInput('fill', TYPE_COLOR);
    this.addInput('epsilon', TYPE_FLOAT, 1.0);
  }

  run() {
    const path = new Path();
    const position = this.inputValue('position');
    const radius = this.inputValue('radius');
    const fill = this.inputValue('fill');
    const rEpsilon = radius * CIRCLE_EPSILON * this.inputValue('epsilon');

    const p1 = new Vec2(position.x, position.y - radius);
    const p2 = new Vec2(position.x + radius, position.y);
    const p3 = new Vec2(position.x, position.y + radius);
    const p4 = new Vec2(position.x - radius, position.y);

    path.moveTo(p1);
    path.curveTo(new Vec2(p1.x + rEpsilon, p1.y), new Vec2(p2.x, p2.y - rEpsilon), p2);
    path.curveTo(new Vec2(p2.x, p2.y + rEpsilon), new Vec2(p3.x + rEpsilon, p3.y), p3);
    path.curveTo(new Vec2(p3.x - rEpsilon, p3.y), new Vec2(p4.x, p4.y + rEpsilon), p4);
    path.curveTo(new Vec2(p4.x, p4.y - rEpsilon), new Vec2(p1.x - rEpsilon, p1.y), p1);
    path.close();
    path.fill = null;
    path.stroke = fill.clone();
    this.setOutput(path);
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
  }

  run() {
    const path = new Path();
    const position = this.inputValue('position');
    const startRadius = this.inputValue('startRadius');
    const startAngle = this.inputValue('startAngle');
    const endRadius = this.inputValue('endRadius');
    const endAngle = this.inputValue('endAngle');
    const segments = this.inputValue('segments');

    // let x = Math.cos(toRadians(startAngle)) * startRadius;
    // let y = Math.sin(toRadians(startAngle)) * startRadius;

    // path.moveTo(new Vec2(position.x + x, position.y + y));
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const angle = lerp(startAngle, endAngle, t);
      const radius = lerp(startRadius, endRadius, t);

      const x = Math.cos(toRadians(angle)) * radius;
      const y = Math.sin(toRadians(angle)) * radius;
      if (i === 0) {
        path.moveTo(new Vec2(position.x + x, position.y + y));
      } else {
        path.lineTo(new Vec2(position.x + x, position.y + y));
      }
    }
    path.fill = null;
    path.stroke = new Color(0.92, 0.5, 0.39); // #eabf77 237 187 101 0.92578125 0.5 0.39453125
    path.strokeWidth = 0.25;
    this.setOutput(path);
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
  }

  scalePath(shape, scale) {
    const newShape = new Path();
    newShape.verbs = shape.verbs.slice();
    for (let pt of shape.points) {
      pt = new Vec2(pt.x * scale, pt.y * scale);
      newShape.points.push(pt);
    }
    newShape.attrs = shape.attrs === undefined ? undefined : JSON.parse(JSON.stringify(shape.attrs));
    return newShape;
  }

  run() {
    const shape = this.inputValue('shape');
    const target = this.inputValue('target');
    const outShape = new Path();
    outShape.fill = shape.fill ? shape.fill.clone() : null;
    outShape.stroke = shape.stroke ? shape.stroke.clone() : null;
    outShape.strokeWidth = shape.strokeWidth;
    //console.log(target);
    for (let i = 0, l = target.points.length; i < l; i++) {
      const transform = target.points[i];
      const attrs = target.attrs[i];
      let newShape = shape;
      if (attrs && attrs.pscale !== undefined) {
        // console.log(attrs.pscale);
        newShape = this.scalePath(newShape, attrs.pscale);
        // console.log(newShape);
      }
      outShape.verbs.push(...newShape.verbs);
      for (const pt of newShape.points) {
        outShape.points.push(new Vec2(pt.x + transform.x, pt.y + transform.y));
      }
    }
    this.setOutput(outShape);
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
    const path = new Path();
    for (let i = 0; i < amount; i++) {
      const x = position.x + (Math.random() - 0.5) * width;
      const y = position.y + (Math.random() - 0.5) * height;
      path.moveTo(new Vec2(x, y));
    }
    this.setOutput(path);
  }
}

export class WrangleNode extends Node {
  constructor(name) {
    super(name, TYPE_SHAPE);
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('attr', TYPE_STRING);
    this.addInput('expr', TYPE_STRING);
  }

  run() {
    const shape = this.inputValue('shape');
    const attrName = this.inputValue('attr');
    const expr = this.inputValue('expr');

    const lox = new Lox();
    const scanner = new Scanner(lox, expr);
    scanner.scanTokens();
    // console.log(scanner.tokens);
    if (lox.hadError) return;
    const parser = new Parser(lox, scanner.tokens);
    const expression = parser.parse();
    const interp = new Interpreter(lox);

    const newPath = new Path();
    newPath.verbs = shape.verbs.slice();
    for (let i = 0, l = shape.points.length; i < l; i++) {
      const pt = shape.points[i];
      let attr = shape.attrs[i];
      attr = attr === undefined ? undefined : JSON.parse(JSON.stringify(attr));
      newPath.points.push(pt.clone());

      interp.scope['$PT'] = i;
      const result = interp.evaluate(expression);
      newPath.attrs.push({ [attrName]: result });
    }

    this.setOutput(newPath);
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

    let n = 30;
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
