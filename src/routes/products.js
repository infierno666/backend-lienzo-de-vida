// src/routes/productRoutes.js
import express from "express";
import multer from "multer";
import slugify from "slugify";
import { supabaseAdmin, supabase } from "../supabase.js"; // usar supabaseAdmin para backend seguro
import { verifyAdminAuth } from "../auth/jwt.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const PRODUCT_IMAGES_BUCKET = "product-images";

// 🔹 Middleware de autenticación
router.use(verifyAdminAuth);

// 🔹 Función auxiliar para subir imagen a Supabase Storage
async function uploadImageToStorage(file) {
    const originalNameSafe = file.originalname.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
    const fileName = `products/${Date.now()}-${originalNameSafe}`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(fileName, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(fileName);

    let imageUrl = publicUrlData?.publicUrl;

    if (!imageUrl || imageUrl.includes("undefined")) {
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .createSignedUrl(fileName, 60 * 60); // 1 hora
        if (signedUrlError) throw signedUrlError;
        imageUrl = signedUrlData.signedUrl;
    }

    return { imageUrl, fileName };
}

// ----------------------------------------------------------------------
// 🆕 🔹 Obtener todas las imágenes del Storage para la MediaLibrary
// ----------------------------------------------------------------------
router.get("/images", async (req, res) => {
    try {
        // Usamos supabaseAdmin para garantizar acceso total al bucket (aunque podríamos usar supabase simple
        // si el bucket tiene políticas RLS para lectura pública).
        const { data: listData, error: listError } = await supabaseAdmin.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .list("products", { // 'products' es el prefijo de carpeta dentro del bucket
                limit: 100, // Limita la cantidad de archivos a 100 por defecto
                offset: 0,
                sortBy: { column: "created_at", order: "desc" },
            });

        if (listError) throw listError;

        if (!listData || listData.length === 0) {
            return res.json({ media: [] });
        }

        // Formatear los datos para obtener la URL pública de cada archivo
        const formattedMedia = listData
            .filter(file => file.name !== '.emptyFolderPlaceholder') // Ignorar placeholder de Supabase
            .map((file, index) => {
                // Obtener la URL pública del archivo
                const publicUrlPath = `products/${file.name}`; 
                const { data: urlData } = supabaseAdmin.storage
                    .from(PRODUCT_IMAGES_BUCKET)
                    .getPublicUrl(publicUrlPath);

                // Determinar el tamaño en un formato legible
                const sizeKB = file.metadata?.size ? (file.metadata.size / 1024).toFixed(1) : "N/A";

                return {
                    id: file.id || index + 1, // Usar un ID/índice si file.id no está disponible
                    name: file.name,
                    type: 'Imagen', 
                    url: urlData.publicUrl,
                    size: sizeKB + " KB", 
                    date: new Date(file.created_at).toISOString().split('T')[0],
                    description: `Imagen de producto: ${file.name}`,
                    mimeType: file.metadata?.mimetype || 'application/octet-stream',
                    storagePath: publicUrlPath, // Guardar el path completo para la eliminación
                };
            });

        res.json({ media: formattedMedia });
    } catch (err) {
        console.error("Error al obtener imágenes del Storage:", err);
        res.status(500).json({ error: "Error al obtener imágenes: " + err.message });
    }
});

// ----------------------------------------------------------------------
// 🔹 Subir imagen de forma independiente
// ----------------------------------------------------------------------
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No se encontró el archivo." });

        const { imageUrl, fileName } = await uploadImageToStorage(req.file);

        res.status(201).json({
            url: imageUrl,
            name: req.file.originalname,
            storagePath: fileName,
        });
    } catch (err) {
        console.error("Error al subir imagen:", err);
        res.status(500).json({ error: "Error al subir imagen: " + err.message });
    }
});

// ----------------------------------------------------------------------
// 🔹 Obtener producto por SLUG
// ----------------------------------------------------------------------
router.get("/slug/:slug", async (req, res) => {
    const { slug } = req.params;
    try {
        const { data, error } = await supabase
            .from("products")
            .select("*")
            .eq("slug", slug)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Producto no encontrado" });

        res.json({ product: data });
    } catch (err) {
        console.error("Error al obtener producto por slug:", err);
        res.status(404).json({ error: "Producto no encontrado" });
    }
});

// ----------------------------------------------------------------------
// 🔹 Crear producto (opcionalmente con imagen)
// ----------------------------------------------------------------------
router.post("/", upload.single("file"), async (req, res) => {
    try {
        let newProduct = req.body;

        // Limpiar valores vacíos
        newProduct = Object.fromEntries(
            Object.entries(newProduct).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
        );

        // Forzar tipos
        if (newProduct.price) newProduct.price = parseFloat(newProduct.price);
        if (newProduct.stock) newProduct.stock = parseInt(newProduct.stock);

        // Slug
        if (newProduct.name && !newProduct.slug) {
            newProduct.slug = slugify(newProduct.name, { lower: true, strict: true });
        } else if (newProduct.slug) {
            newProduct.slug = slugify(newProduct.slug, { lower: true, strict: true });
        }

        // Subir imagen si existe
        if (req.file) {
            const { imageUrl, fileName } = await uploadImageToStorage(req.file);
            newProduct.image_url = imageUrl;
            newProduct.image_path = fileName;
        }

        const { data, error } = await supabaseAdmin.from("products").insert([newProduct]).select();
        if (error) throw error;

        res.status(201).json({ product: data[0] });
    } catch (err) {
        console.error("Error al crear producto:", err);
        res.status(500).json({ error: "Error al crear producto: " + err.message });
    }
});

// ----------------------------------------------------------------------
// 🔹 Actualizar producto (opcionalmente con nueva imagen)
// ----------------------------------------------------------------------
router.put("/:id", upload.single("file"), async (req, res) => {
    const { id } = req.params;
    try {
        let updates = req.body;
        delete updates.id;

        updates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
        );

        if (updates.price) updates.price = parseFloat(updates.price);
        if (updates.stock) updates.stock = parseInt(updates.stock);

        if (updates.name && !updates.slug) {
            updates.slug = slugify(updates.name, { lower: true, strict: true });
        } else if (updates.slug) {
            updates.slug = slugify(updates.slug, { lower: true, strict: true });
        }

        // Subir nueva imagen si se envía
        if (req.file) {
            const { imageUrl, fileName } = await uploadImageToStorage(req.file);
            updates.image_url = imageUrl;
            updates.image_path = fileName;
        }

        const { data, error } = await supabaseAdmin.from("products").update(updates).eq("id", id).select();
        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: "Producto no encontrado." });

        res.json({ product: data[0] });
    } catch (err) {
        console.error("Error al actualizar producto:", err);
        res.status(500).json({ error: "Error al actualizar producto: " + err.message });
    }
});

// ----------------------------------------------------------------------
// 🔹 Obtener todos los productos
// ----------------------------------------------------------------------
router.get("/", async (_, res) => {
    try {
        const { data, error } = await supabase.from("products").select("*").order("id", { ascending: true });
        if (error) throw error;
        res.json({ products: data });
    } catch (err) {
        console.error("Error al obtener productos:", err);
        res.status(500).json({ error: "Error al obtener productos: " + err.message });
    }
});

// ----------------------------------------------------------------------
// 🔹 Obtener producto por ID
// ----------------------------------------------------------------------
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
        if (error) throw error;
        res.json({ product: data });
    } catch (err) {
        console.error("Error al obtener producto:", err);
        res.status(404).json({ error: "Producto no encontrado" });
    }
});

// ----------------------------------------------------------------------
// 🔹 Eliminar producto y su imagen
// ----------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // Primero obtener producto para borrar su imagen
        const { data: product, error: selectError } = await supabaseAdmin
            .from("products")
            .select("*")
            .eq("id", id)
            .single();
        if (selectError) throw selectError;
        if (!product) return res.status(404).json({ error: "Producto no encontrado" });

        // Eliminar imagen del storage si existe
        if (product.image_path) {
            const { error: storageError } = await supabaseAdmin.storage
                .from(PRODUCT_IMAGES_BUCKET)
                .remove([product.image_path]);
            if (storageError) console.warn("No se pudo eliminar la imagen del storage:", storageError.message);
        }

        // Eliminar producto de la tabla
        const { error: deleteError } = await supabaseAdmin.from("products").delete().eq("id", id);
        if (deleteError) throw deleteError;

        res.status(204).send();
    } catch (err) {
        console.error("Error al eliminar producto:", err);
        res.status(500).json({ error: "No se pudo eliminar el producto" });
    }
});

// 1️⃣ Eliminar imagen del Storage (ruta específica primero)
router.delete("/image", async (req, res) => {
    const filePath = decodeURIComponent(req.query.filePath); // decodificar
    if (!filePath) return res.status(400).json({ error: "filePath requerido" });

    try {
        const { error } = await supabaseAdmin.storage.from(PRODUCT_IMAGES_BUCKET).remove([filePath]);
        if (error) throw error;

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error al eliminar imagen del Storage:", err);
        res.status(500).json({ error: "No se pudo eliminar la imagen" });
    }
});
export default router;
