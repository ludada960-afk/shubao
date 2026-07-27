const path = require('node:path');

const [projectRoot, source, destination] = process.argv.slice(2);
if (![projectRoot, source, destination].every(value => typeof value === 'string' && value.length > 0)) {
  throw new Error('Usage: backup-runtime-db.cjs <project-root> <source> <destination>');
}

const driverPath = require.resolve('better-sqlite3', { paths: [path.resolve(projectRoot)] });
const Database = require(driverPath);
const db = new Database(path.resolve(source), { readonly: true, fileMustExist: true });

db.backup(path.resolve(destination))
  .finally(() => db.close())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
