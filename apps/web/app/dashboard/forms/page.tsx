// apps/web/app/dashboard/forms/page.tsx

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, PencilLine, LogOut, Trash2 } from "lucide-react";

import { useCreateForm, useDeleteForm, useListForms } from "~/hooks/api/form";
import { useLogout } from "~/hooks/api/auth";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

export default function DashboardForms() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { createFormAsync, error, status } = useCreateForm();
  const { forms, isLoading } = useListForms();
  const { logoutAsync, isPending: isLoggingOut } = useLogout();
  const { deleteFormAsync } = useDeleteForm();

  const handleDeleteForm = async (formId: string) => {
    if (!confirm("Delete this form and all of its fields and submissions? This can't be undone."))
      return;
    await deleteFormAsync({ formId });
  };

  const handleLogout = async () => {
    await logoutAsync();
    router.push("/signin");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await createFormAsync({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
    });

    setOpen(false);
    setTitle("");
    setDescription("");
  };

  return (
    <main className="min-h-screen bg-black px-6 py-6 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">Forms</p>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-white/90">Create Form</Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Form</DialogTitle>
                  <DialogDescription className="text-white/60">
                    Add a title and optional description.
                  </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label htmlFor="title" className="text-sm text-white/70">
                      Title
                    </label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Form title"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm text-white/70">
                      Description
                    </label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Optional description"
                      className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                  </div>

                  {error ? <p className="text-sm text-red-400">{error.message}</p> : null}

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={status === "pending" || title.trim().length === 0}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      {status === "pending" ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <LogOut className="mr-2 size-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>

        <section className="grid gap-3">
          {isLoading ? (
            <div className="border border-white/10 bg-white/5 p-6 text-sm text-white/50">
              Loading forms...
            </div>
          ) : forms && forms.length > 0 ? (
            forms.map((form) => (
              <article key={form.id} className="border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-medium text-white">{form.title}</h2>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                        {form.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/60">{form.description || "No description"}</p>
                    <span className="block text-xs text-white/35">
                      {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href={`/form/${form.id}/submissions`} aria-label="View submissions">
                        <Eye className="size-4" />
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href={`/dashboard/forms/${form.id}`} aria-label="Edit form">
                        <PencilLine className="size-4" />
                      </Link>
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteForm(form.id)}
                      aria-label="Delete form"
                      className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="border border-white/10 bg-white/5 p-6 text-sm text-white/60">
              No forms yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
