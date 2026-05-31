import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

export const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: { error: 'Demasiados intentos de login. Intenta de nuevo en 10 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});
