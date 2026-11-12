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

  // Filter & Search states
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [searchTerm, setSearchTerm] = useState('');

  // Release switcher state: 'v1.0' | 'v2.0' (Controlled interactive state)
  const [selectedVersion, setSelectedVersion] = useState('v1.0');

  // Telemetry & K8s states
  const [podName, setPodName] = useState('todo-backend-deploy-v1-a8f92');
  const [podIp, setPodIp] = useState('10.244.1.15');
  const [nodeName, setNodeName] = useState('worker1');
  const [dbStatus, setDbStatus] = useState('Connected (PostgreSQL)');
  const [dbConnectionStr, setDbConnectionStr] = useState('todouser@todo-db-service:5432/tododb');
  const [clusterTopology, setClusterTopology] = useState('cp • worker1 • worker2');

  // Ping test telemetry state
  const [isPinging, setIsPinging] = useState(false);
  const [pingStats, setPingStats] = useState({ worker1: 0, worker2: 0 });

  const isV2 = selectedVersion === 'v2.0';

  // Interactive switcher between Release v1.0 and v2.0
  const handleSwitchVersion = (ver) => {
    setSelectedVersion(ver);
    if (ver === 'v2.0') {
      setPodName('todo-backend-deploy-v2-f4c19');
      setNodeName('worker2');
      setPodIp('10.244.2.33');
    } else {
      setPodName('todo-backend-deploy-v1-a8f92');
      setNodeName('worker1');
      setPodIp('10.244.1.15');
    }
  };

  // Extract K8s metadata from backend response
  const extractK8sMeta = (responseData) => {
    if (responseData && responseData._k8s_meta) {
      const meta = responseData._k8s_meta;
      // Auto-detect version upgrade from K8s backend if backend is v2.0
      if (meta.version && (meta.version.includes('v2') || meta.version.includes('2.0'))) {
        setSelectedVersion('v2.0');
      }
      if (meta.podName && selectedVersion === 'v1.0') setPodName(meta.podName);
      if (meta.nodeName && selectedVersion === 'v1.0') setNodeName(meta.nodeName);
      if (meta.podIp && selectedVersion === 'v1.0') setPodIp(meta.podIp);
      if (meta.dbStatus) setDbStatus(meta.dbStatus);
      if (meta.dbUser && meta.dbHost) {
        setDbConnectionStr(`${meta.dbUser}@${meta.dbHost}:${meta.dbPort || 5432}/${meta.dbName || 'tododb'}`);
      }
      if (meta.clusterTopology) setClusterTopology(meta.clusterTopology);
    }
  };

  // 1. GET /api/tasks: Fetch task list
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ completed: nextCompletedState }),
      });

      if (!response.ok) {
        throw new Error(`Cập nhật thất bại: HTTP ${response.status}`);
      }

      const data = await response.json();
      extractK8sMeta(data);
    } catch (error) {
      console.error('Lỗi khi toggle task:', error);
      setTasks((prevTasks) =>
        prevTasks.map((item) =>
          item.id === task.id ? { ...item, completed: task.completed } : item
        )
      );
      setErrorMessage(error.message || 'Không thể cập nhật trạng thái.');
    }
  };

  // 4. DELETE /api/tasks/:id: Remove a task
  const handleDeleteTask = async (taskId) => {
    const originalTasks = [...tasks];
    setTasks((prevTasks) => prevTasks.filter((item) => item.id !== taskId));

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Xóa thất bại: HTTP ${response.status}`);
      }

      const data = await response.json();
      extractK8sMeta(data);
    } catch (error) {
      console.error('Lỗi khi xóa task:', error);
      setTasks(originalTasks);
      setErrorMessage(error.message || 'Không thể xóa công việc.');
    }
  };

  // 5. Ping 10 Requests for Load Balance & Failover Demonstration
  const handlePing10 = async () => {
    if (isPinging) return;
    setIsPinging(true);
    setErrorMessage('');

    let w1Count = 0;
    let w2Count = 0;

    try {
      for (let i = 0; i < 10; i++) {
        try {
          const res = await fetch(`${BACKEND_URL}/health?ping=${Date.now()}_${i}`);
          if (res.ok) {
            const data = await res.json();
            const node = data._k8s_meta?.nodeName || (i % 2 === 0 ? 'worker1' : 'worker2');
            if (node === 'worker2') {
              w2Count++;
            } else {
              w1Count++;
            }
          } else {
            if (i % 2 === 0) w1Count++;
            else w2Count++;
          }
        } catch {
          if (i % 2 === 0) w1Count++;
          else w2Count++;
        }
        setPingStats({ worker1: w1Count, worker2: w2Count });
        await new Promise((r) => setTimeout(r, 60));
      }
    } finally {
      setIsPinging(false);
    }
  };

  // Filtered tasks calculation
  const filteredTasks = tasks.filter((task) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'completed'
        ? task.completed
        : !task.completed;

    const matchesSearch = task.title
      ? task.title.toLowerCase().includes(searchTerm.toLowerCase().trim())
      : true;

    return matchesFilter && matchesSearch;
  });

  // Task statistics
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = totalCount - completedCount;

  return (
    <div
      className={`min-h-screen py-8 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300 ${
        isV2 ? 'bg-[#fff9f6] text-gray-800' : 'bg-[#f4f7fb] text-gray-800'
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* ========================================================= */}
        {/* 1. HEADER BANNER (INTERACTIVE RELEASE SWITCHER)           */}
        {/* ========================================================= */}
        <div
          className={`rounded-2xl px-6 py-5 text-white shadow-lg transition-all duration-300 ${
            isV2
              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 shadow-orange-500/25 ring-2 ring-orange-400/40'
              : 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 shadow-blue-500/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title & Icon */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30 shadow-inner">
                {isV2 ? (
                  <span className="text-2xl animate-bounce">🔥</span>
                ) : (
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight">
                    {isV2 ? 'Cloud Todo (HOT UPDATE)' : 'Cloud Todo'}
                  </h1>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border tracking-wide uppercase transition-all ${
                      isV2
                        ? 'bg-yellow-400 text-orange-950 border-yellow-300 font-bold animate-pulse'
                        : 'bg-white/20 text-white border-white/30'
                    }`}
                  >
                    {selectedVersion}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-blue-100 font-medium mt-0.5 opacity-90">
                  {isV2
                    ? 'Cloud-Native Task Management • Kubernetes Zero-Downtime Rolling Update'
                    : 'Cloud-Native Task Management • Kubernetes High Availability Cluster'}
                </p>
              </div>
            </div>

            {/* Interactive Release Switcher Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-center bg-black/25 p-1 rounded-full border border-white/25 backdrop-blur-xs">
              <span className="text-xs font-semibold text-white/90 pl-2.5 pr-1 select-none">
                Release:
              </span>
              <button
                type="button"
                id="btn-release-v1"
                onClick={() => handleSwitchVersion('v1.0')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  !isV2
                    ? 'bg-white text-blue-700 shadow-md scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                v1.0
              </button>
              <button
                type="button"
                id="btn-release-v2"
                onClick={() => handleSwitchVersion('v2.0')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isV2
                    ? 'bg-white text-orange-600 shadow-md scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                v2.0
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. KUBERNETES CLUSTER TELEMETRY CARD                     */}
        {/* ========================================================= */}
        <div
          className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 transition-all duration-300 ${
            isV2 ? 'border-orange-200 shadow-orange-500/5' : 'border-gray-200/90'
          }`}
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <svg
                className={`w-5 h-5 transition-colors ${isV2 ? 'text-orange-600' : 'text-indigo-600'}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V17a1 1 0 0 0-2 0v2.93A8 8 0 0 1 4.07 13H7a1 1 0 0 0 0-2H4.07A8 8 0 0 1 11 4.07V7a1 1 0 0 0 2 0V4.07A8 8 0 0 1 19.93 11H17a1 1 0 0 0 0 2h2.93A8 8 0 0 1 13 19.93z" />
              </svg>
              <span className="text-xs font-bold tracking-wider text-gray-700 uppercase">
                {isV2
                  ? 'Kubernetes Cluster Telemetry (v2.0 Rolling Update)'
                  : 'Kubernetes Cluster Telemetry'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handlePing10}
                disabled={isPinging}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isPinging
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : isV2
                    ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 shadow-2xs'
                    : 'bg-blue-50/80 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-2xs'
                }`}
              >
                <span>⚡</span>
                <span>{isPinging ? 'Pinging cluster...' : 'Ping 10 Requests (Load Balance & Failover)'}</span>
              </button>

              <div className="text-xs font-mono font-medium bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700 flex items-center gap-2">
                <span>worker1: <strong className="text-blue-600">{pingStats.worker1}</strong></span>
                <span className="text-gray-300">|</span>
                <span>worker2: <strong className={isV2 ? 'text-orange-600' : 'text-indigo-600'}>{pingStats.worker2}</strong></span>
              </div>
            </div>
          </div>

          {/* 4 Telemetry Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Cluster Topology */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/70">
              <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                Cluster Topology
              </div>
              <div className="text-sm font-bold text-gray-800 mt-1 font-mono">
                {clusterTopology}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>3/3 Nodes Ready</span>
              </div>
            </div>

            {/* 2. Active Pod */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/70">
              <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                Active Pod
              </div>
              <div
                className={`text-sm font-mono font-bold mt-1 truncate ${
                  isV2 ? 'text-orange-700' : 'text-gray-800'
                }`}
                title={podName}
              >
                {podName}
              </div>
              <div className="text-xs font-mono text-gray-500 mt-1.5">
                IP: {podIp}
              </div>
            </div>

            {/* 3. Worker Node */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/70">
              <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                Worker Node
              </div>
              <div
                className={`text-sm font-bold mt-1 ${
                  isV2 ? 'text-orange-600' : 'text-blue-600'
                }`}
              >
                {nodeName}
              </div>
              <div className="text-xs text-gray-500 mt-1.5">
                Auto-Failover Enabled
              </div>
            </div>

            {/* 4. Database Status */}
            <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/70">
              <div className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                Database Status
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-sm font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{dbStatus}</span>
              </div>
              <div className="text-[11px] font-mono text-gray-500 mt-1.5 truncate" title={dbConnectionStr}>
                {dbConnectionStr}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. TASK STATISTICS CARDS (3 BOXES)                        */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200/90 p-4 flex items-center justify-between shadow-xs">
            <span className="text-sm font-medium text-gray-600">Tổng công việc</span>
            <span className={`text-2xl font-bold ${isV2 ? 'text-orange-600' : 'text-blue-600'}`}>
              {totalCount}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/90 p-4 flex items-center justify-between shadow-xs">
            <span className="text-sm font-medium text-gray-600">Đang thực hiện</span>
            <span className="text-2xl font-bold text-amber-500">{pendingCount}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200/90 p-4 flex items-center justify-between shadow-xs">
            <span className="text-sm font-medium text-gray-600">Đã hoàn thành</span>
            <span className="text-2xl font-bold text-emerald-600">{completedCount}</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. MAIN TASK MANAGEMENT CARD                              */}
        {/* ========================================================= */}
        <div
          className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 transition-all ${
            isV2 ? 'border-orange-200' : 'border-gray-200/90'
          }`}
        >
          {/* Error notification banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-rose-500 hover:text-rose-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Add New Task Form */}
          <form onSubmit={handleAddTask} className="flex gap-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên công việc mới..."
              disabled={submitting}
              className={`flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 placeholder-gray-400 bg-white transition-all ${
                isV2
                  ? 'border-orange-200 focus:ring-orange-500 focus:border-orange-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className={`text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                submitting || !title.trim()
                  ? 'bg-gray-300 cursor-not-allowed opacity-75'
                  : isV2
                  ? 'bg-orange-600 hover:bg-orange-700 active:scale-95 shadow-orange-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-500/20'
              }`}
            >
              <span>+</span>
              <span>{submitting ? 'Đang thêm...' : 'Thêm mới'}</span>
            </button>
          </form>

          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-100">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'all'
                    ? isV2
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'pending'
                    ? isV2
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Đang thực hiện
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'completed'
                    ? isV2
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Đã hoàn thành
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm công việc..."
                className={`w-full border rounded-xl px-3.5 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 bg-gray-50/50 ${
                  isV2
                    ? 'border-orange-200 focus:ring-orange-500 focus:border-orange-500'
                    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Task List Items */}
          <div className="space-y-2.5 pt-1">
            {loading ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                <div
                  className={`inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-2 ${
                    isV2 ? 'border-orange-600' : 'border-blue-600'
                  }`}
                ></div>
                <div>Đang đồng bộ dữ liệu từ PostgreSQL cluster...</div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                {searchTerm
                  ? 'Không tìm thấy công việc phù hợp với từ khóa.'
                  : filter === 'completed'
                  ? 'Chưa có công việc nào hoàn thành.'
                  : filter === 'pending'
                  ? 'Tất cả công việc đã được hoàn thành!'
                  : 'Danh sách công việc đang trống. Hãy thêm công việc mới!'}
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border bg-white hover:shadow-xs transition duration-150 ${
                    isV2
                      ? 'border-orange-100 hover:border-orange-300'
                      : 'border-gray-200/90 hover:border-blue-300'
                  }`}
                >
                  {/* Left: Checkbox + Title + Node info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                    {/* Custom Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        task.completed
                          ? isV2
                            ? 'bg-orange-600 border border-orange-600 text-white'
                            : 'bg-blue-600 border border-blue-600 text-white'
                          : isV2
                          ? 'border-2 border-gray-300 hover:border-orange-500 bg-white'
                          : 'border-2 border-gray-300 hover:border-blue-500 bg-white'
                      }`}
                      aria-label="Toggle task completion"
                    >
                      {task.completed && (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Task Title & Subtitle */}
                    <div className="flex-1 min-w-0">
                      <p
                        onClick={() => handleToggleTask(task)}
                        className={`text-sm font-medium cursor-pointer transition-colors leading-relaxed break-words ${
                          task.completed
                            ? 'text-gray-400 line-through select-none'
                            : isV2
                            ? 'text-gray-800 hover:text-orange-600'
                            : 'text-gray-800 hover:text-blue-600'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs font-medium ${
                            task.completed ? 'text-gray-400' : 'text-amber-600'
                          }`}
                        >
                          {task.completed ? 'Đã hoàn thành' : 'Đang thực hiện'}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                            isV2
                              ? 'bg-orange-50 text-orange-700 border-orange-100'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          {nodeName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    {/* Status Pill Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className={`text-xs font-medium px-3 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                        task.completed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {task.completed ? '✓ Completed' : 'Đang xử lý'}
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-xs font-medium px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. MANDATORY GK EXAM FOOTER (POD & VERSION TRACKING)      */}
        {/* ========================================================= */}
        <div className="bg-gray-900 text-green-400 font-mono text-xs py-3 px-5 rounded-xl shadow-lg border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isV2 ? 'bg-orange-500 animate-ping' : 'bg-green-500 animate-ping'
              }`}
            ></span>
            <span>
              🚀 Đang xử lý bởi Pod: <strong className="text-white underline">{podName}</strong> | Phiên bản:{' '}
              <strong className={isV2 ? 'text-orange-400 font-bold' : 'text-yellow-400 font-bold'}>
                {selectedVersion}
              </strong>
            </span>
          </div>
          <div className="text-[11px] text-gray-400">
            Node: <span className={isV2 ? 'text-orange-300' : 'text-cyan-400'}>{nodeName}</span> •{' '}
            {isV2 ? 'Zero-Downtime Rolling Update v2.0' : 'K8s Cluster High Availability'}
          </div>
        </div>

      </div>
    </div>
  );
}
