module.exports = {
  apps: [
    {
      name: 'free-fs',
      script: 'java',
      args: '-jar backend/fs-admin.jar --spring.profiles.active=prod',
      cwd: '__APP_ROOT__',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
