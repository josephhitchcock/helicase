const fs = require('fs');

const { parameters } = require('../config');
const { bytes, percent, space } = require('../utils');

const { capacity, buffer } = parameters;

class Drive {
  constructor(path, size) {
    this.path = path;
    this.name = path.replace('/Volumes/', '');
    this.capacity = bytes(size, 'TB') * percent(capacity) - bytes(buffer, 'GB');

    this.toDelete = [];
    this.toCopy = [];
  }

  getCapacity() {
    return this.capacity;
  }

  getName() {
    return this.name;
  }

  delete(path) {
    this.toDelete.push(path);
  }

  use(bytes) {
    this.capacity -= space(bytes);
  }

  copy(path, size) {
    this.toCopy.push({ path, size });
    this.use(size);
  }

  writeInstructions() {
    const output = { delete: this.toDelete, copy: this.toCopy };
    const location = `output/${this.name}.json`;
    fs.writeFileSync(location, JSON.stringify(output));
  }
}

module.exports = Drive;
