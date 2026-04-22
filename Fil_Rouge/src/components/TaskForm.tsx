import React, { useState } from 'react';
import { useStore, Task, Tag } from '../lib/store';
import { X, Plus, Calendar } from 'lucide-react';

interface TaskFormProps {
  task?: Task;
  onSubmit: (task: Omit<Task, 'id'>) => void;
  onCancel: () => void;
}

const priorityOptions = [
  { value: 'LOW', label: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'HIGH', label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
];

const TaskForm: React.FC<TaskFormProps> = ({ task, onSubmit, onCancel }) => {
  const { darkMode, user } = useStore();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState<string>(
    task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [selectedTags, setSelectedTags] = useState<Tag[]>(task?.tags || []);
  const [newTagName, setNewTagName] = useState('');

  if (!user) {
    return <div>Please log in to create tasks</div>;
  }

  const availableTags = [
    { id: '1', name: 'Work', color: '#3B82F6' },
    { id: '2', name: 'Personal', color: '#10B981' },
    { id: '3', name: 'Urgent', color: '#EF4444' },
    { id: '4', name: 'Ideas', color: '#8B5CF6' },
    { id: '5', name: 'Learning', color: '#F59E0B' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title,
      description,
      priority: priority as any,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      completed: task?.completed || false,
      tags: selectedTags,
      userId: String(user.id),
    });
  };

  const addTag = (tag: Tag) => {
    if (!selectedTags.some((t) => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag.id !== tagId));
  };

  const addNewTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: Tag = {
      id: `new-${Date.now()}`,
      name: newTagName,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    };
    
    addTag(newTag);
    setNewTagName('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label 
          htmlFor="title" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className={`w-full px-3 py-2 rounded-md ${
            darkMode 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
          required
        />
      </div>

      <div>
        <label 
          htmlFor="description" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description (optional)"
          rows={3}
          className={`w-full px-3 py-2 rounded-md ${
            darkMode 
              ? 'bg-gray-700 border-gray-600 text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="priority" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={`w-full px-3 py-2 rounded-md ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label 
            htmlFor="dueDate" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Due Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={16} className="text-gray-400" />
            </div>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full pl-10 pr-3 py-2 rounded-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>
      </div>

      <div>
        <label 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Tags
        </label>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {selectedTags.map((tag) => (
            <div 
              key={tag.id}
              className="flex items-center px-2 py-1 rounded-full text-sm"
              style={{ 
                backgroundColor: `${tag.color}20`,
                color: tag.color 
              }}
            >
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="ml-1 focus:outline-none"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex">
          <div className="relative flex-grow">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Add a new tag"
              className={`w-full px-3 py-2 rounded-l-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            <div className="absolute right-0 top-0 h-full">
              <button
                type="button"
                onClick={addNewTag}
                className="h-full px-3 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Or select from available tags:</p>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag(tag)}
                className="px-2 py-1 rounded-full text-xs"
                style={{ 
                  backgroundColor: `${tag.color}20`,
                  color: tag.color 
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className={`px-4 py-2 rounded ${
            darkMode 
              ? 'bg-gray-700 text-white hover:bg-gray-600' 
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          } transition-colors`}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {task ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;