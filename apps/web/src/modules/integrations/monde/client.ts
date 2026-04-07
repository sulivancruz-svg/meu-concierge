import { prisma } from '@/lib/db';
import { decryptMondePassword } from './crypto';
import type {
  MondeListResponse,
  MondePersonResource,
  MondeTokenResponse,
} from './types';

const MONDE_BASE_URL = 'https://web.monde.com.br/api/v2';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes (tokens expire at 60)
const JSON_API_HEADERS = {
  Accept: 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
};

// In-memory token cache per agency
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAgencyMondeCredentials(agencyId: string) {
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: { mondeLogin: true, mondePasswordEnc: true, mondeEnabled: true },
  });

  if (!agency.mondeEnabled || !agency.mondeLogin || !agency.mondePasswordEnc) {
    throw new Error('MONDE_NOT_CONFIGURED');
  }

  return {
    login: agency.mondeLogin,
    password: decryptMondePassword(agency.mondePasswordEnc),
  };
}

async function authenticate(login: string, password: string): Promise<string> {
  const res = await fetch(`${MONDE_BASE_URL}/tokens`, {
    method: 'POST',
    headers: JSON_API_HEADERS,
    body: JSON.stringify({
      data: {
        type: 'tokens',
        attributes: { login, password },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.errors?.[0]?.detail ?? body?.errors?.[0]?.title ?? 'Authentication failed';
    throw new Error(`MONDE_AUTH_ERROR: ${detail}`);
  }

  const json = (await res.json()) as MondeTokenResponse;
  return json.data.attributes.token;
}

export async function getMondeToken(agencyId: string): Promise<string> {
  const cached = tokenCache.get(agencyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const { login, password } = await getAgencyMondeCredentials(agencyId);
  const token = await authenticate(login, password);

  tokenCache.set(agencyId, {
    token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return token;
}

export function clearMondeTokenCache(agencyId: string) {
  tokenCache.delete(agencyId);
}

export async function fetchMondePeople(
  agencyId: string,
  page = 1,
  pageSize = 50,
): Promise<MondeListResponse<MondePersonResource>> {
  const token = await getMondeToken(agencyId);

  const url = `${MONDE_BASE_URL}/people?page[number]=${page}&page[size]=${pageSize}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...JSON_API_HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearMondeTokenCache(agencyId);
      throw new Error('MONDE_AUTH_EXPIRED');
    }
    throw new Error(`MONDE_FETCH_ERROR: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as MondeListResponse<MondePersonResource>;
}

export async function fetchAllMondePeople(agencyId: string): Promise<MondePersonResource[]> {
  const all: MondePersonResource[] = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const response = await fetchMondePeople(agencyId, page, pageSize);
    all.push(...response.data);

    if (!response.links?.next || response.data.length < pageSize) {
      break;
    }

    page++;
  }

  return all;
}

export async function testMondeConnection(
  login: string,
  password: string,
): Promise<{ ok: true; personCount: number } | { ok: false; error: string }> {
  try {
    const token = await authenticate(login, password);

    const res = await fetch(`${MONDE_BASE_URL}/people?page[number]=1&page[size]=1`, {
      method: 'GET',
      headers: {
        ...JSON_API_HEADERS,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { ok: false, error: `Erro ao acessar dados: ${res.status}` };
    }

    const json = (await res.json()) as MondeListResponse<MondePersonResource>;
    return { ok: true, personCount: json.data.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: message.replace('MONDE_AUTH_ERROR: ', '') };
  }
}
