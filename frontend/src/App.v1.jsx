import React, { useState, useEffect } from 'react';

// Read Backend URL from environment variable
const RAW_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const BACKEND_URL = RAW_BACKEND_URL.replace(/\/$/, '');

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // State storing K8s Pod metadata
  const [podName, setPodName] = useState('Đang kết nối...');
  const [version, setVersion] = useState('v1.0');

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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
        <header className="p-6 pb-4 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-blue-600 text-center tracking-tight">
            K8s Todo App - V1.0
          </h1>
          <p className="text-xs text-gray-500 text-center mt-1">
            Ứng dụng quản lý công việc trên nền tảng Kubernetes
          </p>
        </header>

        <div className="p-6 flex-1 flex flex-col space-y-5">
          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập công việc cần làm..."
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-5 py-2 rounded-lg text-sm transition duration-150 flex items-center justify-center whitespace-nowrap shadow-sm"
            >
              {submitting ? 'Đang thêm...' : 'Thêm'}
            </button>
          </form>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="font-bold ml-2 text-red-400 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-400 animate-pulse">
                Đang tải dữ liệu từ Pod...
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Chưa có công việc nào. Hãy thêm công việc đầu tiên!
              </div>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-blue-50/50 hover:border-blue-100 transition cursor-pointer select-none bg-gray-50/50"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(task.completed)}
                      onChange={() => {}}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span
                      className={`text-sm flex-1 break-words transition ${
                        task.completed ? 'line-through text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="bg-black text-green-400 font-mono text-xs px-4 py-3 text-center border-t border-gray-800 tracking-wide select-none">
          🚀 Đang xử lý bởi Pod: <span className="font-semibold text-green-300">{podName}</span> | Phiên bản: <span className="font-semibold text-green-300">{version}</span>
        </footer>
      </div>
    </div>
  );
}
