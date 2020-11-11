import { html, render, useEffect, useState, useRef } from '../third_party/preact-htm.min.js';
import { Geometry, Style, Color } from './graphics.js';

function rand(min, max, grid = 10) {
  const v = min + Math.random() * (max - min);
  return Math.round(v / grid) * grid;
}

const geo = new Geometry();
//console.log(geo);
// geo.add
for (let i = 0; i < 1000; i++) {
  geo.addStyle(new Style(new Color(Math.random(), 0, 0, 1), new Color(0, 0, 0, 0), 1));
  geo.addRect(rand(-100, 500), rand(-100, 500), rand(10, 100), rand(10, 100));
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const animate = () => {
  const xs = geo.commands.table['point[x]'];
  const ys = geo.commands.table['point[x]'];
  for (let i = 0, l = geo.commands.size; i < l; i++) {
    xs.data[i] = xs.data[i] + (Math.random() - 0.5) * 3;
    ys.data[i] = ys.data[i] + (Math.random() - 0.5) * 3;
  }
  geo.draw(ctx);
  window.requestAnimationFrame(animate);
};
window.requestAnimationFrame(animate);

const SPREADSHEET_MODE_CONTOURS = 'contours';
const SPREADSHEET_MODE_COMMANDS = 'commands';

function Spreadsheet() {
  const [mode, setMode] = useState('contours');

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

  return html`<div class="flex flex-col" style=${{ borderLeft: '4px solid #111111' }}>
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

render(html`<${Spreadsheet} />`, document.getElementById('spreadsheet'));
