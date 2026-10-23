// apps/web/lib/respondent-session.ts
//
// What a respondent's browser remembers for ONE form, in localStorage (shared across tabs, so a
// magic link opened in a new tab can hand the credential back to the tab that asked for it):
//   dockett:rv:<formId>    the credential from the email link (a signed token — the server decides if it is good)
//   dockett:rvn:<formId>   a random id of this fill attempt (lets a corrected email replace the earlier link)
//   dockett:code:<formId>  the access code they entered, so a magic-link tab doesn't ask again
// All access is wrapped: storage can be unavailable (private mode, blocked cookies).

const k = {
  token: (id: string) => `dockett:rv:${id}`,
  nonce: (id: string) => `dockett:rvn:${id}`,
  code: (id: string) => `dockett:code:${id}`,
};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the flow still works within this tab */
  }
}

export const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const respondentSession = {
  keyFor: k,
  getToken: (formId: string) => read(k.token(formId)),
  setToken: (formId: string, token: string) => write(k.token(formId), token),
  clearToken: (formId: string) => write(k.token(formId), null),
  /** Stable for this browser + form until the credential is issued. */
  getNonce: (formId: string) => {
    const existing = read(k.nonce(formId));
    if (existing) return existing;
    const fresh = randomId();
    write(k.nonce(formId), fresh);
    return fresh;
  },
  resetNonce: (formId: string) => {
    const fresh = randomId();
    write(k.nonce(formId), fresh);
    return fresh;
  },
  getCode: (formId: string) => read(k.code(formId)),
  setCode: (formId: string, code: string) => write(k.code(formId), code),
  clearCode: (formId: string) => write(k.code(formId), null),
};
