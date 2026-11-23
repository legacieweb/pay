const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('Auth middleware - Authorization header:', authHeader ? 'present' : 'NOT PRESENT');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth middleware - No token provided');
    return res.status(401).json({ msg: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Auth middleware - Token:', token ? token.substring(0, 20) + '...' : 'empty');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware - Decoded user id:', decoded.id);
    
    // Use findOne with where clause instead of findByPk
    const user = await User.findOne({ where: { id: decoded.id } });
    console.log('Auth middleware - User found:', user ? user.name : 'NO');
    
    if (!user) return res.status(401).json({ msg: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    console.log('Auth middleware - Token verification error:', err.message);
    return res.status(401).json({ msg: 'Token is invalid' });
  }
};
