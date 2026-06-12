import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import useAuth from "@/hooks/api/use-auth";
import useGetWorkspaceMembers from "@/hooks/api/use-get-workspace-members";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { toast } from "@/hooks/use-toast";
import {
  createCommentMutationFn,
  createCommentReplyMutationFn,
  deleteCommentMutationFn,
  editCommentMutationFn,
  getActivityFeedQueryFn,
  getCommentsQueryFn,
} from "@/lib/api";
import {
  CommentListResponseType,
  CommentTargetType,
  CommentType,
} from "@/types/api.type";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CommentEditor from "./comment-editor";
import CommentItem from "./comment-item";
import ActivityFeed from "./activity-feed";

type CommentSubmitValue = {
  bodyJson: Record<string, unknown>;
  plainText: string;
};

const createOptimisticComment = (
  value: CommentSubmitValue,
  workspaceId: string,
  targetType: CommentTargetType,
  targetId: string,
  currentUser?: { _id: string; name?: string; email?: string; profilePicture?: string | null },
  parentComment?: string | null
): CommentType => ({
  _id: `optimistic-${Date.now()}-${Math.random()}`,
  workspace: workspaceId,
  author: currentUser
    ? {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        profilePicture: currentUser.profilePicture ?? null,
      }
    : "optimistic",
  targetType,
  targetId,
  parentComment: parentComment ?? null,
  bodyJson: value.bodyJson,
  plainText: value.plainText,
  mentions: [],
  editedAt: null,
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  replyCount: 0,
  replies: [],
});

const updateCommentTree = (
  comments: CommentType[],
  commentId: string,
  updater: (comment: CommentType) => CommentType | null
): CommentType[] =>
  comments
    .map((comment) => {
      if (comment._id === commentId) {
        return updater(comment);
      }

      return {
        ...comment,
        replies: updateCommentTree(comment.replies, commentId, updater),
      };
    })
    .filter((comment): comment is CommentType => Boolean(comment));

export default function TargetDiscussion({
  targetType,
  targetId,
}: {
  targetType: CommentTargetType;
  targetId: string;
}) {
  const [commentLimit, setCommentLimit] = useState(20);
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { data: authData } = useAuth();
  const { data: memberData } = useGetWorkspaceMembers(workspaceId);
  const members = useMemo(() => memberData?.members || [], [memberData?.members]);
  const currentUser = authData?.user;
  const currentRole = useMemo(() => {
    const member = members.find((item) => item.userId?._id === currentUser?._id);
    return member?.role?.name;
  }, [currentUser?._id, members]);

  const commentsQueryKey = [
    "comments",
    workspaceId,
    targetType,
    targetId,
    commentLimit,
  ];
  const activityQueryKey = ["activity", workspaceId, targetType, targetId];

  const { data, isLoading } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: () =>
      getCommentsQueryFn({
        workspaceId,
        targetType,
        targetId,
        pageSize: commentLimit,
        pageNumber: 1,
      }),
    enabled: Boolean(workspaceId && targetId),
  });

  const activityQuery = useQuery({
    queryKey: activityQueryKey,
    queryFn: () =>
      getActivityFeedQueryFn({
        workspaceId,
        targetType,
        targetId,
        pageSize: 20,
        pageNumber: 1,
      }),
    enabled: Boolean(workspaceId && targetId),
  });

  const invalidateDiscussion = () => {
    queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    queryClient.invalidateQueries({ queryKey: activityQueryKey });
  };

  const createComment = useMutation({
    mutationFn: createCommentMutationFn,
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous =
        queryClient.getQueryData<CommentListResponseType>(commentsQueryKey);
      queryClient.setQueryData<CommentListResponseType>(commentsQueryKey, (old) =>
        old
          ? {
              ...old,
              comments: [
                createOptimisticComment(
                  value,
                  workspaceId,
                  targetType,
                  targetId,
                  currentUser
                ),
                ...old.comments,
              ],
              pagination: {
                ...old.pagination,
                totalCount: old.pagination.totalCount + 1,
              },
            }
          : old
      );
      return { previous };
    },
    onError: (error, _value, context) => {
      queryClient.setQueryData(commentsQueryKey, context?.previous);
      toast({
        title: "Comment failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: invalidateDiscussion,
  });

  const createReply = useMutation({
    mutationFn: createCommentReplyMutationFn,
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous =
        queryClient.getQueryData<CommentListResponseType>(commentsQueryKey);
      queryClient.setQueryData<CommentListResponseType>(commentsQueryKey, (old) =>
        old
          ? {
              ...old,
              comments: old.comments.map((comment) =>
                comment._id === value.commentId
                  ? {
                      ...comment,
                      replyCount: (comment.replyCount || 0) + 1,
                      replies: [
                        ...comment.replies,
                        createOptimisticComment(
                          value,
                          workspaceId,
                          targetType,
                          targetId,
                          currentUser,
                          value.commentId
                        ),
                      ],
                    }
                  : comment
              ),
            }
          : old
      );
      return { previous };
    },
    onError: (error, _value, context) => {
      queryClient.setQueryData(commentsQueryKey, context?.previous);
      toast({
        title: "Reply failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: invalidateDiscussion,
  });

  const editComment = useMutation({
    mutationFn: editCommentMutationFn,
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous =
        queryClient.getQueryData<CommentListResponseType>(commentsQueryKey);
      queryClient.setQueryData<CommentListResponseType>(commentsQueryKey, (old) =>
        old
          ? {
              ...old,
              comments: updateCommentTree(old.comments, value.commentId, (comment) => ({
                ...comment,
                bodyJson: value.bodyJson,
                plainText: value.plainText,
                editedAt: new Date().toISOString(),
              })),
            }
          : old
      );
      return { previous };
    },
    onError: (error, _value, context) => {
      queryClient.setQueryData(commentsQueryKey, context?.previous);
      toast({
        title: "Edit failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: invalidateDiscussion,
  });

  const deleteComment = useMutation({
    mutationFn: deleteCommentMutationFn,
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous =
        queryClient.getQueryData<CommentListResponseType>(commentsQueryKey);
      queryClient.setQueryData<CommentListResponseType>(commentsQueryKey, (old) =>
        old
          ? {
              ...old,
              comments: updateCommentTree(old.comments, value.commentId, () => null),
              pagination: {
                ...old.pagination,
                totalCount: Math.max(0, old.pagination.totalCount - 1),
              },
            }
          : old
      );
      return { previous };
    },
    onError: (error, _value, context) => {
      queryClient.setQueryData(commentsQueryKey, context?.previous);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: invalidateDiscussion,
  });

  const isMutating =
    createComment.isPending ||
    createReply.isPending ||
    editComment.isPending ||
    deleteComment.isPending;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Discussion</h2>
      </div>

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="space-y-4">
          <CommentEditor
            members={members}
            isSubmitting={createComment.isPending}
            onSubmit={(value) =>
              createComment.mutate({
                workspaceId,
                targetType,
                targetId,
                ...value,
              })
            }
          />

          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading comments...</p>
          )}
          {!isLoading && (data?.comments.length || 0) === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}

          <div className="space-y-5">
            {(data?.comments || []).map((comment) => (
              <CommentItem
                key={comment._id}
                comment={comment}
                members={members}
                currentUserId={currentUser?._id}
                currentRole={currentRole}
                isMutating={isMutating}
                onReply={(commentId, value) =>
                  createReply.mutate({
                    workspaceId,
                    commentId,
                    ...value,
                  })
                }
                onEdit={(commentId, value) =>
                  editComment.mutate({
                    workspaceId,
                    commentId,
                    ...value,
                  })
                }
                onDelete={(commentId) =>
                  deleteComment.mutate({ workspaceId, commentId })
                }
              />
            ))}
          </div>

          {data && data.comments.length < data.pagination.totalCount && (
            <div className="flex justify-center">
              <button
                type="button"
                className="text-sm font-medium text-primary underline underline-offset-4"
                onClick={() => setCommentLimit((value) => value + 20)}
              >
                Load more comments
              </button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="activity">
          <ActivityFeed
            activities={activityQuery.data?.activities || []}
            isLoading={activityQuery.isLoading}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
