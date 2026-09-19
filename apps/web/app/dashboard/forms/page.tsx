// apps/web/app/dashboard/forms/page.tsx

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, PencilLine, LogOut, Trash2 } from "lucide-react";

import { useCreateForm, useDeleteForm, useListForms } from "~/hooks/api/form";
import { useLogout } from "~/hooks/api/auth";
import { getFormTheme } from "~/lib/form-themes";

import { AppHeader } from "~/components/app-header";
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
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Forms</p>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            </div>

            <div className="flex items-center gap-2">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>Create Form</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Form</DialogTitle>
                    <DialogDescription>Add a title and optional description.</DialogDescription>
                  </DialogHeader>

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <label htmlFor="title" className="text-sm text-muted-foreground">
                        Title
                      </label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Form title"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="description" className="text-sm text-muted-foreground">
                        Description
                      </label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Optional description"
                        className="min-h-24"
                      />
                    </div>

                    {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={status === "pending" || title.trim().length === 0}
                      >
                        {status === "pending" ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut className="mr-2 size-4" />
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </div>

          <section className="grid gap-3">
            {isLoading ? (
              <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
                Loading forms...
              </div>
            ) : forms && forms.length > 0 ? (
              forms.map((form) => {
                const theme = getFormTheme(form.theme);
                return (
                  <article key={form.id} className="glass flex items-start gap-4 rounded-2xl p-5">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{ background: theme.accent }}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-medium">{form.title}</h2>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {form.status}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {form.description || "No description"}
                      </p>
                      <span className="block text-xs text-muted-foreground/70">
                        {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/form/${form.id}/submissions`} aria-label="View submissions">
                          <Eye className="size-4" />
                        </Link>
                      </Button>

                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/forms/${form.id}`} aria-label="Edit form">
                          <PencilLine className="size-4" />
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteForm(form.id)}
                        aria-label="Delete form"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
                No forms yet.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
