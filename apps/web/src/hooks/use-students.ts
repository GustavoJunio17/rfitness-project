import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Plan, Student, StudentDetail, StudentStatus } from "@/types/students";

export function usePlans(activeOnly = false) {
  return useQuery({
    queryKey: ["plans", activeOnly],
    queryFn: () => apiFetch<Plan[]>(`/students/plans?activeOnly=${activeOnly}`),
  });
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  price: number;
  durationDays: number;
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) =>
      apiFetch<Plan>("/students/plans", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export interface StudentFilters {
  search?: string;
  status?: StudentStatus;
}

export function useStudents(filters: StudentFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();

  return useQuery({
    queryKey: ["students", filters],
    queryFn: () => apiFetch<Student[]>(`/students${query ? `?${query}` : ""}`),
  });
}

export function useStudent(id: string | null) {
  return useQuery({
    queryKey: ["student", id],
    queryFn: () => apiFetch<StudentDetail>(`/students/${id}`),
    enabled: Boolean(id),
  });
}

export interface CreateStudentInput {
  name: string;
  cpf?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  trainerName?: string;
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) =>
      apiFetch<Student>("/students", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });
}

/**
 * Edição, status e exclusão invalidam a lista *e* o detalhe: o painel de
 * detalhe costuma estar aberto por trás da ação, e sem isso ele continuaria
 * mostrando o aluno como estava antes de salvar.
 */
/**
 * `null` em vez de `undefined` nos opcionais: no PATCH parcial do servidor,
 * campo ausente significa "não mexe" e `null` significa "limpa". Sem essa
 * diferença não haveria como apagar um CPF digitado errado.
 */
export interface UpdateStudentInput {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateStudentInput) =>
      apiFetch<Student>(`/students/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", variables.id] });
    },
  });
}

export function useUpdateStudentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StudentStatus }) =>
      apiFetch<Student>(`/students/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", variables.id] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/students/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.removeQueries({ queryKey: ["student", id] });
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, planId }: { studentId: string; planId: string }) =>
      apiFetch(`/students/${studentId}/enroll`, { method: "POST", body: JSON.stringify({ planId }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student", variables.studentId] });
    },
  });
}

export function useAddGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, description }: { studentId: string; description: string }) =>
      apiFetch(`/students/${studentId}/goals`, { method: "POST", body: JSON.stringify({ description }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student", variables.studentId] });
    },
  });
}

export function useToggleGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, achieved }: { goalId: string; achieved: boolean; studentId: string }) =>
      apiFetch(`/students/goals/${goalId}`, { method: "PATCH", body: JSON.stringify({ achieved }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student", variables.studentId] });
    },
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, content }: { studentId: string; content: string }) =>
      apiFetch(`/students/${studentId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student", variables.studentId] });
    },
  });
}
