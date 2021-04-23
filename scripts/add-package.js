const { readdirSync, writeFileSync } = require('fs');

const excludePaths = ['esm'];
const basePackage = {
  sideEffects: false,
  types: './index.d.ts',
};

console.log('Adding package.json to Component directories')

const filterDirs = (dir) => {
  const keepDir = !excludePaths.includes(dir.name);
  return dir.isDirectory() && keepDir;
}

const directories = readdirSync('./dist', { withFileTypes: true })
  .filter(filterDirs)
  .map(dir => dir.name);

directories.forEach((dirname) => {
  const data = JSON.stringify({
    ...basePackage,
    module: `../esm/${dirname}/index.js`,
  }, null, 2);

  writeFileSync(`./dist/${dirname}/package.json`, data);
});

console.log('Task finished');
