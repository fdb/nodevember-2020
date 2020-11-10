// Nodevember day 9 - Fluffy
// Wiggle shapes, and place lines on them.

import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import { Color, LinearGradient, Vec2 } from './graphics.js';
import * as nodes from './nodes.js';
import { TYPE_FLOAT, TYPE_INT, TYPE_SHAPE, TYPE_IMAGE, TYPE_STRING, TYPE_VEC2 } from './nodes.js';

function Viewer({ network, version, uiVisible }) {
  const canvasRef = useRef();
  const contextRef = useRef();
  const [drawPoints, setDrawPoints] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current; //document.getElementById('c');
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    canvas.width = canvas.width * window.devicePixelRatio;
    canvas.height = canvas.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // canvasRef.current = canvas;
    contextRef.current = ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

    const node = network.nodes.find((node) => node.name === network.renderedNode);
    if (node.output.type === TYPE_SHAPE) {
      const outputShape = node.outputValue();
      outputShape.draw(ctx);

      if (drawPoints) {
        ctx.fillStyle = '#4299e1';
        ctx.beginPath();
        for (const pt of outputShape.points) {
          ctx.moveTo(pt.x, pt.y);
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    } else if (node.output.type === TYPE_IMAGE) {
      const outputImage = node.outputValue();
      // console.log(outputImage);
      ctx.drawImage(outputImage.element, -outputImage.width / 2, -outputImage.height / 2);
    }
    ctx.restore();
  }, [network, version, drawPoints]);

  return html`<div class="viewer bg-gray-900 flex justify-center items-center">
    ${uiVisible &&
    html`<div class="fixed top-0 left-0 w-screen p-2 text-sm flex align-center bg-gray-800 z">
      <label class="ml-2"
        ><input class="align-text-middle" type="checkbox" value=${drawPoints} onChange=${() => setDrawPoints((pt) => !pt)} /> Draw
        Points</label
      >
    </div>`}
    <canvas width="500" height="500" ref=${canvasRef} style=${{ mixBlendMode: 'lighten' }}></canvas>
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

  const conns = network.connections.map(({ outNode, inNode, inPort }) => {
    outNode = network.nodes.find((node) => node.name === outNode);
    inNode = network.nodes.find((node) => node.name === inNode);
    const outDelta = 10;
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
  return html`<div class="bg-gray-800 p-1 mr-1 w-20 text-gray-200 text-sm cursor-move" onMouseDown=${onMouseDown}>
    ${value.toFixed(2)}
  </div>`;
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

function Vec2Dragger({ value, onChange }) {
  return html`<div class="flex">
    <${FloatDragger} value=${value.x} onChange=${(x) => onChange(new Vec2(x, value.y))} /><${FloatDragger}
      value=${value.y}
      onChange=${(y) => onChange(new Vec2(value.x, y))}
    />
  </div>`;
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
        <div class="w-24 text-gray-500 text-sm p-1">${port.name}</div>
        ${port.type === TYPE_VEC2 &&
        html`<${Vec2Dragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`}
        ${port.type === TYPE_FLOAT &&
        html`<${FloatDragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`}
        ${port.type === TYPE_INT &&
        html`<${IntDragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`}
        ${port.type === TYPE_SHAPE && html`<p class="p-1 text-sm italic text-gray-600">[Shape]</p>`}
        ${port.type === TYPE_STRING && html`<p class="p-1 text-sm italic text-gray-600">${port.value}</p>`}
      </div>`);
    }
  }
  return html`<div class="props bg-gray-900 select-none">${rows}</div>`;
}

const network = new nodes.Network();

const super1 = new nodes.SuperformulaNode('super1');
// super1.setInput('fill', undefined);
// super1.setInput('stroke', new Color(1, 1, 1, 1));

// line1.setInput('fill', new Color(1, 1, 1));
// line1.setInput('radius', 3);
super1.x = 20;
super1.y = 20;

const line1 = new nodes.LineNode('line1');
line1.setInput('point1', new Vec2(0, 0));
line1.setInput('point2', new Vec2(300, 300));
line1.setInput('stroke', new Color(1, 0.75, 0.8, 1));
line1.setInput('strokeWidth', 0.5);

line1.x = 20;
line1.y = 20;

const grid1 = new nodes.GridNode('grid1');
grid1.setInput('columns', 50);
grid1.setInput('rows', 50);
grid1.setInput('width', 450);
grid1.setInput('height', 450);
grid1.x = 150;
grid1.y = 20;

const super2 = new nodes.SuperformulaNode('super2');
super2.setInput('segments', 250);
super2.setInput('m', 2);
super2.setInput('n1', 0.5);
super2.x = 150;
super2.y = 20;

const wrangle1 = new nodes.WrangleNode('wrangle1');
// wrangle1.setInput('expressions', 'pscale = noise($pt.x, $pt.y , 0)');
wrangle1.setInput('expressions', 'pscale = noise2d($pos_x * 0.01 + $time * 0.4, $pos_y * 0.001 + $time * 0.2) * 0.1');
wrangle1.x = 150;
wrangle1.y = 80;

const copy1 = new nodes.CopyToPointsNode('copy1');
copy1.x = 20;
copy1.y = 140;

const wiggle1 = new nodes.WiggleNode('wiggle1');
wiggle1.setInput('offset', new Vec2(0, 0));
wiggle1.x = 20;
wiggle1.y = 200;

const transform1 = new nodes.TransformNode('transform1');
transform1.setInput('translate', new Vec2(1, 10));
transform1.setInput('scale', new Vec2(1, 1));
transform1.x = 20;
transform1.y = 200;

network.nodes.push(super1);
network.nodes.push(line1);
network.nodes.push(super2);
network.nodes.push(grid1);
network.nodes.push(wrangle1);
network.nodes.push(copy1);
network.nodes.push(wiggle1);
// network.nodes.push(transform1);
network.connections.push({ outNode: 'line1', inNode: 'copy1', inPort: 'shape' });
network.connections.push({ outNode: 'grid1', inNode: 'wrangle1', inPort: 'shape' });
network.connections.push({ outNode: 'wrangle1', inNode: 'copy1', inPort: 'target' });
network.connections.push({ outNode: 'copy1', inNode: 'wiggle1', inPort: 'shape' });
network.renderedNode = 'wiggle1';

// network.nodes.push(circle1);
// network.nodes.push(transform1);
// network.connections.push({ outNode: 'circle1', inNode: 'transform1', inPort: 'shape' });
// network.renderedNode = 'transform1';

// Check connections
for (const conn of network.connections) {
  const connString = JSON.stringify(conn);
  const outNodeResult = network.nodes.find((node) => node.name === conn.outNode);
  const inNodeResult = network.nodes.find((node) => node.name === conn.inNode);
  console.assert(outNodeResult, `Connection ${connString}: could not find output node ${conn.outNode}.`);
  console.assert(inNodeResult, `Connection ${connString}: could not find input node ${conn.inNode}.`);
  const inPortResult = inNodeResult.inputMap[conn.inPort];
  console.assert(inPortResult, `Connection ${connString}: could not find input port ${conn.inPort} for node ${conn.inNode}.`);
}

function App() {
  const [activeNode, setActiveNode] = useState(network.nodes[0]);
  const [version, setVersion] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    network.run({ $time: 0 });
    setVersion((version) => version + 1);
    window.requestAnimationFrame(animate);
  }, []);

  const animate = () => {
    const time = (Date.now() - startTime) / 1000.0;
    wiggle1.setInput('offset', new Vec2(Math.sin(time) * 10, Math.cos(time / 3) * 5));
    // circle1.setInput('position', new Vec2(Math.sin(time / 20) * 100, 0));
    network.run({ $time: time });

    setVersion((version) => version + 1);
    window.requestAnimationFrame(animate);
  };

  const onSetInput = (node, inputName, value) => {
    node.setInput(inputName, value);
    // console.log(value);
    setVersion((version) => version + 1);
    const time = (Date.now() - startTime) / 1000.0;
    network.run({ $time: time });
  };

  const toggleUI = () => {
    setUiVisible((ui) => !ui);
  };

  return html`<div class=${`app ${uiVisible ? 'ui-visible' : 'ui-hidden'}`}>
    <button onClick=${toggleUI} style=${{ zIndex: 10, position: 'fixed', right: '10px', top: '10px', outline: 'none' }}>
      <svg width="20" height="20" viewBox="0 0 10 10"><path d="M0 2h8M0 5h8M0 8h8" fill="none" stroke="#a0aec0" /></svg>
    </button>
    <${Viewer} network=${network} version=${version} uiVisible=${uiVisible} />
    ${uiVisible &&
    html`<div class="sidebar">
      <${PropsView} activeNode=${activeNode} onSetInput=${onSetInput} version=${version} />
      <${NetworkView} network=${network} activeNode=${activeNode} onSelectNode=${setActiveNode} version=${version} />
    </div>`}
  </div>`;
}

const startTime = Date.now();
render(html`<${App} />`, document.body);
