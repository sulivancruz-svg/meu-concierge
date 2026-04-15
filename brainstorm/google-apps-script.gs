// ID do documento que será atualizado
const DOC_ID = '1_AE1N6MVghahkNKFkePbjbpGAKE7oIkr65h_HEa6o8E';

/**
 * Adiciona conteúdo ao documento Google Docs
 * @param {string} section - Seção do documento (ex: "Ideias", "Implementações")
 * @param {string} content - Conteúdo a adicionar
 * @param {string} token - Token de segurança
 */
function doPost(e) {
  try {
    // Verificar token de segurança
    const validToken = 'meu-concierge-brainstorm-2026';
    const providedToken = e.parameter.token;

    if (providedToken !== validToken) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Token inválido'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const section = e.parameter.section || 'Ideias Gerais';
    const content = e.parameter.content;
    const author = e.parameter.author || 'Claude';

    if (!content) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Conteúdo não fornecido'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Abrir documento
    const doc = DocumentApp.openById(DOC_ID);
    const body = doc.getBody();

    // Procurar ou criar seção
    let sectionFound = false;
    const paragraphs = body.getParagraphs();
    let insertIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].getText();
      if (text.includes(section)) {
        sectionFound = true;
        insertIndex = i + 1;
        break;
      }
    }

    // Se seção não existe, criar nova
    if (!sectionFound) {
      body.appendParagraph('\n');
      body.appendParagraph(section).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      insertIndex = body.getParagraphs().length - 1;
    }

    // Adicionar timestamp
    const timestamp = new Date().toLocaleString('pt-BR');
    const fullContent = `[${author} - ${timestamp}]\n${content}`;

    // Inserir conteúdo
    const element = body.insertParagraph(insertIndex, fullContent);
    element.setSpacing(DocumentApp.SpacingAttribute.LINE_SPACING, 1.15);

    // Salvar documento
    doc.saveAndClose();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Conteúdo adicionado à seção "${section}"`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
