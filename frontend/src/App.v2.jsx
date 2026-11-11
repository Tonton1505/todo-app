import React, { useState, useEffect } from 'react';

// Read Backend URL from environment variable import.meta.env.VITE_BACKEND_URL with fallback
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
  const [version, setVersion] = useState('v2.0');

  const extractK8sMeta = (responseData) => {
    if (responseData && responseData._k8s_meta) {
      if (responseData._k8s_meta.podName) setPodName(responseData._k8s_meta.podName);
      if (responseData._k8s_meta.version) setVersion(responseData._k8s_meta.version);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`);
      if (!response.ok) throw new Error(`Lỗi máy chủ: HTTP ${response.status}`);
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

  const handleAddTask = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || submitting) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Lỗi máy chủ: HTTP ${response.status}`);
      }

      const data = await response.json();
      const newTask = data.task || data.data;
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

  const handleToggleTask = async (task) => {
    const nextCompletedState = !task.completed;
    setTasks((prevTasks) =>
      prevTasks.map((item) =>
        item.id === task.id ? { ...item, completed: nextCompletedState } : item
      )
    );

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      {/* Background Subtle Fire/Hot Grid Accent */}
      <div className="fixed inset-0 pointer-events-none opacity-30 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Centered Application Card - V2.0 Hot Update */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl shadow-orange-500/10 border-2 border-orange-300 overflow-hidden flex flex-col transition-all">
        
        {/* Top Hot-Release Bar Header */}
        <div className="bg-gradient-to-r from-orange-600 via-red-600 to-amber-600 px-6 py-2.5 flex items-center justify-between text-white border-b border-red-700">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-amber-200 fill-current"
              viewBox="0 0 128 128"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M64 4C30.86 4 4 30.86 4 64s26.86 60 60 60 60-26.86 60-60S97.14 4 64 4zm28.7 85.83c-1.85 2.12-5.46 3.63-9.15 3.84-2.81.16-5.84-.73-8.02-2.48-3.03-2.43-4.63-6.52-5.26-10.36-.6-3.66-.46-7.53-.19-11.23.23-3.1.53-6.2.78-9.3.16-1.95.27-4.04-.6-5.82-1.07-2.19-3.48-3.34-5.82-3.82-3.23-.66-6.66-.44-9.84.44-2.93.81-5.71 2.37-7.66 4.74-2.26 2.75-3.35 6.39-3.93 9.87-.64 3.84-.71 7.78-.54 11.67.14 3.16.48 6.43-.8 9.35-1.12 2.56-3.48 4.41-6.19 5.22-3.17.95-6.81.54-9.61-1.2-3.22-2-5.18-5.63-6.17-9.28-1.57-5.8-1.55-12.02-.91-17.97.74-6.9 2.58-13.78 6.06-19.78 3.84-6.63 9.47-12.06 16.32-15.63 7.37-3.84 15.89-5.19 24.11-4.22 8.35.98 16.44 4.54 22.86 10.09 6.36 5.5 10.87 12.87 13.06 21.07 1.94 7.28 1.99 15.11.16 22.44-1.21 4.86-3.76 9.49-7.22 13.08z" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-100">
              PostgreSQL HA Cluster &bull; Release V2.0
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
            <span className="text-[11px] font-mono text-amber-200">Rollout Live</span>
          </div>
        </div>

        {/* Card Header - Theme V2.0 Hot Update */}
        <header className="p-6 pb-4 bg-gradient-to-b from-orange-50/70 to-white border-b border-orange-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-wide uppercase bg-gradient-to-r from-orange-600 via-red-600 to-amber-600 bg-clip-text text-transparent">
                🔥 K8S TODO APP - PHIÊN BẢN 2.0 (HOT UPDATE)
              </h1>
              <p className="text-xs text-orange-700/80 font-medium mt-0.5">
                Giao diện nâng cấp V2.0 • Sẵn sàng demo Kubernetes Rolling Update
              </p>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                Tổng: <strong className="ml-1">{tasks.length}</strong>
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                Xong: <strong className="ml-1">{completedCount}</strong>
              </span>
            </div>
          </div>
        </header>

        {/* Card Body */}
        <div className="p-6 flex-1 flex flex-col space-y-5">
          {/* Form input and submit button with Orange Gradient & hover:scale-105 */}
          <form onSubmit={handleAddTask} className="flex gap-2.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-orange-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập công việc phiên bản V2.0..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-orange-50/40 border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white transition shadow-inner placeholder-orange-300"
                disabled={submitting}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 hover:scale-105 shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {submitting ? 'Đang thêm...' : 'Thêm công việc'}
            </button>
          </form>

          {/* Error Message Notification */}
          {errorMessage && (
            <div className="p-3.5 bg-red-100 border-l-4 border-red-600 text-red-800 text-xs rounded-r-xl flex items-center justify-between shadow-sm">
              <span className="font-medium">⚠ {errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="font-bold text-red-500 hover:text-red-900 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Task List (ul / li) */}
          <div className="flex-1">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-orange-500 animate-pulse">
                <svg className="w-8 h-8 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-mono">Đang nạp dữ liệu từ Kubernetes Pod...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-orange-200 rounded-xl bg-orange-50/40">
                <p className="text-sm font-semibold text-orange-700">Chưa có công việc nào trong phiên bản V2.0</p>
                <p className="text-xs text-orange-500 mt-1">Thêm một task mới để kiểm tra giao diện Hot Update!</p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                      task.completed
                        ? 'bg-orange-50/50 border-orange-200 border-l-4 border-l-red-500'
                        : 'bg-white border-orange-100 border-l-4 border-l-orange-500 hover:border-orange-300 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(task.completed)}
                      onChange={() => {}}
                      className="w-4 h-4 text-orange-600 accent-orange-600 rounded border-orange-300 focus:ring-orange-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                      #{task.id}
                    </span>
                    <span
                      className={`text-sm flex-1 break-words font-medium transition ${
                        task.completed
                          ? 'line-through text-slate-400 decoration-red-500 decoration-2'
                          : 'text-slate-800'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.completed && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-md">
                        Đã xong
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer: K8s Status Bar - Nền Đỏ thẫm, chữ Vàng, Animate Pulse */}
        <footer className="bg-red-950 text-yellow-300 font-mono text-xs md:text-sm px-4 py-3.5 text-center border-t-2 border-red-800 tracking-wide select-none animate-pulse shadow-inner">
          🚀 Đang xử lý bởi Pod: <span className="font-bold text-yellow-200 underline decoration-yellow-400">{podName}</span> | Phiên bản: <span className="font-black text-white bg-red-800 px-2 py-0.5 rounded">{version}</span>
        </footer>

      </div>
    </div>
  );
}
