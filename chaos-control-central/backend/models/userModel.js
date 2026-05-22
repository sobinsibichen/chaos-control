const pool = require("../config/db");

const findUserByEmail = async (email) => {
  const query = `
    SELECT id, name, email, password, created_at
    FROM public.users
    WHERE email = $1
  `;

  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const createUser = async ({ name, email, password }) => {
  const query = `
    INSERT INTO public.users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, name, email, created_at
  `;

  console.log("Executing signup INSERT query for email:", email);
  const { rows } = await pool.query(query, [name, email, password]);
  return rows[0];
};

const findUserById = async (id) => {
  const query = `
    SELECT id, name, email, created_at
    FROM public.users
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
};
