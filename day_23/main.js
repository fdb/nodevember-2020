// Nodevember day 23 - Sign
// Signs across a road would be cool.
// Needs a circle node, merge node.

import { html, render, useEffect, useState, useRef, useCallback } from '../third_party/preact-htm.min.js';
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
const m4 = twgl.m4;

function remap(v, inMin, inMax, outMin, outMax) {
  v = (v - inMin) / (inMax - inMin);
  return outMin + v * (outMax - outMin);
}

const FACES_VS = `precision mediump float;
uniform mat4 u_model_view_projection;
attribute vec4 position;
void main(void) {
  gl_Position = u_model_view_projection * position;
  gl_PointSize = 4.0;
}`;

const FACES_FS = `precision mediump float;
void main(void) {
  gl_FragColor = vec4(0.8, 0.8, 0.8, 1.0);
}`;

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

const DRAW_MODE_LINES = 'lines';
const DRAW_MODE_POINTS = 'points';

let gPointsShader;
let gPointsBuffer;
let gProgramInfo;
let gBufferInfo;

function Viewer({ network, version, uiVisible, bordered, isAnimating, setIsAnimating }) {
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
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);

    // programRef.current = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);

    // ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // canvasRef.current = canvas;
    glRef.current = gl;
  }, []);

  const drawGeo = (gl, geo, mode) => {
    const { points, faces } = geo;
    if (!gProgramInfo) {
      gProgramInfo = twgl.createProgramInfo(gl, [FACES_VS, FACES_FS]);
    }

    // Convert geo arrays to single merged array
    const position = [];
    const xs = points.getArray('p[x]');
    const ys = points.getArray('p[y]');
    const zs = points.getArray('p[z]');
    for (let i = 0, l = points.size; i < l; i++) {
      position.push(xs[i], ys[i], zs[i]);
    }

    if (mode === DRAW_MODE_LINES) {
      const indices = [];
      const f0 = faces.getArray('f[0]');
      const f1 = faces.getArray('f[1]');
      const f2 = faces.getArray('f[2]');
      for (let i = 0, l = faces.size; i < l; i++) {
        indices.push(f0[i], f1[i], f1[i], f2[i], f2[i], f0[i]);
      }
      const arrays = {
        position,
        indices,
      };
      gBufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    } else if (mode === DRAW_MODE_POINTS) {
      const arrays = {
        position,
      };
      gBufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    } else {
      throw new Error(`Invalid draw mode ${mode}`);
    }

    // Set up matrices
    const fov = (30 * Math.PI) / 180;
    const aspect = 1;
    const near = 0.1;
    const far = 1000;
    const projection = m4.perspective(fov, aspect, near, far);
    const eye = [0, 0, 5];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const camera = m4.lookAt(eye, target, up);
    const view = m4.inverse(camera);
    const viewProjection = m4.multiply(projection, view);
    const world = m4.identity();
    const modelViewProjection = m4.multiply(viewProjection, world);
    const uniforms = {
      u_model_view_projection: modelViewProjection,
    };

    gl.useProgram(gProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, gProgramInfo, gBufferInfo);
    twgl.setUniforms(gProgramInfo, uniforms);

    if (mode === DRAW_MODE_LINES) {
      gl.drawElements(gl.LINES, gBufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.drawArrays(gl.POINTS, 0, gBufferInfo.numElements);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    if (clearCanvas) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

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
          drawGeo(gl, outputGeo, DRAW_MODE_LINES);
          if (drawPoints) {
            drawGeo(gl, outputGeo, DRAW_MODE_POINTS);
          }
          // drawGeoFaces(gl, points, faces);
        } else if (points.size > 0) {
          drawGeo(gl, outputGeo, DRAW_MODE_POINTS);

          // drawGeoPoints(gl, points);
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
        ><input class="align-text-middle" type="checkbox" checked=${isAnimating} onChange=${() => setIsAnimating(!isAnimating)} /> Animate
      </label>
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
const SPREADSHEET_MODE_POINTS = 'points';
const SPREADSHEET_MODE_FACES = 'faces';

function Spreadsheet({ network, version }) {
  const node = network.nodes.find((node) => node.name === network.renderedNode);
  const outType = node.output.type;
  const [mode, setMode] = useState(outType === TYPE_SHAPE ? 'contours' : 'points');
  if (outType !== TYPE_SHAPE && outType !== TYPE_GEO) {
    return html`<div>No spreadsheet for output type ${node.output.type}</div>`;
  }
  const geo = node.outputValue();

  let table;
  if (mode === SPREADSHEET_MODE_CONTOURS) {
    table = geo.contours;
  } else if (mode === SPREADSHEET_MODE_COMMANDS) {
    table = geo.commands;
  } else if (mode === SPREADSHEET_MODE_POINTS) {
    table = geo.points;
  } else if (mode === SPREADSHEET_MODE_FACES) {
    table = geo.faces;
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
        ${outType === TYPE_SHAPE && html`<option value=${SPREADSHEET_MODE_CONTOURS}>Contours</option>`}
        ${outType === TYPE_SHAPE && html`<option value=${SPREADSHEET_MODE_COMMANDS}>Commands</option>`}
        ${outType === TYPE_GEO && html`<option value=${SPREADSHEET_MODE_POINTS}>Points</option>`}
        ${outType === TYPE_GEO && html`<option value=${SPREADSHEET_MODE_FACES}>Faces</option>`}
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

function ViewerPane({ network, version, uiVisible, bordered, isAnimating, setIsAnimating }) {
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
    html`<${Viewer}
      network=${network}
      version=${version}
      uiVisible=${uiVisible}
      bordered=${bordered}
      isAnimating=${isAnimating}
      setIsAnimating=${setIsAnimating}
    />`}
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
      multiplier.current = 0.1;
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

const circle1 = new nodes.GeoCircleNode('circle1');
circle1.setInput('size', new Vec3(0.4, 0.4));
circle1.x = 20;
circle1.y = 20;

const box1 = new nodes.BoxNode('box1');
box1.setInput('size', new Vec3(0.1, 20.0, 3.0));
box1.setInput('center', new Vec3(0.0, 12, 0.0));
box1.x = 150;
box1.y = 20;

// const trans2 = new nodes.GeoTransformNode('trans2');
// // trans2.setInput('rotate', new Vec3(15, 25, 0));
// trans2.x = 20;
// trans2.y = 170;

const merge1 = new nodes.GeoMergeNode('merge1');
merge1.x = 20;
merge1.y = 70;

const grid1 = new nodes.GeoGridNode('grid1');
grid1.setInput('center', new Vec3(0, 0.25, 0));
grid1.setInput('size', new Vec2(4, 100));
grid1.setInput('rows', 20);
grid1.setInput('columns', 5);
grid1.x = 150;
grid1.y = 70;

const copy1 = new nodes.GeoCopyToPointsNode('copy1');
copy1.x = 20;
copy1.y = 120;

const trans1 = new nodes.GeoTransformNode('trans1');
trans1.setInput('rotate', new Vec3(0, 0, 0));
// trans1.setInput('translate', new Vec3(0, 0, -50));
trans1.setExpression(lox, 'translate', 'vec3(0, 0, -50 + $time % 50)');
trans1.x = 20;
trans1.y = 170;

// network.nodes.push(triangle1);
network.nodes.push(circle1);
network.nodes.push(box1);
network.nodes.push(trans1);
network.nodes.push(merge1);
network.nodes.push(grid1);
network.nodes.push(copy1);
// network.nodes.push(grid1);
// network.nodes.push(copy1);
// network.nodes.push(trans2);
network.connections.push({ outNode: 'circle1', inNode: 'merge1', inPort: 'geo1' });
network.connections.push({ outNode: 'box1', inNode: 'merge1', inPort: 'geo2' });
network.connections.push({ outNode: 'merge1', inNode: 'copy1', inPort: 'geo' });
network.connections.push({ outNode: 'grid1', inNode: 'copy1', inPort: 'target' });
network.connections.push({ outNode: 'copy1', inNode: 'trans1', inPort: 'geo' });
// network.connections.push({ outNode: 'trans1', inNode: 'copy1', inPort: 'geo' });
// network.connections.push({ outNode: 'grid1', inNode: 'copy1', inPort: 'target' });
// network.connections.push({ outNode: 'copy1', inNode: 'trans2', inPort: 'geo' });

network.renderedNode = 'trans1';

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

let simplex = new SimplexNoise(4);

function App() {
  const [activeNode, setActiveNode] = useState(network.nodes[0]);
  const [version, setVersion] = useState(0);
  const [uiVisible, setUiVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const shouldAnimateRef = useRef(true);
  const animationHandleRef = useRef();

  useEffect(() => {
    setActiveNode(network.nodes.find((node) => node.name === network.renderedNode));
    if (isAnimating) {
      animationHandleRef.current = window.requestAnimationFrame(animate);
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
    const seg = simplex.noise2D(3571, time * 0.1);
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

    network.setInput('circle1', 'segments', remap(seg, -1, 1, 2, 40));
    const circle1Size = remap(seg, -1, 1, 0.2, 1);
    network.setInput('circle1', 'size', new Vec2(circle1Size, circle1Size));
    // const gridWidth = remap(gridSize, -1, 1, 100, 500);
    // const gridSize = new Vec3(remap(sx, -1, 1, 0.5, 2.0), remap(sy, -1, 1, 0.5, 2.0), remap(sz, -1, 1, 0.5, 2.0));
    // network.setInput('grid1', 'size', gridSize);

    // const transRot = new Vec3(remap(rx, -1, 1, -10, 10), remap(ry, -1, 1, -10, 10), remap(rz, -1, 1, -10, 10));
    // network.setInput('trans1', 'rotate', transRot);
    // network.setInput('trans2', 'rotate', new Vec3(0, 0, time * 10));
    // network.setInput('trans2', 'translate', new Vec3(0, 0, time));
    // network.setInput('super1', 'n1', remap(n1, -1, 1, -0.2, 2));
    // network.setInput('grid1', 'size', new Vec3(1, 1, 20 + time * 2));

    // network.setInput('mountain1', 'amplitude', new Vec2(remap(ax, -1, 1, -20, 20), remap(ay, -1, 1, -20, 20)));
    // network.setInput('grid1', 'height', gridWidth);
    // network.setInput('trans1', 'rotate', remap(r, -1, 1, -90, 90));
    runNetwork();
    if (shouldAnimateRef.current) {
      animationHandleRef.current = window.requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isAnimating) {
      animationHandleRef.current = window.requestAnimationFrame(animate);
      shouldAnimateRef.current = true;
    } else {
      window.cancelAnimationFrame(animationHandleRef.current);
      shouldAnimateRef.current = false;
    }
  }, [isAnimating]);

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
    <${ViewerPane}
      network=${network}
      version=${version}
      uiVisible=${uiVisible}
      bordered=${true}
      isAnimating=${isAnimating}
      setIsAnimating=${setIsAnimating}
    />
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
