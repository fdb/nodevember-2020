// Nodevember day 5 — Pastry
// Working with spirals
import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import * as nodes from './nodes.js';
import { TYPE_FLOAT, TYPE_INT, TYPE_SHAPE } from './nodes.js';
import { Color } from './graphics.js';

function Viewer({ network, version }) {
  const canvasRef = useRef();
  const contextRef = useRef();
  useEffect(() => {
    const canvas = document.getElementById('c');
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    canvas.width = canvas.width * window.devicePixelRatio;
    canvas.height = canvas.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    canvasRef.current = canvas;
    contextRef.current = ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

    network.run();
    const node = network.nodes.find((node) => node.name === network.renderedNode);
    // node.run();

    const outputShape = node.outputValue('out');
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

const network = new nodes.Network();

const spiral1 = new nodes.SpiralNode('spiral1');
spiral1.setInput('segments', 20);
spiral1.x = 20;
spiral1.y = 50;

const spiral2 = new nodes.SpiralNode('spiral2');
spiral2.setInput('segments', 500);
spiral2.x = 150;
spiral2.y = 50;

const copy1 = new nodes.CopyToPointsNode('copy1');
copy1.x = 20;
copy1.y = 150;

network.nodes.push(spiral1);
network.nodes.push(spiral2);
network.nodes.push(copy1);
network.nodes.push(copy1);
network.connections.push({ outNode: 'spiral1', inNode: 'copy1', inPort: 'shape' });
network.connections.push({ outNode: 'spiral2', inNode: 'copy1', inPort: 'target' });
network.renderedNode = 'copy1';

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
  const [uiVisible, setUiVisible] = useState(false);

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    window.requestAnimationFrame(animate);
  }, []);

  const animate = () => {
    const time = (Date.now() - startTime) / 1000.0;
    const startAngle1 = time * 7.0;
    const endAngle2 = 180 + time * 100;
    const endRadius2 = 150 + Math.sin(time / 10.0) * 50;
    spiral1.setInput('startAngle', startAngle1);
    spiral2.setInput('endAngle', endAngle2);
    spiral2.setInput('endRadius', endRadius2);
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
