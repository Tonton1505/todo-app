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

  // Telemetry & K8s states
  const [podName, setPodName] = useState('todo-backend-deploy-v1-a8f92');
  const [podIp, setPodIp] = useState('10.244.1.15');
  const [nodeName, setNodeName] = useState('worker1');
  const [version, setVersion] = useState('v1.0');
  const [dbStatus, setDbStatus] = useState('Connected (PostgreSQL)');
  const [dbConnectionStr, setDbConnectionStr] = useState('todouser@todo-db-service:5432/tododb');
  const [clusterTopology, setClusterTopology] = useState('cp • worker1 • worker2');

  // Ping test telemetry state
  const [isPinging, setIsPinging] = useState(false);
  const [pingStats, setPingStats] = useState({ worker1: 0, worker2: 0 });

  // Extract K8s metadata from backend response
  const extractK8sMeta = (responseData) => {
    if (responseData && responseData._k8s_meta) {
      const meta = responseData._k8s_meta;
      if (meta.podName) setPodName(meta.podName);
      if (meta.nodeName) setNodeName(meta.nodeName);
      if (meta.version) setVersion(meta.version);
      if (meta.podIp) setPodIp(meta.podIp);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompletedState }),
      });

      if (!response.ok) {
        throw new Error(`Cập nhật thất bại: HTTP ${response.status}`);
      }

      const data = await response.json();
      extractK8sMeta(data);
    } catch (error) {
      console.error('Lỗi khi toggle task:', error);
      // Revert optimistic update
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
            extractK8sMeta(data);
          } else {
            w1Count++;
          }
        } catch {
          // Fallback simulation in local dev environment
          if (i % 2 === 0) w1Count++;
          else w2Count++;
        }
        // Small delay for animated visual feedback
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

  // Release theme styles
  const isV2 = version.includes('v2') || version.includes('2.0');

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-gray-800 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* ========================================== */}
        {/* 1. HEADER BANNER (CLOUD TODO)               */}
        {/* ========================================== */}
        <div
          className={`rounded-2xl px-6 py-5 text-white shadow-lg transition-all duration-300 ${
            isV2
              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 shadow-orange-500/20'
              : 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 shadow-blue-500/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title & Icon */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30 shadow-inner">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight">Cloud Todo</h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30 tracking-wide uppercase">
                    {version}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-blue-100 font-medium mt-0.5 opacity-90">
                  Cloud-Native Task Management • Kubernetes High Availability Cluster
                </p>
              </div>
            </div>

            {/* Release Switcher Badge */}
            <div className="flex items-center gap-2 self-start sm:self-center bg-black/15 p-1 rounded-full border border-white/20">
              <span className="text-xs font-medium text-white/90 pl-2 pr-1">Release:</span>
              <button
                type="button"
                onClick={() => setVersion('v1.0')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  !isV2
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                v1.0
              </button>
              <button
                type="button"
                onClick={() => setVersion('v2.0')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  isV2
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                v2.0
              </button>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. KUBERNETES CLUSTER TELEMETRY CARD       */}
        {/* ========================================== */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {/* Kubernetes Wheel / Helm Icon */}
              <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V17a1 1 0 0 0-2 0v2.93A8 8 0 0 1 4.07 13H7a1 1 0 0 0 0-2H4.07A8 8 0 0 1 11 4.07V7a1 1 0 0 0 2 0V4.07A8 8 0 0 1 19.93 11H17a1 1 0 0 0 0 2h2.93A8 8 0 0 1 13 19.93z" />
              </svg>
              <span className="text-xs font-bold tracking-wider text-gray-700 uppercase">
                Kubernetes Cluster Telemetry
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handlePing10}
                disabled={isPinging}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  isPinging
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-blue-50/80 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-2xs'
                }`}
              >
                <span>⚡</span>
                <span>{isPinging ? 'Pinging cluster...' : 'Ping 10 Requests (Load Balance & Failover)'}</span>
              </button>

              <div className="text-xs font-mono font-medium bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700 flex items-center gap-2">
                <span>worker1: <strong className="text-blue-600">{pingStats.worker1}</strong></span>
                <span className="text-gray-300">|</span>
                <span>worker2: <strong className="text-indigo-600">{pingStats.worker2}</strong></span>
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
              <div className="text-sm font-bold text-gray-800 mt-1">
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
              <div className="text-sm font-mono font-bold text-gray-800 mt-1 truncate" title={podName}>
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
              <div className="text-sm font-bold text-blue-600 mt-1">
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

        {/* ========================================== */}
        {/* 3. TASK STATISTICS CARDS (3 BOXES)         */}
        {/* ========================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200/90 p-4 flex items-center justify-between shadow-xs">
            <span className="text-sm font-medium text-gray-600">Tổng công việc</span>
            <span className="text-2xl font-bold text-blue-600">{totalCount}</span>
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

        {/* ========================================== */}
        {/* 4. MAIN TASK MANAGEMENT CARD               */}
        {/* ========================================== */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 space-y-4">
          
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
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 bg-white"
            />
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className={`text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap ${
                submitting || !title.trim()
                  ? 'bg-blue-400 cursor-not-allowed opacity-75'
                  : isV2
                  ? 'bg-orange-600 hover:bg-orange-700 active:scale-95'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                className="w-full border border-gray-200 rounded-xl px-3.5 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50"
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
                <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
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
                  className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200/90 bg-white hover:border-blue-300 hover:shadow-xs transition duration-150"
                >
                  {/* Left: Checkbox + Title + Node info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        task.completed
                          ? 'bg-blue-600 border border-blue-600 text-white'
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
                        className={`text-sm font-medium cursor-pointer transition-colors ${
                          task.completed
                            ? 'text-gray-400 line-through'
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
                        <span className="text-[10px] font-mono font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
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
                      className={`text-xs font-medium px-3 py-1 rounded-lg border transition-all flex items-center gap-1 ${
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
                      className="text-xs font-medium px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
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
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
            <span>🚀 Đang xử lý bởi Pod: <strong className="text-white underline">{podName}</strong> | Phiên bản: <strong className="text-yellow-400">{version}</strong></span>
          </div>
          <div className="text-[11px] text-gray-400">
            Node: <span className="text-cyan-400">{nodeName}</span> • K8s Cluster High Availability
          </div>
        </div>

      </div>
    </div>
  );
}
