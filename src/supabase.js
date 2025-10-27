// src/supabase.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; 

const supabaseUrl = process.env.SUPABASE_URL;

// 1. Cliente PÚBLICO (usa la clave ANON)
const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY); 

// 2. Cliente ADMINISTRADOR (usa la Service Key)
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY); 

export { supabase, supabaseAdmin };