import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured =
  !!url &&
  !!key &&
  !url.includes("YOUR_PROJECT") &&
  !key.includes("YOUR_PUBLIC");
const db = configured ? createClient(url, key) : null;
const blank = { title: "", description: "", due_date: "" };
const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
const formatDate = (x) =>
  x
    ? new Date(x + "T00:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No due date";

// Keep transport errors readable while retaining useful validation messages.
function errorMessage(error) {
  const message = error?.message || "";
  if (
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(
      message,
    )
  ) {
    return "Unable to connect. Check your internet connection, then refresh to check the latest tasks before retrying.";
  }
  return message || "Something went wrong. Please try again.";
}

function Notice({ error, message }) {
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
    </>
  );
}

function App() {
  const [session, setSession] = useState(null),
    [initial, setInitial] = useState(!!db),
    [tasks, setTasks] = useState([]);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [filter, setFilter] = useState("All tasks"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(blank);
  const [authMessage, setAuthMessage] = useState("");
  const editor = useRef(null),
    generation = useRef(0);
  const uid = session?.user.id;
  useEffect(() => {
    if (!db) return;
    let active = true;
    db.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          if (error) setError(errorMessage(error));
          setSession(data.session);
          setInitial(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e));
          setInitial(false);
        }
      });
    const { data } = db.auth.onAuthStateChange((_event, s) => {
      if (active) {
        setSession(s);
        setInitial(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function refresh() {
    if (!uid) return;
    const n = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const { data, error } = await db
        .from("tasks")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (n !== generation.current) return;
      if (error) throw error;
      setTasks(data);
    } catch (e) {
      if (n === generation.current) setError(errorMessage(e));
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (uid) setAuthMessage("");
    setTasks([]);
    setEditing(null);
    setForm(blank);
    setQuery("");
    setFilter("All tasks");
    if (uid) refresh();
    return () => {
      generation.current++;
    };
  }, [uid]);
  async function authenticate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setAuthMessage("");
    try {
      const credentials = { email: email.trim(), password };
      const result =
        mode === "login"
          ? await db.auth.signInWithPassword(credentials)
          : await db.auth.signUp({
              ...credentials,
              options: { emailRedirectTo: window.location.origin },
            });
      if (result.error) throw result.error;
      setPassword("");
      if (mode === "signup" && !result.data.session)
        setAuthMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const fields = {
        title: form.title.trim(),
        description: form.description.trim(),
        due_date: form.due_date || null,
      };
      const result = editing
        ? await db
            .from("tasks")
            .update(fields)
            .eq("id", editing)
            .eq("user_id", uid)
            .select()
            .single()
        : await db
            .from("tasks")
            .insert({ ...fields, user_id: uid })
            .select()
            .single();
      if (result.error) throw result.error;
      setForm(blank);
      setEditing(null);
      setMessage(editing ? "Task updated." : "Task added.");
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function change(task, remove = false) {
    if (
      remove &&
      !window.confirm('Delete "' + task.title + '"? This cannot be undone.')
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = remove
        ? await db
            .from("tasks")
            .delete()
            .eq("id", task.id)
            .eq("user_id", uid)
            .select()
            .single()
        : await db
            .from("tasks")
            .update({ completed: !task.completed })
            .eq("id", task.id)
            .eq("user_id", uid)
            .select()
            .single();
      if (result.error) throw result.error;
      if (remove && editing === task.id) {
        setEditing(null);
        setForm(blank);
      }
      setMessage(remove ? "Task deleted." : "Task status updated.");
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      setTasks([]);
      setMessage("");
      setAuthMessage("");
      setSession(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const completed = tasks.filter((t) => t.completed).length;
  const visible = tasks.filter(
    (t) =>
      (filter === "All tasks" ||
        (filter === "Completed" ? t.completed : !t.completed)) &&
      (t.title + " " + t.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const notice = (
    <Notice error={error} message={session ? message : authMessage} />
  );
  if (initial)
    return (
      <main className="center">
        <p role="status">Opening your workspace…</p>
      </main>
    );
  if (!configured)
    return (
      <main className="setup">
        <div className="brand">☁ Cloud Task Manager</div>
        <h1>Your workspace starts here.</h1>
        <p>
          The app is ready for its Supabase connection. No tasks are being saved
          yet.
        </p>
        <ol>
          <li>
            Run <code>supabase/schema.sql</code> in your new Supabase project.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code>.
          </li>
          <li>Add your project URL and public publishable key.</li>
          <li>Restart the development server.</li>
        </ol>
        <p>See README.md for the full setup and deployment steps.</p>
      </main>
    );
  if (!session)
    return (
      <main className="auth-layout">
        <section className="intro">
          <div className="brand">☁ Cloud Task Manager</div>
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1>
            Make room for
            <br />
            what matters.
          </h1>
          <p>
            Keep your assignments, deadlines and daily plans together in one
            personal cloud workspace.
          </p>
          <div className="illustration" aria-hidden="true">
            <span>YOUR NEXT SMALL WIN</span>
            <h2>One task at a time.</h2>
            <p>✓ Plan your week</p>
            <p>✓ Stay on top of deadlines</p>
            <p>○ Make progress</p>
          </div>
          <small>Cloud Computing Lab · Muhammad Ismail · K22SW034</small>
        </section>
        <section className="auth-form">
          <div className="auth-inner">
            <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
            <h2>{mode === "login" ? "Welcome back." : "A fresh start."}</h2>
            <p>
              {mode === "login"
                ? "Sign in to pick up where you left off."
                : "Create an account to keep your tasks in the cloud."}
            </p>
            {notice}
            <form onSubmit={authenticate}>
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <button className="primary wide" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in →"
                    : "Create account →"}
              </button>
            </form>
            <p className="switch">
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button
                disabled={busy}
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                  setMessage("");
                  setAuthMessage("");
                }}
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
        </section>
      </main>
    );
  return (
    <div className="app">
      <aside>
        <div className="brand">☁ Cloud Task Manager</div>
        <p className="eyebrow">WORKSPACE</p>
        <nav aria-label="Task filters">
          {["All tasks", "Pending", "Completed"].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
              aria-current={filter === f ? "page" : undefined}
            >
              {f}
              <span>
                {f === "All tasks"
                  ? tasks.length
                  : f === "Completed"
                    ? completed
                    : tasks.length - completed}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Small steps.
            <br />
            <strong>Real progress.</strong>
          </p>
          <small>
            Cloud Computing Lab
            <br />
            K22SW034
          </small>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <span className="eyebrow">MY WORKSPACE / OVERVIEW</span>
          <div className="account">
            <span>{session.user.email}</span>
            <button disabled={busy} onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <section className="heading">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1>A clearer day starts here.</h1>
            <p>Plan a little. Focus on what comes next.</p>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setForm(blank);
              editor.current?.focus();
            }}
          >
            ＋ New task
          </button>
        </section>
        <section className="stats" aria-label="Task statistics">
          {[
            ["Total tasks", tasks.length],
            ["Still to do", tasks.length - completed],
            ["Completed", completed],
          ].map(([label, n]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{n}</strong>
              <small>
                {label === "Completed"
                  ? "Progress worth celebrating"
                  : label === "Still to do"
                    ? "One step at a time"
                    : "Everything in your workspace"}
              </small>
            </article>
          ))}
        </section>
        {notice}
        <div className="content">
          <section className="task-panel">
            <div className="panel-title">
              <h2>{filter}</h2>
              <button onClick={refresh} disabled={loading || busy}>
                ↻ Refresh
              </button>
            </div>
            <label className="search">
              <span className="sr-only">Search tasks</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your tasks…"
              />
            </label>
            {loading ? (
              <p role="status" className="empty">
                Loading your tasks…
              </p>
            ) : visible.length === 0 ? (
              <div className="empty">
                <span>☁</span>
                <h3>
                  {tasks.length
                    ? "Nothing matches just yet."
                    : "A little space for your next idea."}
                </h3>
                <p>
                  {tasks.length
                    ? "Try another search or filter."
                    : "Add your first task using the form alongside."}
                </p>
              </div>
            ) : (
              <ul className="task-list">
                {visible.map((t) => (
                  <li key={t.id}>
                    <button
                      className={"check " + (t.completed ? "done" : "")}
                      aria-label={
                        (t.completed ? "Mark pending: " : "Mark completed: ") +
                        t.title
                      }
                      aria-pressed={t.completed}
                      disabled={busy}
                      onClick={() => change(t)}
                    >
                      {t.completed ? "✓" : ""}
                    </button>
                    <div className="task-text">
                      <h3 className={t.completed ? "strike" : ""}>{t.title}</h3>
                      {t.description && <p>{t.description}</p>}
                      <div className="tags">
                        <span className={t.completed ? "green" : "gold"}>
                          {t.completed ? "Completed" : "Pending"}
                        </span>
                        <span
                          className={
                            !t.completed && t.due_date && t.due_date < today()
                              ? "overdue"
                              : ""
                          }
                        >
                          {formatDate(t.due_date)}
                          {!t.completed && t.due_date && t.due_date < today()
                            ? " · Overdue"
                            : ""}
                        </span>
                      </div>
                      <div className="task-actions">
                        <button
                          disabled={busy}
                          onClick={() => {
                            setEditing(t.id);
                            setForm({
                              title: t.title,
                              description: t.description,
                              due_date: t.due_date || "",
                            });
                            editor.current?.focus();
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => change(t, true)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="editor">
            <span className="eyebrow">MAKE A LITTLE PLAN</span>
            <h2>{editing ? "Edit your task" : "What’s next?"}</h2>
            <p>Give your next step a place to live.</p>
            <form onSubmit={save}>
              <label>
                Task title
                <input
                  ref={editor}
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Finish the cloud lab report"
                />
              </label>
              <label>
                Description <small>(optional)</small>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="A few details to help you get started…"
                />
              </label>
              <label>
                Due date <small>(optional)</small>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </label>
              <button className="primary wide" disabled={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "＋ Add task"}
              </button>
              {editing && (
                <button
                  type="button"
                  disabled={busy}
                  className="wide cancel"
                  onClick={() => {
                    setEditing(null);
                    setForm(blank);
                  }}
                >
                  Cancel editing
                </button>
              )}
            </form>
            <p className="privacy">Your tasks belong to your account.</p>
          </section>
        </div>
        <footer>
          Cloud Task Manager <span>Built for a more organised day.</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
