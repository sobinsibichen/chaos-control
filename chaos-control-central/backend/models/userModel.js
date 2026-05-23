const pool = require("../config/db");

const findUserByEmail = async (email) => {
  const query = `
    SELECT id, name, email, password, cigarette_price, visibility_enabled, created_at
    FROM public.users
    WHERE email = $1
  `;

  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const createUser = async ({ name, email, password }) => {
  const query = `
    INSERT INTO public.users (name, email, password, cigarette_price, visibility_enabled)
    VALUES ($1, $2, $3, 20, FALSE)
    RETURNING id, name, email, cigarette_price, visibility_enabled, created_at
  `;

  console.log("Executing signup INSERT query for email:", email);
  const { rows } = await pool.query(query, [name, email, password]);
  return rows[0];
};

const findUserById = async (id) => {
  const query = `
    SELECT id, name, email, cigarette_price, visibility_enabled, created_at
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
