import React from 'react';
import { useStore, Task, Tag } from '../lib/store';
import { Calendar, CheckCircle, Circle, Trash, Edit, Flag } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors = {
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };

  const iconColors = {
    HIGH: 'text-red-600 dark:text-red-400',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400',
    LOW: 'text-green-600 dark:text-green-400',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded-full flex items-center ${colors[priority as keyof typeof colors]}`}>
      <Flag className={`mr-1 ${iconColors[priority as keyof typeof iconColors]}`} size={12} />
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
};

const TagBadge: React.FC<{ tag: Tag }> = ({ tag }) => {
  return (
    <span 
      className="text-xs px-2 py-1 rounded-full flex items-center mr-1 mb-1"
      style={{ 
        backgroundColor: `${tag.color}20`, 
        color: tag.color, 
      }}
    >
      {tag.name}
    </span>
  );
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit }) => {
  const { updateTask, deleteTask, darkMode } = useStore();

  const toggleTaskCompletion = () => {
    updateTask({ ...task, completed: !task.completed });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTask(task.id);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div 
      className={`${
        darkMode 
          ? 'bg-gray-800 hover:bg-gray-750 border-gray-700' 
          : 'bg-white hover:bg-gray-50 border-gray-200'
      } border rounded-lg p-4 shadow-sm transition-all duration-200 transform hover:-translate-y-1`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start">
          <button 
            onClick={toggleTaskCompletion}
            className="mt-1 mr-3 text-gray-400 hover:text-blue-500 transition-colors"
          >
            {task.completed ? (
              <CheckCircle className="text-green-500" size={20} />
            ) : (
              <Circle size={20} />
            )}
          </button>
          <div>
            <h3 
              className={`font-medium ${
                task.completed 
                  ? 'line-through text-gray-500 dark:text-gray-400' 
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {task.description}
              </p>
            )}
          </div>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      <div className="flex flex-wrap mt-3 mb-2">
        {task.tags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} />
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <Calendar size={14} className="mr-1" />
          <span>{formatDate(task.dueDate)}</span>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Edit task"
          >
            <Edit size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={handleDelete}
            className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            aria-label="Delete task"
          >
            <Trash size={16} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;