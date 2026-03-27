// ─── Extração de dados de documentos via IA ──────────────────────────────────
// Processa PDFs e imagens já convertidos em texto, extrai metadados estruturados.

import { anthropic, AI_MODEL } from './anthropic';

interface ExtractedDocumentData {
  extractedText: string;
  structuredMetadata: Record<string, unknown>;
}

const CATEGORY_PROMPTS: Record<string, string> = {
  FLIGHT: 'Extraia: número do voo, companhia, origem, destino, data/hora de partida, data/hora de chegada, PNR/localizador, classe, número de assentos, franquia de bagagem.',
  HOTEL: 'Extraia: nome do hotel, endereço, telefone, datas de check-in e check-out, número de noites, tipo de quarto, código de confirmação, regime de alimentação.',
  TRANSFER: 'Extraia: empresa, data/hora de pickup, local de embarque, local de destino, tipo de veículo, código de confirmação, telefone do motorista.',
  TOUR: 'Extraia: nome do passeio, data/hora, duração, ponto de encontro, empresa, código de confirmação, o que está incluído.',
  INSURANCE: 'Extraia: seguradora, número de apólice, período de cobertura, tipo de cobertura, telefone de emergência 24h, site de acionamento.',
  TRAIN: 'Extraia: operadora, número do trem, origem, destino, data/hora de partida, data/hora de chegada, classe, código de reserva.',
  VISA: 'Extraia: país, tipo de visto, número, datas de validade, número de entradas permitidas, portador.',
  VOUCHER: 'Extraia: serviço, fornecedor, datas, código de confirmação, observações importantes.',
  OTHER: 'Extraia todos os dados relevantes como datas, nomes, códigos, telefones e endereços.',
};

export async function extractDocumentData(
  text: string,
  category: string,
): Promise<ExtractedDocumentData> {
  const categoryPrompt = CATEGORY_PROMPTS[category] ?? CATEGORY_PROMPTS.OTHER;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Você é um assistente especializado em extrair dados de documentos de viagem.

DOCUMENTO:
${text.slice(0, 4000)}

TAREFA:
${categoryPrompt}

Retorne APENAS um JSON válido com os campos extraídos. Use null para campos não encontrados.
Exemplo: {"flightNumber": "LA706", "origin": "GRU", "destination": "CDG", "departureAt": "2025-07-14T08:30:00", "pnr": "ABCDEF"}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Resposta inválida da IA');

    // Extrair JSON da resposta
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    const structuredMetadata = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return { extractedText: text, structuredMetadata };
  } catch (err) {
    console.error('[extract-document] Erro:', err);
    return { extractedText: text, structuredMetadata: {} };
  }
}
