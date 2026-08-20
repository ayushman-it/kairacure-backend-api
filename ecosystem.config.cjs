module.exports = {
  apps: [{
    name: 'kairacure-api',
    script: 'index.js',
    cwd: '/opt/kairacure/kairacure-backend-api',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/root/.pm2/logs/kairacure-api-error.log',
    out_file: '/root/.pm2/logs/kairacure-api-out.log',
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
  }],
};
