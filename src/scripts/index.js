const { sources, delimiter } = require('../config');
const { execute } = require('../utils');

(async () => {
  const directories = [...new Set(sources)].sort();
  for (let i = 1; i < directories.length; i++) {
    const [previous, current] = directories.slice(i - 1, i + 1);
    if (current.startsWith(previous)) {
      console.log(`${current} contained within ${previous}`);
      console.log(`Please fix source configuration to avoid duplication.`);
      console.log();
      return;
    }
  }

  const output = 'temp/index.txt';

  const startTime = new Date().getTime();

  await execute(`> ${output}`);
  for (const directory of directories) {
    console.log(`Indexing files in ${directory}`);
    const format = ['%N', '%m', '%z'].join(delimiter);
    const command = `find "${directory}" -type f -not -name ".*" -exec stat -f "${format}" {} \\; >> "${output}"`;
    await execute(command).catch(error => console.log(error));
  }

  const endTime = new Date().getTime();

  const difference = (endTime - startTime) / 1000;
  const minutes = Math.floor(difference / 60);
  const seconds = Math.round(difference % 60);

  const duration = `${minutes}m ${seconds}s`;

  console.log();
  console.log(`Successfully completed index in ${duration}`);
  console.log();
})();
