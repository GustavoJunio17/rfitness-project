export const WHATSAPP_GATEWAY = Symbol("WHATSAPP_GATEWAY");

export interface WhatsAppGateway {
  sendMessage(instanceName: string, phone: string, text: string): Promise<void>;
}
