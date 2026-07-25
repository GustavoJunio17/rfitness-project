"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStudents } from "@/hooks/use-students";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { PlanFormDialog } from "@/components/students/plan-form-dialog";
import { StudentDetailDialog } from "@/components/students/student-detail-dialog";
import type { StudentStatus } from "@/types/students";

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
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Matrícula</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && (students ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum aluno encontrado.
              </TableCell>
            </TableRow>
          )}
          {students?.map((student) => (
            <TableRow key={student.id} className="cursor-pointer" onClick={() => setSelectedStudentId(student.id)}>
              <TableCell className="font-medium">{student.name}</TableCell>
              <TableCell>{student.whatsapp ?? student.phone ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={student.status === "ACTIVE" ? "default" : "outline"}>
                  {STATUS_LABELS[student.status]}
                </Badge>
              </TableCell>
              <TableCell>{new Date(student.enrollmentDate).toLocaleDateString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <StudentFormDialog open={isStudentFormOpen} onOpenChange={setStudentFormOpen} />
      <PlanFormDialog open={isPlanFormOpen} onOpenChange={setPlanFormOpen} />
      <StudentDetailDialog studentId={selectedStudentId} onOpenChange={(open) => !open && setSelectedStudentId(null)} />
    </div>
  );
}
