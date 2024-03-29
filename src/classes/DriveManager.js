const fs = require('fs');

const { destinations } = require('../config');
const { space } = require('../utils');

const Drive = require('../classes/Drive');

class DriveManager {
  constructor() {
    this.drives = {};
    destinations.forEach(destination => {
      const { path, size } = destination;
      const drive = new Drive(path, size);
      this.drives[drive.getName()] = drive;
    });
    this.active = new Set();
  }

  remove(drive, path) {
    this.drives[drive].delete(path);
    this.active.add(drive);
  }

  load(previous) {
    for (const path of Object.keys(previous)) {
      const { drive, size } = previous[path];
      this.drives[drive].use(size);
    }
  }

  test(current) {
    let adding = 0;
    for (const file of Object.values(current)) {
      adding += file.size;
    }

    let capacity = 0;
    for (const drive of Object.values(this.drives)) {
      capacity += drive.getCapacity();
    }

    return capacity - space(adding);
  }

  add(current, previous) {
    for (const path of Object.keys(current)) {
      const { updated, size } = current[path];

      let writeTo = '';

      for (const drive of [...this.active].reverse()) {
        if (this.drives[drive].getCapacity() >= space(size)) {
          writeTo = drive;
          break;
        }
      }

      if (!writeTo) {
        let biggest = 0;
        for (const drive of Object.keys(this.drives)) {
          if (!this.active.has(drive)) {
            const capacity = this.drives[drive].getCapacity();
            if (capacity > biggest) {
              biggest = capacity;
              writeTo = drive;
            }
          }
        }
        this.active.add(writeTo);
      }

      this.drives[writeTo].copy(path, size);
      previous[path] = { drive: writeTo, updated, size };
    }

    for (const drive of this.active) {
      this.drives[drive].writeInstructions();
    }
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    const timestamp = new Date().toLocaleString('en-US', options);
    const location = `output/snapshot (${timestamp}).json`;
    fs.writeFileSync(location, JSON.stringify(previous));
  }
}

module.exports = DriveManager;
