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
    // storage unavailable: the flow still works within this tab 
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
