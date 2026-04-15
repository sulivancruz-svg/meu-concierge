const token = 'EAAR6NWsafDgBRDar2I5IHLEl9BCz2Ebpm4ub7yAVsYMQd8PiAdknrvZAJrPNvwmX5ZBPUsPciQuk6BomRGflQvsFCy2oAqBC6Ne02hALC1eLnNfIwTPYbZBSAcUJRCV10DRZCJ36815kqnL9UpdTsvyupUSOGfAhrMEjs1CTwdXN7ZCN1ZBc2iS9lZBsmPLY5ogdZAWNzfLgNAxfwtS3oJf1xZAiJZBWZCc9ZB8jZB5tuq6fzSq0SBhJo3x2iBbt1lumB1uz6U1OU3OBJjwLGpQjlYWjNCqOR7nobzsZALQssk';
const wabaId = '915222444460809';

// Verificar assinaturas atuais
console.log('Verificando assinaturas atuais...');
const getRes = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/subscribed_apps`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
console.log('GET:', JSON.stringify(await getRes.json(), null, 2));

// Assinar com campo messages explícito
console.log('\nAssinando campo messages...');
const postRes = await fetch(
  `https://graph.facebook.com/v19.0/${wabaId}/subscribed_apps?subscribed_fields=messages`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  }
);
console.log('POST:', JSON.stringify(await postRes.json(), null, 2));
