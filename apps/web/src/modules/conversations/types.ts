export type ConversationListItem = {
  id: string;
  passengerId: string | null;
  passengerName: string | null;
  tripId: string | null;
  tripTitle: string | null;
  phone: string;
  status: string;
  contextSummary: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  lastMessage: {
    body: string;
    role: string;
    direction: string;
    createdAt: string;
  } | null;
};

export type ConversationMessageItem = {
  id: string;
  role: string;
  direction: string;
  channel: string;
  body: string;
  createdAt: string;
  waStatus: string | null;
  waErrorCode: string | null;
  waErrorMsg: string | null;
  waMessageId: string | null;
  payload: Record<string, unknown> | null;
  suggestions: Array<{
    id: string;
    title: string;
    categoryLabel: string;
    downloadUrl: string | null;
  }>;
};

export type ConversationDetail = ConversationListItem & {
  messages: ConversationMessageItem[];
};
