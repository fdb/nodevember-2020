// Nodevember day 1 - cookie
// We don't have a full graphical node editor yet, just the runtime parts.
// The nodes are all pure, that is, they don't have any side effects. They take input from their input ports and return outputs on their output ports.

import { html, render } from '../third_party/preact-htm.min.js';

const TYPE_VEC2 = 'vec2';
const TYPE_FLOAT = 'float';
const TYPE_INT = 'int';
const TYPE_COLOR = 'color';
const TYPE_SHAPE = 'shape';

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

const CIRCLE_EPSILON = (4 / 3) * Math.tan(Math.PI / 8);

class Path {
  constructor() {
    this.fill = new Color();
    this.verbs = [];
    this.points = [];
  }

  moveTo(pt) {
    this.verbs.push(PATH_MOVE_TO);
    this.points.push(pt);
  }

  lineTo(pt) {
    this.verbs.push(PATH_LINE_TO);
    this.points.push(pt);
  }

  curveTo(ctrl1, ctrl2, pt) {
    this.verbs.push(PATH_CURVE_TO);
    this.points.push(ctrl1);
    this.points.push(ctrl2);
    this.points.push(pt);
  }

  close() {
    this.verbs.push(PATH_CLOSE);
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

  run() {
    const shape = this.inputValue('shape');
    const target = this.inputValue('target');
    const outShape = new Path();
    outShape.fill = shape.fill.clone();
    for (const transform of target.points) {
      outShape.verbs.push(...shape.verbs);
      for (const pt of shape.points) {
        outShape.points.push(new Vec2(pt.x + transform.x, pt.y + transform.y));
      }
    }
    this.setOutput('out', outShape);
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

  const circle1 = new CircleNode();
  circle1.setInput('radius', 30);
  circle1.setInput('fill', new Color(1, 0, 0));
  circle1.run();

  const circle2 = new CircleNode();
  circle2.setInput('radius', 200);
  circle2.setInput('fill', new Color(0.8, 0.8, 0.8, 0.8));
  circle2.setInput('epsilon', Math.cos(Date.now() / 1999) + 1);
  circle2.run();

  const circle3 = new CircleNode();
  circle3.setInput('radius', 200);
  circle3.setInput('fill', new Color(0.8, 0.8, 0.8, 0.8));
  circle3.setInput('epsilon', Math.cos(Date.now() / 1997) + 1);
  circle3.run();

  const circle4 = new CircleNode();
  circle4.setInput('radius', 200);
  circle4.setInput('fill', new Color(0.8, 0.8, 0.8, 0.8));
  circle4.setInput('epsilon', Math.cos(Date.now() / 1993) + 1);
  circle4.run();

  const circle5 = new CircleNode();
  circle5.setInput('radius', 200);
  circle5.setInput('fill', new Color(0.8, 0.8, 0.8, 0.8));
  circle5.setInput('epsilon', Math.cos(Date.now() / 1987) + 1);
  circle5.run();

  const copy1 = new CopyToPointsNode();
  copy1.setInput('shape', circle1.outputValue('out'));
  copy1.setInput('target', circle2.outputValue('out'));
  copy1.run();

  const copy2 = new CopyToPointsNode();
  copy2.setInput('shape', circle1.outputValue('out'));
  copy2.setInput('target', copy1.outputValue('out'));
  copy2.run();

  const out_circle1 = circle1.outputValue('out');
  // out_circle1.draw(ctx);

  const out_circle2 = circle2.outputValue('out');
  out_circle2.draw(ctx);

  const out_circle3 = circle3.outputValue('out');
  out_circle3.draw(ctx);

  const out_circle4 = circle4.outputValue('out');
  out_circle4.draw(ctx);

  const out_circle5 = circle5.outputValue('out');
  out_circle5.draw(ctx);

  const out_copy1 = copy1.outputValue('out');
  // out_copy1.draw(ctx);

  const out_copy2 = copy2.outputValue('out');
  // out_copy2.draw(ctx);

  ctx.restore();

  window.requestAnimationFrame(animate);
}

animate();

// render(html`<a href="/">Hello!</a>`, document.body);
