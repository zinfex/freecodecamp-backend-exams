require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const { MongoClient } = require('mongodb');
const app = express();

const port = process.env.PORT || 3000;

app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use(express.urlencoded({ extended: true }));

// Banco de dados
const client = new MongoClient(process.env.DB_URL);
let urls;

async function connectDB() {
  await client.connect();
  const db = client.db("urlshortner");
  urls = db.collection("urls");
  console.log("MongoDB conectado.");
}

connectDB();

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// POST - Cadastra a URL no banco
app.post('/api/shorturl', async function (req, res) {
  let urlInput = req.body.url;
  let url;

  // Verifica formato da URL
  try {
    url = new URL(urlInput);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return res.json({ error: "invalid url" });
    }
  } catch (error) {
    return res.json({ error: "invalid url" });
  }

  // Valida com DNS
  dns.lookup(url.hostname, async (err, address) => {
    if (err || !address) {
      return res.json({ error: "invalid url" });
    }

    // Verifica se já existe no banco
    const existing = await urls.findOne({ url: urlInput });
    if (existing) {
      return res.json({
        original_url: existing.url,
        short_url: existing.short_url
      });
    }

    // Gera novo short_url (incremental)
    const last = await urls.find().sort({ short_url: -1 }).limit(1).toArray();
    const newShort = last.length ? last[0].short_url + 1 : 1;

    const doc = {
      url: urlInput,
      short_url: newShort
    };

    await urls.insertOne(doc);

    res.json({
      original_url: urlInput,
      short_url: newShort
    });
  });
});

// GET - Redireciona para a URL original
app.get('/api/shorturl/:short_url', async function (req, res) {
  const short = parseInt(req.params.short_url);

  const found = await urls.findOne({ short_url: short });

  if (found) {
    return res.redirect(found.url);
  } else {
    return res.json({ error: "No short URL found for given input" });
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
