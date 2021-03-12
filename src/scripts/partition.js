const fs = require('fs');

const DriveManager = require('../classes/DriveManager');

const { delimiter } = require('../config');

let previous = {};
try {
  previous = require('../../input/previous.json');
} catch {
  console.log('No previous.json file found in /input');
  console.log('Copy over and rename a previous snapshot file');
  console.log();
  return;
}

let index = '';
try {
  index = fs.readFileSync('temp/index.txt', { encoding: 'utf8' });
} catch {
  console.log('No index.txt file found');
  console.log('Make sure you first execute npm run index');
  console.log();
  return;
}

const lines = index.split('\n');
lines.pop();

const manager = new DriveManager();

const startTime = new Date().getTime();

const current = {};
for (const line of lines) {
  const attributes = line.split(delimiter);

  if (attributes.length !== 3) {
    console.log('Invalid index entry');
    console.log('Ensure index script completed successfully');
    console.log();
    return;
  }

  const [path, updated, size] = attributes;
  current[path] = { updated: Number(updated), size: Number(size) };
}

for (const path of Object.keys(previous)) {
  // This file no longer exists
  if (!current[path]) {
    const { drive } = previous[path];
    manager.remove(drive, path);
    delete previous[path];
  }
}

for (const path of Object.keys(current)) {
  if (previous[path]) {
    // This file is older
    if (previous[path].updated < current[path].updated) {
      const { drive } = previous[path];
      manager.remove(drive, path);
      delete previous[path];
    }

    // This is the same file
    else {
      delete current[path];
    }
  }
}

manager.load(previous);

const free = manager.test(current);

if (free < 0) {
  const extra = -free / 1000000000;
  console.log(`${extra.toFixed(1)} GB over capacity`);
  console.log('Add another drive or tweak parameters');
  console.log();
  return;
}

manager.add(current, previous);

const endTime = new Date().getTime();

const difference = (endTime - startTime) / 1000;

const count = Object.keys(current).length.toLocaleString();
const duration = `${difference.toFixed(1)}s`;

console.log(`Successfully placed ${count} files in ${duration}`);
console.log();
