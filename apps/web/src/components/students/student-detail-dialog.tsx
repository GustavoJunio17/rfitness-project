"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import {
  useAddGoal,
  useAddNote,
  useDeleteStudent,
  useEnrollStudent,
  usePlans,
  useStudent,
  useToggleGoal,
  useUpdateStudentStatus,
} from "@/hooks/use-students";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { formatCpf, formatPhone } from "@/lib/masks";
import type { StudentStatus } from "@/types/students";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  OVERDUE: "Inadimplente",
  SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado",
};

/**
 * INADIMPLENTE fica de fora: é derivado das matrículas a cada leitura, então
 * marcá-lo à mão duraria só até o próximo carregamento da tela.
 */
const ASSIGNABLE_STATUSES: StudentStatus[] = ["ACTIVE", "SUSPENDED", "CANCELLED"];

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
  const updateStatus = useUpdateStudentStatus();
  const deleteStudent = useDeleteStudent();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  if (!studentId) return null;

  async function handleDelete() {
    if (!studentId) return;
    await deleteStudent.mutateAsync(studentId);
    // Fecha o detalhe junto: o aluno que ele mostra não existe mais.
    onOpenChange(false);
  }

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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={student.status === "ACTIVE" ? "default" : "outline"}>
                {STATUS_LABELS[student.status]}
              </Badge>
              {student.cpf && <span>CPF: {formatCpf(student.cpf)}</span>}
              {student.phone && <span>Tel.: {formatPhone(student.phone)}</span>}
              {student.whatsapp && <span>WhatsApp: {formatPhone(student.whatsapp)}</span>}
              {student.email && <span>{student.email}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-3 w-3" aria-hidden /> Editar
              </Button>

              <Select
                aria-label="Status do aluno"
                className="h-9 w-auto"
                value={ASSIGNABLE_STATUSES.includes(student.status) ? student.status : ""}
                onChange={(e) => updateStatus.mutate({ id: student.id, status: e.target.value as StudentStatus })}
                disabled={updateStatus.isPending}
              >
                {/* Inadimplente não é atribuível, mas é o estado atual de quem
                    venceu — precisa aparecer para o campo não mentir. */}
                {!ASSIGNABLE_STATUSES.includes(student.status) && (
                  <option value="">{STATUS_LABELS[student.status]}</option>
                )}
                {ASSIGNABLE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>

              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-brand-red hover:bg-brand-red/10 hover:text-brand-red"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-3 w-3" aria-hidden /> Excluir
              </Button>
            </div>
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

          <StudentFormDialog open={isEditOpen} onOpenChange={setEditOpen} student={student} />

          <ConfirmDialog
            open={isDeleteOpen}
            onOpenChange={setDeleteOpen}
            title="Excluir aluno"
            confirmLabel="Excluir aluno"
            description={
              <>
                <p>
                  <span className="font-medium">{student.name}</span> sai da academia junto com as
                  matrículas, metas e observações. Vendas e pedidos continuam no histórico, mas sem
                  o vínculo com o aluno.
                </p>
                <p>
                  Não dá para desfazer — e quem já tem fatura lançada não pode ser excluído. Para só
                  tirar da operação, use o status Cancelado.
                </p>
              </>
            }
            onConfirm={handleDelete}
          />
        </div>
      )}
    </Dialog>
  );
}
