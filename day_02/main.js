// Nodevember day 2 — Candy
// We actually made the script for day 1 on day 2, so I'm one day behind and quite tired.
// I would love to scatter a lot of weird circles all over the canvas.
// I've created an expression parser that could add dynamic expressions when working with attributes.
// Based on Lox by https://craftinginterpreters.com/
// I've also added path attributes, although not in the perfect format yet.
// This is based on Houdini's instance attributes: https://www.sidefx.com/docs/houdini/copy/instanceattrs.html

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

const canvas = document.getElementById('c');
canvas.style.width = `${canvas.width}px`;
canvas.style.height = `${canvas.height}px`;
canvas.width = canvas.width * window.devicePixelRatio;
canvas.height = canvas.height * window.devicePixelRatio;
const ctx = canvas.getContext('2d');
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

function animate() {
  // ctx.setTransform(1, 0, 0, 1, 0, 0);
  // ctx.fillStyle = 'rgb(26, 32, 44)';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

  const clr = (Math.round(Date.now() / 100) % 100.0) / 100;
  const circle1 = new CircleNode();
  circle1.setInput('radius', 3);
  circle1.setInput('fill', new Color(0.9, clr, 0.2));
  // circle1.setInput('epsilon', )
  // circle1.setInput('epsilon', Math.cos(Date.now() / 199) * 5);
  circle1.run();

  const scatter1 = new ScatterPointsNode();
  scatter1.setInput('width', 30);
  scatter1.setInput('height', 30);
  scatter1.setInput('amount', 3);
  scatter1.setInput('seed', Math.round(Date.now() / 3000));
  scatter1.run();

  const copy1 = new CopyToPointsNode();
  copy1.setInput('shape', circle1.outputValue('out'));
  copy1.setInput('target', scatter1.outputValue('out'));
  copy1.run();

  const scatter2 = new ScatterPointsNode();
  scatter2.setInput('amount', 100);
  scatter2.run();

  //const scale = (Math.cos(Date.now() / 1999) + 1) * 0.1;
  const time = Date.now() / 1000;
  const wrangle1 = new WrangleNode();
  wrangle1.setInput('shape', scatter2.outputValue('out'));
  wrangle1.setInput('attr', `pscale`);
  wrangle1.setInput('expr', `($PT * ${time} * 0.03) % 5`);
  wrangle1.run();

  const copy2 = new CopyToPointsNode();
  copy2.setInput('shape', copy1.outputValue('out'));
  copy2.setInput('target', wrangle1.outputValue('out'));
  copy2.run();

  // const out_scatter1 = scatter1.outputValue('out');
  // ctx.beginPath();
  // for (const pt of out_scatter1.points) {
  //   ctx.moveTo(pt.x, pt.y);
  //   ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
  // }
  // ctx.fillStyle = 'white';
  // ctx.fill();

  const out_copy2 = copy2.outputValue('out');
  // console.log(out_copy2);
  out_copy2.draw(ctx);

  // const out_wrangle1 = wrangle1.outputValue('out');
  // console.log(out_wrangle1);

  ctx.restore();

  window.requestAnimationFrame(animate);
}

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
