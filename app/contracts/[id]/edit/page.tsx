import Link from "next/link";
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
    <main className="min-h-screen px-4 sm:px-6 py-10 flex items-start sm:items-center justify-center">
      <div className="w-full max-w-xl">
        <Breadcrumb
          items={[
            { label: "Contracte", href: "/contracts" },
            { label: contract.name, href: `/contracts/${contract.id}` },
            { label: "Editare" },
          ]}
        />
        <div className="mb-6">
          <h1 className="text-center text-2xl sm:text-3xl font-bold">
            Editează contract
          </h1>
        </div>
        {!mongoConfigured && (
          <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
            MongoDB nu este configurat. Completați variabila MONGODB_URI în .env
            pentru a salva.
          </p>
        )}
        <EditForm contract={contract} mongoConfigured={mongoConfigured} />
      </div>
    </main>
  );
}
