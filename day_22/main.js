// Nodevember day 22 - City
// Place boxes on a grid.
// This requires further work on the 3D engine: getting matrix code correct,
// perspective transforms, and rendering not just dots but lines.
// Also I think there's a huge memory leak I have to fix :-)

import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import {
  Color,
  LinearGradient,
  Vec2,
  Vec3,
  Matrix4,
  ATTRIBUTE_TYPE_U8,
  ATTRIBUTE_TYPE_I16,
  AffineTransfom,
  Shape,
  toRadians,
} from './graphics.js';
import Lox from './lox.js';
import * as nodes from './nodes.js';
import { TYPE_FLOAT, TYPE_INT, TYPE_SHAPE, TYPE_GEO, TYPE_IMAGE, TYPE_STRING, TYPE_VEC2, TYPE_VEC3 } from './nodes.js';

function remap(v, inMin, inMax, outMin, outMax) {
  v = (v - inMin) / (inMax - inMin);
  return outMin + v * (outMax - outMin);
}

const POINTS_VS = `precision mediump float;
uniform mat4 u_proj_matrix;
uniform mat4 u_model_view_matrix;
attribute vec3 a_position;
void main(void) {
  gl_Position = u_proj_matrix * u_model_view_matrix * vec4(a_position, 1.0);
  gl_PointSize = 6.0;
}`;

const POINTS_FS = `precision mediump float;
void main(void) {
  gl_FragColor = vec4(0.8, 0.8, 0.8, 1.0);
}`;

function compileShader(gl, source, type, replacements) {
  const shader = gl.createShader(type);

  if (replacements) {
    for (k in replacements) {
      const v = replacements[k];
      const re = new RegExp(k, 'g');
      source = source.replace(re, v);
    }
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!ok) {
    throw `Compile error: ${gl.getShaderInfoLog(shader)}`;
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource, replacements) {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER, replacements);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER, replacements);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!ok) {
    throw `Link error: ${gl.getProgramInfoLog(program)}`;
  }
  return program;
}

let gDefaultShader;
let gPointsShader;
let gPointsBuffer;

function Viewer({ network, version, uiVisible, bordered }) {
  const canvasRef = useRef();
  const glRef = useRef();
  const [drawPoints, setDrawPoints] = useState(false);
  const [clearCanvas, setClearCanvas] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current; //document.getElementById('c');
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    canvas.width = canvas.width * window.devicePixelRatio;
    canvas.height = canvas.height * window.devicePixelRatio;
    const gl = canvas.getContext('webgl');

    // programRef.current = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);

    // ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // canvasRef.current = canvas;
    glRef.current = gl;
  }, []);

  const drawGeoFaces = (gl, points, faces) => {};

  const drawGeoPoints = (gl, points) => {
    if (!gPointsShader) {
      gPointsShader = createProgram(gl, POINTS_VS, POINTS_FS);
    }
    if (!gPointsBuffer) {
      gPointsBuffer = gl.createBuffer();
    }

    const vertices = new Float32Array(points.size * 3);
    const size = points.size;
    let offset = 0;
    const xs = points.getArray('p[x]');
    const ys = points.getArray('p[y]');
    const zs = points.getArray('p[z]');
    for (let i = 0; i < size; i++) {
      vertices[offset++] = xs[i];
      vertices[offset++] = ys[i];
      vertices[offset++] = zs[i];
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gPointsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    // gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.useProgram(gPointsShader);

    // gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    var positionAttrib = gl.getAttribLocation(gPointsShader, 'a_position');
    gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttrib);

    const projMatrix = new Matrix4();
    // projMatrix.makeOrthographicCamera();
    projMatrix.makePerspectiveCamera(75, 1, -1000, 1000);

    const modelViewMatrix = new Matrix4();
    modelViewMatrix.makeTranslation(0, 0, -0.8);

    // matrix.makeOrthographic(-3, 3, -3, 3, -1, 1);
    // matrix.scale(new Vec3(0.5, 1.0, 1.0));
    // const rot = new Matrix4().makeRotationX(0.1);
    // matrix.multiplyInto(matrix, rot);
    const projMatrixLoc = gl.getUniformLocation(gPointsShader, 'u_proj_matrix');
    const modelViewMatrixLoc = gl.getUniformLocation(gPointsShader, 'u_model_view_matrix');

    gl.uniformMatrix4fv(projMatrixLoc, false, projMatrix.toUniformMatrix());
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, modelViewMatrix.toUniformMatrix());

    gl.drawArrays(gl.POINTS, 0, points.size);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    gl.viewport(0, 0, canvas.width, canvas.height);
    // if (clearCanvas) {
    //   ctx.clearRect(0, 0, canvas.width, canvas.height);
    // } else {
    //   // ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
    //   // ctx.fillRect(0, 0, canvas.width, canvas.height);
    // }
    // ctx.save();
    // ctx.translate(canvas.width / 2 / window.devicePixelRatio, canvas.height / 2 / window.devicePixelRatio);

    const node = network.nodes.find((node) => node.name === network.renderedNode);
    if (node.output.type === TYPE_GEO) {
      const outputGeo = node.outputValue();
      // console.log(node, outputGeo);
      if (outputGeo) {
        const { points, faces } = outputGeo;
        if (faces.size > 0) {
          drawGeoFaces(gl, points, faces);
        } else if (points.size > 0) {
          drawGeoPoints(gl, points);
        }

        // outputGeo.draw(gl);
      }
    }

    // if (node.output.type === TYPE_SHAPE) {
    //   const outputShape = node.outputValue();
    //   outputShape.draw(ctx);

    //   if (drawPoints) {
    //     ctx.fillStyle = '#4299e1';
    //     ctx.beginPath();
    //     const pointCount = outputShape.commands.size;
    //     const xs = outputShape.commands.table['p[x]'].data;
    //     const ys = outputShape.commands.table['p[y]'].data;
    //     for (let i = 0; i < pointCount; i++) {
    //       ctx.moveTo(xs[i], ys[i]);
    //       ctx.arc(xs[i], ys[i], 2, 0, Math.PI * 2);
    //     }
    //     ctx.fill();
    //   }
    // } else if (node.output.type === TYPE_IMAGE) {
    //   const outputImage = node.outputValue();
    //   if (outputImage) {
    //     ctx.save();
    //     ctx.drawImage(outputImage.element, -outputImage.width / 2, -outputImage.height / 2);
    //     ctx.restore();
    //   }
    // }
    // ctx.restore();
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
        class=${bordered ? 'border border-gray-800 shadow-lg' : ''}
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
  const shape = node.outputValue();

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
    <div style=${{ height: 'calc(100vh - 40px)' }} class="overflow-hidden overflow-y-auto">
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

function ViewerPane({ network, version, uiVisible, bordered }) {
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
    ${activeTab === VIEWER_PANE_VIEWER &&
    html`<${Viewer} network=${network} version=${version} uiVisible=${uiVisible} bordered=${bordered} />`}
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

function Vec3Dragger({ value, onChange }) {
  return html`<div class="flex">
    <${FloatDragger} value=${value.x} onChange=${(x) => onChange(new Vec3(x, value.y, value.z))} />
    <${FloatDragger} value=${value.y} onChange=${(y) => onChange(new Vec3(value.x, y, value.z))} />
    <${FloatDragger} value=${value.z} onChange=${(z) => onChange(new Vec3(value.x, value.y, z))} />
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
        <div class="w-24 text-gray-500 text-xs p-1">${port.name}</div>
        ${activeNode.hasExpression(inputName) &&
        html`<div className="bg-green-900 p-1 w-40 font-mono text-sm">${activeNode.getExpression(inputName)}</div>`}
        ${!activeNode.hasExpression(inputName) && [
          port.type === TYPE_VEC2 &&
            html`<${Vec2Dragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`,
          port.type === TYPE_VEC3 &&
            html`<${Vec3Dragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`,
          port.type === TYPE_FLOAT &&
            html`<${FloatDragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`,
          port.type === TYPE_INT &&
            html`<${IntDragger} value=${port.value} onChange=${(value) => onSetInput(activeNode, inputName, value)} />`,
          port.type === TYPE_SHAPE && html`<p class="p-1 text-sm italic text-gray-600">[Shape]</p>`,
          port.type === TYPE_STRING && html`<p class="p-1 text-sm italic text-gray-600">${port.value}</p>`,
        ]}
      </div>`);
    }
  }
  return html`<div class="props bg-gray-900 select-none">${rows}</div>`;
}

const network = new nodes.Network();
const lox = new Lox();

const triangle1 = new nodes.TriangleNode('triangle1');
triangle1.x = 20;
triangle1.y = 20;

const box1 = new nodes.BoxNode('box1');
box1.setInput('size', new Vec3(0.1, 0.1, 0.1));

box1.x = 20;
box1.y = 20;

const grid1 = new nodes.GeoGridNode('grid1');
grid1.setInput('rows', 4);
grid1.setInput('columns', 4);
grid1.x = 150;
grid1.y = 20;

const trans1 = new nodes.GeoTransformNode('trans1');
trans1.setInput('rotate', new Vec3(15, 25, 0));
trans1.x = 20;
trans1.y = 70;

const copy1 = new nodes.GeoCopyToPointsNode('copy1');
copy1.x = 20;
copy1.y = 120;

// network.nodes.push(triangle1);
network.nodes.push(box1);
network.nodes.push(trans1);
network.nodes.push(grid1);
network.nodes.push(copy1);
network.connections.push({ outNode: 'box1', inNode: 'trans1', inPort: 'geo' });
network.connections.push({ outNode: 'trans1', inNode: 'copy1', inPort: 'geo' });
network.connections.push({ outNode: 'grid1', inNode: 'copy1', inPort: 'target' });

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

// const simplex = new SimplexNoise(101);
let simplex = new SimplexNoise(101);

function App() {
  const [activeNode, setActiveNode] = useState(network.nodes[0]);
  const [version, setVersion] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    if (isAnimating) {
      window.requestAnimationFrame(animate);
    } else {
      runNetwork();
    }
    // window.addEventListener('keydown', (e) => {
    //   if (e.code === 'Space') {
    //     isAnimating = !isAnimating;
    //     if (isAnimating) {
    //       window.requestAnimationFrame(animate);
    //     }
    //   }
    // });
  }, []);

  const runNetwork = () => {
    const time = (Date.now() - startTime) / 1000.0;
    lox.interpreter.scope['$time'] = time;
    network.run({ $time: time }, lox);
    setVersion((version) => version + 1);
  };

  const animate = () => {
    const time = (Date.now() - startTime) / 1000.0;
    const sx = simplex.noise2D(7917, time * 0.01);
    const sy = simplex.noise2D(3626, time * 0.01);
    const sz = simplex.noise2D(4643, time * 0.01);
    const rx = simplex.noise2D(3163, time * 0.02);
    const ry = simplex.noise2D(3001, time * 0.02);
    const rz = simplex.noise2D(3571, time * 0.02);
    // const r = simplex.noise2D(3626, time * 0.08);
    // const gridSize = simplex.noise2D(3626, time * 0.05);
    // const cy = simplex.noise2D(4643, time * 0.1);
    // const m = simplex.noise2D(3163, time * 0.03);
    // const n1 = simplex.noise2D(4643, time * 0.03);
    // const n2 = simplex.noise2D(3001, time * 0.01);
    // const n3 = simplex.noise2D(3623, time * 0.05);
    // const strokeWidth = simplex.noise2D(3163, time * 0.04);
    // const copies = simplex.noise2D(3571, time * 0.04);

    // network.setInput('trans1', 'seed', Math.round(time * 3));
    // const gridWidth = remap(gridSize, -1, 1, 100, 500);
    const gridSize = new Vec3(remap(sx, -1, 1, 0.5, 2.0), remap(sy, -1, 1, 0.5, 2.0), remap(sz, -1, 1, 0.5, 2.0));
    network.setInput('grid1', 'size', gridSize);

    const transRot = new Vec3(remap(rx, -1, 1, -90, 90), remap(ry, -1, 1, -90, 90), remap(rz, -1, 1, -90, 90));
    network.setInput('trans1', 'rotate', transRot);

    // network.setInput('super1', 'n1', remap(n1, -1, 1, -0.2, 2));

    // network.setInput('mountain1', 'amplitude', new Vec2(remap(ax, -1, 1, -20, 20), remap(ay, -1, 1, -20, 20)));
    // network.setInput('grid1', 'height', gridWidth);
    // network.setInput('trans1', 'rotate', remap(r, -1, 1, -90, 90));
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
    <button onClick=${toggleUI} style=${{ zIndex: 10, position: 'fixed', right: '15px', top: '15px', outline: 'none' }}>
      <svg width="20" height="20" viewBox="0 0 10 10"><path d="M0 2h8M0 5h8M0 8h8" fill="none" stroke="#a0aec0" /></svg>
    </button>
    <${ViewerPane} network=${network} version=${version} uiVisible=${uiVisible} bordered=${true} />
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
