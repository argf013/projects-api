import rateLimit from 'express-rate-limit';

export const basicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    code: 429,
    message: 'Too many requests, please try again later.',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    code: 429,
    message: 'Too many requests, please try again later.',
    data: null,
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    code: 429,
    message: 'Upload limit exceeded, please try again later.',
    data: null,
  },
});
