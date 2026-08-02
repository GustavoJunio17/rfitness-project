"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkNotificationRead, useNotifications, useUnreadNotificationsCount } from "@/hooks/use-notifications";
import type { NotificationType } from "@/types/notifications";

const TYPE_LABELS: Record<NotificationType, string> = {
  NEW_ORDER: "Pedido",
  PAYMENT_RECEIVED: "Pagamento",
  LOW_STOCK: "Estoque baixo",
  NEW_STUDENT: "Novo aluno",
  IMPORTANT_MESSAGE: "Mensagem",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount } = useUnreadNotificationsCount();
  const { data: notifications, isPending: isNotificationsPending } = useNotifications();
  const markRead = useMarkNotificationRead();

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const hasUnread = Boolean(unreadCount && unreadCount > 0);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-red text-[10px] font-semibold text-white">
            {(unreadCount ?? 0) > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-border bg-card shadow-lg">
          <div className="border-b border-border p-3 text-sm font-semibold">Notificações</div>
          <div className="max-h-96 overflow-y-auto" aria-busy={isNotificationsPending}>
            {isNotificationsPending &&
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2 border-b border-border p-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            {!isNotificationsPending && (notifications ?? []).length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
            )}
            {notifications?.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.readAt && markRead.mutate(notification.id)}
                className={cn(
                  "block w-full border-b border-border p-3 text-left text-sm last:border-0 hover:bg-muted/50",
                  !notification.readAt && "bg-brand-red/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{notification.title}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[notification.type]}</span>
                </div>
                <p className="text-muted-foreground">{notification.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString("pt-BR")}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
