module.exports = {
  apps: [
    {
      name: "pams",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/var/www/pams",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "/var/log/pams/error.log",
      out_file: "/var/log/pams/out.log",
    },
  ],
};
