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
