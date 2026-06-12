import { useEffect, useMemo, useState } from "react";
import { EditorContent, JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import { AtSign, Bold, Italic, Link2, Loader, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AllMembersInWorkspaceResponseType } from "@/types/api.type";

type CommentEditorSubmitValue = {
  bodyJson: Record<string, unknown>;
  plainText: string;
};

type CommentEditorProps = {
  members: AllMembersInWorkspaceResponseType["members"];
  initialBodyJson?: Record<string, unknown>;
  submitLabel?: string;
  isSubmitting?: boolean;
  compact?: boolean;
  onSubmit: (value: CommentEditorSubmitValue) => void;
  onCancel?: () => void;
};

const emptyDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

export default function CommentEditor({
  members,
  initialBodyJson,
  submitLabel = "Comment",
  isSubmitting = false,
  compact = false,
  onSubmit,
  onCancel,
}: CommentEditorProps) {
  const [plainText, setPlainText] = useState("");
  const [mentionUserId, setMentionUserId] = useState("");

  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => member.userId?._id)
        .map((member) => ({
          id: member.userId._id,
          label: member.userId.name || member.userId.email,
        })),
    [members]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
        strike: false,
      }),
      Link.configure({
        autolink: false,
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary",
        },
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
      }),
    ],
    content: (initialBodyJson as JSONContent) || emptyDoc,
    editorProps: {
      attributes: {
        class:
          "min-h-[88px] max-h-56 overflow-y-auto rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
      },
    },
    onUpdate({ editor }) {
      setPlainText(editor.getText().trim());
    },
  });

  useEffect(() => {
    if (editor) {
      setPlainText(editor.getText().trim());
    }
  }, [editor]);

  const addLink = () => {
    if (!editor) return;

    const href = window.prompt("Paste link URL");
    if (!href) return;

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const insertMention = () => {
    if (!editor || !mentionUserId) return;

    const member = memberOptions.find((option) => option.id === mentionUserId);
    if (!member) return;

    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "mention",
          attrs: {
            id: member.id,
            label: member.label,
          },
        },
        { type: "text", text: " " },
      ])
      .run();
  };

  const handleSubmit = () => {
    if (!editor || !plainText || isSubmitting) return;

    onSubmit({
      bodyJson: editor.getJSON(),
      plainText,
    });

    if (!initialBodyJson) {
      editor.commands.setContent(emptyDoc);
      setPlainText("");
    }
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={editor?.isActive("bold") ? "secondary" : "outline"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
          <span className="sr-only">Bold</span>
        </Button>
        <Button
          type="button"
          variant={editor?.isActive("italic") ? "secondary" : "outline"}
          size="sm"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
          <span className="sr-only">Italic</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addLink}>
          <Link2 className="h-4 w-4" />
          <span className="sr-only">Link</span>
        </Button>
        <div className="flex min-w-[220px] items-center gap-2">
          <Select value={mentionUserId} onValueChange={setMentionUserId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Mention member" />
            </SelectTrigger>
            <SelectContent>
              {memberOptions.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={insertMention}
            disabled={!mentionUserId}
          >
            <AtSign className="h-4 w-4" />
            <span className="sr-only">Mention</span>
          </Button>
        </div>
      </div>

      <EditorContent editor={editor} />

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!plainText || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
