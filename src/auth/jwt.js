import jwt from 'jsonwebtoken';
import 'dotenv/config'; // Asegúrate de cargar las variables de entorno

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = '7d'; // Tiempo de vida del token

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET no está configurada en .env");
}

/**
 * 1. Generar un Token de Acceso JWT
 * @param {object} userPayload - Datos del usuario a incluir en el token (ej: id, email, role).
 */
export const generateAdminToken = (userPayload) => {
    // Es CRÍTICO incluir el rol para la autorización
    return jwt.sign(userPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRATION,
    });
};

/**
 * 2. Middleware para verificar el token y el rol de Admin
 */
export const verifyAdminAuth = (req, res, next) => {
    // 1. Obtener el token del encabezado (Authorization: Bearer <token>)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verificar el token y decodificar el payload
        const decoded = jwt.verify(token, JWT_SECRET);

        // 3. Autorización: Verificar el rol del usuario
        // Asumimos que el payload del token tiene un campo 'role'
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso prohibido. Requiere rol de administrador.' });
        }

        // 4. Adjuntar el payload del usuario a la solicitud para uso posterior
        req.user = decoded; 
        next(); // Continuar con la ruta
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado.' });
        }
        return res.status(401).json({ error: 'Token inválido o malformado.' });
    }
};