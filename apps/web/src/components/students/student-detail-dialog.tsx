"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { useAddGoal, useAddNote, useEnrollStudent, usePlans, useStudent, useToggleGoal } from "@/hooks/use-students";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  OVERDUE: "Inadimplente",
  SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado",
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function StudentDetailDialog({
  studentId,
  onOpenChange,
}: {
  studentId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: student, isPending } = useStudent(studentId);
  const { data: plans } = usePlans(true);
  const enrollStudent = useEnrollStudent();
  const addGoal = useAddGoal();
  const toggleGoal = useToggleGoal();
  const addNote = useAddNote();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [noteContent, setNoteContent] = useState("");

  if (!studentId) return null;

  async function handleEnroll() {
    if (!selectedPlanId || !studentId) return;
    await enrollStudent.mutateAsync({ studentId, planId: selectedPlanId });
    setSelectedPlanId("");
  }

  async function handleAddGoal() {
    if (!goalDescription.trim() || !studentId) return;
    await addGoal.mutateAsync({ studentId, description: goalDescription.trim() });
    setGoalDescription("");
  }

  async function handleAddNote() {
    if (!noteContent.trim() || !studentId) return;
    await addNote.mutateAsync({ studentId, content: noteContent.trim() });
    setNoteContent("");
  }

  return (
    <Dialog open={Boolean(studentId)} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{student?.name ?? <Skeleton className="h-6 w-48" />}</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      {isPending && (
        <div className="space-y-6" aria-busy>
          <Skeleton className="h-6 w-64" />
          {/* Plano, metas e observações: três seções de mesma forma. */}
          {[0, 1, 2].map((section) => (
            <section key={section} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <SkeletonList items={2} />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-28" />
              </div>
            </section>
          ))}
        </div>
      )}

      {student && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={student.status === "ACTIVE" ? "default" : "outline"}>
              {STATUS_LABELS[student.status]}
            </Badge>
            {student.whatsapp && <span>WhatsApp: {student.whatsapp}</span>}
            {student.email && <span>{student.email}</span>}
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Plano</h3>
            {student.subscriptions.length === 0 && (
              <p className="text-sm text-muted-foreground">Aluno ainda não foi matriculado em nenhum plano.</p>
            )}
            {student.subscriptions.map((sub) => (
              <div key={sub.id} className="flex justify-between rounded-md border border-border p-2 text-sm">
                <span>{sub.planName}</span>
                <span className="text-muted-foreground">
                  vence em {new Date(sub.dueDate).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
            <div className="flex gap-2">
              <Select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                <option value="">Selecione um plano</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {currency(Number(plan.price))}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={handleEnroll} disabled={!selectedPlanId || enrollStudent.isPending}>
                Matricular
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Metas</h3>
            {student.goals.map((goal) => (
              <div key={goal.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span className={goal.achieved ? "text-muted-foreground line-through" : ""}>{goal.description}</span>
                <Button
                  size="sm"
                  variant={goal.achieved ? "outline" : "default"}
                  onClick={() => toggleGoal.mutate({ goalId: goal.id, achieved: !goal.achieved, studentId })}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Nova meta"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
              />
              <Button size="sm" onClick={handleAddGoal} disabled={addGoal.isPending}>
                Adicionar
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Observações</h3>
            {student.studentNotes.map((note) => (
              <div key={note.id} className="rounded-md border border-border p-2 text-sm">
                <p>{note.content}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Nova observação"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <Button size="sm" onClick={handleAddNote} disabled={addNote.isPending}>
                Adicionar
              </Button>
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}
