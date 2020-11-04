// Nodevember day 4 — Grain
// Trying to get a first version of the UI online, that is hidden by default.
import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';

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
  constructor(name) {
    this.name = name;
    this.x = 0;
    this.y = 0;
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

class Network {
  constructor() {
    this.nodes = [];
    this.connections = [];
    this.renderedNode = null;
  }

  run() {
    const node = this.nodes.find((node) => node.name === this.renderedNode);
    console.assert(node, `Network.run(): could not find rendered node ${network.renderedNode}.`);
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
        node.setInput(inputName, outNode.outputValue(conn.outPort));
      }
    }
    node.run();
  }
}

class CircleNode extends Node {
  constructor(name) {
    super(name);
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
  constructor(name) {
    super(name);
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
  constructor(name) {
    super(name);
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
  constructor(name) {
    super(name);
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
  constructor(name) {
    super(name);
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

    this.setOutput('out', path);
  }
}

function Viewer({ network, version }) {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = document.getElementById('c');
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    canvas.width = canvas.width * window.devicePixelRatio;
    canvas.height = canvas.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    canvasRef.current = canvas;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

    network.run();
    const node = network.nodes.find((node) => node.name === network.renderedNode);
    // node.run();

    const outputShape = node.outputValue('out');
    outputShape.fill = new Color(0.9, 0.4, 0.5);
    outputShape.draw(ctx);

    ctx.restore();
  }, [network, version]);

  return html`<div class="viewer bg-gray-900 flex justify-center align-center">
    <canvas width="600" height="600" id="c"></canvas>
  </div>`;
}

function NetworkView({ activeNode, network, onSelectNode }) {
  const nodes = network.nodes.map(
    (node) =>
      html`<g transform=${`translate(${node.x}, ${node.y})`} class="select-none cursor-pointer" onClick=${() => onSelectNode(node)}>
        <rect x="0" y="0" width="100" height="30" fill="#4a5568" />
        ${network.renderedNode === node.name && html`<rect x="0" y="0" width="4" height="30" fill="#f6ad55" />`}
        ${activeNode === node && html`<rect x="0" y="0" width="100" height="30" stroke="#a0aec0" stroke-width="1" fill="none" />`}
        <text x="10" y="20" fill="#a0aec0" font-size="11">${node.name}</text>
      </g>`
  );

  const conns = network.connections.map(({ outNode, outPort, inNode, inPort }) => {
    outNode = network.nodes.find((node) => node.name === outNode);
    inNode = network.nodes.find((node) => node.name === inNode);
    const outDelta = 10 + outNode.outputNames.indexOf(outPort) * 20;
    const inDelta = 10 + inNode.inputNames.indexOf(inPort) * 20;
    return html`<line
      x1=${outNode.x + outDelta}
      y1=${outNode.y + 30}
      x2=${inNode.x + inDelta}
      y2=${inNode.y}
      stroke="#a0aec0"
      stroke-width="1"
    />`;
  });

  return html`<div class="network bg-gray-800">
    <svg width="300" height="400">
      <g transform="translate(0, 0)">${nodes}${conns}</g>
    </svg>
  </div>`;
}

function FloatDragger({ value, onChange }) {
  const startX = useRef();
  const startValue = useRef();
  const multiplier = useRef(1);

  const onMouseDown = (e) => {
    if (e.shiftKey) {
      multiplier.current = 10;
    } else if (e.altKey) {
      multiplier.current = 0.01;
    } else {
      multiplier.current = 1;
    }
    e.preventDefault();
    startX.current = e.clientX;
    startValue.current = value;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    const dx = e.clientX - startX.current;
    const newValue = startValue.current + dx * multiplier.current;
    onChange(newValue);
  };

  const onMouseUp = (e) => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
  return html`<div class="bg-gray-800 p-1 w-20 text-gray-200 text-sm cursor-move" onMouseDown=${onMouseDown}>${value.toFixed(2)}</div>`;
}

function IntDragger({ value, onChange }) {
  const startX = useRef();
  const startValue = useRef();
  const multiplier = useRef(1);

  const onMouseDown = (e) => {
    if (e.shiftKey) {
      multiplier.current = 10;
    } else if (e.altKey) {
      multiplier.current = 0.01;
    } else {
      multiplier.current = 1;
    }
    e.preventDefault();
    startX.current = e.clientX;
    startValue.current = value;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    const dx = e.clientX - startX.current;
    const newValue = startValue.current + dx * multiplier.current;
    onChange(Math.round(newValue));
  };

  const onMouseUp = (e) => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
  return html`<div class="bg-gray-800 p-1 w-20 text-gray-200 text-sm cursor-move" onMouseDown=${onMouseDown}>${value}</div>`;
}

function PropsView({ activeNode, onSetInput }) {
  const rows = [];
  if (!activeNode) {
    rows.push(html`<p class="italic p-5 text-xs">No node selected</p>`);
  } else {
    rows.push(html`<div class="p-2">${activeNode.name}</div>`);
    for (const inputName of activeNode.inputNames) {
      const port = activeNode.inputMap[inputName];
      rows.push(html`<div class="p-2 flex">
        <div class="w-32 text-gray-500 text-sm p-1">${port.name}</div>
        ${port.type === TYPE_FLOAT &&
        html`<${FloatDragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`}
        ${port.type === TYPE_INT &&
        html`<${IntDragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`}
        ${port.type === TYPE_SHAPE && html`<p class="p-1 text-sm italic text-gray-600">[Shape]</p>`}
      </div>`);
    }
  }
  return html`<div class="props bg-gray-900 select-none">${rows}</div>`;
}

const network = new Network();

const circle1 = new CircleNode('circle1');
circle1.x = 20;
circle1.y = 50;
circle1.setInput('radius', 150);
circle1.setInput('epsilon', 2.5);

const superformula1 = new SuperformulaNode('superformula1');
superformula1.x = 150;
superformula1.y = 50;
superformula1.setInput('radius', 105);
superformula1.setInput('m', 0.35);
superformula1.setInput('n1', 0.37);
superformula1.setInput('n2', 1.0);
superformula1.setInput('n3', 0.82);

// const scatter1 = new ScatterPointsNode('scatter1');
// scatter1.x = 150;
// scatter1.y = 50;

const copy1 = new CopyToPointsNode('copy1');
copy1.x = 20;
copy1.y = 150;

network.nodes.push(circle1);
network.nodes.push(superformula1);
// network.nodes.push(scatter1);
network.nodes.push(copy1);
network.connections.push({ outNode: 'circle1', outPort: 'out', inNode: 'copy1', inPort: 'shape' });
network.connections.push({ outNode: 'superformula1', outPort: 'out', inNode: 'copy1', inPort: 'target' });
network.renderedNode = 'copy1';

// Check connections
for (const conn of network.connections) {
  const connString = JSON.stringify(conn);
  const outNodeResult = network.nodes.find((node) => node.name === conn.outNode);
  const inNodeResult = network.nodes.find((node) => node.name === conn.inNode);
  console.assert(outNodeResult, `Connection ${connString}: could not find output node ${conn.outNode}.`);
  console.assert(inNodeResult, `Connection ${connString}: could not find input node ${conn.inNode}.`);
  const outPortResult = outNodeResult.outputMap[conn.outPort];
  const inPortResult = inNodeResult.inputMap[conn.inPort];
  console.assert(outPortResult, `Connection ${connString}: could not find output port ${conn.outPort} for node ${conn.outNode}.`);
  console.assert(inPortResult, `Connection ${connString}: could not find input port ${conn.inPort} for node ${conn.inNode}.`);
}

function App() {
  const [activeNode, setActiveNode] = useState(network.nodes[0]);
  const [version, setVersion] = useState(0);
  const [uiVisible, setUiVisible] = useState(false);

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    window.requestAnimationFrame(animate);
  }, []);

  const animate = () => {
    const time = (Date.now() - startTime) / 1000.0;
    const epsilon = Math.cos(time / 10.0) * 3.0;
    // let epsilon = (time % 100.0) / 100.0;
    // epsilon -= 0.5;
    // epsilon *= 5;
    circle1.setInput('epsilon', epsilon);
    setVersion((version) => version + 1);
    window.requestAnimationFrame(animate);
  };

  const onSetInput = (node, inputName, value) => {
    node.setInput(inputName, value);
    setVersion((version) => version + 1);
  };

  const toggleUI = () => {
    setUiVisible((ui) => !ui);
  };

  // console.log(activeNode);
  return html`<div class=${`app ${uiVisible ? 'ui-visible' : 'ui-hidden'}`}>
    <button onClick=${toggleUI} style=${{ position: 'fixed', right: '10px', top: '10px', outline: 'none' }}>
      <svg width="20" height="20" viewBox="0 0 10 10"><path d="M0 2h8M0 5h8M0 8h8" fill="none" stroke="#a0aec0" /></svg>
    </button>
    <${Viewer} network=${network} version=${version} />
    <div class="sidebar">
      <${PropsView} activeNode=${activeNode} onSetInput=${onSetInput} version=${version} />
      <${NetworkView} network=${network} activeNode=${activeNode} onSelectNode=${setActiveNode} version=${version} />
    </div>
  </div>`;
}

const startTime = Date.now();
render(html`<${App} />`, document.body);
