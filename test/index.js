const veko = require('..');
const app = veko();

// Configuration du moteur de rendu
app.set('views', './test/views');
app.set('view engine', 'html');

// Route avec logs détaillés mais plus simple
app.get('/', (req, res) => {
  console.log('🚀 Route / appelée');
  console.log('📝 Request details:', {
    method: req.method,
    url: req.url,
    path: req.path,
    headers: Object.keys(req.headers)
  });
  
    res.refnder('home', { 
      title: 'Accueil Veko',
      message: 'Bienvenue sur votre application Veko.js !'
    });
    console.log('✅ Response sent successfully');
});

app.get('/simple', (req, res) => {
  console.log('🔧 Route /simple appelée');
  res.send('<h1>Route simple qui marche !</h1>');
});

app.get('/api/test', (req, res) => {
  console.log('🔧 Route API appelée');
  res.json({ 
    message: 'API endpoint works!', 
    timestamp: new Date().toISOString(),
    port: 3001
  });
});

console.log('🚀 Démarrage du serveur Veko...');
app.listen(3001, () => {
  console.log('✅ Serveur démarré sur http://localhost:3001');
  console.log('🔗 Test simple: http://localhost:3001/simple');
  console.log('🔗 Test API: http://localhost:3001/api/test');
  console.log('🔗 Test principal: http://localhost:3001/');
});