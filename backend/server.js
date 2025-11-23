// server.js — Node.js + Express + Socket.IO + better-sqlite3
// Segurança: NÃO aceite execução de comandos arbitrários.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_FILE = path.join(__dirname,'db.sqlite');
const db = new Database(DB_FILE);

// init
db.prepare('CREATE TABLE IF NOT EXISTS samples(id INTEGER PRIMARY KEY, input TEXT, label INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'..','frontend')));

// endpoint para receber lote de samples (cada sample: {x:[], y:0/1})
app.post('/api/samples', (req,res)=>{
  try{
    const body = req.body;
    const samples = body.samples || [];
    const insert = db.prepare('INSERT INTO samples(input,label) VALUES(?,?)');
    const insertMany = db.transaction((samps)=>{
      for(const s of samps){
        insert.run(JSON.stringify(s.x||s.input||[]), s.y ?? s.label ?? 0);
      }
    });
    insertMany(samples);
    // notifica via socket
    for(const s of samples) io.emit('new_sample', s);
    res.json({ok:true, inserted: samples.length});
  }catch(e){
    console.error(e);
    res.status(500).json({ok:false, error: e.message});
  }
});

app.get('/api/samples', (req,res)=>{
  const rows = db.prepare('SELECT id,input,label,created_at FROM samples ORDER BY id DESC LIMIT 1000').all();
  const parsed = rows.map(r=>({id:r.id, x: JSON.parse(r.input||'[]'), label:r.label, created_at:r.created_at}));
  res.json(parsed);
});

// simple limited server-side command via socket (only calculadora allowed)
io.on('connection', socket=>{
  console.log('socket connected', socket.id);
  socket.on('exec_command', (cmd, cb)=>{
    if(typeof cmd !== 'string') return cb({error:'invalid'});
    if(cmd.startsWith('calcular ')){
      try{
        const expr = cmd.slice(8).replace(/[^0-9.+\\-*/() %]/g,'');
        const result = Function(`"use strict"; return (${expr})`)();
        return cb({result});
      }catch(e){ return cb({error: e.message}); }
    }
    return cb({error:'comando não permitido'});
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`Servidor rodando na porta ${PORT}`));
