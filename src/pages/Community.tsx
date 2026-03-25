import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Clock,
  Filter,
  Heart,
  MessageCircle,
  Plus,
  Reply,
  Search,
  Send,
  ShieldAlert,
  Star,
  ThumbsUp,
  Trash2,
  Users
} from 'lucide-react';
import { communityAPI, getAccessToken } from '../services/api';

interface Post {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: Date;
  likes: number;
  replies: number;
  category: string;
  tags: string[];
  isSupport?: boolean;
  isOwner?: boolean;
  isBookmarked?: boolean;
  isPinned?: boolean;
}

interface ReplyItem {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: Date;
  likes: number;
  isOwner?: boolean;
}

const PAGE_LIMIT = 10;
const REACTIONS: Array<{ key: 'heart' | 'hug' | 'pray' | 'strong'; emoji: string; label: string }> = [
  { key: 'heart', emoji: '❤️', label: 'Heart' },
  { key: 'hug', emoji: '🤗', label: 'Hug' },
  { key: 'pray', emoji: '🙏', label: 'Pray' },
  { key: 'strong', emoji: '💪', label: 'Strong' }
];
const CRISIS_KEYWORDS = ['self-harm', 'suicide', 'hurt myself', 'hopeless', 'can’t cope', 'cant cope'];

const categoryLabel: Record<string, string> = {
  all: 'All Posts',
  support: 'Support & Encouragement',
  breastfeeding: 'Breastfeeding',
  'mental-health': 'Mental Health',
  sleep: 'Sleep & Routines',
  recovery: 'Physical Recovery',
  general: 'General Discussion'
};

const samplePosts: Post[] = [
  {
    id: 'sample-1',
    author: 'Ananya P.',
    avatar: '👩',
    content:
      'Week 5 postpartum update: I started short breathing sessions twice a day and my anxiety episodes reduced a lot. Sharing this in case it helps someone else.',
    timestamp: new Date('2026-03-20T10:00:00'),
    likes: 18,
    replies: 6,
    category: 'mental-health',
    tags: ['anxiety', 'coping', 'postpartum'],
    isSupport: true
  },
  {
    id: 'sample-2',
    author: 'Neha R.',
    avatar: '🤱',
    content:
      'Any moms here dealing with cluster feeding at night? Looking for practical tips that worked for you without affecting sleep too much.',
    timestamp: new Date('2026-03-21T08:30:00'),
    likes: 11,
    replies: 9,
    category: 'breastfeeding',
    tags: ['feeding', 'newborn', 'night-routine']
  },
  {
    id: 'sample-3',
    author: 'Drishti M.',
    avatar: '🌙',
    content:
      'Small win today: baby slept in 3-hour blocks and I finally got enough rest. Routine + dim lights before bedtime really helped us.',
    timestamp: new Date('2026-03-22T22:15:00'),
    likes: 24,
    replies: 7,
    category: 'sleep',
    tags: ['sleep', 'routine', 'newborn']
  },
  {
    id: 'sample-4',
    author: 'Kavya S.',
    avatar: '💪',
    content:
      'Recovery question: when did you start light walks after delivery? I want to move more but don’t want to overdo it.',
    timestamp: new Date('2026-03-23T09:45:00'),
    likes: 15,
    replies: 5,
    category: 'recovery',
    tags: ['recovery', 'exercise', 'postnatal']
  },
  {
    id: 'sample-5',
    author: 'Anonymous',
    avatar: '👤',
    content:
      'I felt very overwhelmed this week and guilty for feeling that way. Posting this to remind anyone else: asking for help is okay.',
    timestamp: new Date('2026-03-23T18:20:00'),
    likes: 33,
    replies: 12,
    category: 'support',
    tags: ['support', 'overwhelm', 'mental-health'],
    isSupport: true
  }
];

const mapPost = (post: any): Post => ({
  id: String(post.id),
  author: post.is_anonymous ? 'Anonymous' : post.author_name || 'User',
  avatar: post.is_anonymous ? '👤' : '👩',
  content: post.content,
  timestamp: new Date(post.created_at),
  likes: post.likes_count || 0,
  replies: post.replies_count || 0,
  category: post.category || 'general',
  tags: post.tags || [],
  isSupport: post.is_support_request || false,
  isOwner: Boolean(post.is_owner),
  isBookmarked: Boolean(post.is_bookmarked),
  isPinned: Boolean(post.is_pinned)
});

const mapReply = (reply: any): ReplyItem => ({
  id: String(reply.id),
  author: reply.is_anonymous ? 'Anonymous' : reply.author_name || 'User',
  avatar: reply.is_anonymous ? '👤' : '👩',
  content: reply.content,
  timestamp: new Date(reply.created_at),
  likes: reply.likes_count || 0,
  isOwner: Boolean(reply.is_owner)
});

const getTimeSince = (date: Date) => {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

const Community: React.FC = () => {
  const draftStorageKey = useMemo(() => {
    try {
      const token = getAccessToken();
      if (!token) return 'community_new_post_draft_guest';
      const parts = token.split('.');
      if (parts.length !== 3) return 'community_new_post_draft_guest';
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return `community_new_post_draft_${payload?.sub || payload?.id || 'guest'}`;
    } catch {
      return 'community_new_post_draft_guest';
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'discussions' | 'experts' | 'saved'>('discussions');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Recent');
  const [activeCategory, setActiveCategory] = useState('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [bookmarks, setBookmarks] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Record<string, ReplyItem[]>>({});
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});
  const [experts, setExperts] = useState<Array<{ name: string; role: string; avatar: string; verified: boolean }>>([]);
  const [analytics, setAnalytics] = useState<{ total_posts: number; total_replies: number; total_likes: number }>({
    total_posts: 0,
    total_replies: 0,
    total_likes: 0
  });
  const [trendingTags, setTrendingTags] = useState<Array<{ tag: string; usage_count: number }>>([]);

  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTags, setNewPostTags] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('support');
  const [newPostAnonymous, setNewPostAnonymous] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

  const categories = useMemo(
    () => [
      { id: 'all', name: 'All Posts' },
      { id: 'support', name: 'Support & Encouragement' },
      { id: 'breastfeeding', name: 'Breastfeeding' },
      { id: 'mental-health', name: 'Mental Health' },
      { id: 'sleep', name: 'Sleep & Routines' },
      { id: 'recovery', name: 'Physical Recovery' },
      { id: 'general', name: 'General Discussion' }
    ],
    []
  );

  const crisisPrompt = useMemo(() => {
    const text = newPostContent.toLowerCase();
    return CRISIS_KEYWORDS.some((keyword) => text.includes(keyword));
  }, [newPostContent]);

  const mentions = useMemo(() => {
    const list = (newPostContent.match(/@\w+/g) || []).map((item) => item.trim());
    return Array.from(new Set(list));
  }, [newPostContent]);

  useEffect(() => {
    const raw = localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      setNewPostContent(draft.content || '');
      setNewPostTags(draft.tags || '');
      setNewPostCategory(draft.category || 'support');
      setNewPostAnonymous(Boolean(draft.isAnonymous));
    } catch {
      // ignore malformed draft
    }
  }, [draftStorageKey]);

  useEffect(() => {
    localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        content: newPostContent,
        tags: newPostTags,
        category: newPostCategory,
        isAnonymous: newPostAnonymous
      })
    );
  }, [newPostContent, newPostTags, newPostCategory, newPostAnonymous, draftStorageKey]);

  const loadMeta = async () => {
    try {
      const [analyticsResponse, expertsResponse, bookmarkResponse] = await Promise.all([
        communityAPI.getAnalytics(),
        communityAPI.getExperts(),
        communityAPI.getBookmarks()
      ]);
      if (analyticsResponse?.success) {
        setAnalytics(analyticsResponse.data.summary || analytics);
        setTrendingTags(analyticsResponse.data.trendingTags || []);
      }
      if (expertsResponse?.success) {
        setExperts(expertsResponse.data.experts || []);
      }
      if (bookmarkResponse?.success) {
        setBookmarks((bookmarkResponse.data.posts || []).map(mapPost));
      }
    } catch {
      // metadata optional
    }
  };

  const fetchPosts = async (nextOffset = 0, append = false) => {
    try {
      setLoading(true);
      if (!append) setError(null);

      const response = await communityAPI.getPosts({
        search: searchQuery || undefined,
        category: activeCategory === 'all' ? undefined : activeCategory,
        limit: PAGE_LIMIT,
        offset: nextOffset
      });

      if (response?.success && response?.data?.posts) {
        const incoming = response.data.posts.map(mapPost);
        const normalizedIncoming = incoming.length === 0 && !append ? samplePosts : incoming;
        setPosts((prev) => (append ? [...prev, ...normalizedIncoming] : normalizedIncoming));
        setOffset(nextOffset);
        setHasMore(incoming.length === PAGE_LIMIT && incoming.length > 0);
      } else if (!append) {
        setPosts(samplePosts);
      }
    } catch (err: any) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts. Please try again.');
      if (!append) {
        setPosts(samplePosts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(0, false);
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (selectedPost) fetchReplies(selectedPost.id);
  }, [selectedPost]);

  const fetchReplies = async (postId: string) => {
    try {
      const response = await communityAPI.getReplies(postId);
      if (response?.success && response?.data?.replies) {
        setReplies((prev) => ({ ...prev, [postId]: response.data.replies.map(mapReply) }));
      }
    } catch (err) {
      console.error('Error fetching replies:', err);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      setError('Please enter a message');
      return;
    }
    try {
      setLoading(true);
      const tags = newPostTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const response = await communityAPI.createPost({
        content: newPostContent.trim(),
        category: newPostCategory,
        tags,
        isAnonymous: newPostAnonymous,
        isSupportRequest: newPostCategory === 'support'
      });

      if (!response?.success) {
        setError(response?.message || 'Failed to create post');
        return;
      }

      setShowNewPost(false);
      setNewPostContent('');
      setNewPostTags('');
      setNewPostCategory('support');
      setNewPostAnonymous(false);
      localStorage.removeItem(draftStorageKey);
      await fetchPosts(0, false);
      await loadMeta();
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleAddReply = async (postId: string) => {
    const content = replyContent[postId]?.trim();
    if (!content) {
      setError('Please enter a reply');
      return;
    }
    try {
      setLoading(true);
      const response = await communityAPI.addReply(postId, {
        content,
        isAnonymous: Boolean(replyAnonymous[postId])
      });
      if (!response?.success) {
        setError(response?.message || 'Failed to add reply');
        return;
      }
      setReplyContent((prev) => ({ ...prev, [postId]: '' }));
      setReplyAnonymous((prev) => ({ ...prev, [postId]: false }));
      await fetchReplies(postId);
      await fetchPosts(0, false);
      await loadMeta();
    } catch (err: any) {
      setError(err.message || 'Failed to add reply');
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const response = await communityAPI.likePost(postId);
      if (!response?.success) return;
      const delta = response?.data?.liked ? 1 : -1;
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: Math.max(0, p.likes + delta) } : p)));
      setSelectedPost((prev) => (prev && prev.id === postId ? { ...prev, likes: Math.max(0, prev.likes + delta) } : prev));
    } catch {
      // no-op
    }
  };

  const handleReact = async (postId: string, reactionType: 'heart' | 'hug' | 'pray' | 'strong') => {
    try {
      await communityAPI.reactPost(postId, reactionType);
      await loadMeta();
    } catch {
      // no-op
    }
  };

  const handleLikeReply = async (postId: string, replyId: string) => {
    try {
      const response = await communityAPI.likeReply(postId, replyId);
      if (!response?.success) return;
      const delta = response?.data?.liked ? 1 : -1;
      setReplies((prev) => {
        const list = prev[postId] || [];
        return {
          ...prev,
          [postId]: list.map((reply) =>
            reply.id === replyId ? { ...reply, likes: Math.max(0, reply.likes + delta) } : reply
          )
        };
      });
    } catch {
      // no-op
    }
  };

  const handleBookmark = async (postId: string) => {
    try {
      const response = await communityAPI.toggleBookmark(postId);
      if (!response?.success) return;
      const bookmarked = Boolean(response?.data?.bookmarked);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isBookmarked: bookmarked } : p)));
      setSelectedPost((prev) => (prev && prev.id === postId ? { ...prev, isBookmarked: bookmarked } : prev));
      await loadMeta();
    } catch {
      // no-op
    }
  };

  const handleReport = async (postId: string) => {
    const reason = window.prompt('Report reason (required):', 'Concerning / inappropriate content');
    if (!reason?.trim()) return;
    try {
      const response = await communityAPI.reportPost(postId, reason.trim());
      if (response?.success) {
        setError('Thanks for reporting. Our moderators will review this post.');
      }
    } catch {
      setError('Unable to submit report right now.');
    }
  };

  const handleDeletePost = async (postId: string) => {
    const ok = window.confirm('Delete this post permanently?');
    if (!ok) return;
    try {
      const response = await communityAPI.deletePost(postId);
      if (!response?.success) return;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setSelectedPost((prev) => (prev?.id === postId ? null : prev));
      await loadMeta();
    } catch {
      setError('Failed to delete post.');
    }
  };

  const handleUpdatePost = async (post: Post) => {
    if (!editingContent.trim()) {
      setError('Post content cannot be empty.');
      return;
    }
    try {
      const response = await communityAPI.updatePost(post.id, { content: editingContent.trim() });
      if (!response?.success) {
        setError(response?.message || 'Failed to update post');
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, content: editingContent.trim() } : p)));
      setSelectedPost((prev) => (prev?.id === post.id ? { ...prev, content: editingContent.trim() } : prev));
      setEditingPostId(null);
      setEditingContent('');
    } catch {
      setError('Failed to update post.');
    }
  };

  const loadMore = async () => {
    if (!hasMore || loading) return;
    await fetchPosts(offset + PAGE_LIMIT, true);
  };

  const pinnedPosts = posts.filter((p) => p.isPinned);
  const visiblePosts = posts
    .slice()
    .sort((a, b) => {
      if (sortBy === 'Most Liked') return b.likes - a.likes;
      if (sortBy === 'Most Replied') return b.replies - a.replies;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Support</h1>
        <p className="text-gray-600">Connect, share, and receive support from mothers and experts.</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-yellow-900 font-medium">📌 Announcement: Weekly expert Q&A every Sunday. Use #ExpertAdvice in your post.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <Users className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{analytics.total_posts}</p>
          <p className="text-sm text-gray-600">Discussions</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <MessageCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{analytics.total_replies}</p>
          <p className="text-sm text-gray-600">Replies</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <Heart className="h-8 w-8 text-pink-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{analytics.total_likes}</p>
          <p className="text-sm text-gray-600">Likes</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
          <Star className="h-8 w-8 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{experts.length}</p>
          <p className="text-sm text-gray-600">Expert Moderators</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { id: 'discussions', name: 'Discussions', icon: MessageCircle },
          { id: 'experts', name: 'Expert Support', icon: Star },
          { id: 'saved', name: 'Saved Posts', icon: Bookmark }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'discussions' | 'experts' | 'saved')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-rose-50 hover:text-rose-600 border border-gray-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {activeTab !== 'saved' && (
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Share Your Story</h3>
                  <p className="text-rose-100">Include @mentions and tags so right people can discover your post.</p>
                </div>
                <button onClick={() => setShowNewPost(true)} className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg transition-colors font-medium flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>New Post</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'experts' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Expert Moderators</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {experts.map((expert, index) => (
                  <div key={`${expert.name}-${index}`} className="p-4 bg-gray-50 rounded-lg flex items-center space-x-3">
                    <div className="text-2xl">{expert.avatar}</div>
                    <div>
                      <p className="font-semibold text-gray-900">{expert.name}</p>
                      <p className="text-sm text-gray-600">{expert.role}</p>
                      {expert.verified && <p className="text-xs text-purple-600 font-medium">Verified Expert</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab !== 'experts' && (
            <>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search discussions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5 text-gray-400" />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
                      <option>Recent</option>
                      <option>Most Liked</option>
                      <option>Most Replied</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                  <button onClick={() => setError(null)} className="text-red-600 text-xs mt-2">
                    Dismiss
                  </button>
                </div>
              )}

              {pinnedPosts.length > 0 && (
                <div className="space-y-3">
                  {pinnedPosts.map((post) => (
                    <div key={`pin-${post.id}`} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-xs text-amber-700 font-semibold mb-1">PINNED</p>
                      <p className="text-sm text-amber-900">{post.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {(activeTab === 'saved' ? bookmarks : visiblePosts).map((post) => (
                  <div key={post.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md cursor-pointer" onClick={() => setSelectedPost(post)}>
                    <div className="flex items-start space-x-4">
                      <div className="text-2xl">{post.avatar}</div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{post.author}</h4>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{categoryLabel[post.category] || post.category}</span>
                          {post.isSupport && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Support</span>}
                          {post.isBookmarked && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Saved</span>}
                        </div>
                        <p className="text-gray-700 mb-3 line-clamp-3">{post.content}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {post.tags.map((tag) => (
                            <button
                              key={`${post.id}-${tag}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(tag);
                              }}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLikePost(post.id);
                              }}
                              className="flex items-center space-x-1 hover:text-rose-500"
                            >
                              <Heart className="h-4 w-4" />
                              <span>{post.likes}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBookmark(post.id);
                              }}
                              className="flex items-center space-x-1 hover:text-blue-600"
                            >
                              <Bookmark className={`h-4 w-4 ${post.isBookmarked ? 'fill-current' : ''}`} />
                              <span>{post.isBookmarked ? 'Saved' : 'Save'}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReport(post.id);
                              }}
                              className="flex items-center space-x-1 hover:text-orange-600"
                            >
                              <ShieldAlert className="h-4 w-4" />
                              <span>Report</span>
                            </button>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="h-4 w-4" />
                            <span>{post.replies}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{getTimeSince(post.timestamp)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {REACTIONS.map((reaction) => (
                            <button
                              key={`${post.id}-${reaction.key}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReact(post.id, reaction.key);
                              }}
                              className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                            >
                              {reaction.emoji}
                            </button>
                          ))}
                          {post.isOwner && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPostId(post.id);
                                  setEditingContent(post.content);
                                }}
                                className="text-xs text-indigo-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePost(post.id);
                                }}
                                className="text-xs text-red-600 flex items-center space-x-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                        {editingPostId === post.id && (
                          <div className="mt-3 border rounded-lg p-3 bg-gray-50">
                            <textarea
                              rows={3}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleUpdatePost(post)} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">
                                Save
                              </button>
                              <button onClick={() => setEditingPostId(null)} className="px-3 py-1 border rounded text-xs">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeTab !== 'saved' && hasMore && (
                <button onClick={loadMore} disabled={loading} className="w-full py-3 rounded-lg border border-gray-300 hover:bg-gray-50">
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveTab('discussions');
                    setActiveCategory(category.id);
                    setOffset(0);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    activeCategory === category.id ? 'bg-rose-50 text-rose-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Trending Tags</h3>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <button
                  key={tag.tag}
                  onClick={() => setSearchQuery(tag.tag)}
                  className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                >
                  #{tag.tag} ({tag.usage_count})
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-2">Community Guidelines</h3>
            <ul className="text-sm text-purple-100 space-y-1">
              <li>• Be kind and supportive</li>
              <li>• Respect privacy</li>
              <li>• No medical diagnoses</li>
              <li>• Share experiences, not prescriptions</li>
              <li>• Report concerning content</li>
            </ul>
          </div>
        </div>
      </div>

      {selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Discussion</h3>
                <button onClick={() => setSelectedPost(null)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <div className="border-b border-gray-100 pb-6 mb-6">
                <p className="text-gray-700 mb-4">{selectedPost.content}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <button onClick={() => handleLikePost(selectedPost.id)} className="flex items-center space-x-1 hover:text-rose-500">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{selectedPost.likes}</span>
                  </button>
                  <button onClick={() => replyInputRef.current?.focus()} className="flex items-center space-x-1 hover:text-blue-500">
                    <Reply className="h-4 w-4" />
                    <span>Reply</span>
                  </button>
                  <button onClick={() => handleBookmark(selectedPost.id)} className="flex items-center space-x-1 hover:text-blue-600">
                    <Bookmark className={`h-4 w-4 ${selectedPost.isBookmarked ? 'fill-current' : ''}`} />
                    <span>{selectedPost.isBookmarked ? 'Saved' : 'Save'}</span>
                  </button>
                  <button onClick={() => handleReport(selectedPost.id)} className="flex items-center space-x-1 hover:text-orange-600">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Report</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <h4 className="font-semibold text-gray-900">Replies ({selectedPost.replies})</h4>
                {(replies[selectedPost.id] || []).map((reply) => (
                  <div key={reply.id} className="flex items-start space-x-4 bg-gray-50 p-4 rounded-lg">
                    <div className="text-xl">{reply.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h5 className="font-medium text-gray-900 text-sm">{reply.author}</h5>
                        <span className="text-xs text-gray-500">{getTimeSince(reply.timestamp)}</span>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{reply.content}</p>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleLikeReply(selectedPost.id, reply.id)} className="flex items-center space-x-1 text-xs text-gray-500 hover:text-rose-500">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{reply.likes}</span>
                        </button>
                        <button
                          onClick={() =>
                            setReplyContent((prev) => ({ ...prev, [selectedPost.id]: `@${reply.author.replace(/\s+/g, '')} ` }))
                          }
                          className="text-xs text-blue-600"
                        >
                          Reply to this
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-6">
                <textarea
                  ref={replyInputRef}
                  rows={3}
                  placeholder="Share your thoughts or support..."
                  value={replyContent[selectedPost.id] || ''}
                  onChange={(e) => setReplyContent((prev) => ({ ...prev, [selectedPost.id]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  disabled={loading}
                />
                <div className="flex items-center justify-between mt-3">
                  <label className="text-xs text-gray-600 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(replyAnonymous[selectedPost.id])}
                      onChange={(e) =>
                        setReplyAnonymous((prev) => ({ ...prev, [selectedPost.id]: e.target.checked }))
                      }
                    />
                    Reply anonymously
                  </label>
                  <button
                    onClick={() => handleAddReply(selectedPost.id)}
                    disabled={loading || !replyContent[selectedPost.id]?.trim()}
                    className="bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Reply</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Create New Post</h3>
                <button onClick={() => setShowNewPost(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {crisisPrompt && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">
                    Crisis-related language detected. If you are in immediate danger, please use Emergency resources now.
                  </p>
                </div>
              )}

              {mentions.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-indigo-700 text-sm">Mentions detected: {mentions.join(', ')}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select value={newPostCategory} onChange={(e) => setNewPostCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  {categories.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Message *</label>
                <textarea
                  rows={6}
                  placeholder="Share your experience, ask a question, or offer support..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input
                  type="text"
                  placeholder="e.g. postpartum, sleep, breastfeeding"
                  value={newPostTags}
                  onChange={(e) => setNewPostTags(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Comma separated. Draft auto-saves automatically.</p>
              </div>

              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input type="checkbox" checked={newPostAnonymous} onChange={(e) => setNewPostAnonymous(e.target.checked)} />
                Post anonymously
              </label>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  disabled={loading || !newPostContent.trim()}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium"
                >
                  {loading ? 'Sharing...' : 'Share Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;