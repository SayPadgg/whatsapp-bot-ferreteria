const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const { obtenerInventario } = require("./services/sheets");
const {
    detectarMaterialesIA,
    buscarMaterialSemantico,
    responderIA
} = require("./services/ai");

const {
    normalizarTexto,
    singularizar
} = require("./utils/text");

// Configuración del cliente para Render
const client = new Client({
    authStrategy: new LocalAuth({
        // opcional: puedes poner una carpeta específica para la sesión
        // por ejemplo: dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true, // importante para servidores
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Evento QR (solo visible en terminal)
client.on("qr", qr => {
    console.log("📲 Escanea este QR en tu WhatsApp:");
    qrcode.generate(qr, { small: true });
});

// Bot listo
client.on("ready", () => {
    console.log("🤖 Bot conectado a WhatsApp");
});

// Manejo de mensajes
client.on("message", async message => {
    try {
        const texto = message.body.trim();
        console.log("📩 Mensaje:", texto);

        const inventario = await obtenerInventario();
        const materialesIA = await detectarMaterialesIA(texto);

        if (materialesIA.length > 0) {
            for (const material of materialesIA) {
                const materialNormalizado =
                    singularizar(normalizarTexto(material));

                let variantes = inventario.filter(i => {
                    const productoNormalizado =
                        singularizar(normalizarTexto(i.Producto));
                    return productoNormalizado.includes(materialNormalizado);
                });

                if (variantes.length === 0) {
                    const sugerido =
                        await buscarMaterialSemantico(material, inventario);

                    if (sugerido) {
                        variantes = inventario.filter(i =>
                            i.Producto.toLowerCase() === sugerido.toLowerCase()
                        );
                    }
                }

                if (variantes.length > 0) {
                    let respuesta = `📌 Resultados para "${material}"\n\n`;

                    variantes.forEach(item => {
                        respuesta += `📦 ${item.Producto}
💰 Precio: $${item.Precio}
📊 Stock Sucursal 1: ${item.StockSucursal1}
📊 Stock Sucursal 2: ${item.StockSucursal2}

`;
                    });

                    await message.reply(respuesta.trim());
                } else {
                    await message.reply(`Lo siento, no encontré "${material}" en el inventario.`);
                }
            }
            return;
        }

        // Respuesta genérica de IA si no hay materiales detectados
        const respuesta = await responderIA(texto);
        await message.reply(respuesta);

    } catch (err) {
        console.error("⚠️ Error procesando mensaje:", err);
        await message.reply("⚠️ Ocurrió un error, intenta de nuevo.");
    }
});

// Inicializar cliente
client.initialize();