// src/index.js (EJEMPLO)
import express from 'express';
import cors from 'cors'; // 🚨 IMPORTAR CORS
import 'dotenv/config';
// ... importa tus routers (authRouter, productsRouter)
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';


const app = express();
const PORT = process.env.PORT || 4000;

// 🚨 CONFIGURACIÓN DE CORS
// Permite peticiones de tu frontend (http://localhost:5173) y cualquier otro origen
const corsOptions = {
    // ⚠️ Asegúrate de cambiar esto si tu frontend no corre en el 5173
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true, // Importante si usas cookies o sesiones, aunque aquí usamos JWT
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); // 🚨 USAR CORS ANTES DE LAS RUTAS

app.use(express.json()); // Middleware para parsear JSON
app.use(express.urlencoded({ extended: true })); // Middleware para datos de formularios

// Rutas de API
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productsRouter);

// Ruta de prueba (opcional)
app.get('/api/v1/', (req, res) => {
    res.json({ message: 'Lienzo de Vida API running!' });
});


app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});