"use client";

import { FormEvent, useState } from "react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateStudent } from "@/hooks/use-students";

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentFormDialog({ open, onOpenChange }: StudentFormDialogProps) {
  const createStudent = useCreateStudent();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCpf("");
    setPhone("");
    setWhatsapp("");
    setEmail("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createStudent.mutateAsync({
        name,
        cpf: cpf || undefined,
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar o aluno.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Novo aluno</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="student-name">Nome</Label>
          <Input id="student-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="student-cpf">CPF</Label>
            <Input id="student-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-phone">Telefone</Label>
            <Input id="student-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-whatsapp">WhatsApp (usado pelo agente de IA)</Label>
          <Input
            id="student-whatsapp"
            placeholder="5511999999999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-email">E-mail</Label>
          <Input id="student-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="text-sm text-brand-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={createStudent.isPending}>
          {createStudent.isPending ? "Salvando..." : "Cadastrar"}
        </Button>
      </form>
    </Dialog>
  );
}
