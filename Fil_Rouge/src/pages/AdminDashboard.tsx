import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Ajout de l'import

const BACKEND_URL = "http://localhost:3001";

type User = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
};

type Topic = {
  id: number;
  title: string;
  category: string;
  game: string;
  likes: number;
  createdBy: number;
};

type Post = {
  id: number;
  content: string;
  topicId: number;
  createdBy: number;
  createdAt: string;
};

type Like = {
  id: number;
  user: { id: number; username: string };
  topic: { id: number; title: string };
};

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<"users" | "topics" | "posts" | "likes">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Ajout du hook

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        if (tab === "users") {
          const res = await fetch(`${BACKEND_URL}/users`);
          setUsers(await res.json());
        }
        if (tab === "topics") {
          const res = await fetch(`${BACKEND_URL}/api/topics`);
          setTopics(await res.json());
        }
        if (tab === "posts") {
          const res = await fetch(`${BACKEND_URL}/api/posts`);
          setPosts(await res.json());
        }
        if (tab === "likes") {
          const res = await fetch(`${BACKEND_URL}/api/likes`);
          setLikes(await res.json());
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tab]);

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    const res = await fetch(`${BACKEND_URL}/api/users/${id}`, { method: "DELETE" });
    if (res.ok) setUsers(users.filter(u => u.id !== id));
  };
  const handleDeleteTopic = async (id: number) => {
    if (!window.confirm("Supprimer ce topic ?")) return;
    const res = await fetch(`${BACKEND_URL}/api/topics/${id}`, { method: "DELETE" });
    if (res.ok) setTopics(topics.filter(t => t.id !== id));
  };
  const handleDeletePost = async (id: number) => {
    if (!window.confirm("Supprimer ce post ?")) return;
    const res = await fetch(`${BACKEND_URL}/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) setPosts(posts.filter(p => p.id !== id));
  };
  const handleDeleteLike = async (id: number) => {
    if (!window.confirm("Supprimer ce like ?")) return;
    const res = await fetch(`${BACKEND_URL}/api/likes/${id}`, { method: "DELETE" });
    if (res.ok) setLikes((prev) => prev.filter((l) => l.id !== id));
  };

  const store = JSON.parse(localStorage.getItem("gameforum-store") || "null");
  const userId = store?.state?.user?.id;
  const handleToggleAdmin = async (user: User) => {
    if (user.id === userId) {
      alert("Tu ne peux pas changer ton propre rôle !");
      return;
    }
    const res = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        isAdmin: !user.isAdmin,
      }),
    });
    const data = await res.json();
    if (data.user) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isAdmin: data.user.isAdmin } : u
        )
      );
    } else {
      alert(data.error || "Erreur lors du changement de rôle");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#181c2f] to-[#232946] font-mono text-[#e0e0e0]">
      {/* Bouton Home */}
      <button
        className="fixed top-6 left-6 px-4 py-2 bg-[#232946] border border-[#64ffda] text-[#64ffda] rounded hover:bg-[#64ffda] hover:text-[#232946] transition font-bold shadow-lg z-50"
        onClick={() => navigate("/")}
      >
        ← Accueil
      </button>
      <div className="max-w-6xl mx-auto py-10 px-4">
        <h1 className="text-4xl font-bold mb-8 text-[#64ffda] tracking-widest neon-glow">Admin Dashboard</h1>
        <div className="flex gap-4 mb-8">
          <button
            className={`px-4 py-2 rounded transition-all duration-200 border-b-4 ${
              tab === "users"
                ? "bg-[#232946] border-[#64ffda] text-[#64ffda] neon-glow"
                : "bg-[#181c2f] border-transparent hover:bg-[#232946] hover:text-[#64ffda]"
            }`}
            onClick={() => setTab("users")}
          >
            Utilisateurs
          </button>
          <button
            className={`px-4 py-2 rounded transition-all duration-200 border-b-4 ${
              tab === "topics"
                ? "bg-[#232946] border-[#ff6ec7] text-[#ff6ec7] neon-glow"
                : "bg-[#181c2f] border-transparent hover:bg-[#232946] hover:text-[#ff6ec7]"
            }`}
            onClick={() => setTab("topics")}
          >
            Topics
          </button>
          <button
            className={`px-4 py-2 rounded transition-all duration-200 border-b-4 ${
              tab === "posts"
                ? "bg-[#232946] border-[#f7b801] text-[#f7b801] neon-glow"
                : "bg-[#181c2f] border-transparent hover:bg-[#232946] hover:text-[#f7b801]"
            }`}
            onClick={() => setTab("posts")}
          >
            Posts
          </button>
          <button
            className={`px-4 py-2 rounded transition-all duration-200 border-b-4 ${
              tab === "likes"
                ? "bg-[#232946] border-[#00ffea] text-[#00ffea] neon-glow"
                : "bg-[#181c2f] border-transparent hover:bg-[#232946] hover:text-[#00ffea]"
            }`}
            onClick={() => setTab("likes")}
          >
            Likes
          </button>
        </div>

        {loading && <div className="text-center text-lg">Chargement...</div>}

        {!loading && tab === "users" && (
          <div className="overflow-x-auto rounded-lg shadow-lg bg-[#232946]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#181c2f] text-[#64ffda]">
                  <th className="p-3">ID</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#282d3c] transition">
                    <td className="p-3">{u.id}</td>
                    <td className="p-3">{u.username}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          u.isAdmin
                            ? "bg-[#64ffda] text-[#181c2f]"
                            : "bg-[#232946] text-[#e0e0e0] border border-[#64ffda]"
                        }`}
                      >
                        {u.isAdmin ? "Oui" : "Non"}
                      </span>
                    </td>
                    <td className="p-3 flex gap-2">
                      <button
                        className="px-3 py-1 rounded bg-[#232946] border border-[#64ffda] text-[#64ffda] hover:bg-[#64ffda] hover:text-[#232946] transition neon-glow"
                        onClick={() => handleToggleAdmin(u)}
                      >
                        {u.isAdmin ? "Retirer admin" : "Donner admin"}
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-[#232946] border border-[#ff6ec7] text-[#ff6ec7] hover:bg-[#ff6ec7] hover:text-[#232946] transition"
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === "topics" && (
          <div className="overflow-x-auto rounded-lg shadow-lg bg-[#232946]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#181c2f] text-[#ff6ec7]">
                  <th className="p-3">ID</th>
                  <th className="p-3">Titre</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Jeu</th>
                  <th className="p-3">Likes</th>
                  <th className="p-3">Auteur</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => (
                  <tr key={t.id} className="hover:bg-[#282d3c] transition">
                    <td className="p-3">{t.id}</td>
                    <td className="p-3">{t.title}</td>
                    <td className="p-3">{t.category}</td>
                    <td className="p-3">{t.game}</td>
                    <td className="p-3">{t.likes}</td>
                    <td className="p-3">{t.createdBy}</td>
                    <td className="p-3">
                      <button
                        className="px-3 py-1 rounded bg-[#232946] border border-[#ff6ec7] text-[#ff6ec7] hover:bg-[#ff6ec7] hover:text-[#232946] transition"
                        onClick={() => handleDeleteTopic(t.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === "posts" && (
          <div className="overflow-x-auto rounded-lg shadow-lg bg-[#232946]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#181c2f] text-[#f7b801]">
                  <th className="p-3">ID</th>
                  <th className="p-3">Topic</th>
                  <th className="p-3">Auteur</th>
                  <th className="p-3">Contenu</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#282d3c] transition">
                    <td className="p-3">{p.id}</td>
                    <td className="p-3">{p.topicId}</td>
                    <td className="p-3">{p.createdBy}</td>
                    <td className="p-3">{p.content}</td>
                    <td className="p-3">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      <button
                        className="px-3 py-1 rounded bg-[#232946] border border-[#f7b801] text-[#f7b801] hover:bg-[#f7b801] hover:text-[#232946] transition"
                        onClick={() => handleDeletePost(p.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === "likes" && (
          <div className="overflow-x-auto rounded-lg shadow-lg bg-[#232946]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#181c2f] text-[#00ffea]">
                  <th className="p-3">ID</th>
                  <th className="p-3">Utilisateur</th>
                  <th className="p-3">Topic</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {likes.map((like) => (
                  <tr key={like.id} className="hover:bg-[#282d3c] transition">
                    <td className="p-3">{like.id}</td>
                    <td className="p-3">{like.user?.username ?? "?"}</td>
                    <td className="p-3">{like.topic?.title ?? "?"}</td>
                    <td className="p-3">
                      <button
                        className="px-3 py-1 rounded bg-[#232946] border border-[#00ffea] text-[#00ffea] hover:bg-[#00ffea] hover:text-[#232946] transition"
                        onClick={() => handleDeleteLike(like.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Neon effect */}
      <style>{`
        .neon-glow {
          text-shadow: 0 0 8px #64ffda, 0 0 16px #64ffda, 0 0 32px #64ffda;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;