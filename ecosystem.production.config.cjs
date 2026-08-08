const path = require('node:path');

module.exports = {
  apps: [{
    name: 'shubao-production',
    script: 'server/index.mjs',
    cwd: __dirname,
    env: { NODE_ENV: 'production', PORT: '3002' },
    exec_mode: 'cluster',
    instances: 1,
    wait_ready: true,
    listen_timeout: 120_000,
    kill_timeout: 1_200_000,
    max_memory_restart: '1G',
    error_file: path.join(__dirname, 'logs/error.log'),
    out_file: path.join(__dirname, 'logs/output.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }],
};
