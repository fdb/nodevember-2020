// Nodevember day 10 - Paint
// Add a simple layer system that renders but doesn't need to clear.
// I also want to introduce better support for attributes using a table-based approach, where all attributes live in a single table.

import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import { Color, LinearGradient, Vec2 } from './graphics.js';
import * as nodes from './nodes.js';
import { TYPE_FLOAT, TYPE_INT, TYPE_SHAPE, TYPE_IMAGE, TYPE_STRING, TYPE_VEC2 } from './nodes.js';

function Viewer({ network, version, uiVisible }) {
  const canvasRef = useRef();
  const contextRef = useRef();
  const [drawPoints, setDrawPoints] = useState(false);
  const [clearCanvas, setClearCanvas] = useState(true);
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
    if (clearCanvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.save();
    ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

    const node = network.nodes.find((node) => node.name === network.renderedNode);
    if (node.output.type === TYPE_SHAPE) {
      const outputShape = node.outputValue();
      outputShape.draw(ctx);

      if (drawPoints) {
        ctx.fillStyle = '#4299e1';
        ctx.beginPath();
        const pointCount = outputShape.commands.size;
        const xs = outputShape.commands.table['point[x]'].data;
        const ys = outputShape.commands.table['point[y]'].data;
        for (let i = 0; i < pointCount; i++) {
          ctx.moveTo(xs[i], ys[i]);
          ctx.arc(xs[i], ys[i], 2, 0, Math.PI * 2);
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

  return html`<div class="viewer bg-gray-900 flex flex-col h-full ">
    ${uiVisible &&
    html`<div class="p-2 text-sm flex align-center bg-gray-800 select-none">
      <label class="ml-2"
        ><input class="align-text-middle" type="checkbox" checked=${drawPoints} onChange=${() => setDrawPoints((pt) => !pt)} /> Draw
        Points</label
      >
      <label class="ml-2"
        ><input class="align-text-middle" type="checkbox" checked=${clearCanvas} onChange=${() => setClearCanvas((v) => !v)} /> Clear
        Canvas</label
      >
    </div>`}
    <div class="flex items-center justify-center w-full h-full">
      <canvas width="500" height="500" ref=${canvasRef} style=${{ mixBlendMode: 'normal' }}></canvas>
    </div>
  </div>`;
}

const SPREADSHEET_MODE_CONTOURS = 'contours';
const SPREADSHEET_MODE_COMMANDS = 'commands';

function Spreadsheet({ network, version }) {
  const [mode, setMode] = useState('contours');
  const node = network.nodes.find((node) => node.name === network.renderedNode);
  if (node.output.type !== TYPE_SHAPE) {
    return html`<div>No spreadsheet for output type ${node.output.type}</div>`;
  }
  const geo = node.outputValue();

  let table;
  if (mode === SPREADSHEET_MODE_CONTOURS) {
    table = geo.contours;
  } else if (mode === SPREADSHEET_MODE_COMMANDS) {
    table = geo.commands;
  } else {
    throw new Error(`Invalid table mode ${mode}.`);
  }

  let headerColumns = [];
  headerColumns.push(html`<th class="bg-gray-700 text-gray-200 sticky top-0 px-2 py-1">Index</th>`);

  for (const key in table.table) {
    const attribute = table.table[key];
    headerColumns.push(html`<th class="bg-gray-700 text-gray-200 sticky top-0 px-2 py-1">${attribute.name}</th>`);
  }

  const rows = [];
  for (let i = 0; i < table.size; i++) {
    let row = [];
    row.push(html`<td class="px-2 bg-gray-900">${i}</td>`);
    for (const key in table.table) {
      row.push(html`<td class="px-2">${table.get(i, key)}</td>`);
    }
    rows.push(
      html`<tr>
        ${row}
      </tr>`
    );
  }

  return html`<div class="flex flex-col">
    <div class="bg-gray-800 p-2">
      <select class="bg-gray-800 text-gray-400 outline-none" onChange=${(e) => setMode(e.target.value)} value=${mode}>
        <option value=${SPREADSHEET_MODE_CONTOURS}>Contours</option>
        <option value=${SPREADSHEET_MODE_COMMANDS}>Commands</option>
      </select>
    </div>
    <div style=${{ height: 'calc(100vh - 40px)' }} class="overflow-hidden overflow-y-scroll">
      <table class="w-full text-left table-collapse ">
        <thead>
          <tr>
            ${headerColumns}
          </tr>
        </thead>
        <tbody class="bg-gray-800 text-sm">
          ${rows}
        </tbody>
      </table>
    </div>
  </div>`;
}

const VIEWER_PANE_VIEWER = 'viewer';
const VIEWER_PANE_SPREADSHEET = 'spreadsheet';

function ViewerPane({ network, version, uiVisible }) {
  const [activeTab, setActiveTab] = useState(VIEWER_PANE_VIEWER);
  const header = html`
    <header class="flex bg-gray-900">
      <div
        class=${`p-2 ${activeTab === VIEWER_PANE_VIEWER ? 'bg-gray-800' : 'bg-gray-900 text-gray-700'}`}
        onClick=${() => setActiveTab(VIEWER_PANE_VIEWER)}
      >
        Viewer
      </div>
      <div
        class=${`p-2 ${activeTab === VIEWER_PANE_SPREADSHEET ? 'bg-gray-800' : 'bg-gray-900 text-gray-700'}`}
        onClick=${() => setActiveTab(VIEWER_PANE_SPREADSHEET)}
      >
        Spreadsheet
      </div>
    </header>
  `;
  return html`<div class="flex flex-col">
    ${uiVisible && header}
    ${activeTab === VIEWER_PANE_VIEWER && html`<${Viewer} network=${network} version=${version} uiVisible=${uiVisible} />`}
    ${activeTab === VIEWER_PANE_SPREADSHEET && html`<${Spreadsheet} network=${network} version=${version} />`}
  </div> `;
}

function NetworkView({ activeNode, network, onSelectNode, onSetRenderedNode }) {
  const nodes = network.nodes.map(
    (node) =>
      html`<g
        transform=${`translate(${node.x}, ${node.y})`}
        class="select-none cursor-pointer"
        onClick=${() => onSelectNode(node)}
        onDblClick=${() => onSetRenderedNode(node)}
      >
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

const circle1 = new nodes.CircleNode('circle1');
circle1.setInput('radius', 5);
circle1.x = 20;
circle1.y = 20;

const grid1 = new nodes.GridNode('grid1');
grid1.setInput('columns', 3);
grid1.setInput('rows', 3);
grid1.setInput('width', 300);
grid1.setInput('height', 300);
grid1.x = 150;
grid1.y = 20;

const wrangle1 = new nodes.WrangleNode('wrangle1');
wrangle1.setInput('expressions', 'pscale = abs(noise2d($pos_x * 0.01, $pos_y * 0.01 + $time) * 1)');
wrangle1.x = 150;
wrangle1.y = 80;

const mountain1 = new nodes.MountainNode('mountain1');

mountain1.x = 150;
mountain1.y = 140;

const copy1 = new nodes.CopyToPointsNode('copy1');
copy1.x = 20;
copy1.y = 200;

const wiggle1 = new nodes.WiggleNode('wiggle1');
wiggle1.setInput('offset', new Vec2(0, 0));
wiggle1.x = 20;
wiggle1.y = 200;

const transform1 = new nodes.TransformNode('transform1');
transform1.setInput('translate', new Vec2(1, 10));
transform1.setInput('scale', new Vec2(1, 1));
transform1.x = 20;
transform1.y = 200;

network.nodes.push(circle1);
network.nodes.push(grid1);
network.nodes.push(wrangle1);
network.nodes.push(mountain1);
network.nodes.push(copy1);
network.connections.push({ outNode: 'circle1', inNode: 'copy1', inPort: 'shape' });
network.connections.push({ outNode: 'grid1', inNode: 'wrangle1', inPort: 'shape' });
network.connections.push({ outNode: 'wrangle1', inNode: 'mountain1', inPort: 'shape' });
network.connections.push({ outNode: 'mountain1', inNode: 'copy1', inPort: 'target' });
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

const simplex = new SimplexNoise(42);

function App() {
  const [activeNode, setActiveNode] = useState(network.nodes[0]);
  const [version, setVersion] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    runNetwork();
    // window.requestAnimationFrame(animate);
  }, []);

  const runNetwork = () => {
    const time = (Date.now() - startTime) / 1000.0;
    network.run({ $time: time });
    setVersion((version) => version + 1);
  };

  const animate = () => {
    const time = (Date.now() - startTime) / 1000.0;
    mountain1.setInput('offset', new Vec2(simplex.noise2D(time / 1000, 0) * 100, simplex.noise2D(0, time / 1000) * 100));
    circle1.setInput('radius', 2 + (Math.sin(time / 5) + 1) * 5);
    // circle1.setInput('position', new Vec2(Math.sin(time / 20) * 100, 0));
    runNetwork();
    window.requestAnimationFrame(animate);
  };

  const setRenderedNode = (node) => {
    network.renderedNode = node.name;
    runNetwork();
  };

  const onSetInput = (node, inputName, value) => {
    network.setInput(node.name, inputName, value);
    runNetwork();
  };

  const toggleUI = () => {
    setUiVisible((ui) => !ui);
  };

  return html`<div class=${`app ${uiVisible ? 'ui-visible' : 'ui-hidden'}`}>
    <button onClick=${toggleUI} style=${{ zIndex: 10, position: 'fixed', right: '10px', top: '10px', outline: 'none' }}>
      <svg width="20" height="20" viewBox="0 0 10 10"><path d="M0 2h8M0 5h8M0 8h8" fill="none" stroke="#a0aec0" /></svg>
    </button>
    <${ViewerPane} network=${network} version=${version} uiVisible=${uiVisible} />
    ${uiVisible &&
    html`<div class="sidebar">
      <${PropsView} activeNode=${activeNode} onSetInput=${onSetInput} version=${version} />
      <${NetworkView}
        network=${network}
        activeNode=${activeNode}
        onSelectNode=${setActiveNode}
        onSetRenderedNode=${setRenderedNode}
        version=${version}
      />
    </div>`}
  </div>`;
}

const startTime = Date.now();
render(html`<${App} />`, document.body);
