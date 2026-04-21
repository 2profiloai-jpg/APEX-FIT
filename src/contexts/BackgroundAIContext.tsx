import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { suggestMealForRemainingMacros, suggestExerciseAlternative, parseFoodInput, generateInstantWorkout } from '../services/geminiService';

export type AITaskType = 'meal-suggestion' | 'exercise-alternative' | 'food-parse' | 'instant-workout' | 'general';

export interface AITask {
  id: string;
  type: AITaskType;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: string;
  metadata?: any;
}

interface BackgroundAIContextType {
  tasks: AITask[];
  runMealSuggestion: (params: { 
    remKcal: number, remPro: number, remCarb: number, remFat: number, 
    pantry: string[], favs: any[], context: string, targetKcal: number, portions: string,
    date: string 
  }) => Promise<string>;
  runExerciseAlternative: (params: {
    originalName: string, inventory: string[], completed: string[], isCrowded: boolean,
    exerciseIdx: number
  }) => Promise<string>;
  runFoodParse: (params: { 
    meal: string, input: string, image?: string, date: string 
  }) => Promise<string>;
  runInstantWorkout: (params: { 
    focus: string, duration: number, inventory: string[] 
  }) => Promise<string>;
  getTask: (id: string) => AITask | undefined;
  clearTask: (id: string) => void;
  isTaskPending: (type: AITaskType, metadataKey?: string, metadataValue?: any) => boolean;
}

const BackgroundAIContext = createContext<BackgroundAIContextType | undefined>(undefined);

export function BackgroundAIProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<AITask[]>(() => {
    const saved = localStorage.getItem('apex_ai_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // Limit saved tasks to last 20 to avoid localStorage bloat on mobile
    const savedTasks = tasks.length > 20 ? tasks.slice(-20) : tasks;
    localStorage.setItem('apex_ai_tasks', JSON.stringify(savedTasks));
  }, [tasks]);

  const addTask = useCallback((task: Omit<AITask, 'status'>) => {
    setTasks(prev => {
      const newTasks = [...prev, { ...task, status: 'pending' as const }];
      return newTasks.length > 30 ? newTasks.slice(-30) : newTasks;
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<AITask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const clearTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const runMealSuggestion = async (params: any) => {
    const taskId = `meal-${params.date}`;
    // Check if already pending for this date
    if (tasks.find(t => t.id === taskId && t.status === 'pending')) {
      return taskId;
    }

    // Clear old result if exists
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    addTask({
      id: taskId,
      type: 'meal-suggestion',
      timestamp: new Date().toISOString(),
      metadata: { date: params.date }
    });

    try {
      const result = await suggestMealForRemainingMacros(
        params.remKcal, params.remPro, params.remCarb, params.remFat, 
        params.pantry, params.favs, params.context, params.targetKcal, params.portions
      );
      updateTask(taskId, { status: 'completed', result });
      toast.success('Suggerimento pasti pronto! Controlla la Hub Nutrizione.');
    } catch (err: any) {
      updateTask(taskId, { status: 'failed', error: err.message });
      toast.error('Errore nel suggerimento pasti.');
    }

    return taskId;
  };

  const runExerciseAlternative = async (params: any) => {
    const taskId = `alt-${params.exerciseIdx}`;
    
    setTasks(prev => prev.filter(t => t.id !== taskId));

    addTask({
      id: taskId,
      type: 'exercise-alternative',
      timestamp: new Date().toISOString(),
      metadata: { exerciseIdx: params.exerciseIdx }
    });

    try {
      const result = await suggestExerciseAlternative(
        params.originalName, params.inventory, params.completed, params.isCrowded
      );
      updateTask(taskId, { status: 'completed', result });
      toast.success('Alternativa trovata! Torna alla sessione per applicarla.');
    } catch (err: any) {
      updateTask(taskId, { status: 'failed', error: err.message });
    }

    return taskId;
  };

  const runFoodParse = async (params: any) => {
    const taskId = `parse-${params.meal}-${params.date}`;
    
    setTasks(prev => prev.filter(t => t.id !== taskId));

    addTask({
      id: taskId,
      type: 'food-parse',
      timestamp: new Date().toISOString(),
      metadata: { meal: params.meal, date: params.date }
    });

    try {
      const result = await parseFoodInput(params.input, params.image);
      updateTask(taskId, { status: 'completed', result });
      toast.success(`Analisi ${params.meal} completata!`);
    } catch (err: any) {
      updateTask(taskId, { status: 'failed', error: err.message });
      toast.error(`Errore nell'analisi del pasto.`);
    }

    return taskId;
  };

  const runInstantWorkout = async (params: any) => {
    const taskId = `instant-workout`;
    
    setTasks(prev => prev.filter(t => t.id !== taskId));

    addTask({
      id: taskId,
      type: 'instant-workout',
      timestamp: new Date().toISOString(),
      metadata: { focus: params.focus }
    });

    try {
      const result = await generateInstantWorkout(params.focus, params.duration, params.inventory);
      updateTask(taskId, { status: 'completed', result });
      toast.success(`Allenamento "${params.focus}" generato!`);
    } catch (err: any) {
      updateTask(taskId, { status: 'failed', error: err.message });
      toast.error(`Errore nella generazione dell'allenamento.`);
    }

    return taskId;
  };

  const getTask = (id: string) => tasks.find(t => t.id === id);

  const isTaskPending = (type: AITaskType, metadataKey?: string, metadataValue?: any) => {
    return tasks.some(t => {
      if (t.status !== 'pending') return false;
      if (t.type !== type) return false;
      if (metadataKey && t.metadata?.[metadataKey] !== metadataValue) return false;
      return true;
    });
  };

  return (
    <BackgroundAIContext.Provider value={{ 
      tasks, 
      runMealSuggestion, 
      runExerciseAlternative,
      runFoodParse,
      runInstantWorkout,
      getTask, 
      clearTask,
      isTaskPending
    }}>
      {children}
    </BackgroundAIContext.Provider>
  );
}

export function useBackgroundAI() {
  const context = useContext(BackgroundAIContext);
  if (!context) throw new Error('useBackgroundAI must be used within BackgroundAIProvider');
  return context;
}
