module.exports = {
  apps: [
    {
      name: 'shubao',
      script: 'server/index.mjs',
      cwd: '/home/ubuntu/shubao',
      env: { NODE_ENV: 'production', PORT: '3001' },
      max_memory_restart: '1G',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'cloudflare-tunnel',
      script: 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
      args: 'tunnel --config C:\\Users\\SHEJI\\.cloudflared\\config.yml run',
      cwd: '/home/ubuntu/shubao',
      error_file: 'logs/tunnel-error.log',
      out_file: 'logs/tunnel.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ]
};
