// app.js — Frontend avançado: coleta de samples, treino local TF.js (opcional) e integração Socket.IO.
// Requisitos: tensorflow.js (cdn) e socket.io client (cdn) incluídos no index.html

const logEl = document.getElementById('log');
const inputEl = document.getElementById('input');
const labelEl = document.getElementById('label');
const addSampleBtn = document.getElementById('addSample');
const trainLocalBtn = document.getElementById('trainLocal');
const uploadSamplesBtn = document.getElementById('uploadSamples');

const socket = (typeof io !== 'undefined') ? io() : null;
const samples = []; // {x: [num,...], y: 0/1}

// util
function log(...args){
  logEl.textContent += args.join(' ') + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

// adiciona sample local
addSampleBtn.addEventListener('click', ()=>{
  const raw = inputEl.value.trim();
  const lbl = parseInt(labelEl.value || '0');
  if(!raw){ log('Entrada vazia'); return; }
  const x = raw.split(',').map(s=>parseFloat(s.trim())||0);
  samples.push({x, y: lbl});
  log('Sample adicionado:', JSON.stringify({x,y:lbl}));
  inputEl.value = '';
  labelEl.value = '';
});

// enviar samples ao servidor
uploadSamplesBtn.addEventListener('click', async ()=>{
  if(!samples.length){ log('Nenhum sample para enviar'); return; }
  try{
    const res = await fetch('/api/samples', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({samples})
    });
    const j = await res.json();
    if(j.ok) { log('Samples enviados ao servidor.'); samples.length = 0; }
    else log('Erro do servidor:', JSON.stringify(j));
  }catch(e){ log('Erro fetch:', e.message); }
});

// TREINO LOCAL (TF.js)
trainLocalBtn.addEventListener('click', async ()=>{
  if(typeof tf === 'undefined'){ log('TensorFlow.js não carregado.'); return; }
  if(samples.length === 0){ log('Sem samples locais para treinar.'); return; }

  // Assumimos entradas de mesmo tamanho
  const inputDim = samples[0].x.length;
  const xs = tf.tensor2d(samples.map(s=>s.x));
  const ys = tf.tensor2d(samples.map(s=>[s.y]));

  const model = tf.sequential();
  model.add(tf.layers.dense({units:16, activation:'relu', inputShape:[inputDim]}));
  model.add(tf.layers.dense({units:1, activation:'sigmoid'}));
  model.compile({optimizer: tf.train.adam(0.01), loss:'binaryCrossentropy', metrics:['accuracy']});

  log('Iniciando treino local...');
  await model.fit(xs, ys, {
    epochs: 30,
    batchSize: Math.min(32, samples.length),
    callbacks: {
      onEpochEnd: (epoch, logs)=> log(`ep:${epoch} loss:${logs.loss.toFixed(4)} acc:${(logs.acc||logs.accuracy||0).toFixed(4)}`)
    }
  });
  // salvar em IndexedDB
  await model.save('indexeddb://agent-model');
  log('Treino finalizado e modelo salvo em IndexedDB (indexeddb://agent-model)');
  xs.dispose(); ys.dispose();
});

// escutar eventos do servidor via socket (ex: new_sample)
if(socket){
  socket.on('connect', ()=> log('Socket conectado ao servidor.'));
  socket.on('new_sample', data => log('Novo sample no servidor:', JSON.stringify(data)));
}

// interpretação de comando simples (para UI)
window.interpretCommand = function(command){
  command = command.trim();
  if(!command) return log('Comando vazio');
  // calcular
  let m = command.match(/^calcular\s+(.+)$/i);
  if(m){
    try{
      const safe = m[1].replace(/[^0-9.+\-*/() %]/g,'');
      const res = Function(`"use strict"; return (${safe})`)();
      return log('Resultado:', res);
    }catch(e){ return log('Erro ao calcular:', e.message); }
  }
  // criar arquivo no cliente
  m = command.match(/^criar arquivo\s+([^\s]+)\s+com\s+([\s\S]+)$/i);
  if(m){
    const filename = m[1];
    const content = m[2];
    const blob = new Blob([content], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.textContent = `Download ${filename}`;
    document.body.appendChild(a);
    return log('Arquivo criado no cliente (link adicionado):', filename);
  }
  log('Comando não reconhecido. Exemplos: "calcular 2+2", "criar arquivo teste.txt com Olá"');
};
