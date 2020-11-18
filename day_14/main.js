// Nodevember day 14 - Art Deco

import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import { Color, LinearGradient, Vec2, ATTRIBUTE_TYPE_U8, ATTRIBUTE_TYPE_I16 } from './graphics.js';
import * as nodes from './nodes.js';
import { TYPE_FLOAT, TYPE_INT, TYPE_SHAPE, TYPE_IMAGE, TYPE_STRING, TYPE_VEC2 } from './nodes.js';

function remap(v, inMin, inMax, outMin, outMax) {
  v = (v - inMin) / (inMax - inMin);
  return outMin + v * (outMax - outMin);
}

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
    <div class="flex items-center justify-center w-full h-full p-2">
      <canvas
        width="500"
        height="500"
        class="border border-gray-800 shadow-lg"
        ref=${canvasRef}
        style=${{ mixBlendMode: 'normal' }}
      ></canvas>
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

  // const
  const isInt = {};
  for (const key in table.table) {
    const type = table.table[key].type;
    isInt[key] = type === ATTRIBUTE_TYPE_U8 || type === ATTRIBUTE_TYPE_I16;
  }

  const rows = [];
  for (let i = 0; i < table.size; i++) {
    let row = [];
    row.push(html`<td class="px-2 bg-gray-900">${i}</td>`);
    for (const key in table.table) {
      if (isInt[key]) {
        row.push(html`<td class="px-2">${table.get(i, key)}</td>`);
      } else {
        row.push(html`<td class="px-2">${table.get(i, key).toFixed(2)}</td>`);
      }
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
    <header class="flex bg-gray-900 select-none">
      <div
        class=${`cursor-pointer p-2 ${activeTab === VIEWER_PANE_VIEWER ? 'bg-gray-800' : 'bg-gray-900 text-gray-700'}`}
        onClick=${() => setActiveTab(VIEWER_PANE_VIEWER)}
      >
        Viewer
      </div>
      <div
        class=${`cursor-pointer p-2 ${activeTab === VIEWER_PANE_SPREADSHEET ? 'bg-gray-800' : 'bg-gray-900 text-gray-700'}`}
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
    <svg width="400" height="400">
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
super1.setInput('position', new Vec2(0, 0));
super1.setInput('radius', 35);
super1.setInput('m', 4);
super1.setInput('segments', 80);
super1.setInput('stroke', new Color(0.81, 0.65, 0.41, 0.8));
super1.setInput('strokeWidth', 1.2);
super1.x = 20;
super1.y = 20;

const copy1 = new nodes.CopyAndTransformNode('copy1');
copy1.setInput('copies', 5);
copy1.setInput('translate', new Vec2(0, -2));
copy1.setInput('scale', new Vec2(1.15, 1.2));
copy1.x = 20;
copy1.y = 80;

const grid1 = new nodes.GridNode('grid1');
grid1.setInput('width', 320);
grid1.setInput('height', 320);
grid1.setInput('rows', 3);
grid1.setInput('columns', 3);
grid1.x = 150;
grid1.y = 20;

const grid2 = new nodes.GridNode('grid2');
grid2.setInput('width', 160);
grid2.setInput('height', 160);
grid2.setInput('rows', 2);
grid2.setInput('columns', 2);
grid2.x = 150;
grid2.y = 80;

const copy2 = new nodes.CopyToPointsNode('copy2');
copy2.x = 20;
copy2.y = 130;

const copy3 = new nodes.CopyToPointsNode('copy3');
copy3.x = 50;
copy3.y = 180;

const transform1 = new nodes.TransformNode('transform1');
transform1.x = 150;
transform1.y = 80;

const merge1 = new nodes.MergeNode('merge1');
merge1.x = 20;
merge1.y = 250;

const wrangle1 = new nodes.WrangleNode('wrangle1');
wrangle1.setInput('expressions', 'pscale = 1 + $pt * 0.3');
wrangle1.x = 150;
wrangle1.y = 100;

// const merge1 = new nodes.MergeNode('merge1');
// merge1.x = 20;
// merge1.y = 300;

network.nodes.push(super1);
network.nodes.push(copy1);
network.nodes.push(grid1);
network.nodes.push(copy2);
network.nodes.push(grid2);
network.nodes.push(copy3);
network.nodes.push(merge1);

// network.nodes.push(poly1);
// network.nodes.push(wrangle1);
network.nodes.push(copy1);
// network.nodes.push(transform1);

// network.nodes.push(merge1);

network.connections.push({ outNode: 'super1', inNode: 'copy1', inPort: 'shape' });
network.connections.push({ outNode: 'copy1', inNode: 'copy2', inPort: 'shape' });
network.connections.push({ outNode: 'grid1', inNode: 'copy2', inPort: 'target' });
network.connections.push({ outNode: 'copy1', inNode: 'copy3', inPort: 'shape' });
network.connections.push({ outNode: 'grid2', inNode: 'copy3', inPort: 'target' });
network.connections.push({ outNode: 'copy2', inNode: 'merge1', inPort: 'shape1' });
network.connections.push({ outNode: 'copy3', inNode: 'merge1', inPort: 'shape2' });

// network.connections.push({ outNode: 'poly1', inNode: 'copy1', inPort: 'shape' });
// network.connections.push({ outNode: 'poly1', inNode: 'wrangle1', inPort: 'shape' });
// network.connections.push({ outNode: 'wrangle1', inNode: 'copy1', inPort: 'target' });
// network.connections.push({ outNode: 'copy1', inNode: 'merge1', inPort: 'shape4' });

// network.connections.push({ outNode: 'mountain1', inNode: 'copy1', inPort: 'shape' });
// network.connections.push({ outNode: 'grid1', inNode: 'wrangle1', inPort: 'shape' });
// network.connections.push({ outNode: 'wrangle1', inNode: 'mountain1', inPort: 'shape' });
// network.connections.push({ outNode: 'scatter1', inNode: 'copy1', inPort: 'target' });
// network.connections.push({ outNode: 'copy1', inNode: 'transform1', inPort: 'shape' });

network.renderedNode = 'merge1';

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

// const simplex = new SimplexNoise(101);
let simplex = new SimplexNoise(102);

let isAnimating = true;

function App() {
  const [activeNode, setActiveNode] = useState(network.nodes[0]);
  const [version, setVersion] = useState(0);
  const [uiVisible, setUiVisible] = useState(false);
  // const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    runNetwork();
    window.requestAnimationFrame(animate);
    document.querySelector('canvas').addEventListener('click', () => {
      simplex = new SimplexNoise(Math.random() * 100000);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        isAnimating = !isAnimating;
        if (isAnimating) {
          window.requestAnimationFrame(animate);
        }
      }
    });
  }, []);

  const runNetwork = () => {
    const time = (Date.now() - startTime) / 750.0;
    network.run({ $time: time });
    setVersion((version) => version + 1);
  };

  const animate = () => {
    const time = (Date.now() - startTime) / 750.0;
    const r = simplex.noise2D(2539, time * 0.05);
    const m = simplex.noise2D(2539, time * 0.01);
    const n1 = simplex.noise2D(7917, time * 0.1);
    const n2 = simplex.noise2D(2833, time * 0.04 + 6);
    const n3 = simplex.noise2D(3623, time * 0.05);
    const a = simplex.noise2D(4643, time * 0.03);
    const b = simplex.noise2D(3001, time * 0.01);
    const strokeWidth = simplex.noise2D(3163, time * 0.04);
    const copies = simplex.noise2D(3571, time * 0.04);

    network.setInput('super1', 'radius', remap(r, -1, 1, 10, 40));
    network.setInput('super1', 'm', remap(m, -1, 1, 1, 5));
    network.setInput('super1', 'n1', remap(n1, -1, 1, 0, 5));
    network.setInput('super1', 'n2', remap(n2, -1, 1, 0, 5));
    network.setInput('super1', 'n3', remap(n3, -1, 1, 0, 5));
    network.setInput('super1', 'a', remap(a, -1, 1, 0, 10));
    network.setInput('super1', 'b', remap(b, -1, 1, 0, 10));
    network.setInput('super1', 'strokeWidth', remap(strokeWidth, -1, 1, 0.5, 3));
    network.setInput('copy1', 'copies', remap(copies, -1, 1, 1, 6));

    // network.setInput('mountain1', 'offset', new Vec2(time / 10, 0));
    // network.setInput('mountain2', 'offset', new Vec2(time / 10, 0.1));
    // network.setInput('mountain3', 'offset', new Vec2(time / 10, 0.2));
    // network.setInput('poly1', 'position', new Vec2(0, 20 + Math.sin(time / 5) * 10));
    runNetwork();
    if (isAnimating) {
      window.requestAnimationFrame(animate);
    }
  };

  const setRenderedNode = (node) => {
    network.renderedNode = node.name;
    if (!isAnimating) {
      runNetwork();
    }
  };

  const onSetInput = (node, inputName, value) => {
    network.setInput(node.name, inputName, value);
    if (!isAnimating) {
      runNetwork();
    }
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
