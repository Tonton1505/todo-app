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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-orange-300 overflow-hidden flex flex-col transition-all duration-300">
        <header className="p-6 pb-4 bg-gradient-to-r from-orange-50 via-red-50 to-orange-50 border-b border-orange-200">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-red-600 text-white rounded-full shadow-sm animate-pulse">
              Live Release
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-center tracking-wide uppercase bg-gradient-to-r from-orange-600 via-red-600 to-amber-600 bg-clip-text text-transparent drop-shadow-sm">
            🔥 K8S TODO APP - PHIÊN BẢN 2.0 (HOT UPDATE)
          </h1>
          <p className="text-xs text-orange-700/80 text-center font-medium mt-1">
            Giao diện nâng cấp V2.0 • Sẵn sàng demo Kubernetes Rolling Update
          </p>
        </header>

        <div className="p-6 flex-1 flex flex-col space-y-5">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập công việc phiên bản V2.0..."
              className="flex-1 px-4 py-2.5 text-sm border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-inner bg-orange-50/30"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-orange-400/50 flex items-center justify-center whitespace-nowrap cursor-pointer"
            >
              {submitting ? 'Đang thêm...' : 'Thêm công việc'}
            </button>
          </form>

          {errorMessage && (
            <div className="p-3 bg-red-100 border-l-4 border-red-600 text-red-800 text-xs rounded-r-lg flex items-center justify-between shadow-sm">
              <span className="font-medium">⚠ {errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="font-bold ml-2 text-red-500 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex-1">
            {loading ? (
              <div className="py-10 text-center text-sm font-semibold text-orange-500 animate-pulse">
                ⏳ Đang nạp dữ liệu từ Kubernetes Pod...
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-orange-600/70 font-medium bg-orange-50/50 rounded-xl border border-dashed border-orange-200">
                🎉 Chưa có công việc nào. Thêm một task mới để kiểm tra V2.0!
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-orange-100 hover:border-orange-300 hover:bg-orange-50/70 transition-all cursor-pointer select-none bg-white shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(task.completed)}
                      onChange={() => {}}
                      className="w-4 h-4 text-orange-600 accent-orange-600 rounded border-orange-300 focus:ring-orange-500 cursor-pointer"
                    />
                    <span
                      className={`text-sm flex-1 break-words font-medium transition ${
                        task.completed
                          ? 'line-through text-gray-400 decoration-red-500 decoration-2'
                          : 'text-gray-800'
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

        <footer className="bg-red-950 text-yellow-300 font-mono text-xs md:text-sm px-4 py-3.5 text-center border-t-2 border-red-800 tracking-wide select-none animate-pulse shadow-inner">
          🚀 Đang xử lý bởi Pod: <span className="font-bold text-yellow-200 underline decoration-yellow-400">{podName}</span> | Phiên bản: <span className="font-black text-white bg-red-800 px-2 py-0.5 rounded">{version}</span>
        </footer>
      </div>
    </div>
  );
}
