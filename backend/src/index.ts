import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { generalLimiter } from './middleware/rateLimiter';
import { authenticateToken } from './middleware/auth';

import authRouter from './routes/auth';
import ordersRouter from './routes/orders';
import itemStatusRouter from './routes/itemStatus';
import suppliersRouter from './routes/suppliers';
import articlesRouter from './routes/articles';
import recipesRouter from './routes/recipes';
import storeRouter from './routes/store';
import usersRouter from './routes/users';
import inventoryRouter from './routes/inventory';
import settingsRouter from './routes/settings';

declare global {
    namespace Express {
        interface Request {
            user?: { userId: string; username: string };
        }
    }
}

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use(express.json({ limit: '2mb' }));

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Error && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
        res.status(413).json({ error: 'La imagen es demasiado grande. Usa una imagen de menos de 500 KB.' });
        return;
    }
    next(err);
});

app.use('/api/', generalLimiter);

// Public routes
app.get('/', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', authRouter);

// Protected routes
app.use('/api', authenticateToken);
app.use('/api/item-status', itemStatusRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/store-orders', storeRouter);
app.use('/api/users', usersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/settings', settingsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Servidor Backend escuchando en http://localhost:${port}`);
});
