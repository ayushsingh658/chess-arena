import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * Higher-security rate limiter for authentication routes.
 * Prevents brute-force attacks on login and registration.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  handler: (req, res, _next, options) => {
    logger.warn('Security', `Rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * General purpose rate limiter for API routes.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'You are sending too many requests. Slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
