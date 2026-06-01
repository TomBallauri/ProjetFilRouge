import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/User';
import { Priority } from '@prisma/client';

export type Task = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  dueDate?: Date;
  tags: Tag[];
  userId: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
};

interface StoreState {
  user: User | null;
  setUser: (user: User | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  tasks: Task[];
  loading: boolean;
  error: string | null;
  
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      tasks: [],
      loading: false,
      error: null,
      
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (task) => set((state) => ({ 
        tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) 
      })),
      deleteTask: (id) => set((state) => ({ 
        tasks: state.tasks.filter((t) => t.id !== id) 
      })),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'gameforum-store', // nom de la clé dans le localStorage
      partialize: (state) => ({ user: state.user, darkMode: state.darkMode }),
    }
  )
);