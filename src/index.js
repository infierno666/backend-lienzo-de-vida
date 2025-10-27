import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Lista de orígenes permitidos
const allowedOrigins = [
    'http://localhost:5173',                 // desarrollo local
    'https://lienzo-de-vida.vercel.app',     // frontend en Vercel
    'https://lienzo-backend.onrender.com'    // backend (por si hace fetch a sí mismo)
];

// ✅ Configuración de CORS
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('❌ Bloqueado por CORS:', origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);

app.get('/api/v1/', (req, res) => {
    res.json({ message: 'Lienzo de Vida API running!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en puerto ${PORT}`);
});
