// Simula um POST do Meta para o webhook local
const webhookUrl = 'http://localhost:3001/api/webhooks/whatsapp';
const phone = '5541991872016'; // seu número sem +

const payload = {
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: phone,
          id: 'test-msg-' + Date.now(),
          type: 'text',
          text: { body: 'Olá, qual é o meu hotel?' },
        }],
      },
    }],
  }],
};

console.log(`Enviando mensagem de teste para ${webhookUrl}...`);
const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('Status:', res.status);
console.log('Resposta:', await res.text());
