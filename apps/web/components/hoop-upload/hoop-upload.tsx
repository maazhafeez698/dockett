"use client";

import { useEffect, useRef } from "react";
import "./tokens.css";
import {
  createHoopUpload,
  type HoopUploadHandle,
  type HoopUploadOptions,
  type HuFileLike,
  type HuTheme,
} from "./engine";

export type { HuFileLike, HuTheme, HoopUploadOptions };

export type HoopUploadProps = Partial<HoopUploadOptions> & {
  className?: string;
};

/**
 * Options that must stay live (callbacks) are read through a ref, so a new function identity on
 * re-render never re-creates the widget. Everything else is read once at mount: change `key` to
 * re-mount with new limits.
 */
export function HoopUpload({ className, ...options }: HoopUploadProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HoopUploadHandle | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const o = latest.current;
    const hu = createHoopUpload(host, {
      ...o,
      upload: o.upload ? (f, p) => latest.current.upload!(f, p) : null,
      onUploaded: (f, r) => latest.current.onUploaded?.(f, r),
      onRemove: (f, r) => latest.current.onRemove?.(f, r),
      onReject: (f, why) => latest.current.onReject?.(f, why),
      onBusyChange: (b) => latest.current.onBusyChange?.(b),
    });
    handleRef.current = hu;
    return () => {
      hu.destroy();
      handleRef.current = null;
    };
    // Mount once; see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setDisabled(!!options.disabled);
  }, [options.disabled]);

  useEffect(() => {
    handleRef.current?.setShotMode(!!options.shotMode);
  }, [options.shotMode]);

  useEffect(() => {
    if (options.theme) handleRef.current?.setTheme(options.theme);
  }, [options.theme]);

  return <div ref={hostRef} className={className} />;
}
