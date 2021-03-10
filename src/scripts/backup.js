const fs = require('fs');

const { execute } = require('../utils');

const volume = process.argv.slice(2).join(' ');

if (!volume) {
  console.log('Provide a volume');
  console.log('Usage: npm run backup <volume>');
  console.log();
  return;
}

let instructions;
try {
  instructions = require(`../../output/${volume}.json`);
} catch {
  console.log('Instructions not found');
  console.log(`Make sure ${volume}.json matches a file in /output`);
  console.log();
  return;
}

let stream;
const log = error => {
  if (!stream) {
    stream = fs.createWriteStream('output/errors.txt', { flags: 'a' });
  }
  stream.write(error + '\n');
};

const formatted = volume.split(' ').join('\\ ');

const getLocation = path => {
  // Match "/Volumes/" at start of string
  const leadingVolumes = /^\/Volumes\//;
  const newLocation = `/Volumes/${formatted}/`;
  return path.replace(leadingVolumes, newLocation);
};

execute(`cd /Volumes/${formatted}`)
  .then(async () => {
    const totalFiles = instructions.delete.length.toLocaleString();

    let count = 0;
    for (const path of instructions.delete) {
      const location = getLocation(path);
      const command = `rm "${location}"`;
      await execute(command).catch(error => log(error));

      count += 1;
      const current = `${count.toLocaleString().padStart(totalFiles.length)}`;

      console.clear();
      console.log(`Deleted file ${current}/${totalFiles}`);
    }

    let totalSize = 0;
    for (const file of instructions.copy) {
      const { size } = file;
      totalSize += size;
    }

    const startTime = new Date().getTime();

    let progress = 0;
    for (const file of instructions.copy) {
      const { path: source, size } = file;

      const destination = getLocation(source);
      const directory = destination.split('/').slice(0, -1).join('/');
      const command = `mkdir -p "${directory}" && cp -p "${source}" "${destination}"`;
      await execute(command).catch(error => log(error));

      progress += size;
      const percent = Math.min((progress / totalSize) * 100, 99.99);
      const formattedPercent = percent.toFixed(2).padStart(6);

      console.clear();
      console.log(`${formattedPercent}% | ${source})`);
    }

    const endTime = new Date().getTime();

    const difference = (endTime - startTime) / 1000;
    const hours = Math.floor(difference / 3600);
    const minutes = Math.floor(difference / 60);
    const seconds = Math.round(difference % 60);

    const copied = instructions.copy.length.toLocaleString();
    const duration = `${hours}h ${minutes}m ${seconds}s`;

    const wrote = (totalSize / 1000000000000).toFixed(2);
    const rate = (totalSize / difference / 1000000).toFixed(2);

    console.clear();
    console.log(`Copied ${copied} files in ${duration}`);
    console.log(`Wrote ${wrote} TB at ${rate} MB/s`);
    console.log();
  })
  .catch(() => {
    console.log(`/Volumes/${formatted} not found`);
    console.log();
    return;
  });
