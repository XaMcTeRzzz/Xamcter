import React from 'react';
import { Layout } from '@/components/Layout';
import { TasksList } from '@/components/TasksList';
import { TaskCalendar } from '@/components/TaskCalendar';
import { AddTaskForm } from '@/components/AddTaskForm';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { SiriAssistant } from '@/components/SiriAssistant';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useSpeech } from '@/hooks/use-speech';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  date: Date;
  category?: string;
}

interface Settings {
  greeting: string;
  userName: string;
  userTitle: string;
}

/**
 * Повертає правильний відмінок слова "задача" залежно від кількості
 */
const getTaskWordForm = (count: number): string => {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'задача';
  } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return 'задачі';
  } else {
    return 'задач';
  }
};

export default function App() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settings, setSettings] = React.useState<Settings>({
    greeting: 'Привіт',
    userName: 'Користувач',
    userTitle: 'пане',
  });
  const [isMobile, setIsMobile] = React.useState(false);

  const {
    isListening,
    isSpeaking,
    speak,
    startListening,
    stopListening,
    stopSpeaking
  } = useSpeech({
    onResult: (transcript) => {
      const lowerTranscript = transcript.toLowerCase();

      // Читання задач
      if (lowerTranscript.includes('задачі') || lowerTranscript.includes('що заплановано')) {
        const todayTasks = tasks.filter(task => {
          const taskDate = new Date(task.date);
          return (
            taskDate.getDate() === selectedDate.getDate() &&
            taskDate.getMonth() === selectedDate.getMonth() &&
            taskDate.getFullYear() === selectedDate.getFullYear()
          );
        });

        if (todayTasks.length === 0) {
          speak(`${settings.greeting}, ${settings.userName}! На ${format(selectedDate, 'dd MMMM', { locale: uk })} у вас немає запланованих задач.`);
        } else {
          const tasksList = todayTasks
            .map(task => `${task.completed ? 'Виконано' : 'Не виконано'}: ${task.title}`)
            .join('. ');
          
          speak(`${settings.greeting}, ${settings.userName}! На ${format(selectedDate, 'dd MMMM', { locale: uk })} у вас ${todayTasks.length} ${getTaskWordForm(todayTasks.length)}. ${tasksList}`);
        }
      }

      // Додавання нової задачі
      if (lowerTranscript.includes('додати задачу') || lowerTranscript.includes('нова задача')) {
        setShowAddForm(true);
      }

      // Закриття форм
      if (lowerTranscript.includes('скасувати') || lowerTranscript.includes('закрити')) {
        setShowAddForm(false);
        setEditingTask(null);
        setShowSettings(false);
      }

      // Налаштування
      if (lowerTranscript.includes('налаштування')) {
        setShowSettings(true);
      }
    }
  });

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleAddTask = (newTask: Omit<Task, 'id' | 'completed'>) => {
    const task: Task = {
      ...newTask,
      id: crypto.randomUUID(),
      completed: false,
    };
    setTasks(prev => [...prev, task]);
    setShowAddForm(false);
    speak(`Задачу "${task.title}" додано на ${format(task.date, 'dd MMMM', { locale: uk })}`);
  };

  const handleEditTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
    }
  };

  const handleUpdateTask = (updatedTask: Omit<Task, 'id' | 'completed'>) => {
    if (!editingTask) return;

    setTasks(prev =>
      prev.map(task =>
        task.id === editingTask.id
          ? { ...task, ...updatedTask }
          : task
      )
    );
    setEditingTask(null);
    speak(`Задачу "${updatedTask.title}" оновлено`);
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id === taskId) {
          const completed = !task.completed;
          speak(`Задачу "${task.title}" ${completed ? 'виконано' : 'відмінено'}`);
          return { ...task, completed };
        }
        return task;
      })
    );
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      speak(`Задачу "${task.title}" видалено`);
    }
  };

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    speak(`${newSettings.greeting}, ${newSettings.userName}! Налаштування збережено.`);
  };

  const sidebar = (
    <div className="space-y-4">
      <TaskCalendar
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          if (date) {
            setSelectedDate(date);
            speak(`Обрано дату ${format(date, 'dd MMMM', { locale: uk })}`);
          }
        }}
        tasks={tasks}
      />
      <SiriAssistant
        isSpeaking={isSpeaking}
        isListening={isListening}
        onSettingsClick={() => setShowSettings(true)}
        onStartListening={startListening}
        onStopListening={stopListening}
      />
    </div>
  );

  return (
    <>
      <Layout sidebar={sidebar}>
        <div className={cn(
          'space-y-6',
          isMobile ? 'mt-4' : 'mt-6'
        )}>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Мої задачі</h1>
            <Button
              onClick={() => setShowAddForm(true)}
              className="glass-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Нова задача
            </Button>
          </div>

          {showAddForm && (
            <AddTaskForm
              onSubmit={handleAddTask}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          <TasksList
            tasks={tasks}
            date={selectedDate}
            onTaskComplete={handleCompleteTask}
            onTaskDelete={handleDeleteTask}
            onEditTask={handleEditTask}
          />
        </div>
      </Layout>

      {editingTask && (
        <EditTaskDialog
          isOpen={true}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          onSave={handleUpdateTask}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-full max-h-[90vh] overflow-y-auto',
            isMobile ? 'max-w-[95vw]' : 'max-w-md'
          )}>
            <form className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Налаштування Siri</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(false)}
                  className="hover:bg-primary/10"
                >
                  <span className="sr-only">Закрити</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </Button>
              </div>

              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Вітання"
                  value={settings.greeting}
                  onChange={(e) => setSettings(prev => ({ ...prev, greeting: e.target.value }))}
                  className="glass-input"
                />
                <Input
                  type="text"
                  placeholder="Ім'я користувача"
                  value={settings.userName}
                  onChange={(e) => setSettings(prev => ({ ...prev, userName: e.target.value }))}
                  className="glass-input"
                />
                <Input
                  type="text"
                  placeholder="Звертання"
                  value={settings.userTitle}
                  onChange={(e) => setSettings(prev => ({ ...prev, userTitle: e.target.value }))}
                  className="glass-input"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="submit"
                  className="flex-1 glass-button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSaveSettings(settings);
                    setShowSettings(false);
                  }}
                >
                  Зберегти
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="glass-button-secondary"
                >
                  Скасувати
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
