const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getRequiredEnv } = require("../utils/env");
const {
  createUser,
  findUserByEmail,
  findUserById,
} = require("../models/userModel");
const { ensureUserBootstrap } = require("../services/userDataService");

const generateToken = (userId) =>
  jwt.sign({ id: userId }, getRequiredEnv("JWT_SECRET"), { expiresIn: "7d" });

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  cigarettePrice: Number(user.cigarette_price) || 20,
  visibilityEnabled: Boolean(user.visibility_enabled),
});

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const signup = async (req, res) => {
  try {
    console.log("Signup request body:", req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
      console.log("Signup blocked: email already exists:", normalizedEmail);
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully for:", normalizedEmail);
    const user = await createUser({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });
    await ensureUserBootstrap(user.id);

    const token = generateToken(user.id);
    console.log("Signup success", {
      userId: user.id,
      email: normalizedEmail,
      tokenGenerated: Boolean(token),
    });

    return res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const login = async (req, res) => {
  try {
    console.log("Login request body:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      console.log("Login failed: user not found for email:", normalizedEmail);
      return res.status(401).json({
        success: false,
        message: "Login error: email or password wrong.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password comparison result for login:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Login error: email or password wrong.",
      });
    }

    const token = generateToken(user.id);
    await ensureUserBootstrap(user.id);

    console.log("Login success", {
      userId: user.id,
      email: normalizedEmail,
      tokenGenerated: Boolean(token),
    });

    return res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
};
