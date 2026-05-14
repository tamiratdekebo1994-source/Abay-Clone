module.exports = {
  apps: [{
    name: 'fetno-api',
    script: 'src/server.js',
    cwd: '/home/user/Abay-Clone/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/fetno/error.log',
    out_file: '/var/log/fetno/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
