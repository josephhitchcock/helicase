const fs = require('fs');

const DriveManager = require('../classes/DriveManager');

const previous = require('../../input/previous.json');

const index = fs.readFileSync('temp/index.txt', { encoding: 'utf8' });
const lines = index.split('\n');
lines.pop();

const manager = new DriveManager();

const startTime = new Date().getTime();

const current = {};
for (const line of lines) {
  const attributes = line.split('|');

  if (attributes.length !== 3) {
    console.log('Invalid index');
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

if (!manager.hasCapacity(current)) {
  console.log('Not enough space');
  return;
}

manager.add(current, previous);

const endTime = new Date().getTime();

const difference = (endTime - startTime) / 1000;
const minutes = Math.floor(difference / 60);
const seconds = Math.round(difference % 60);

const count = Object.keys(current).length.toLocaleString();
const duration = `${minutes}m ${seconds}s`;

console.log();
console.log(`Successfully placed ${count} files in ${duration}`);
console.log();
