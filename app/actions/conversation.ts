"use server";

import { revalidatePath } from "next/cache";
import type { MemoryPromotionChoice } from "@/lib/conversation/types";
import { buildConversationFocus } from "@/lib/conversation";
import * as svc from "@/lib/supabase/services/conversation.service";

function revalidateBrain() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/brain");
}

export async function startConversationAction(input?: {
  title?: string;
  focus?: Parameters<typeof buildConversationFocus>[0];
}) {
  const result = await svc.startConversation(input);
  revalidateBrain();
  return result;
}

export async function sendConversationMessageAction(input: {
  conversationId?: string | null;
  message: string;
  focus?: Parameters<typeof buildConversationFocus>[0];
  memoryChoice?: MemoryPromotionChoice;
}) {
  const result = await svc.sendConversationMessage(input);
  revalidateBrain();
  return result;
}

export async function confirmConversationActionAction(input: {
  conversationId: string;
  actionId: string;
}) {
  const result = await svc.confirmConversationAction(input);
  revalidateBrain();
  return result;
}

export async function cancelConversationActionAction(input: {
  conversationId: string;
  actionId: string;
}) {
  const result = await svc.cancelConversationAction(input);
  revalidateBrain();
  return result;
}

export async function listConversationsAction(opts?: {
  query?: string;
  includeArchived?: boolean;
}) {
  return svc.listConversations(opts);
}

export async function getConversationAction(id: string) {
  return svc.getConversation(id);
}

export async function updateConversationContextAction(input: {
  conversationId: string;
  focus: Parameters<typeof buildConversationFocus>[0];
}) {
  const result = await svc.updateConversationContext(input);
  revalidateBrain();
  return result;
}

export async function archiveConversationAction(id: string) {
  const result = await svc.archiveConversation(id);
  revalidateBrain();
  return result;
}

export async function deleteConversationAction(id: string) {
  const result = await svc.deleteConversation(id);
  revalidateBrain();
  return result;
}

export async function exportConversationAction(id: string) {
  return svc.exportConversation(id);
}

export async function explainConversationResponseAction(messageId: string) {
  return svc.explainConversationResponse(messageId);
}

export async function getHomeConversationWidgetAction() {
  return svc.getHomeConversationWidget();
}
