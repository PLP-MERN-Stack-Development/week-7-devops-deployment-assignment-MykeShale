import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Signup from './Signup';
import { useEffect, useState, useRef } from 'react';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

const PRIORITIES = [
  { label: 'Low', value: 'low', icon: '⬇️' },
  { label: 'Medium', value: 'medium', icon: '⏺️' },
  { label: 'High', value: 'high', icon: '⬆️' },
];

function ProtectedApp() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  // Dark mode state and effect
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
  }, [darkMode]);

  // Task manager state and logic
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDueDate, setEditingDueDate] = useState('');
  const [editingPriority, setEditingPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const filterRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/tasks';

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setTasks(data.data || []);
    } catch (err) {
      setError('Failed to fetch tasks');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Success message timeout
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 1500);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Add task
  const handleAddTask = async (e: any) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask, dueDate: newDueDate || undefined, priority: newPriority }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error();
      setNewTask('');
      setNewDueDate('');
      setNewPriority('medium');
      setSuccess('Task added!');
      fetchTasks();
    } catch {
      setError('Failed to add task');
    }
  };

  // Delete task
  const handleDelete = async (id: any) => {
    setDeletingId(null);
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error();
      setSuccess('Task deleted!');
      fetchTasks();
    } catch {
      setError('Failed to delete task');
    }
  };

  // Toggle complete
  const handleToggle = async (id: any) => {
    try {
      const res = await fetch(`${API_URL}/${id}/toggle`, { method: 'PATCH' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error();
      setSuccess('Task updated!');
      fetchTasks();
    } catch {
      setError('Failed to update task');
    }
  };

  // Start editing
  const startEdit = (task: any) => {
    setEditingId(task._id);
    setEditingTitle(task.title);
    setEditingDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setEditingPriority(task.priority || 'medium');
  };

  // Save edit
  const handleEdit = async (id: any) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle, dueDate: editingDueDate || undefined, priority: editingPriority }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error();
      setEditingId(null);
      setEditingTitle('');
      setEditingDueDate('');
      setEditingPriority('medium');
      setSuccess('Task updated!');
      fetchTasks();
    } catch {
      setError('Failed to update task');
    }
  };

  // Filtered tasks
  const filteredTasks = tasks.filter((task: any) => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  // Drag and drop handler
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const reordered = Array.from(filteredTasks);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setTasks(prev => {
      const ids = reordered.map(t => t._id);
      const rest = prev.filter(t => !ids.includes(t._id));
      return [
        ...prev.filter(t => filter !== 'all' ? !filteredTasks.includes(t) : false),
        ...reordered,
        ...rest
      ];
    });
    // Persist order to backend (only for all filter)
    if (filter === 'all') {
      try {
        const res = await fetch(`${API_URL}/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: reordered.map(t => t._id) }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error();
        setSuccess('Order updated!');
        fetchTasks();
      } catch {
        setError('Failed to update order');
      }
    }
  };

  // Keyboard navigation for filter buttons
  const handleFilterKeyDown = (e: any, idx: number) => {
    if (e.key === 'ArrowRight') {
      const next = (idx + 1) % FILTERS.length;
      filterRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prev = (idx - 1 + FILTERS.length) % FILTERS.length;
      filterRefs.current[prev]?.focus();
    }
  };

  // Helper: is overdue
  const isOverdue = (task: any) => {
    if (!task.dueDate || task.completed) return false;
    return new Date(task.dueDate) < new Date(new Date().toDateString());
  };

  return (
    <>
      <button
        className="dark-toggle"
        onClick={() => setDarkMode(dm => !dm)}
        style={{ position: 'absolute', top: 18, left: 24 }}
        aria-label="Toggle dark mode"
      >
        {darkMode ? '🌙 Dark' : '☀️ Light'}
      </button>
      <button className="logout-btn" onClick={logout} style={{ position: 'absolute', top: 18, right: 24 }}>Logout</button>
      <h1>Task Manager</h1>
      <form className="task-form" onSubmit={handleAddTask} aria-label="Add task form">
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          aria-label="Task title"
        />
        <input
          type="date"
          value={newDueDate}
          onChange={e => setNewDueDate(e.target.value)}
          title="Due date"
          aria-label="Due date"
        />
        <select value={newPriority} onChange={e => setNewPriority(e.target.value)} aria-label="Priority">
          {PRIORITIES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <button type="submit" disabled={!newTask.trim()}>Add</button>
      </form>
      <div className="filter-group" role="group" aria-label="Task filters">
        {FILTERS.map((f, idx) => (
          <button
            key={f.value}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
            type="button"
            aria-label={f.label + ' tasks'}
            ref={el => { filterRefs.current[idx] = el; }}
            tabIndex={0}
            onKeyDown={e => handleFilterKeyDown(e, idx)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {success && <div className="success" role="status">{success}</div>}
      {loading ? (
        <div className="spinner" aria-label="Loading"></div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state">No tasks found. Add your first task!</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="task-list">
            {(provided: any) => (
              <ul className="task-list" ref={provided.innerRef} {...provided.droppableProps}>
                {filteredTasks.map((task: any, idx: number) => (
                  <Draggable key={task._id} draggableId={task._id} index={idx}>
                    {(provided: any, snapshot: any) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={
                          task.completed
                            ? 'completed' + (snapshot.isDragging ? ' dragging' : '')
                            : (snapshot.isDragging ? ' dragging' : '')
                        }
                        style={{
                          ...provided.draggableProps.style,
                          boxShadow: snapshot.isDragging ? '0 2px 12px rgba(79,140,255,0.15)' : undefined,
                        }}
                      >
                        <span onClick={() => handleToggle(task._id)} className="task-title">
                          {editingId === task._id ? (
                            <>
                              <input
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onBlur={() => handleEdit(task._id)}
                                onKeyDown={e => e.key === 'Enter' && handleEdit(task._id)}
                                autoFocus
                                aria-label="Edit task title"
                              />
                              <input
                                type="date"
                                value={editingDueDate}
                                onChange={e => setEditingDueDate(e.target.value)}
                                onBlur={() => handleEdit(task._id)}
                                aria-label="Edit due date"
                              />
                              <select
                                value={editingPriority}
                                onChange={e => setEditingPriority(e.target.value)}
                                onBlur={() => handleEdit(task._id)}
                                aria-label="Edit priority"
                              >
                                {PRIORITIES.map(p => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <>
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => handleToggle(task._id)}
                                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                              />
                              <span
                                className="title-text"
                                onDoubleClick={() => startEdit(task)}
                                aria-label={task.title}
                              >
                                {task.title}
                              </span>
                              <span className="meta">
                                {task.dueDate && (
                                  <span className={
                                    'due-date' + (isOverdue(task) ? ' overdue' : '')
                                  }>
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                                <span className={`priority ${task.priority}`}>
                                  {PRIORITIES.find(p => p.value === task.priority)?.icon} {task.priority}
                                </span>
                              </span>
                            </>
                          )}
                        </span>
                        <button
                          className="delete-btn"
                          aria-label="Delete task"
                          onClick={() => setDeletingId(task._id)}
                        >
                          &times;
                        </button>
                        {deletingId === task._id && (
                          <div className="confirm-delete">
                            <span>Delete this task?</span>
                            <button onClick={() => handleDelete(task._id)} aria-label="Confirm delete">Yes</button>
                            <button onClick={() => setDeletingId(null)} aria-label="Cancel delete">No</button>
                          </div>
                        )}
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<ProtectedApp />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
