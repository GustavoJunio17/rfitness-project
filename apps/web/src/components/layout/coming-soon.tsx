export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Este módulo será implementado na {phase}. A navegação e a autenticação já estão prontas.
      </p>
    </div>
  );
}
