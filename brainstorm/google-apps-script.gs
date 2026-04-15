// ID do documento que será atualizado
const DOC_ID = '1_AE1N6MVghahkNKFkePbjbpGAKE7oIkr65h_HEa6o8E';
const VALID_TOKEN = 'meu-concierge-brainstorm-2026';

function doPost(e) {
  try {
    // Validar token
    if (e.parameter.token !== VALID_TOKEN) {
      return jsonResponse(false, 'Token inválido');
    }

    const section = e.parameter.section || 'Ideias Gerais';
    const content = e.parameter.content;
    const author = e.parameter.author || 'Claude';

    if (!content) {
      return jsonResponse(false, 'Conteúdo não fornecido');
    }

    // Abrir documento
    const doc = DocumentApp.openById(DOC_ID);
    const body = doc.getBody();

    // Timestamp
    const timestamp = new Date().toLocaleString('pt-BR');
    const fullContent = `[${author} - ${timestamp}]\n${content}`;

    // Adicionar conteúdo no final
    body.appendParagraph(fullContent);

    // Salvar
    doc.saveAndClose();

    return jsonResponse(true, `Conteúdo adicionado à seção "${section}"`);

  } catch (error) {
    return jsonResponse(false, error.toString());
  }
}

function jsonResponse(success, message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: success,
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Função para testar localmente (opcional)
 */
function testAddContent() {
  const doc = DocumentApp.openById(DOC_ID);
  const body = doc.getBody();
  body.appendParagraph('\n');
  body.appendParagraph('Teste').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Este é um teste de adição de conteúdo.');
  doc.saveAndClose();
  Logger.log('Teste concluído!');
}
