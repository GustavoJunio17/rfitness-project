"use client";

import { FormEvent, useState } from "react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateStudent } from "@/hooks/use-students";
import { maskCpf, maskPhone, onlyDigits } from "@/lib/masks";

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
      // A máscara fica na tela; o que é gravado são os dígitos. O agente de IA
      // procura o aluno pelo número que o WhatsApp entrega, e esse vem cru.
      await createStudent.mutateAsync({
        name,
        cpf: onlyDigits(cpf) || undefined,
        phone: onlyDigits(phone) || undefined,
        whatsapp: onlyDigits(whatsapp) || undefined,
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
            <Input
              id="student-cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-phone">Telefone</Label>
            <Input
              id="student-phone"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="student-whatsapp">WhatsApp (usado pelo agente de IA)</Label>
          <Input
            id="student-whatsapp"
            inputMode="tel"
            placeholder="+55 (11) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
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
