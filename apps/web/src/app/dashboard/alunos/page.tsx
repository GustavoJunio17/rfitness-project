"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTableRows } from "@/components/ui/skeleton";
import { useDeleteStudent, useStudents } from "@/hooks/use-students";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { PlanFormDialog } from "@/components/students/plan-form-dialog";
import { StudentDetailDialog } from "@/components/students/student-detail-dialog";
import type { Student, StudentStatus } from "@/types/students";
import { formatCpf, formatPhone } from "@/lib/masks";

const STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: "Ativo",
  OVERDUE: "Inadimplente",
  SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado",
};

export default function AlunosPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StudentStatus | "">("");
  const [isStudentFormOpen, setStudentFormOpen] = useState(false);
  const [isPlanFormOpen, setPlanFormOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  const deleteStudent = useDeleteStudent();
  const { data: students, isLoading } = useStudents({
    search: search || undefined,
    status: status || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-sm text-muted-foreground">
            Painel administrativo — o aluno não tem login; toda interação dele acontece pelo WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPlanFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo plano
          </Button>
          <Button onClick={() => setStudentFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo aluno
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as StudentStatus | "")}
          className="max-w-xs"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Matrícula</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={isLoading}>
          {isLoading && <SkeletonTableRows rows={6} columns={6} />}
          {!isLoading && (students ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum aluno encontrado.
              </TableCell>
            </TableRow>
          )}
          {students?.map((student) => (
            <TableRow key={student.id} className="cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
              <TableCell className="font-medium">{student.name}</TableCell>
              <TableCell>{formatCpf(student.cpf) ?? "—"}</TableCell>
              <TableCell>{formatPhone(student.whatsapp ?? student.phone) ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={student.status === "ACTIVE" ? "default" : "outline"}>
                  {STATUS_LABELS[student.status]}
                </Badge>
              </TableCell>
              <TableCell>{new Date(student.enrollmentDate).toLocaleDateString("pt-BR")}</TableCell>
              {/* `stopPropagation`: a linha inteira abre o detalhe, e sem isso
                  editar ou excluir abriria o painel por baixo do formulário. */}
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Editar ${student.name}`}
                    onClick={() => setEditingStudent(student)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Excluir ${student.name}`}
                    className="text-brand-red hover:bg-brand-red/10 hover:text-brand-red"
                    onClick={() => setDeletingStudent(student)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <StudentFormDialog open={isStudentFormOpen} onOpenChange={setStudentFormOpen} />
      <StudentFormDialog
        open={Boolean(editingStudent)}
        onOpenChange={(open) => !open && setEditingStudent(null)}
        student={editingStudent}
      />
      <PlanFormDialog open={isPlanFormOpen} onOpenChange={setPlanFormOpen} />
      <StudentDetailDialog studentId={selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)} />

      <ConfirmDialog
        open={Boolean(deletingStudent)}
        onOpenChange={(open) => !open && setDeletingStudent(null)}
        title="Excluir aluno"
        confirmLabel="Excluir aluno"
        description={
          <>
            <p>
              <span className="font-medium">{deletingStudent?.name}</span> sai da academia junto com
              as matrículas, metas e observações. Vendas e pedidos continuam no histórico, mas sem o
              vínculo com o aluno.
            </p>
            <p>
              Não dá para desfazer — e quem já tem fatura lançada não pode ser excluído. Para só
              tirar da operação, use o status Cancelado.
            </p>
          </>
        }
        onConfirm={async () => {
          if (deletingStudent) await deleteStudent.mutateAsync(deletingStudent.id);
        }}
      />
    </div>
  );
}
