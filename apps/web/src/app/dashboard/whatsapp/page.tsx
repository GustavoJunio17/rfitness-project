"use client";

import { FormEvent, useState } from "react";
import { Bot, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonList } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useConversation, useConversations, useUpdateWhatsAppSettings } from "@/hooks/use-whatsapp";
import { useSession } from "@/hooks/use-session";

export default function WhatsAppPage() {
  const { data: session } = useSession();
  const isAdmin = session?.roles.includes("ADMIN") ?? false;

  const { data: conversations, isLoading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: conversation, isPending: isConversationPending } = useConversation(selectedId);

  const [instanceName, setInstanceName] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const updateSettings = useUpdateWhatsAppSettings();

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    setSettingsMessage(null);
    try {
      await updateSettings.mutateAsync(instanceName);
      setSettingsMessage("Instância salva.");
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agente de IA no WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          O aluno não tem login no sistema — toda a interação dele acontece por aqui, pelo WhatsApp.
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração da instância (Evolution API)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSaveSettings} className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="instance-name">Nome da instância</Label>
                <Input
                  id="instance-name"
                  placeholder="rfitness-demo"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={updateSettings.isPending || !instanceName}>
                {updateSettings.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
            {settingsMessage && <p className="text-sm text-muted-foreground">{settingsMessage}</p>}
            <p className="text-xs text-muted-foreground">
              Configure o webhook da sua instância no Evolution API para apontar para{" "}
              <code className="rounded bg-muted px-1">
                {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/whatsapp/webhook?token=&lt;EVOLUTION_API_KEY&gt;
              </code>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversas</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[32rem] space-y-1 overflow-y-auto p-2" aria-busy={isLoading}>
            {isLoading && <SkeletonList items={5} />}
            {!isLoading && (conversations ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                Nenhuma conversa ainda. Assim que um contato escrever no WhatsApp, ela aparece aqui.
              </p>
            )}
            {conversations?.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full rounded-md p-3 text-left text-sm hover:bg-muted",
                  selectedId === item.id && "bg-muted",
                )}
              >
                <p className="font-medium">{item.studentName ?? item.phone}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.lastMessage ?? "Sem mensagens"}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{conversation ? conversation.phone : "Selecione uma conversa"}</CardTitle>
          </CardHeader>
          <CardContent
            className="max-h-[32rem] space-y-3 overflow-y-auto"
            aria-busy={Boolean(selectedId) && isConversationPending}
          >
            {/* Só com conversa escolhida: sem seleção o estado correto é o convite
                para escolher uma, não um skeleton que nunca vai carregar. */}
            {selectedId && isConversationPending && <SkeletonList items={4} withAvatar />}
            {conversation?.messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-2", message.direction === "OUTBOUND" && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    message.direction === "OUTBOUND" ? "bg-brand-red text-white" : "bg-muted",
                  )}
                >
                  {message.direction === "OUTBOUND" ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                </div>
                <div
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    message.direction === "OUTBOUND" ? "bg-brand-red/10" : "bg-muted",
                  )}
                >
                  <p>{message.content}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(message.createdAt).toLocaleString("pt-BR")}</span>
                    {message.handledByAi && <Badge variant="outline">IA</Badge>}
                  </div>
                </div>
              </div>
            ))}
            {!selectedId && (
              <p className="text-sm text-muted-foreground">Escolha uma conversa na lista ao lado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
