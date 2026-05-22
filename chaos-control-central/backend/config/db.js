require("dotenv").config();

const { Pool } = require("pg");

const requiredEnvVars = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PASSWORD", "DB_PORT"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error("Missing database environment variables:", missingEnvVars.join(", "));
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

pool
  .connect()
  .then((client) => {
    console.log(`PostgreSQL Connected (${process.env.DB_NAME})`);
    client.release();
  })
  .catch((error) => {
    console.error("PostgreSQL connection error:", error.message);
  });

module.exports = pool;
