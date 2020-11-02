// Nodevember day 1 - cookie
// We don't have a full graphical node editor yet, just the runtime parts.
// The nodes are all pure, that is, they don't have any side effects. They take input from their input ports and return outputs on their output ports.

import { html, render } from '../third_party/preact-htm.min.js';

const TYPE_VEC2 = 'vec2';
const TYPE_FLOAT = 'float';
const TYPE_INT = 'int';
const TYPE_COLOR = 'color';

class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
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
}

const PATH_MOVE_TO = 'moveTo';
const PATH_LINE_TO = 'lineTo';
const PATH_CURVE_TO = 'curveTo';

class Path {
  constructor() {
    this.verbs = [];
    this.points = [];
  }
  draw(ctx) {
    for (const verb of this.verbs) {
      ctx.moveTo;
    }
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
    }
  }
}

class Node {
  constructor() {
    this.inputs = [];
    this.outputs = [];
  }

  addInput(name, type) {
    this.inputs.push();
  }

  run() {
    console.error('Please override the run method in your custom node.');
  }
}

class CircleNode {
  constructor() {
    addInput('position', TYPE_VEC2);
    addInput('radius', TYPE_FLOAT);
    addInput('fill', TYPE_COLOR);
  }
  run(ctx) {}
}

render(html`<a href="/">Hello!</a>`, document.body);
