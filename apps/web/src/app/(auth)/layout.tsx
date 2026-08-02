export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-black px-4 py-10">
      {/* Brilho da marca ao fundo — decorativo, não interfere no contraste do cartão. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative z-10 animate-fade-in">{children}</div>
    </div>
  );
}
