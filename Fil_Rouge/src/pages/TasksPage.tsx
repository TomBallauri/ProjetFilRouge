import React, { useState} from 'react';
import { useStore, Task } from '../lib/store';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';
import { Plus, X, Filter, Search, ListTodo } from 'lucide-react';

const TasksPage: React.FC = () => {
  const { tasks, user, darkMode, addTask, updateTask } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const handleCreateTask = (taskData: Omit<Task, 'id'>) => {
    const newTask = {
      ...taskData,
      id: Date.now().toString(),
    } as Task;
    addTask(newTask);
    setShowForm(false);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleUpdateTask = (taskData: Omit<Task, 'id'>) => {
    if (!editingTask) return;
    const updatedTask = {
      ...taskData,
      id: editingTask.id,
    } as Task;
    updateTask(updatedTask);
    setEditingTask(null);
    setShowForm(false);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterPriority('ALL');
    setFilterStatus('ALL');
  };

  const filteredTasks = tasks.filter(task => {
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterPriority !== 'ALL' && task.priority !== filterPriority) {
      return false;
    }
    if (filterStatus === 'COMPLETED' && !task.completed) {
      return false;
    }
    if (filterStatus === 'ACTIVE' && task.completed) {
      return false;
    }
    return true;
  });

  if (!user) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold mb-4">Tasks</h1>
        <p className="mb-6">Please log in to view and manage your tasks.</p>
        <a 
          href="/login" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Log In
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Tasks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {showForm ? (
            <>
              <X size={16} className="mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus size={16} className="mr-2" />
              Add Task
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">
            {editingTask ? 'Edit Task' : 'Create New Task'}
          </h2>
          <TaskForm
            task={editingTask || undefined}
            onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
            onCancel={handleCancelForm}
          />
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center mb-4">
          <div className="relative flex-grow mb-4 md:mb-0 md:mr-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..."
              className={`w-full pl-10 pr-3 py-2 rounded-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-2 rounded ${
              showFilters 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : darkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors`}
          >
            <Filter size={16} className="mr-2" />
            Filters
            {(filterPriority !== 'ALL' || filterStatus !== 'ALL') && (
              <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} mb-4`}>
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className={`px-3 py-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-3 py-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="ALL">All Tasks</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="md:self-end">
                <button
                  onClick={clearFilters}
                  className={`px-3 py-2 rounded ${
                    darkMode 
                      ? 'text-gray-300 hover:text-white' 
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={handleEditTask} />
          ))}
        </div>
      ) : (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-gray-400 mb-4">
            {tasks.length > 0 ? (
              <Filter size={48} className="mx-auto" />
            ) : (
              <ListTodo size={48} className="mx-auto" />
            )}
          </div>
          <h3 className="text-xl font-medium mb-2">
            {tasks.length > 0 ? "No matching tasks found" : "No tasks yet"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {tasks.length > 0 
              ? "Try changing your search or filters to find what you're looking for."
              : "Create your first task to get started with managing your work."
            }
          </p>
          {tasks.length > 0 ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Create Task
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TasksPage;