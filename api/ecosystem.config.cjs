module.exports = {
  apps: [{
    name: "migration-api",
    script: "./dist/server.js",
    instances: "max",
    exec_mode: "cluster",
    watch: false,
    env_file: "api/production.env", 
    env_production: {
      NODE_ENV: "production"
    },
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
  }]
}