import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold">Not found</h1>
        <p className="mt-2 text-muted">That page or kit doesn&apos;t exist.</p>
        <ButtonLink href="/" className="mt-5">Go home</ButtonLink>
      </div>
    </main>
  );
}
