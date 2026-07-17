module.exports = {
  apps: [
    {
      name: 'shubao',
      script: 'server/index.mjs',
      cwd: 'F:/da/shubao',
      env: { NODE_ENV: 'production', PORT: '3001' },
      max_memory_restart: '500M',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'cloudflare-tunnel',
      script: 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
      args: 'tunnel --config C:\\Users\\SHEJI\\.cloudflared\\config.yml run',
      cwd: 'F:/da/shubao',
      error_file: 'logs/tunnel-error.log',
      out_file: 'logs/tunnel.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ]
};
