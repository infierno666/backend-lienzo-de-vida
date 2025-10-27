// src/routes/auth.js
import express from 'express';
// 🚨 CORRECCIÓN: Importamos AMBOS clientes
import { supabase, supabaseAdmin } from '../supabase.js'; 
import { generateAdminToken } from '../auth/jwt.js';

const router = express.Router();

// Ruta de Login para Administradores
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // 1. AUTENTICACIÓN (Usando el cliente PÚBLICO/ANON)
    // El cliente normal es suficiente para verificar el email/password en Supabase Auth.
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (authError) {
        // Credenciales incorrectas
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    
    // Si la autenticación falla, pero el objeto de usuario no se genera (ej. email no confirmado)
    if (!authData.user) {
        return res.status(401).json({ error: 'Fallo de autenticación.' });
    }

    // 2. AUTORIZACIÓN (Usando el cliente ADMIN/SERVICE_ROLE) 🚨 CAMBIO CLAVE
    // Utilizamos supabaseAdmin para leer la tabla 'profiles' sin ser bloqueados por RLS.
    const userId = authData.user.id;
    const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles') 
        .select('role')
        .eq('id', userId)
        .single();

    if (profileError || !profileData || profileData.role !== 'admin') {
        // Esto captura:
        // a) Si hubo un error en la consulta (profileError)
        // b) Si el perfil no se encontró (aunque se logueó, es un error de DB)
        // c) Si el rol existe pero no es 'admin' (profileData.role !== 'admin')
        
        console.error("Fallo de Autorización/Perfil:", profileError);
        return res.status(403).json({ error: 'Usuario no autorizado para el panel de administración.' });
    }

    // 3. Generar el JWT de tu API Backend
    const token = generateAdminToken({
        id: userId,
        email: email,
        role: profileData.role
    });

    // 4. Respuesta de Éxito
    res.json({
        token,
        user: {
            id: userId,
            email: email,
            role: profileData.role
        }
    });
});

export default router;