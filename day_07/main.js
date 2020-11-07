// Nodevember day 7 - Print
// Idea is to render out the graphics on a canvas, then do a halftone render of the results.
// Code inspiration: https://github.com/catospeltincx/dithertool/blob/master/js/fabric_dithering.js
// Code inspiration: https://github.com/meemoo/meemooapp/blob/master/src/nodes/image-monochrome-worker.js

import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import { Color, LinearGradient } from './graphics.js';
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

    network.run();
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
        ${port.type === TYPE_VEC2 && html`<p class="p-1 text-sm italic text-gray-600">${port.value.x} ${port.value.y}</p>`}
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
circle1.setInput('fill', new Color(1, 1, 1));
circle1.setInput('radius', 200);
circle1.x = 20;
circle1.y = 20;

const toImage1 = new nodes.ShapeToImageNode('toImage1');
toImage1.x = 20;
toImage1.y = 80;

const halftone1 = new nodes.HalftoneNode('halftone1');
halftone1.x = 20;
halftone1.y = 140;

network.nodes.push(circle1);
network.nodes.push(toImage1);
network.nodes.push(halftone1);
network.connections.push({ outNode: 'circle1', inNode: 'toImage1', inPort: 'shape' });
network.connections.push({ outNode: 'toImage1', inNode: 'halftone1', inPort: 'image' });
network.renderedNode = 'halftone1';

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
    // spiral1.setInput('endAngle', 100 + time * 10)super1.setInput('m', 0.2);
    // super1.setInput('m', time / 10);
    circle1.setInput('epsilon', Math.sin(time / 5) * 3);
    circle1.setInput(
      'fill',
      new LinearGradient((0.1 + Math.sin(time / 3) + 1) * 0.2, 0, 0, 1, 0.1 + (Math.cos(time / 2) + 1) * 0.8, 0, 0, 1)
    );
    // circle1.setInput('', Math.sin(time) * 3);

    // spiral1.setInput('startRadius', time * 2);
    // halftone1.setInput('threshold', 50 + Math.abs(Math.sin(time) * 200));
    // wrangle1.setInput('expr', `($PT * ${Math.sin(time / 200.0)} + ${time} ) % 2`);
    // circle1.setInput('epsilon', Math.sin((time / 80.0) * 5.0));
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
