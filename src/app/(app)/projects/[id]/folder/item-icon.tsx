import type { ReactNode } from "react";
import { classifyMimeType } from "@/lib/files";

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      {children}
    </svg>
  );
}

export function FolderIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M3.75 4.5A1.5 1.5 0 0 1 5.25 3h4.19c.398 0 .78.158 1.06.44l1.31 1.31c.281.281.663.44 1.06.44h6.128a1.5 1.5 0 0 1 1.5 1.5v.75H3.75V4.5Z" />
      <path
        fillRule="evenodd"
        d="M2.25 9.75a.75.75 0 0 1 .75-.75h18a.75.75 0 0 1 .75.75v8.25a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V9.75Z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export function ImageIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path
        fillRule="evenodd"
        d="M1.5 6A2.25 2.25 0 0 1 3.75 3.75h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6Zm1.5 0v10.94l4.72-4.72a.75.75 0 0 1 1.06 0l4.94 4.94 3.22-3.22a.75.75 0 0 1 1.06 0L21 16.94V6a.75.75 0 0 0-.75-.75H3.75A.75.75 0 0 0 3 6Zm14.25 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export function VideoIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path
        fillRule="evenodd"
        d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 18.375V5.625ZM10.5 8.75a.75.75 0 0 1 1.14-.64l4.5 2.75a.75.75 0 0 1 0 1.28l-4.5 2.75a.75.75 0 0 1-1.14-.64v-5.5Z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export function DocumentIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path
        fillRule="evenodd"
        d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export function NoteIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path
        fillRule="evenodd"
        d="M4.5 2.25a.75.75 0 0 0-.75.75v18a.75.75 0 0 0 .75.75h15a.75.75 0 0 0 .75-.75V6.31a.75.75 0 0 0-.22-.53l-4.06-4.06a.75.75 0 0 0-.53-.22H4.5Zm2.25 9a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm.75 3.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5h-6Z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export function ItemTypeIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  const kind = classifyMimeType(mimeType);
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "video") return <VideoIcon className={className} />;
  if (kind === "note") return <NoteIcon className={className} />;
  return <DocumentIcon className={className} />;
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.507l-3 .8a.5.5 0 0 1-.612-.613l.8-3a2 2 0 0 1 .506-.878l8.5-8.5a2 2 0 0 1 .356-.244Z" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function MoveIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Points right (▸) by default; rotate 90deg via the caller's className when
// a section is open (▾).
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Six-dot grip (⠿) — the drag handle for reordering blocks. pointer-events-
// none so a click that lands on the SVG itself still starts the *parent*
// div's drag gesture, rather than the icon intercepting the mousedown.
export function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`pointer-events-none ${className ?? ""}`}
    >
      <circle cx="7" cy="4" r="1.4" />
      <circle cx="13" cy="4" r="1.4" />
      <circle cx="7" cy="10" r="1.4" />
      <circle cx="13" cy="10" r="1.4" />
      <circle cx="7" cy="16" r="1.4" />
      <circle cx="13" cy="16" r="1.4" />
    </svg>
  );
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.5 7.134a1 1 0 0 1 1.512-.858l4 2.402a1 1 0 0 1 0 1.716l-4 2.402A1 1 0 0 1 8.5 12v-4.866Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 3a.75.75 0 0 1 .75.75v8.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.75A.75.75 0 0 1 10 3ZM3.75 15a.75.75 0 0 0-.75.75v.5A2.75 2.75 0 0 0 5.75 19h8.5A2.75 2.75 0 0 0 17 16.25v-.5a.75.75 0 0 0-1.5 0v.5c0 .69-.56 1.25-1.25 1.25h-8.5C5.06 17.5 4.5 16.94 4.5 16.25v-.5a.75.75 0 0 0-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Mobile-only "Tabs" drawer toggle (hamburger).
export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M2.5 5.75A.75.75 0 0 1 3.25 5h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75ZM2.5 10a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25A.75.75 0 0 1 2.5 10Zm0 4.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Closes the mobile "Tabs" drawer.
export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
