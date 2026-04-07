// Monde API types (JSON:API spec)

export type MondeTokenResponse = {
  data: {
    id: string;
    type: 'tokens';
    attributes: {
      token: string;
      login: string;
    };
  };
};

export type MondePersonAttributes = {
  name: string;
  'company-name': string | null;
  kind: 'F' | 'J';
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  'passport-number': string | null;
  'passport-expiration': string | null;
  'birth-date': string | null;
  gender: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  zip: string | null;
  phone: string | null;
  'business-phone': string | null;
  'mobile-phone': string | null;
  email: string | null;
  website: string | null;
  'state-inscription': string | null;
  'city-inscription': string | null;
  code: string | null;
  'registered-at': string | null;
  observations: string | null;
};

export type MondePersonResource = {
  id: string;
  type: 'people';
  attributes: MondePersonAttributes;
  relationships?: {
    city?: {
      data: { type: 'cities'; id: string } | null;
    };
    creator?: {
      data: { type: 'people'; id: string } | null;
    };
  };
};

export type MondePaginationLinks = {
  first?: string;
  last?: string;
  next?: string | null;
  previous?: string | null;
};

export type MondeListResponse<T> = {
  data: T[];
  links?: MondePaginationLinks;
  included?: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
};

export type MondeErrorResponse = {
  errors: Array<{
    title: string;
    detail: string;
    code: string;
    status: string;
  }>;
};

export type MondeSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ mondeId: string; name: string; error: string }>;
  durationMs: number;
};
