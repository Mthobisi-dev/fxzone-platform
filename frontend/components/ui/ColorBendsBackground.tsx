export function ColorBendsBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 bg-[#05070d]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 15% 0%, rgba(37, 99, 235, 0.16), transparent 34%), radial-gradient(circle at 90% 12%, rgba(109, 40, 217, 0.12), transparent 30%)',
      }}
    />
  );
}
