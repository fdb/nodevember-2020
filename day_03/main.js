// Nodevember day 3 — Fruit
// This is based on the Superformula by Johan Gielis.
// https://en.wikipedia.org/wiki/Superformula
// There's an error in the implementation, connecting all points to the "center" 
// (which also seems to be in the wrong position).
// I kind of like the result, so I'm not interested in fixing it for today.

import Parser from './parser.js';
import Scanner, { TokenType } from './scanner.js';
import Interpreter from './interpreter.js';

const TYPE_VEC2 = 'vec2';
const TYPE_FLOAT = 'float';
const TYPE_INT = 'int';
const TYPE_COLOR = 'color';
const TYPE_SHAPE = 'shape';
const TYPE_STRING = 'string';

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

// const lox = new Lox();
// const scanner = new Scanner(lox, `epsilon = rand($PT) and 12.3`);
// // const scanner = new Scanner(lox, `12 + 23.123`);
// scanner.scanTokens();
// console.log(scanner.tokens);

class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  clone() {
    return new Vec2(this.x, this.y);
  }
}

class Color {
  constructor(r = 0, g = 0, b = 0, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  toRgba() {
    return `rgba(${this.r * 255}, ${this.g * 255}, ${this.b * 255}, ${this.a})`;
  }

  clone() {
    return new Color(this.r, this.g, this.b, this.a);
  }
}

const PATH_MOVE_TO = 'M';
const PATH_LINE_TO = 'L';
const PATH_CURVE_TO = 'C';
const PATH_CLOSE = 'Z';
// const PATH_NOP = '_';

const CIRCLE_EPSILON = (4 / 3) * Math.tan(Math.PI / 8);

class Path {
  constructor() {
    this.fill = new Color();
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
          ctx.closePath();
          break;
      }
    }
    ctx.strokeStyle = this.fill.toRgba();
    ctx.stroke();
  }
}

class Port {
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

class Node {
  constructor() {
    this.inputNames = [];
    this.outputNames = [];
    this.inputMap = {};
    this.outputMap = {};
  }

  addInput(name, type, value) {
    const port = new Port(name, type, value);
    this.inputNames.push(name);
    this.inputMap[name] = port;
  }

  addOutput(name, type) {
    const port = new Port(name, type);
    this.outputNames.push(name);
    this.outputMap[name] = port;
  }

  inputValue(name) {
    return this.inputMap[name].value;
  }

  setInput(name, value) {
    this.inputMap[name].value = value;
  }

  outputValue(name) {
    return this.outputMap[name].value;
  }

  setOutput(name, value) {
    this.outputMap[name].value = value;
  }

  run() {
    console.error('Please override the run method in your custom node.');
  }
}

class CircleNode extends Node {
  constructor() {
    super();
    this.addInput('position', TYPE_VEC2);
    this.addInput('radius', TYPE_FLOAT, 100);
    this.addInput('fill', TYPE_COLOR);
    this.addInput('epsilon', TYPE_FLOAT, 1.0);
    this.addOutput('out', TYPE_SHAPE);
  }

  run(ctx) {
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
    path.fill = fill.clone();
    this.setOutput('out', path);
  }
}

class CopyToPointsNode extends Node {
  constructor() {
    super();
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('target', TYPE_SHAPE);
    this.addOutput('out', TYPE_SHAPE);
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
    outShape.fill = shape.fill.clone();
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
    this.setOutput('out', outShape);
  }
}

// Scatter normally takes in an arbitrary shape and calculates if the points are in bounds.
// But I won't do the path calculation code today, so the scatter will just happen within a bounding box.
class ScatterPointsNode extends Node {
  constructor() {
    super();
    this.addInput('position', TYPE_VEC2);
    this.addInput('width', TYPE_FLOAT, 550);
    this.addInput('height', TYPE_FLOAT, 550);
    this.addInput('amount', TYPE_INT, 50);
    this.addInput('seed', TYPE_INT, 42);
    this.addOutput('out', TYPE_SHAPE);
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
    this.setOutput('out', path);
  }
}

class WrangleNode extends Node {
  constructor() {
    super();
    this.addInput('shape', TYPE_SHAPE);
    this.addInput('attr', TYPE_STRING);
    this.addInput('expr', TYPE_STRING);
    this.addOutput('out', TYPE_SHAPE);
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

    this.setOutput('out', newPath);
  }
}

class SuperformulaNode extends Node {
  constructor() {
    super();
    this.addInput('radius', TYPE_FLOAT, 300);
    this.addInput('m', TYPE_FLOAT, 8);
    this.addInput('n1', TYPE_FLOAT, 1);
    this.addInput('n2', TYPE_FLOAT, 2);
    this.addInput('n3', TYPE_FLOAT, 0.5);
    this.addInput('a', TYPE_FLOAT, 1);
    this.addInput('b', TYPE_FLOAT, 1);
    this.addOutput('out', TYPE_SHAPE);
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

    let n = 100;
    let i = -1;
    const dt = (2 * Math.PI) / n;
    let r = 0;

    const points = [];

    for (let i = 0; i < n; i++) {
      let t = (m * (i * dt - Math.PI)) / 4;
      t = Math.pow(
        Math.abs(Math.pow(Math.abs(Math.cos(t) / a), n2) + Math.pow(Math.abs(Math.sin(t) / b), n3)),
        -1 / n1
      );
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

    this.setOutput('out', path);

    //   const b = this.inputValue('b');

    // //function _superformulaPath(params, n, diameter) {

    //   var i = -1,
    //       dt = 2 * Math.PI / n,
    //       t,
    //       r = 0,
    //       x,
    //       y,
    //       points = [];

    //   while (++i < n) {
    //     t = params.m * (i * dt - Math.PI) / 4;
    //     t = Math.pow(Math.abs(Math.pow(Math.abs(Math.cos(t) / params.a), params.n2)
    //       + Math.pow(Math.abs(Math.sin(t) / params.b), params.n3)), -1 / params.n1);
    //     if (t > r) r = t;
    //     points.push(t);
    //   }

    //   r = diameter * Math.SQRT1_2 / r;
    //   i = -1; while (++i < n) {
    //     x = (t = points[i] * r) * Math.cos(i * dt);
    //     y = t * Math.sin(i * dt);
    //     points[i] = [Math.abs(x) < 1e-6 ? 0 : x, Math.abs(y) < 1e-6 ? 0 : y];
    //   }

    //   return _line(points) + "Z";
    // }
  }
}

const canvas = document.getElementById('c');
canvas.style.width = `${canvas.width}px`;
canvas.style.height = `${canvas.height}px`;
canvas.width = canvas.width * window.devicePixelRatio;
canvas.height = canvas.height * window.devicePixelRatio;
const ctx = canvas.getContext('2d');
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

const superformula1 = new SuperformulaNode();

function animate() {
  const time = (Date.now() - startTime) / 1000.0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

  superformula1.setInput('m', 0.2 + time * 0.1);
  superformula1.setInput('n1', Math.sin(time * 0.2));
  superformula1.setInput('b', Math.cos(time * 0.12));
  superformula1.run();
  const out_superformula1 = superformula1.outputValue('out');
  out_superformula1.fill = new Color(0.3, 0.9, 0.2);
  out_superformula1.draw(ctx);

  ctx.restore();
  window.requestAnimationFrame(animate);
}

const startTime = Date.now();
animate();

// const lox = new Lox();
// // const scanner = new Scanner(lox, '12 == 12 + 5 * 1');
// const scanner = new Scanner(lox, '$PT * 0.1');
// //const scanner = new Scanner(lox, '5 + 3');
// scanner.scanTokens();
// console.log(scanner.tokens);
// //if (lox.hadError) return;
// const parser = new Parser(lox, scanner.tokens);
// const expr = parser.parse();
// console.log(expr);
// const interp = new Interpreter(lox);
// interp.scope['$PT'] = 100;
// const result = interp.evaluate(expr);
// console.log(result);

// render(html`<a href="/">Hello!</a>`, document.body);
