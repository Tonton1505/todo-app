import React, { useState, useEffect } from 'react';

// Read Backend URL from environment variable import.meta.env.VITE_BACKEND_URL
const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const BACKEND_URL = RAW_BACKEND_URL.replace(/\/$/, '');

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Kubernetes Pod metadata extracted from backend response _k8s_meta
  const [podName, setPodName] = useState('Đang kết nối...');
  const [version, setVersion] = useState('v1.0');

  // Helper to extract podName and version from response _k8s_meta
  const extractK8sMeta = (responseData) => {
    if (responseData && responseData._k8s_meta) {
      if (responseData._k8s_meta.podName) {
        setPodName(responseData._k8s_meta.podName);
      }
      if (responseData._k8s_meta.version) {
        setVersion(responseData._k8s_meta.version);
      }
    }
  };

  // 1. GET /api/tasks: Fetch task list on initial mount
  const fetchTasks = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`);
      if (!response.ok) {
        throw new Error(`Lỗi máy chủ: HTTP ${response.status}`);
      }
      const data = await response.json();
      setTasks(data.tasks || data.data || []);
      extractK8sMeta(data);
    } catch (error) {
      console.error('Lỗi khi gọi GET /api/tasks:', error);
      setErrorMessage(error.message || 'Không thể kết nối đến Backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // 2. POST /api/tasks: Add new task
  const handleAddTask = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || submitting) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Lỗi máy chủ: HTTP ${response.status}`);
      }

      const data = await response.json();
      const newTask = data.task || data.data;

      // Prepend to maintain ID descending order
      setTasks((prevTasks) => [newTask, ...prevTasks]);
      setTitle('');
      extractK8sMeta(data);
    } catch (error) {
      console.error('Lỗi khi gọi POST /api/tasks:', error);
      setErrorMessage(error.message || 'Thêm công việc thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. PUT /api/tasks/:id: Toggle task completion status
  const handleToggleTask = async (task) => {
    const nextCompletedState = !task.completed;

    // Optimistic UI update
    setTasks((prevTasks) =>
      prevTasks.map((item) =>
        item.id === task.id ? { ...item, completed: nextCompletedState } : item
      )
    );

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: nextCompletedState }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Lỗi máy chủ: HTTP ${response.status}`);
      }

      const data = await response.json();
      extractK8sMeta(data);
    } catch (error) {
      console.error(`Lỗi khi gọi PUT /api/tasks/${task.id}:`, error);
      // Rollback UI update on failure
      setTasks((prevTasks) =>
        prevTasks.map((item) =>
          item.id === task.id ? { ...item, completed: task.completed } : item
        )
      );
      setErrorMessage(error.message || 'Cập nhật trạng thái thất bại.');
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Background Subtle Tech Grid Accent */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#336791_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Centered Application Card - PostgreSQL Blue Inspired */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl shadow-slate-300/60 border border-slate-200 overflow-hidden flex flex-col transition-all">
        
        {/* PostgreSQL Top Navigation Bar Header */}
        <div className="bg-[#336791] px-6 py-2.5 flex items-center justify-between text-white border-b border-[#275073]">
          <div className="flex items-center gap-2">
            {/* PostgreSQL Elephant Logo SVG */}
            <svg
              className="w-5 h-5 text-white fill-current opacity-95"
              viewBox="0 0 128 128"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M64 4C30.86 4 4 30.86 4 64s26.86 60 60 60 60-26.86 60-60S97.14 4 64 4zm28.7 85.83c-1.85 2.12-5.46 3.63-9.15 3.84-2.81.16-5.84-.73-8.02-2.48-3.03-2.43-4.63-6.52-5.26-10.36-.6-3.66-.46-7.53-.19-11.23.23-3.1.53-6.2.78-9.3.16-1.95.27-4.04-.6-5.82-1.07-2.19-3.48-3.34-5.82-3.82-3.23-.66-6.66-.44-9.84.44-2.93.81-5.71 2.37-7.66 4.74-2.26 2.75-3.35 6.39-3.93 9.87-.64 3.84-.71 7.78-.54 11.67.14 3.16.48 6.43-.8 9.35-1.12 2.56-3.48 4.41-6.19 5.22-3.17.95-6.81.54-9.61-1.2-3.22-2-5.18-5.63-6.17-9.28-1.57-5.8-1.55-12.02-.91-17.97.74-6.9 2.58-13.78 6.06-19.78 3.84-6.63 9.47-12.06 16.32-15.63 7.37-3.84 15.89-5.19 24.11-4.22 8.35.98 16.44 4.54 22.86 10.09 6.36 5.5 10.87 12.87 13.06 21.07 1.94 7.28 1.99 15.11.16 22.44-1.21 4.86-3.76 9.49-7.22 13.08z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-100">
              PostgreSQL &bull; Kubernetes Stack
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-mono text-emerald-300">Cluster Online</span>
          </div>
        </div>

        {/* Card Header - Theme V1.0: Blue Title */}
        <header className="p-6 pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#336791] tracking-tight">
                K8s Todo App - V1.0
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý tiến độ công việc trên hạ tầng Kubernetes & PostgreSQL
              </p>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#336791]/10 text-[#336791] border border-[#336791]/20">
                Tổng: <strong className="ml-1">{tasks.length}</strong>
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Xong: <strong className="ml-1">{completedCount}</strong>
              </span>
            </div>
          </div>
        </header>

        {/* Card Body */}
        <div className="p-6 flex-1 flex flex-col space-y-5">
          {/* Form input and submit button (Theme V1.0 Blue Button) */}
          <form onSubmit={handleAddTask} className="flex gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập công việc cần thực hiện vào database..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50/70 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#336791] focus:border-[#336791] focus:bg-white transition shadow-inner placeholder-slate-400"
                disabled={submitting}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-[#336791] hover:bg-[#275073] active:bg-[#1e3e5b] disabled:bg-[#336791]/50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition duration-150 flex items-center justify-center gap-1.5 whitespace-nowrap shadow-md shadow-[#336791]/20 cursor-pointer"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang ghi...
                </>
              ) : (
                'Thêm công việc'
              )}
            </button>
          </form>

          {/* Error Message Notification */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-r-xl flex items-center justify-between shadow-sm animate-shake">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="font-bold text-red-400 hover:text-red-700 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Task List (ul / li) */}
          <div className="flex-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <svg className="w-8 h-8 text-[#336791] animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-mono">SELECT * FROM tasks ORDER BY id DESC;</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Bảng dữ liệu tasks đang trống</p>
                <p className="text-xs text-slate-400 mt-1">Hãy thêm công việc đầu tiên để lưu vào PostgreSQL!</p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      task.completed
                        ? 'bg-slate-50/80 border-slate-200 border-l-4 border-l-emerald-500'
                        : 'bg-white border-slate-200 border-l-4 border-l-[#336791] hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Checkbox with custom style */}
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={Boolean(task.completed)}
                        onChange={() => {}} // Handled by li onClick
                        className="w-4 h-4 text-[#336791] rounded border-slate-300 focus:ring-[#336791] cursor-pointer"
                      />
                    </div>

                    {/* Task ID pill */}
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 group-hover:bg-slate-200 transition">
                      #{task.id}
                    </span>

                    {/* Task Title */}
                    <span
                      className={`text-sm flex-1 break-words font-medium transition ${
                        task.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-800'
                      }`}
                    >
                      {task.title}
                    </span>

                    {/* Completion status tag */}
                    {task.completed ? (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                        Done
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-50 text-[#336791] rounded-md opacity-0 group-hover:opacity-100 transition">
                        Pending
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer: K8s Status Bar - Strictly Black BG, Neon Green text */}
        <footer className="bg-black text-green-400 font-mono text-xs px-4 py-3.5 text-center border-t border-slate-800 tracking-wide select-none">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            🚀 Đang xử lý bởi Pod: <span className="font-semibold text-green-300">{podName}</span> | Phiên bản: <span className="font-semibold text-green-300">{version}</span>
          </span>
        </footer>

      </div>
    </div>
  );
}
