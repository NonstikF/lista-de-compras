import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Inicializar Prisma Client
const prisma = new PrismaClient();

// Inicializar Express App
const app = express();

// --- Middlewares ---
// ¡CRÍTICO! Habilita CORS para que tu frontend (Vite) pueda hacerle peticiones
app.use(cors()); 
// ¡CRÍTICO! Permite al servidor entender JSON que viene en las peticiones (body)
app.use(express.json()); 

// --- Rutas de nuestra API ---

/**
 * RUTA [GET] /api/all-status
 * Obtiene TODOS los estados de compra guardados en la base de datos.
 * El frontend llamará a esto 1 vez al cargar los pedidos.
 */
app.get('/api/all-status', async (req, res) => {
  try {
    const allStatus = await prisma.purchaseStatus.findMany();
    res.json(allStatus);
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({ error: 'No se pudo obtener el estado de los artículos' });
  }
});

/**
 * RUTA [POST] /api/item-status
 * Guarda o actualiza (upsert) el estado de un artículo de línea individual.
 * El frontend llamará a esto CADA VEZ que el usuario cambie un interruptor o cantidad.
 */
app.post('/api/item-status', async (req, res) => {
  // Obtenemos los datos que envió el frontend en el 'body'
  const { lineItemId, orderId, isPurchased, quantityPurchased } = req.body;

  // Validación simple
  if (typeof lineItemId === 'undefined') {
    return res.status(400).json({ error: 'lineItemId es requerido' });
  }

  try {
    const status = await prisma.purchaseStatus.upsert({
      where: {
        lineItemId: lineItemId, // Busca por el ID del artículo
      },
      update: {
        // Si lo encuentra, lo actualiza
        isPurchased: isPurchased,
        quantityPurchased: quantityPurchased,
      },
      create: {
        // Si no lo encuentra, lo crea
        lineItemId: lineItemId,
        orderId: orderId,
        isPurchased: isPurchased,
        quantityPurchased: quantityPurchased,
      },
    });

    // Respondemos al frontend que todo salió bien
    res.json({ success: true, status: status });

  } catch (error) {
    console.error('Error al guardar estado:', error);
    res.status(500).json({ error: 'No se pudo guardar el estado' });
  }
});


// --- Iniciar el Servidor ---
const port = process.env.PORT || 4000; // Railway proveerá la variable PORT
app.listen(port, () => {
  console.log(`🚀 Servidor Backend escuchando en http://localhost:${port}`);
});