"use client";

import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateStudent, useUpdateStudent } from "@/hooks/use-students";
import { isValidCpf, maskCpf, maskPhone, onlyDigits } from "@/lib/masks";
import type { Student } from "@/types/students";

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente: cadastro. Presente: edição do aluno já gravado. */
  student?: Student | null;
}

const EMPTY = { name: "", cpf: "", phone: "", whatsapp: "", email: "" };

export function StudentFormDialog({ open, onOpenChange, student = null }: StudentFormDialogProps) {
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(student);
  const saving = createStudent.isPending || updateStudent.isPending;

  // Ao abrir, carrega o aluno em edição (o banco guarda dígitos, então a
  // máscara é reaplicada aqui) ou zera para um cadastro novo. Sem isso o
  // formulário reabriria com o que sobrou da vez anterior.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      student
        ? {
            name: student.name,
            cpf: maskCpf(student.cpf ?? ""),
            phone: maskPhone(student.phone ?? ""),
            whatsapp: maskPhone(student.whatsapp ?? ""),
            email: student.email ?? "",
          }
        : EMPTY,
    );
  }, [open, student]);

  function set<K extends keyof typeof EMPTY>(field: K, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // O CPF só é cobrado quando está completo: reclamar dos 11 dígitos enquanto
  // a pessoa digita o terceiro seria erro em cima de campo que ainda vai ficar
  // certo. Em branco também passa — CPF é opcional no cadastro.
  const cpfDigits = onlyDigits(form.cpf);
  const cpfInvalid = cpfDigits.length === 11 && !isValidCpf(cpfDigits);
  const cpfIncomplete = cpfDigits.length > 0 && cpfDigits.length < 11;
  const cpfValid = cpfDigits.length === 11 && !cpfInvalid;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (cpfDigits.length > 0 && !cpfValid) {
      setError("Confira o CPF: os dígitos verificadores não batem.");
      return;
    }

    try {
      if (student) {
        // Campo apagado vira `null` para limpar o que estava gravado;
        // `undefined` faria o servidor manter o valor antigo.
        await updateStudent.mutateAsync({
          id: student.id,
          name: form.name,
          cpf: cpfDigits || null,
          phone: onlyDigits(form.phone) || null,
          whatsapp: onlyDigits(form.whatsapp) || null,
          email: form.email || null,
        });
      } else {
        await createStudent.mutateAsync({
          name: form.name,
          cpf: cpfDigits || undefined,
          phone: onlyDigits(form.phone) || undefined,
          whatsapp: onlyDigits(form.whatsapp) || undefined,
          email: form.email || undefined,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Não foi possível ${isEdit ? "salvar as alterações" : "cadastrar o aluno"}.`,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar aluno" : "Novo aluno"}</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="student-name">Nome</Label>
          <Input
            id="student-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="student-cpf">CPF</Label>
            <Input
              id="student-cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={form.cpf}
              onChange={(e) => set("cpf", maskCpf(e.target.value))}
              aria-invalid={cpfInvalid || undefined}
              aria-describedby="student-cpf-hint"
              className={cpfInvalid ? "border-brand-red focus-visible:ring-brand-red" : undefined}
            />
            {/* `aria-live`: o aviso aparece sem recarregar nem sair do campo,
                então quem usa leitor de tela precisa ser avisado da mudança. */}
            <p
              id="student-cpf-hint"
              aria-live="polite"
              className={`text-xs ${cpfInvalid ? "text-brand-red" : "text-muted-foreground"}`}
            >
              {cpfInvalid && "CPF inválido — confira os dígitos."}
              {cpfIncomplete && "Faltam dígitos."}
              {cpfValid && "CPF válido."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-phone">Telefone</Label>
            <Input
              id="student-phone"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={(e) => set("phone", maskPhone(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-whatsapp">WhatsApp (usado pelo agente de IA)</Label>
          <Input
            id="student-whatsapp"
            inputMode="tel"
            placeholder="+55 (11) 99999-9999"
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-email">E-mail</Label>
          <Input
            id="student-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving || cpfInvalid}>
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </form>
    </Dialog>
  );
}
