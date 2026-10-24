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
