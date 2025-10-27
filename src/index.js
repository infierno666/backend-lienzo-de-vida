// src/index.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Importar tus routers
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';

const app = express();
const PORT = process.env.PORT || 4000;

// 🚨 CONFIGURACIÓN DE CORS
const corsOptions = {
    origin: [
        'http://localhost:5173',               // para desarrollo local
        'https://lienzo-de-vida.vercel.app'    // dominio del frontend en producción
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
};

// Usar CORS antes de las rutas
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de API
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);

// Ruta de prueba
app.get('/api/v1/', (req, res) => {
    res.json({ message: 'Lienzo de Vida API running!' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en puerto ${PORT}`);
});
