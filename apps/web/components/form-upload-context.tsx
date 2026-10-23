// apps/web/components/form-upload-context.tsx
//
// FILE_UPLOAD fields need to know which form they belong to (and its access code, and whether
// they are being shown in the builder's preview). Template shells render fields through
// FormFieldRenderer without knowing about uploads, so that context travels via React context
// instead of through every shell's props.

"use client";

import { createContext, useContext, type ReactNode } from "react";

interface FormUploadContextValue {
  formId: string | null;
  accessCode?: string;
  /** Credential from the respondent's email magic link (verified-email forms). */
  respondentToken?: string;
  /** Builder preview: show the widget but don't upload anything. */
  isPreview: boolean;
}

const Ctx = createContext<FormUploadContextValue>({ formId: null, isPreview: true });

export function FormUploadProvider({
  formId,
  accessCode,
  respondentToken,
  isPreview = false,
  children,
}: {
  formId: string | null;
  accessCode?: string;
  respondentToken?: string;
  isPreview?: boolean;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ formId, accessCode, respondentToken, isPreview }}>{children}</Ctx.Provider>;
}

export const useFormUpload = () => useContext(Ctx);
