'use client';

import { useEffect, useMemo, useState } from 'react';

type Tab = 'info' | 'calendar' | 'cameras' | 'urgentTasks' | 'attendance';
type Role = 'admin' | 'foreman' | 'worker' | 'customer';
type EventType = 'work' | 'problem' | 'delivery' | 'other';
type CameraLiveStatus = 'checking' | 'online' | 'offline';

type Project = {
  id: string;
  name: string;
  street: string;
  status: string;
  customer?: ProjectUser;
  foreman?: ProjectUser;
  workers?: ProjectUser[];
  cameraCount?: number;
};

type ProjectUser = {
  id: string;
  firstName: string;
  lastName?: string;
  telegramUsername?: string;
  role: Role;
};

type CurrentUser = {
  id?: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
};

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  description?: string;
  type: EventType;
};

type Camera = {
  id: string;
  name: string;
  location: string;
  rtspUrl: string;
  hlsUrl?: string;
  isActive: boolean;
};

type UrgentTask = {
  id: string;
  text: string;
  photoFileId?: string;
  completedAt?: string | null;
  createdAt: string;
  sender: ProjectUser;
  recipient: ProjectUser;
  project?: {
    id: string;
    name: string;
    street?: string;
  };
};

type AttendanceRow = {
  user: ProjectUser;
  role: 'foreman' | 'worker';
  enteredAt?: string | null;
  exitedAt?: string | null;
};

const roles: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Админ' },
  { value: 'foreman', label: 'Бригадир' },
  { value: 'worker', label: 'Рабочий' },
  { value: 'customer', label: 'Заказчик' },
];

const eventTypeLabels: Record<EventType, string> = {
  work: 'Работы',
  problem: 'Проблема',
  delivery: 'Поставка',
  other: 'Другое',
};

const eventTypeClasses: Record<EventType, string> = {
  work: 'bg-blue-500',
  problem: 'bg-red-500',
  delivery: 'bg-amber-500',
  other: 'bg-slate-500',
};

const projectRoleLabels: Record<'foreman' | 'worker', string> = {
  foreman: 'Бригадир',
  worker: 'Работник',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHORIZED_LABEL = '\u0410\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d';
const NOT_AUTHORIZED_LABEL =
  '\u041d\u0435 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d';

const cameraStatusMeta: Record<CameraLiveStatus, { label: string; dot: string; badge: string }> = {
  checking: {
    label: 'Проверка',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700',
  },
  online: {
    label: 'Онлайн',
    dot: 'bg-green-400',
    badge: 'bg-green-100 text-green-700',
  },
  offline: {
    label: 'Оффлайн',
    dot: 'bg-slate-400',
    badge: 'bg-slate-200 text-slate-600',
  },
};

function isHlsStream(url?: string | null) {
  return Boolean(url && url.toLowerCase().includes('.m3u8'));
}

function isMjpegStream(url?: string | null) {
  if (!url) return false;
  const normalized = url.toLowerCase();
  const isHttpStream = normalized.startsWith('http://') || normalized.startsWith('https://');
  return isHttpStream && (normalized.includes('/video') || normalized.includes('mjpeg') || !isHlsStream(url));
}

function getCameraStreamUrl(camera?: Camera | null) {
  return camera?.hlsUrl || camera?.rtspUrl || '';
}

function getCameraStatusUrl(camera: Camera) {
  const streamUrl = getCameraStreamUrl(camera);
  if (!streamUrl) return '';

  if (isMjpegStream(streamUrl)) {
    return streamUrl.replace(/\/video\/?$/i, '/shot.jpg');
  }

  return isHlsStream(streamUrl) ? streamUrl : '';
}

function checkImageUrl(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, 5000);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };

    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };

    image.src = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHumanDate(date: Date) {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function monthTitle(date: Date) {
  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function userName(user?: ProjectUser) {
  if (!user) return NOT_AUTHORIZED_LABEL;
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function currentUserName(user?: CurrentUser | null) {
  if (!user) return NOT_AUTHORIZED_LABEL;

  const name = [user.firstName ?? user.first_name, user.lastName ?? user.last_name]
    .filter(Boolean)
    .join(' ');

  return name || NOT_AUTHORIZED_LABEL;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [role, setRole] = useState<Role>('admin');
  const [authLoaded, setAuthLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [errorProjects, setErrorProjects] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [errorEvents, setErrorEvents] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraStatuses, setCameraStatuses] = useState<Record<string, CameraLiveStatus>>({});
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [errorCameras, setErrorCameras] = useState<string | null>(null);
  const [urgentTasks, setUrgentTasks] = useState<UrgentTask[]>([]);
  const [loadingUrgentTasks, setLoadingUrgentTasks] = useState(false);
  const [errorUrgentTasks, setErrorUrgentTasks] = useState<string | null>(null);
  const [selectedUrgentTask, setSelectedUrgentTask] = useState<UrgentTask | null>(null);
  const [urgentTaskPhotoError, setUrgentTaskPhotoError] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(formatDateKey(new Date()));
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [errorAttendance, setErrorAttendance] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('role');
    if (saved) setRole(saved as Role);

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as CurrentUser;
      setCurrentUser(parsed);
      if (parsed.role) setRole(parsed.role);
    }

    setAuthLoaded(true);
  }, []);

  const handleRoleChange = (value: Role) => {
    setRole(value);
    localStorage.setItem('role', value);
  };

  useEffect(() => {
    if (!authLoaded) return;

    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        setErrorProjects(null);

        const userId = currentUser?.id && UUID_RE.test(currentUser.id) ? currentUser.id : null;
        if (!userId) {
          setProjects([]);
          setActiveProjectId(null);
          setErrorProjects('Пользователь не определён. Войдите через Telegram.');
          return;
        }

        const url = `${API_URL}/projects?userId=${encodeURIComponent(userId)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Ошибка загрузки проектов: ${res.status}`);

        const data: Project[] = await res.json();
        setProjects(data);

        if (activeProjectId && !data.some((project) => project.id === activeProjectId)) {
          setActiveProjectId(data[0]?.id ?? null);
        } else if (!activeProjectId && data.length > 0) {
          setActiveProjectId(data[0].id);
        }
      } catch (e: any) {
        setErrorProjects(e.message ?? 'Не удалось загрузить проекты');
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [activeProjectId, authLoaded, currentUser?.id]);

  useEffect(() => {
    if (!activeProjectId) {
      setEvents([]);
      return;
    }

    const fetchEvents = async () => {
      try {
        setLoadingEvents(true);
        setErrorEvents(null);

        const userId = currentUser?.id && UUID_RE.test(currentUser.id) ? currentUser.id : null;
        const userQuery = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const res = await fetch(`${API_URL}/calendar/by-project/${activeProjectId}${userQuery}`);
        if (!res.ok) throw new Error(`Ошибка загрузки календаря: ${res.status}`);

        const data: CalendarEvent[] = await res.json();
        setEvents(data);
      } catch (e: any) {
        setErrorEvents(e.message ?? 'Не удалось загрузить календарь');
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [activeProjectId, currentUser?.id]);

  useEffect(() => {
    if (!activeProjectId) {
      setCameras([]);
      setCameraStatuses({});
      setActiveCameraId(null);
      return;
    }

    const fetchCameras = async () => {
      try {
        setLoadingCameras(true);
        setErrorCameras(null);

        const res = await fetch(`${API_URL}/cameras/by-project/${activeProjectId}`);
        if (!res.ok) throw new Error(`Ошибка загрузки камер: ${res.status}`);

        const data: Camera[] = await res.json();
        setCameras(data);
        setCameraStatuses(
          data.reduce<Record<string, CameraLiveStatus>>((acc, camera) => {
            acc[camera.id] = camera.isActive ? 'checking' : 'offline';
            return acc;
          }, {}),
        );
        setActiveCameraId((current) =>
          current && data.some((camera) => camera.id === current) ? current : data[0]?.id ?? null,
        );
      } catch (e: any) {
        setErrorCameras(e.message ?? 'Не удалось загрузить камеры');
      } finally {
        setLoadingCameras(false);
      }
    };

    fetchCameras();
  }, [activeProjectId]);

  useEffect(() => {
    if (cameras.length === 0) return;

    const controller = new AbortController();

    const checkCameras = async () => {
      await Promise.all(
        cameras.map(async (camera) => {
          const statusUrl = getCameraStatusUrl(camera);

          if (!camera.isActive || !statusUrl) {
            setCameraStatuses((current) => ({ ...current, [camera.id]: 'offline' }));
            return;
          }

          setCameraStatuses((current) => ({ ...current, [camera.id]: 'checking' }));

          try {
            if (isMjpegStream(statusUrl)) {
              const isOnline = await checkImageUrl(statusUrl);
              setCameraStatuses((current) => ({
                ...current,
                [camera.id]: isOnline ? 'online' : 'offline',
              }));
              return;
            }

            const res = await fetch(statusUrl, {
              method: 'GET',
              cache: 'no-store',
              signal: controller.signal,
            });
            setCameraStatuses((current) => ({
              ...current,
              [camera.id]: res.ok ? 'online' : 'offline',
            }));
          } catch {
            if (!controller.signal.aborted) {
              setCameraStatuses((current) => ({ ...current, [camera.id]: 'offline' }));
            }
          }
        }),
      );
    };

    checkCameras();
    const interval = window.setInterval(checkCameras, 30000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [cameras]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const canViewUrgentTasks = role === 'admin' || role === 'foreman';
  const authorizedUserName = currentUserName(currentUser);
  const currentUserId = currentUser?.id && UUID_RE.test(currentUser.id) ? currentUser.id : null;

  useEffect(() => {
    if (!canViewUrgentTasks && activeTab === 'urgentTasks') {
      setActiveTab('info');
    }
  }, [activeTab, canViewUrgentTasks]);

  useEffect(() => {
    if (!activeProjectId || !canViewUrgentTasks) {
      setUrgentTasks([]);
      setSelectedUrgentTask(null);
      return;
    }

    const userId = currentUser?.id && UUID_RE.test(currentUser.id) ? currentUser.id : null;
    if (!userId) {
      setUrgentTasks([]);
      setSelectedUrgentTask(null);
      return;
    }

    const fetchUrgentTasks = async () => {
      try {
        setLoadingUrgentTasks(true);
        setErrorUrgentTasks(null);

        const res = await fetch(
          `${API_URL}/urgent-tasks/by-project/${activeProjectId}?userId=${encodeURIComponent(userId)}`,
        );
        if (!res.ok) throw new Error(`Ошибка загрузки срочных заданий: ${res.status}`);

        const data: UrgentTask[] = await res.json();
        setUrgentTasks(data);
        setSelectedUrgentTask((selected) =>
          selected && data.some((task) => task.id === selected.id) ? selected : null,
        );
      } catch (e: any) {
        setErrorUrgentTasks(e.message ?? 'Не удалось загрузить срочные задания');
      } finally {
        setLoadingUrgentTasks(false);
      }
    };

    fetchUrgentTasks();
  }, [activeProjectId, canViewUrgentTasks, currentUser?.id]);

  useEffect(() => {
    if (!activeProjectId || !attendanceDate) {
      setAttendanceRows([]);
      return;
    }

    const fetchAttendance = async () => {
      try {
        setLoadingAttendance(true);
        setErrorAttendance(null);

        const params = new URLSearchParams({
          projectId: activeProjectId,
          date: attendanceDate,
        });
        const res = await fetch(`${API_URL}/turnstile/attendance/day?${params.toString()}`);
        if (!res.ok) throw new Error(`Ошибка загрузки посещаемости: ${res.status}`);

        const data: AttendanceRow[] = await res.json();
        setAttendanceRows(data);
      } catch (e: any) {
        setErrorAttendance(e.message ?? 'Не удалось загрузить посещаемость');
      } finally {
        setLoadingAttendance(false);
      }
    };

    fetchAttendance();
  }, [activeProjectId, attendanceDate]);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = new Date(firstDay);
    startDay.setDate(startDay.getDate() - ((firstDay.getDay() + 6) % 7));

    const result: Date[] = [];
    const cursor = new Date(startDay);

    for (let i = 0; i < 42; i++) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }, [currentDate]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      acc[event.date] = [...(acc[event.date] ?? []), event];
      return acc;
    }, {});
  }, [events]);

  const eventsForSelectedDay = selectedDay
    ? eventsByDate[formatDateKey(selectedDay)] ?? []
    : [];

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-slate-800">
              Основная информация об объекте
            </h2>
            {activeProject ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Название объекта</p>
                    <p className="text-lg font-medium">{activeProject.name}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Статус</p>
                    <p className="text-lg font-medium text-green-600">{activeProject.status}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Адрес</p>
                    <p className="text-lg font-medium">{activeProject.street}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Бригадир</p>
                    <p className="text-lg font-medium">{userName(activeProject.foreman)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Заказчик</p>
                    <p className="text-lg font-medium">{userName(activeProject.customer)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Камеры</p>
                    <p className="text-lg font-medium">{activeProject.cameraCount ?? cameras.length}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-slate-800">
                    Рабочие на проекте
                  </h3>

                  {activeProject.workers?.length ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {activeProject.workers.map((worker) => (
                        <div
                          key={worker.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="font-medium text-slate-800">{userName(worker)}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {worker.telegramUsername
                              ? `@${worker.telegramUsername}`
                              : 'Telegram username не указан'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      Рабочие пока не назначены.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500">Проекты не загружены или не выбраны.</p>
            )}
          </div>
        );

      case 'calendar':
        return (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Назад
                </button>
                <h2 className="text-xl font-bold capitalize text-slate-800">
                  {monthTitle(currentDate)}
                </h2>
                <button
                  onClick={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Вперёд
                </button>
              </div>

              {loadingEvents && <p className="mb-3 text-sm text-slate-500">Загружаем календарь...</p>}
              {errorEvents && <p className="mb-3 text-sm text-red-600">{errorEvents}</p>}

              <div className="grid grid-cols-7 border-l border-t border-slate-200 text-center text-xs font-medium uppercase text-slate-500">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                  <div key={day} className="border-b border-r border-slate-200 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 border-l border-slate-200">
                {days.map((day) => {
                  const key = formatDateKey(day);
                  const dayEvents = eventsByDate[key] ?? [];
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isSelected = selectedDay && formatDateKey(selectedDay) === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-28 border-b border-r border-slate-200 p-2 text-left transition ${
                        isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : 'hover:bg-slate-50'
                      } ${isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}
                    >
                      <span className="text-sm font-medium">{day.getDate()}</span>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className="flex items-center gap-1 text-xs text-slate-700">
                            <span className={`h-2 w-2 rounded-full ${eventTypeClasses[event.type]}`} />
                            <span className="truncate">{event.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-xs text-slate-500">+{dayEvents.length - 3}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Выбранный день</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-800">
                {selectedDay ? formatHumanDate(selectedDay) : 'День не выбран'}
              </h3>

              <div className="mt-4 space-y-3">
                {eventsForSelectedDay.length === 0 && (
                  <p className="text-sm text-slate-500">На этот день событий нет.</p>
                )}

                {eventsForSelectedDay.map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${eventTypeClasses[event.type]}`} />
                      <p className="font-medium text-slate-800">{event.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{eventTypeLabels[event.type]}</p>
                    {event.description && (
                      <p className="mt-2 text-sm text-slate-600">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        );

      case 'cameras': {
        const activeCamera = cameras.find((camera) => camera.id === activeCameraId);
        const activeCameraStatus = activeCamera
          ? cameraStatuses[activeCamera.id] ?? 'checking'
          : 'offline';
        const activeCameraMeta = cameraStatusMeta[activeCameraStatus];
        const activeCameraStreamUrl = getCameraStreamUrl(activeCamera);
        const activeCameraIsMjpeg = isMjpegStream(activeCameraStreamUrl);

        return (
          <div>
            <h2 className="mb-4 text-2xl font-bold text-slate-800">Камеры объекта</h2>
            {loadingCameras && <p className="mb-3 text-sm text-slate-500">Загружаем камеры...</p>}
            {errorCameras && <p className="mb-3 text-sm text-red-600">{errorCameras}</p>}

            {cameras.length === 0 && !loadingCameras ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-lg font-semibold text-slate-800">Камеры ещё не подключены</p>
                <p className="mt-2 text-sm text-slate-500">
                  Когда для объекта появятся RTSP/HLS-потоки, они будут отображаться здесь в прямом эфире.
                </p>
              </div>
            ) : (
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <div className="space-y-3">
                {cameras.map((camera) => {
                  const status = cameraStatuses[camera.id] ?? 'checking';
                  const meta = cameraStatusMeta[status];

                  return (
                    <button
                      key={camera.id}
                      onClick={() => setActiveCameraId(camera.id)}
                      className={`w-full rounded-lg px-4 py-3 text-left transition ${
                        activeCameraId === camera.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{camera.name}</p>
                        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      </div>
                      <p className="mt-1 text-sm opacity-80">{camera.location}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <div>
                    <p className="font-semibold">{activeCamera?.name ?? 'Камера не выбрана'}</p>
                    <p className="text-sm text-slate-400">{activeCamera?.location}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${activeCameraMeta.badge}`}>
                    {activeCameraMeta.label}
                  </span>
                </div>

                <div className="flex aspect-video items-center justify-center bg-black">
                  {activeCameraStreamUrl && activeCameraIsMjpeg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={activeCamera?.id}
                      src={activeCameraStreamUrl}
                      alt={activeCamera?.name ?? 'Поток камеры'}
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : activeCameraStreamUrl ? (
                    <video
                      key={activeCamera?.id ?? activeCameraStreamUrl}
                      src={activeCameraStreamUrl}
                      controls
                      autoPlay
                      muted
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : (
                    <div className="px-6 text-center">
                      <p className="text-lg font-semibold">Поток камеры не указан</p>
                      <p className="mt-2 text-sm text-slate-400">
                        Добавьте HLS-ссылку или MJPEG-поток IP Webcam вида http://IP:8080/video.
                      </p>
                    </div>
                  )}
                </div>

                {activeCamera && (
                  <div className="space-y-2 px-4 py-3 text-sm text-slate-300">
                    <p>RTSP: <span className="text-slate-500">{activeCamera.rtspUrl}</span></p>
                    <p>HLS: <span className="text-slate-500">{activeCamera.hlsUrl ?? 'не указан'}</span></p>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        );
      }

      case 'urgentTasks':
        return (
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Срочные задания</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Выданные срочные задания по выбранному объекту
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                Всего: {urgentTasks.length}
              </div>
            </div>

            {loadingUrgentTasks && (
              <p className="mb-3 text-sm text-slate-500">Загружаем срочные задания...</p>
            )}
            {errorUrgentTasks && <p className="mb-3 text-sm text-red-600">{errorUrgentTasks}</p>}

            {!loadingUrgentTasks && urgentTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-lg font-semibold text-slate-800">Срочных заданий пока нет</p>
                <p className="mt-2 text-sm text-slate-500">
                  Когда бригадир или администратор выдаст срочное задание через Telegram-бота,
                  оно появится здесь.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Задание</th>
                      <th className="px-4 py-3 font-semibold">Кому выдано</th>
                      <th className="px-4 py-3 font-semibold">Кто выдал</th>
                      <th className="px-4 py-3 font-semibold">Статус</th>
                      <th className="px-4 py-3 font-semibold">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {urgentTasks.map((task) => {
                      const isDone = Boolean(task.completedAt);
                      return (
                        <tr
                          key={task.id}
                          onClick={() => {
                            setSelectedUrgentTask(task);
                            setUrgentTaskPhotoError(null);
                          }}
                          className="cursor-pointer align-top transition hover:bg-slate-50"
                        >
                          <td className="max-w-xl px-4 py-3 text-slate-700">
                            <p className="font-medium text-slate-800">{task.text}</p>
                            {task.photoFileId && (
                              <p className="mt-1 text-xs text-slate-500">Есть фото</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{userName(task.recipient)}</td>
                          <td className="px-4 py-3 text-slate-700">{userName(task.sender)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isDone
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {isDone ? 'Выполнено' : 'Не выполнено'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDateTime(task.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'attendance':
        return (
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Посещаемость</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Вход и выход работников и бригадиров по выбранному дню
                </p>
              </div>
              <label className="text-sm font-medium text-slate-700">
                День
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(event) => setAttendanceDate(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm"
                />
              </label>
            </div>

            {loadingAttendance && (
              <p className="mb-3 text-sm text-slate-500">Загружаем посещаемость...</p>
            )}
            {errorAttendance && <p className="mb-3 text-sm text-red-600">{errorAttendance}</p>}

            {!loadingAttendance && attendanceRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-lg font-semibold text-slate-800">На этот день работников нет</p>
                <p className="mt-2 text-sm text-slate-500">
                  Таблица появляется, когда в календаре выбранного проекта на этот день есть событие
                  типа «Работы».
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Сотрудник</th>
                      <th className="px-4 py-3 font-semibold">Роль</th>
                      <th className="px-4 py-3 font-semibold">Вошёл</th>
                      <th className="px-4 py-3 font-semibold">Вышел</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {attendanceRows.map((row) => (
                      <tr key={`${row.role}-${row.user.id}`} className="align-top">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {userName(row.user)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{projectRoleLabels[row.role]}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.enteredAt
                            ? new Date(row.enteredAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.exitedAt
                            ? new Date(row.exitedAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-100">
      <aside className="flex w-80 flex-col gap-6 bg-slate-900 p-6 text-white">
        <div>
          <h1 className="text-xl font-bold">Construction CRM</h1>
          <p className="mt-1 text-sm text-slate-400">Панель объекта</p>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
            Доступные объекты
          </p>

          {loadingProjects && <p className="text-sm text-slate-400">Загружаем проекты...</p>}
          {errorProjects && <p className="text-sm text-red-400">{errorProjects}</p>}

          <div className="flex flex-col gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  setSelectedDay(new Date());
                }}
                className={`rounded-lg px-4 py-3 text-left transition ${
                  activeProjectId === project.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="block">{project.name}</span>
                <span className="mt-1 block text-xs opacity-75">
                  Камеры: {project.cameraCount ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-700" />

        <nav className="flex flex-col gap-2">
          {[
            ['info', 'Основная информация'],
            ['calendar', 'Календарь'],
            ['attendance', 'Посещаемость'],
            ['cameras', 'Камеры'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value as Tab)}
              className={`rounded-lg px-4 py-3 text-left transition ${
                activeTab === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
          {canViewUrgentTasks && (
            <button
              onClick={() => setActiveTab('urgentTasks')}
              className={`rounded-lg px-4 py-3 text-left transition ${
                activeTab === 'urgentTasks'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Срочные задания
            </button>
          )}
        </nav>

        <div className="mt-auto border-t border-slate-700 pt-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {AUTHORIZED_LABEL}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white" title={authorizedUserName}>
            {authorizedUserName}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {roles.find((r) => r.value === role)?.label}
          </p>
        </div>
      </aside>

      <section className="relative flex-1 p-8">
        <div className="relative min-h-full rounded-2xl bg-white p-8 shadow-sm">
          <div className="absolute right-6 top-6">
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as Role)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 pr-32">
            <p className="text-sm text-slate-500">Текущий объект</p>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeProject?.name ?? 'Не выбран'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Текущая роль: {roles.find((r) => r.value === role)?.label}
            </p>
          </div>

          {renderContent()}
        </div>
      </section>

      {selectedUrgentTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6"
          onClick={() => {
            setSelectedUrgentTask(null);
            setUrgentTaskPhotoError(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Срочное задание</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">
                  {selectedUrgentTask.project?.name ?? activeProject?.name ?? 'Объект не выбран'}
                </h3>
                {selectedUrgentTask.project?.street && (
                  <p className="mt-1 text-sm text-slate-500">{selectedUrgentTask.project.street}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedUrgentTask(null);
                  setUrgentTaskPhotoError(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs uppercase text-slate-500">Кому выдано</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {userName(selectedUrgentTask.recipient)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs uppercase text-slate-500">Кто выдал</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {userName(selectedUrgentTask.sender)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs uppercase text-slate-500">Дата выдачи</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatDateTime(selectedUrgentTask.createdAt)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs uppercase text-slate-500">Статус</p>
                <p
                  className={`mt-1 font-semibold ${
                    selectedUrgentTask.completedAt ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {selectedUrgentTask.completedAt ? 'Выполнено' : 'Не выполнено'}
                </p>
                {selectedUrgentTask.completedAt && (
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTime(selectedUrgentTask.completedAt)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase text-slate-500">Текст задания</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-800">{selectedUrgentTask.text}</p>
            </div>

            {selectedUrgentTask.photoFileId && currentUserId && (
              <div className="mt-6">
                <p className="mb-2 text-xs uppercase text-slate-500">Фото</p>
                {urgentTaskPhotoError ? (
                  <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {urgentTaskPhotoError}
                  </div>
                ) : (
                  <img
                    src={`${API_URL}/urgent-tasks/photo/${selectedUrgentTask.id}?userId=${encodeURIComponent(currentUserId)}`}
                    alt="Фото срочного задания"
                    className="max-h-[520px] w-full rounded-lg border border-slate-200 object-contain"
                    onError={() =>
                      setUrgentTaskPhotoError(
                        'Фото не удалось загрузить. Перезапустите backend и откройте задание ещё раз.',
                      )
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
