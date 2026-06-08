export {
  createCommunicationLog,
  getCommsDashboardStats,
  listCommunicationLogs,
  logOutboundMessage,
  markCommunicationOpened,
} from "./communication.service";
export { logCommsContactClient } from "./client";
export { sendPropostaByEmail } from "./send-proposta.service";
export {
  fetchRecentGmailMessages,
  getGmailPublicStatus,
  openGmailThread,
  searchGmailByCliente,
} from "./gmail.service";
