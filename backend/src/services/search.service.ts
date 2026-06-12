import { CommentTargetTypeEnum } from "../enums/domain.enum";
import CommentModel from "../models/comment.model";
import MemberModel from "../models/member.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import UserModel from "../models/user.model";
import {
  SearchResultType,
  SearchResultTypeEnum,
  searchResultTypes,
} from "../validation/search.validation";

type SearchResult = {
  id: string;
  type: SearchResultType;
  entityId: string;
  title: string;
  subtitle: string;
  snippet: string;
  url: string;
  updatedAt: Date;
  canView: true;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  memberId?: string;
  avatarUrl?: string | null;
  score?: number;
};

type SearchGroup = {
  type: SearchResultType;
  totalCount: number;
  results: SearchResult[];
};

type TypeSearchResult = {
  type: SearchResultType;
  totalCount: number;
  results: SearchResult[];
};

const ENTITY_PRIORITY: Record<SearchResultType, number> = {
  PROJECT: 0,
  TASK: 1,
  COMMENT: 2,
  MEMBER: 3,
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const prefixRegexFor = (query: string) =>
  new RegExp(`(^|\\s)${escapeRegex(query)}`, "i");

const normalizeSnippetText = (value: string) => value.replace(/\s+/g, " ").trim();

const clipSnippet = (value: string, query: string, maxLength = 150) => {
  const text = normalizeSnippetText(value);

  if (text.length <= maxLength) {
    return text;
  }

  const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
  const initialStart = matchIndex > -1 ? Math.max(0, matchIndex - 45) : 0;
  const hasPrefix = initialStart > 0;
  const hasSuffix = initialStart + maxLength < text.length;
  const prefix = hasPrefix ? "..." : "";
  const suffix = hasSuffix ? "..." : "";
  const sliceLength = maxLength - prefix.length - suffix.length;

  return `${prefix}${text.slice(initialStart, initialStart + sliceLength)}${suffix}`;
};

const toDate = (value: unknown) =>
  value instanceof Date ? value : new Date(value as string | number);

const sortResults = (results: SearchResult[]) =>
  results.sort((a, b) => {
    const scoreDelta = (b.score || 0) - (a.score || 0);
    if (scoreDelta !== 0) return scoreDelta;

    const priorityDelta = ENTITY_PRIORITY[a.type] - ENTITY_PRIORITY[b.type];
    if (priorityDelta !== 0) return priorityDelta;

    return toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime();
  });

const stripInternalScore = (results: SearchResult[]) =>
  results.map(({ score: _score, ...result }) => result);

const paginationMeta = (totalCount: number, pageSize: number, pageNumber: number) => {
  const skip = (pageNumber - 1) * pageSize;

  return {
    totalCount,
    pageSize,
    pageNumber,
    totalPages: Math.ceil(totalCount / pageSize),
    skip,
    limit: pageSize,
  };
};

const projectUrl = (workspaceId: string, projectId: string) =>
  `/workspace/${workspaceId}/project/${projectId}`;

const taskUrl = (workspaceId: string, projectId: string, taskId: string) =>
  `/workspace/${workspaceId}/project/${projectId}?taskId=${taskId}`;

const commentUrl = ({
  workspaceId,
  projectId,
  taskId,
  commentId,
}: {
  workspaceId: string;
  projectId: string;
  taskId?: string;
  commentId: string;
}) => {
  const params = new URLSearchParams({ commentId });
  if (taskId) params.set("taskId", taskId);
  return `/workspace/${workspaceId}/project/${projectId}?${params.toString()}`;
};

const memberUrl = (workspaceId: string, memberId: string) =>
  `/workspace/${workspaceId}/members?memberId=${memberId}`;

const withPaginationWindow = async <T>({
  textCount,
  textDocuments,
  prefixDocuments,
  prefixCount,
  skip,
  pageSize,
  map,
}: {
  textCount: number;
  textDocuments: T[];
  prefixDocuments: T[];
  prefixCount: number;
  skip: number;
  pageSize: number;
  map: (document: T, source: "text" | "prefix") => SearchResult | null;
}) => {
  const textResults = textDocuments
    .map((document) => map(document, "text"))
    .filter((result): result is SearchResult => Boolean(result));
  const prefixResults = prefixDocuments
    .map((document) => map(document, "prefix"))
    .filter((result): result is SearchResult => Boolean(result));
  const results = [...textResults, ...prefixResults];

  return {
    totalCount: textCount + prefixCount,
    results: sortResults(results).slice(skip, skip + pageSize),
  };
};

const searchProjects = async (
  workspaceId: string,
  query: string,
  pageSize: number,
  pageNumber: number
): Promise<TypeSearchResult> => {
  const skip = (pageNumber - 1) * pageSize;
  const needed = skip + pageSize;
  const prefixRegex = prefixRegexFor(query);
  const textFilter = {
    workspace: workspaceId,
    $text: { $search: query },
  };
  const textCount = await ProjectModel.countDocuments(textFilter);
  const textProjects = await ProjectModel.find(textFilter, {
    score: { $meta: "textScore" },
  })
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .limit(needed)
    .lean<Array<Record<string, any>>>();
  const textIds = textProjects.map((project) => project._id);

  let prefixProjects: Array<Record<string, any>> = [];
  let prefixCount = 0;

  if (textProjects.length < needed) {
    const prefixFilter = {
      workspace: workspaceId,
      _id: { $nin: textIds },
      $or: [{ name: prefixRegex }, { description: prefixRegex }],
    };
    prefixCount = await ProjectModel.countDocuments(prefixFilter);
    prefixProjects = await ProjectModel.find(prefixFilter)
      .sort({ updatedAt: -1 })
      .limit(needed - textProjects.length)
      .lean<Array<Record<string, any>>>();
  }

  const mapped = await withPaginationWindow({
    textCount,
    textDocuments: textProjects,
    prefixDocuments: prefixProjects,
    prefixCount,
    skip,
    pageSize,
    map: (project, source) => {
      const projectId = project._id.toString();
      return {
        id: `PROJECT:${projectId}`,
        type: SearchResultTypeEnum.PROJECT,
        entityId: projectId,
        projectId,
        title: project.name,
        subtitle: "Project",
        snippet: clipSnippet(project.description || project.name, query),
        url: projectUrl(workspaceId, projectId),
        updatedAt: project.updatedAt,
        canView: true,
        score: source === "text" ? project.score || 0 : 0,
      };
    },
  });

  return { type: SearchResultTypeEnum.PROJECT, ...mapped };
};

const searchTasks = async (
  workspaceId: string,
  query: string,
  pageSize: number,
  pageNumber: number
): Promise<TypeSearchResult> => {
  const skip = (pageNumber - 1) * pageSize;
  const needed = skip + pageSize;
  const prefixRegex = prefixRegexFor(query);
  const textFilter = {
    workspace: workspaceId,
    $text: { $search: query },
  };
  const textCount = await TaskModel.countDocuments(textFilter);
  const textTasks = await TaskModel.find(textFilter, {
    score: { $meta: "textScore" },
  })
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .limit(needed)
    .populate("project", "_id name emoji")
    .lean<Array<Record<string, any>>>();
  const textIds = textTasks.map((task) => task._id);

  let prefixTasks: Array<Record<string, any>> = [];
  let prefixCount = 0;

  if (textTasks.length < needed) {
    const prefixFilter = {
      workspace: workspaceId,
      _id: { $nin: textIds },
      $or: [
        { title: prefixRegex },
        { description: prefixRegex },
        { taskCode: prefixRegex },
      ],
    };
    prefixCount = await TaskModel.countDocuments(prefixFilter);
    prefixTasks = await TaskModel.find(prefixFilter)
      .sort({ updatedAt: -1 })
      .limit(needed - textTasks.length)
      .populate("project", "_id name emoji")
      .lean<Array<Record<string, any>>>();
  }

  const mapped = await withPaginationWindow({
    textCount,
    textDocuments: textTasks,
    prefixDocuments: prefixTasks,
    prefixCount,
    skip,
    pageSize,
    map: (task, source) => {
      const project = task.project;
      if (!project || !project._id) return null;

      const taskId = task._id.toString();
      const projectId = project._id.toString();
      return {
        id: `TASK:${taskId}`,
        type: SearchResultTypeEnum.TASK,
        entityId: taskId,
        projectId,
        taskId,
        title: task.title,
        subtitle: `${project.name} · ${task.status}`,
        snippet: clipSnippet(task.description || task.taskCode || task.title, query),
        url: taskUrl(workspaceId, projectId, taskId),
        updatedAt: task.updatedAt,
        canView: true,
        score: source === "text" ? task.score || 0 : 0,
      };
    },
  });

  return { type: SearchResultTypeEnum.TASK, ...mapped };
};

const hydrateCommentResults = async (
  workspaceId: string,
  comments: Array<Record<string, any>>,
  query: string,
  source: "text" | "prefix"
) => {
  const taskTargetIds = comments
    .filter((comment) => comment.targetType === CommentTargetTypeEnum.TASK)
    .map((comment) => comment.targetId);
  const projectTargetIds = comments
    .filter((comment) => comment.targetType === CommentTargetTypeEnum.PROJECT)
    .map((comment) => comment.targetId);

  const [tasks, projects] = await Promise.all([
    TaskModel.find({ _id: { $in: taskTargetIds }, workspace: workspaceId })
      .select("_id title project")
      .populate("project", "_id name emoji")
      .lean<Array<Record<string, any>>>(),
    ProjectModel.find({ _id: { $in: projectTargetIds }, workspace: workspaceId })
      .select("_id name emoji")
      .lean<Array<Record<string, any>>>(),
  ]);

  const taskMap = new Map(tasks.map((task) => [task._id.toString(), task]));
  const projectMap = new Map(
    projects.map((project) => [project._id.toString(), project])
  );

  return comments
    .map((comment): SearchResult | null => {
      const commentId = comment._id.toString();

      if (comment.targetType === CommentTargetTypeEnum.TASK) {
        const task = taskMap.get(comment.targetId.toString());
        const project = task?.project;
        if (!task || !project?._id) return null;

        const taskId = task._id.toString();
        const projectId = project._id.toString();

        return {
          id: `COMMENT:${commentId}`,
          type: SearchResultTypeEnum.COMMENT,
          entityId: commentId,
          commentId,
          taskId,
          projectId,
          title: `Comment on ${task.title}`,
          subtitle: project.name,
          snippet: clipSnippet(comment.plainText, query),
          url: commentUrl({ workspaceId, projectId, taskId, commentId }),
          updatedAt: comment.updatedAt,
          canView: true,
          score: source === "text" ? comment.score || 0 : 0,
        } satisfies SearchResult;
      }

      const project = projectMap.get(comment.targetId.toString());
      if (!project) return null;

      const projectId = project._id.toString();

      return {
        id: `COMMENT:${commentId}`,
        type: SearchResultTypeEnum.COMMENT,
        entityId: commentId,
        commentId,
        projectId,
        title: `Comment on ${project.name}`,
        subtitle: "Project discussion",
        snippet: clipSnippet(comment.plainText, query),
        url: commentUrl({ workspaceId, projectId, commentId }),
        updatedAt: comment.updatedAt,
        canView: true,
        score: source === "text" ? comment.score || 0 : 0,
      } satisfies SearchResult;
    })
    .filter((result): result is SearchResult => Boolean(result));
};

const searchComments = async (
  workspaceId: string,
  query: string,
  pageSize: number,
  pageNumber: number
): Promise<TypeSearchResult> => {
  const skip = (pageNumber - 1) * pageSize;
  const needed = skip + pageSize;
  const prefixRegex = prefixRegexFor(query);
  const textFilter = {
    workspace: workspaceId,
    deletedAt: null,
    $text: { $search: query },
  };
  const textCount = await CommentModel.countDocuments(textFilter);
  const textComments = await CommentModel.find(textFilter, {
    score: { $meta: "textScore" },
  })
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .limit(needed)
    .lean<Array<Record<string, any>>>();
  const textIds = textComments.map((comment) => comment._id);

  let prefixComments: Array<Record<string, any>> = [];
  let prefixCount = 0;

  if (textComments.length < needed) {
    const prefixFilter = {
      workspace: workspaceId,
      deletedAt: null,
      _id: { $nin: textIds },
      plainText: prefixRegex,
    };
    prefixCount = await CommentModel.countDocuments(prefixFilter);
    prefixComments = await CommentModel.find(prefixFilter)
      .sort({ updatedAt: -1 })
      .limit(needed - textComments.length)
      .lean<Array<Record<string, any>>>();
  }

  const [textResults, prefixResults] = await Promise.all([
    hydrateCommentResults(workspaceId, textComments, query, "text"),
    hydrateCommentResults(workspaceId, prefixComments, query, "prefix"),
  ]);

  return {
    type: SearchResultTypeEnum.COMMENT,
    totalCount: textCount + prefixCount,
    results: sortResults([...textResults, ...prefixResults]).slice(
      skip,
      skip + pageSize
    ),
  };
};

const searchMembers = async (
  workspaceId: string,
  query: string,
  pageSize: number,
  pageNumber: number
): Promise<TypeSearchResult> => {
  const members = await MemberModel.find({ workspaceId })
    .select("_id userId updatedAt joinedAt")
    .lean<Array<Record<string, any>>>();
  const memberByUserId = new Map(
    members.map((member) => [member.userId.toString(), member])
  );
  const userIds = members.map((member) => member.userId);
  const prefixRegex = prefixRegexFor(query);

  const users = await UserModel.find({
    _id: { $in: userIds },
    isActive: true,
    $or: [{ name: prefixRegex }, { email: prefixRegex }],
  })
    .select("_id name email profilePicture updatedAt")
    .lean<Array<Record<string, any>>>();

  const results = users
    .map((user): SearchResult | null => {
      const member = memberByUserId.get(user._id.toString());
      if (!member) return null;

      const memberId = member._id.toString();
      return {
        id: `MEMBER:${memberId}`,
        type: SearchResultTypeEnum.MEMBER,
        entityId: memberId,
        memberId,
        title: user.name || user.email,
        subtitle: user.email,
        snippet: user.email,
        avatarUrl: user.profilePicture || null,
        url: memberUrl(workspaceId, memberId),
        updatedAt: user.updatedAt || member.updatedAt || member.joinedAt,
        canView: true,
        score:
          user.name?.toLowerCase().startsWith(query.toLowerCase()) ||
          user.email?.toLowerCase().startsWith(query.toLowerCase())
            ? 1
            : 0,
      } satisfies SearchResult;
    })
    .filter((result): result is SearchResult => Boolean(result));

  const sortedResults = sortResults(results);
  const skip = (pageNumber - 1) * pageSize;

  return {
    type: SearchResultTypeEnum.MEMBER,
    totalCount: sortedResults.length,
    results: sortedResults.slice(skip, skip + pageSize),
  };
};

const searchByType = (
  workspaceId: string,
  type: SearchResultType,
  query: string,
  pageSize: number,
  pageNumber: number
) => {
  switch (type) {
    case SearchResultTypeEnum.PROJECT:
      return searchProjects(workspaceId, query, pageSize, pageNumber);
    case SearchResultTypeEnum.TASK:
      return searchTasks(workspaceId, query, pageSize, pageNumber);
    case SearchResultTypeEnum.COMMENT:
      return searchComments(workspaceId, query, pageSize, pageNumber);
    case SearchResultTypeEnum.MEMBER:
      return searchMembers(workspaceId, query, pageSize, pageNumber);
    default:
      return searchProjects(workspaceId, query, pageSize, pageNumber);
  }
};

export const searchWorkspacePreviewService = async (
  workspaceId: string,
  query: string,
  types: SearchResultType[] | undefined,
  limitPerType: number
) => {
  const requestedTypes = types?.length ? types : searchResultTypes;
  const groups = await Promise.all(
    requestedTypes.map((type) =>
      searchByType(workspaceId, type, query, limitPerType, 1)
    )
  );

  return {
    groups: groups
      .sort((a, b) => ENTITY_PRIORITY[a.type] - ENTITY_PRIORITY[b.type])
      .map<SearchGroup>((group) => ({
        type: group.type,
        totalCount: group.totalCount,
        results: stripInternalScore(group.results),
      })),
  };
};

export const searchWorkspaceTypeService = async (
  workspaceId: string,
  type: SearchResultType,
  query: string,
  pageSize: number,
  pageNumber: number
) => {
  const result = await searchByType(workspaceId, type, query, pageSize, pageNumber);

  return {
    type: result.type,
    results: stripInternalScore(result.results),
    pagination: paginationMeta(result.totalCount, pageSize, pageNumber),
  };
};
