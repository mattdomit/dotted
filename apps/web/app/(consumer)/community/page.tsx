"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { apiFetch } from "@/lib/api";

interface ZonePost {
  id: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
  user?: { name: string; avatarUrl?: string };
  commentCount: number;
  likeCount: number;
}

interface PostComment {
  id: string;
  body: string;
  createdAt: string;
  parentId?: string;
  user?: { name: string; avatarUrl?: string };
  children?: PostComment[];
}

export default function CommunityPage() {
  const { token } = useAuth();
  const [posts, setPosts] = useState<ZonePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  // Comment state
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    apiFetch<{ data: { id: string; zoneId: string }[] }>("/zones/mine")
      .then((res) => {
        if (res.data.length > 0) {
          const zId = res.data[0].zoneId;
          setZoneId(zId);
          return fetchPosts(zId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function fetchPosts(zId: string) {
    const res = await apiFetch<{ data: ZonePost[] }>(`/feed/zones/${zId}/feed`);
    setPosts(res.data);
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId || !newPost.trim()) return;
    setPosting(true);
    setError("");
    try {
      await apiFetch(`/feed/zones/${zoneId}/posts`, {
        method: "POST",
        body: JSON.stringify({ body: newPost }),
      });
      setNewPost("");
      await fetchPosts(zoneId);
    } catch (err: any) {
      setError(err.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(postId: string) {
    if (!zoneId) return;
    try {
      await apiFetch(`/feed/posts/${postId}/like`, { method: "POST" });
      await fetchPosts(zoneId);
    } catch {}
  }

  async function handleDelete(postId: string) {
    if (!zoneId) return;
    try {
      await apiFetch(`/feed/posts/${postId}`, { method: "DELETE" });
      await fetchPosts(zoneId);
    } catch {}
  }

  async function loadComments(postId: string) {
    if (expandedPost === postId) {
      setExpandedPost(null);
      return;
    }
    try {
      const res = await apiFetch<{ data: PostComment[] }>(`/feed/posts/${postId}/comments`);
      setComments((prev) => ({ ...prev, [postId]: res.data }));
      setExpandedPost(postId);
    } catch {}
  }

  async function handleComment(postId: string) {
    const text = commentText[postId]?.trim();
    if (!text || !zoneId) return;
    try {
      await apiFetch(`/feed/posts/${postId}/comment`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
      await loadComments(postId);
      await fetchPosts(zoneId);
    } catch {}
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container max-w-2xl py-8">
        <h1 className="text-3xl font-bold">Community</h1>
        <p className="mt-1 text-muted-foreground">Share with your zone neighbors.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {token && zoneId && (
          <form onSubmit={handleCreatePost} className="mt-6 space-y-3 rounded-lg border p-4">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={posting || !newPost.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="mt-6 text-muted-foreground">Loading feed...</p>
        ) : !zoneId ? (
          <p className="mt-6 text-center text-muted-foreground">
            Join a zone to see the community feed.
          </p>
        ) : posts.length === 0 ? (
          <p className="mt-6 text-center text-muted-foreground">
            No posts yet. Be the first to share!
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {post.user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <span className="text-sm font-medium">{post.user?.name || "Anonymous"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm">{post.body}</p>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="mt-2 max-h-64 rounded-md object-cover" />
                )}
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <button onClick={() => handleLike(post.id)} className="hover:text-primary">
                    {post.likeCount} Likes
                  </button>
                  <button onClick={() => loadComments(post.id)} className="hover:text-primary">
                    {post.commentCount} Comments
                  </button>
                  {token && (
                    <button onClick={() => handleDelete(post.id)} className="hover:text-red-500">
                      Delete
                    </button>
                  )}
                </div>

                {expandedPost === post.id && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {(comments[post.id] || []).map((c) => (
                      <div key={c.id} className="rounded bg-muted/30 p-2 text-sm">
                        <span className="font-medium">{c.user?.name}</span>: {c.body}
                        {c.children?.map((child) => (
                          <div key={child.id} className="ml-4 mt-1 rounded bg-muted/20 p-2 text-sm">
                            <span className="font-medium">{child.user?.name}</span>: {child.body}
                          </div>
                        ))}
                      </div>
                    ))}
                    {token && (
                      <div className="flex gap-2">
                        <input
                          value={commentText[post.id] || ""}
                          onChange={(e) =>
                            setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="Write a comment..."
                          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleComment(post.id);
                          }}
                        />
                        <button
                          onClick={() => handleComment(post.id)}
                          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
