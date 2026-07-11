import { notFound } from "next/navigation";
import { fetchContractById } from "@/lib/contracts";
import EditForm from "./EditForm";
import Breadcrumb from "@/app/components/breadcrumb";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await fetchContractById(id);
  if (!contract) return notFound();
  const mongoConfigured = Boolean(process.env.MONGODB_URI);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 pt-4 pb-12">
      <Breadcrumb
        items={[
          { label: "Contracte", href: "/contracts" },
          { label: contract.name, href: `/contracts/${contract.id}` },
          { label: "Editare" },
        ]}
      />
      <div className="mt-2 mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Editează contract
          </h1>
          <p className="mt-1 text-sm text-foreground/60">{contract.name}</p>
        </div>
        <span
          className="rounded-md bg-foreground/5 px-2 py-1 font-mono text-[11px] text-foreground/50"
          title="ID contract"
        >
          {contract.id}
        </span>
      </div>
      {!mongoConfigured && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          MongoDB nu este configurat. Completați variabila MONGODB_URI în .env
          pentru a salva.
        </p>
      )}
      <EditForm contract={contract} mongoConfigured={mongoConfigured} />
    </main>
  );
}
