import express from "express";
import fs from "fs";
import https from "https";

const app = express();
app.use(express.json());

// -------------------------
// CONFIGURATION (Badel Houni)
// -------------------------
const JETPACK_URL = "https://www.jetpack.tn/apis/mande-DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45/v1/post.php";
const JETPACK_TOKEN = "DJSKKNC34UFHJFHSHJBCIN47YILJLKHJQWBJH3KU4H5KHJHFJ45"; // 
const LOG_FILE = "log.txt";
const LOG_PASSWORD = "MonMotDePasse123"; // Mot de passe pour voir les logs

const processedOrders = new Set();

// Fonction Helper pour les logs
function log(data) {
  const message = `[${new Date().toISOString()}] ${data}\n`;
  console.log(message.trim());
  try { fs.appendFileSync(LOG_FILE, message); } catch (e) { console.error("Log file error:", e); }
}

app.get("/", (req, res) => res.send("🚀 Server Running & Ready"));

app.post("/shopify", async (req, res) => {
  // 1. Réponse immédiate pour que Shopify ne réessaye pas (Timeout prevention)
  res.status(200).send('Webhook received');

  try {
    const order = req.body;
    const orderId = order.id;

    // ----------------------------------------------------
    // 🛑 FILTER 1: Vérification Adresse (Pas d'adresse = Pas de livraison)
    // ----------------------------------------------------
    if (!order.shipping_address || !order.shipping_address.address1) {
      log(`⚠️ IGNORED: Order ${orderId} - Pas d'adresse de livraison.`);
      return; 
    }

    // ----------------------------------------------------
    // 🛑 FILTER 2: Anti-Doublons (Deduplication)
    // ----------------------------------------------------
    if (orderId && processedOrders.has(orderId)) {
      console.log(`⚠️ DUPLICATE BLOCKED: Order ${orderId} déjà traitée.`);
      return;
    }

    // Ajout à la liste des traités (Suppression auto après 10 min)
    if (orderId) {
      processedOrders.add(orderId);
      setTimeout(() => processedOrders.delete(orderId), 10 * 60 * 1000);
    }

    log(`📦 PROCESSING VALID ORDER: ${orderId}`);

    // Calcul du nombre total d'articles
    let totalArticles = 0;
    if (order.line_items && Array.isArray(order.line_items)) {
      totalArticles = order.line_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    // Formatage de la liste des produits
    const productNames = order.line_items?.map(item => `${item.quantity}x ${item.name}`).join(", ") || "Produit Divers";

    // Récupération des champs Shopify
    const firstName = order.customer?.first_name || order.shipping_address?.first_name || "";
    const lastName = order.customer?.last_name || order.shipping_address?.last_name || "";
    
    // ----------------------------------------------------
    // 🛠️ MAPPAGE CORRIGÉ POUR LA DESTINATION
    // ----------------------------------------------------
    // Note: Pour remplir "Déstination" sur le bordereau, on priorise la Province.
    // Si la Province est vide, on force la Ville dans le champ Gouvernorat.
    const provinceShopify = order.shipping_address?.province || "";
    const cityShopify = order.shipping_address?.city || "";

    const data = {
      prix: order.total_price || 0,
      nom: `${firstName} ${lastName}`,
      
      // Houni el 3afsa: Ken province fergha, 7ott el ville.
      // Hetheka 3lech 'Déstination' kenet to5rej fergha 9bal.
      gouvernerat: provinceShopify ? provinceShopify : cityShopify, 
      
      ville: cityShopify,
      adresse: `${order.shipping_address?.address1} ${order.shipping_address?.address2 || ""}`,
      tel: order.shipping_address?.phone || order.customer?.phone || "",
      tel2: "", 
      designation: productNames,
      nb_article: totalArticles || 1,
      msg: `Order ID: ${orderId}`,
    };

    // Préparation de l'envoi vers Jetpack
    const postData = new URLSearchParams(data).toString();
    const url = new URL(JETPACK_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(JETPACK_TOKEN + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    // Envoi de la requête HTTPS
    const request = https.request(options, (response) => {
      let body = "";
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => {
        // On logue la réponse de Jetpack pour être sûr qu'ils ont bien reçu
        if (response.statusCode === 200 || response.statusCode === 201) {
            log(`✅ SENT TO JETPACK SUCCESS: ${body}`);
        } else {
            log(`⚠️ JETPACK ERROR RESPONSE (${response.statusCode}): ${body}`);
        }
      });
    });

    request.on("error", (e) => log(`❌ JETPACK CONNECTION ERROR: ${e.message}`));
    request.write(postData);
    request.end();

  } catch (err) {
    log(`❌ CRITICAL ERROR: ${err.message}`);
  }
});

// Logs Viewer (Sécurisé un minimum)
app.get("/logs", (req, res) => {
    if (req.query.key !== LOG_PASSWORD) return res.status(403).send("⛔ Accès Interdit");
    
    try { 
        if (fs.existsSync(LOG_FILE)) {
            const logs = fs.readFileSync(LOG_FILE, "utf-8");
            res.type("text/plain").send(logs);
        } else {
            res.send("Aucun log pour le moment.");
        }
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
