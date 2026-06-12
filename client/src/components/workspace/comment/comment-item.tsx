import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getApiAssetUrl } from "@/lib/base-url";
import { AllMembersInWorkspaceResponseType, CommentType } from "@/types/api.type";
import CommentEditor from "./comment-editor";
import CommentRichRenderer from "./comment-rich-renderer";

type CommentSubmitValue = {
  bodyJson: Record<string, unknown>;
  plainText: string;
};

type CommentItemProps = {
  comment: CommentType;
  members: AllMembersInWorkspaceResponseType["members"];
  currentUserId?: string;
  currentRole?: string;
  isReply?: boolean;
  isMutating?: boolean;
  onReply: (commentId: string, value: CommentSubmitValue) => void;
  onEdit: (commentId: string, value: CommentSubmitValue) => void;
  onDelete: (commentId: string) => void;
};

const getAuthor = (comment: CommentType) => {
  if (typeof comment.author === "string") {
    return {
      id: comment.author,
      name: "Unknown member",
      email: "",
      profilePicture: null,
    };
  }

  return {
    id: comment.author._id,
    name: comment.author.name || comment.author.email || "Unknown member",
    email: comment.author.email || "",
    profilePicture: comment.author.profilePicture || null,
  };
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function CommentItem({
  comment,
  members,
  currentUserId,
  currentRole,
  isReply = false,
  isMutating = false,
  onReply,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const author = getAuthor(comment);
  const isAuthor = author.id === currentUserId;
  const canDelete =
    isAuthor || currentRole === "OWNER" || currentRole === "ADMIN";

  const handleDelete = () => {
    if (!window.confirm("Delete this comment?")) return;
    onDelete(comment._id);
  };

  return (
    <div className={isReply ? "pl-8" : ""}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          {author.profilePicture && (
            <AvatarImage src={getApiAssetUrl(author.profilePicture)} alt={author.name} />
          )}
          <AvatarFallback className="text-xs">{initials(author.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{author.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
              })}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-muted-foreground">edited</span>
            )}
          </div>

          {isEditing ? (
            <CommentEditor
              members={members}
              initialBodyJson={comment.bodyJson}
              submitLabel="Save"
              isSubmitting={isMutating}
              compact
              onCancel={() => setIsEditing(false)}
              onSubmit={(value) => {
                onEdit(comment._id, value);
                setIsEditing(false);
              }}
            />
          ) : (
            <CommentRichRenderer bodyJson={comment.bodyJson} />
          )}

          <div className="flex flex-wrap gap-1">
            {!isReply && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsReplying((value) => !value)}
              >
                <MessageSquare className="h-4 w-4" />
                Reply
              </Button>
            )}
            {isAuthor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>

          {isReplying && (
            <CommentEditor
              members={members}
              submitLabel="Reply"
              isSubmitting={isMutating}
              compact
              onCancel={() => setIsReplying(false)}
              onSubmit={(value) => {
                onReply(comment._id, value);
                setIsReplying(false);
              }}
            />
          )}

          {!isReply && comment.replies.length > 0 && (
            <div className="space-y-4 border-l pl-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply._id}
                  comment={reply}
                  members={members}
                  currentUserId={currentUserId}
                  currentRole={currentRole}
                  isReply
                  isMutating={isMutating}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
