import { ReactNode } from "react";

type JsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: JsonNode[];
};

const isSafeHref = (href: unknown): href is string => {
  if (typeof href !== "string") return false;

  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const applyMarks = (
  node: JsonNode,
  children: ReactNode,
  key: string
): ReactNode => {
  return (node.marks || []).reduce((content, mark, index) => {
    if (mark.type === "bold") {
      return <strong key={`${key}-bold-${index}`}>{content}</strong>;
    }

    if (mark.type === "italic") {
      return <em key={`${key}-italic-${index}`}>{content}</em>;
    }

    if (mark.type === "link" && isSafeHref(mark.attrs?.href)) {
      return (
        <a
          key={`${key}-link-${index}`}
          href={mark.attrs.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {content}
        </a>
      );
    }

    return content;
  }, children);
};

const renderNode = (node: JsonNode, key: string): ReactNode => {
  if (node.type === "text") {
    return applyMarks(node, node.text || "", key);
  }

  if (node.type === "mention") {
    const label =
      typeof node.attrs?.label === "string"
        ? node.attrs.label
        : typeof node.attrs?.id === "string"
          ? node.attrs.id
          : "member";

    return (
      <span
        key={key}
        className="rounded bg-primary/10 px-1.5 py-0.5 text-sm font-medium text-primary"
      >
        @{label}
      </span>
    );
  }

  if (node.type === "hardBreak") {
    return <br key={key} />;
  }

  const children = node.content?.map((child, index) =>
    renderNode(child, `${key}-${index}`)
  );

  if (node.type === "paragraph") {
    return (
      <p key={key} className="mb-2 last:mb-0">
        {children}
      </p>
    );
  }

  if (node.type === "doc") {
    return <>{children}</>;
  }

  return null;
};

export default function CommentRichRenderer({
  bodyJson,
}: {
  bodyJson: Record<string, unknown>;
}) {
  return (
    <div className="prose prose-sm max-w-none text-sm leading-6 text-foreground">
      {renderNode(bodyJson as JsonNode, "comment")}
    </div>
  );
}
