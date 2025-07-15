const express = require('express');
const Task = require('../models/Task');
const router = express.Router();

const isValidPriority = (priority) => ['low', 'medium', 'high'].includes(priority);
const isValidDate = (date) => !isNaN(Date.parse(date));

// Get all tasks (ordered)
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error('GET /tasks error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add a new task
router.post('/', async (req, res) => {
  try {
    const { title, dueDate, priority } = req.body;
    if (!title || typeof title !== 'string' || title.length < 1 || title.length > 100) {
      return res.status(400).json({ success: false, error: 'Title is required (1-100 chars)' });
    }
    if (dueDate && !isValidDate(dueDate)) {
      return res.status(400).json({ success: false, error: 'Invalid due date' });
    }
    if (priority && !isValidPriority(priority)) {
      return res.status(400).json({ success: false, error: 'Invalid priority' });
    }
    // Find the current max order
    const maxOrderTask = await Task.findOne().sort('-order');
    const nextOrder = maxOrderTask ? maxOrderTask.order + 1 : 1;
    const newTask = new Task({ title, order: nextOrder });
    if (dueDate) newTask.dueDate = dueDate;
    if (priority) newTask.priority = priority;
    const savedTask = await newTask.save();
    res.status(201).json({ success: true, data: savedTask });
  } catch (err) {
    console.error('POST /tasks error:', err);
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

// Update a task (title, completed, dueDate, priority)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed, dueDate, priority } = req.body;
    const update = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || title.length < 1 || title.length > 100) {
        return res.status(400).json({ success: false, error: 'Title must be 1-100 chars' });
      }
      update.title = title;
    }
    if (completed !== undefined) update.completed = completed;
    if (dueDate !== undefined) {
      if (dueDate && !isValidDate(dueDate)) {
        return res.status(400).json({ success: false, error: 'Invalid due date' });
      }
      update.dueDate = dueDate;
    }
    if (priority !== undefined) {
      if (priority && !isValidPriority(priority)) {
        return res.status(400).json({ success: false, error: 'Invalid priority' });
      }
      update.priority = priority;
    }
    const updatedTask = await Task.findByIdAndUpdate(id, update, { new: true });
    if (!updatedTask) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, data: updatedTask });
  } catch (err) {
    console.error('PUT /tasks/:id error:', err);
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

// Toggle complete
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    task.completed = !task.completed;
    await task.save();
    res.json({ success: true, data: task });
  } catch (err) {
    console.error('PATCH /tasks/:id/toggle error:', err);
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

// Reorder tasks
router.patch('/reorder', async (req, res) => {
  try {
    const { ids } = req.body; // array of task IDs in new order
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'ids must be an array' });
    // Update each task's order
    await Promise.all(ids.map((id, idx) => Task.findByIdAndUpdate(id, { order: idx + 1 })));
    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    console.error('PATCH /tasks/reorder error:', err);
    res.status(400).json({ success: false, error: 'Invalid data' });
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Task.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('DELETE /tasks/:id error:', err);
    res.status(404).json({ success: false, error: 'Task not found' });
  }
});

module.exports = router; 