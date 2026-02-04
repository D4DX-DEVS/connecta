const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user (passwordless)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, mobile, place, gender } = req.body;

    // Require at least one of email or mobile for login later
    if (!email && !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either email or mobile number'
      });
    }

    // Check if user already exists by email or mobile
    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(mobile ? [{ mobile }] : [])
      ].filter(Boolean)
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone number'
      });
    }

    // Create user (no password)
    const userData = { name, place, gender };
    if (email) userData.email = email.toLowerCase();
    if (mobile) userData.mobile = mobile;

    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user (passwordless - email or phone only)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, mobile, identifier } = req.body;
    const loginIdentifier = (identifier || email || mobile || '').trim();

    if (!loginIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email or phone number'
      });
    }

    // Find user by email or mobile
    const isEmailLogin = loginIdentifier.includes('@') || !!email;
    const query = isEmailLogin
      ? { email: loginIdentifier.toLowerCase() }
      : { mobile: loginIdentifier };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No account found with this email or phone number'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('bookmarkedBooths', 'name title logo')
      .populate('visitedBooths.booth', 'name title logo');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, mobile, place, gender } = req.body;
    const updates = { name, place, gender };
    if (email !== undefined) updates.email = email ? email.toLowerCase() : null;
    if (mobile !== undefined) updates.mobile = mobile || null;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

