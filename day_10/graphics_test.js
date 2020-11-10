import { Geometry } from './graphics.js';

const geo = new Geometry();
console.log(geo);
// geo.add
for (let i = 0; i < 100; i++) {
  geo.moveTo(100, 100);
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

ctx.fillRect(0, 0, 100, 100);
