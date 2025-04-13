module.exports = {
  apps: [
    {
      name: "slack_collector",
      script: "src/index.js",
      watch: false,
      ignore_watch: ["node_modules", "logs", "downloads", "backups", "*.log"],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
