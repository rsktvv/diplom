import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Context, Markup, Telegraf } from 'telegraf';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '..', '.env'));

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is not set');
}

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';
const ADD_PROJECT_BUTTON = 'Добавить проект';
const EDIT_PROJECT_BUTTON = 'Редактировать проект';
const DELETE_PROJECT_BUTTON = 'Удалить проект';
const ADD_CALENDAR_EVENT_BUTTON = 'Добавить событие в календарь';
const TODAY_TASKS_BUTTON = 'Дела на сегодня';
const URGENT_TASK_BUTTON = 'Срочное задание';

type ProjectDraft = {
  name?: string;
  street?: string;
  area?: number;
  customer?: PersonInput;
  foreman?: PersonInput;
  workers?: PersonInput[];
};

type PersonInput = {
  telegramId?: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
};

type ProjectStep = 'name' | 'street' | 'area' | 'customer' | 'foreman' | 'workers';
type CalendarStep = 'project' | 'startDate' | 'endDate' | 'title' | 'description' | 'type';
type EditProjectStep =
  | 'project'
  | 'action'
  | 'name'
  | 'customer'
  | 'foreman'
  | 'workers'
  | 'cameraName'
  | 'cameraLocation'
  | 'cameraRtsp'
  | 'cameraHls';
type EventType = 'work' | 'problem' | 'delivery' | 'other';
type UserRole = 'admin' | 'client' | 'foreman' | 'worker';

type Session = {
  step: ProjectStep;
  draft: ProjectDraft;
};

type ApiUser = {
  id: string;
  telegramId?: string;
  telegramUsername?: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
};

type ApiProject = {
  id: string;
  name: string;
  street?: string;
  customer?: ApiUser;
  foreman?: ApiUser;
  workers?: ApiUser[];
};

type CalendarDraft = {
  projectId?: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  description?: string;
  type?: EventType;
};

type ApiCalendarEvent = {
  id: string;
  date: string;
  title: string;
  description?: string;
  type: EventType;
};

type CalendarSession = {
  step: CalendarStep;
  projects: ApiProject[];
  draft: CalendarDraft;
};

type EditProjectDraft = {
  projectId?: string;
  projectName?: string;
  cameraName?: string;
  cameraLocation?: string;
  cameraRtsp?: string;
};

type EditProjectSession = {
  step: EditProjectStep;
  projects: ApiProject[];
  draft: EditProjectDraft;
};

type TurnstileAction = 'entry' | 'exit';

type TurnstileAccessLog = {
  id: string;
  projectId?: string;
  cardId: string;
  personName?: string;
  action: TurnstileAction;
  occurredAt: string;
  deviceName?: string;
};

type TurnstileReportSession = {
  step: 'project' | 'month';
  projects: ApiProject[];
  project?: ApiProject;
};

type UrgentTaskSession = {
  step: 'project' | 'recipient' | 'message' | 'photo';
  projects: ApiProject[];
  project?: ApiProject;
  recipients?: ApiUser[];
  recipient?: ApiUser;
  message?: string;
};

type UrgentInboxTask = {
  id: string;
  projectId: string;
  projectName: string;
  recipientId: string;
  senderName: string;
  text: string;
  photoFileId?: string;
  createdAt: string;
  completedAt?: string;
};

type UrgentInboxSession = {
  taskIds: string[];
};

const sessions = new Map<number, Session>();
const deleteSessions = new Map<number, ApiProject[]>();
const calendarSessions = new Map<number, CalendarSession>();
const editProjectSessions = new Map<number, EditProjectSession>();
const turnstileReportSessions = new Map<number, TurnstileReportSession>();
const urgentTaskSessions = new Map<number, UrgentTaskSession>();
const urgentInboxSessions = new Map<number, UrgentInboxSession>();
const urgentInboxTasks = new Map<string, UrgentInboxTask[]>();
const bot = new Telegraf(token);

function mainKeyboard() {
  return Markup.keyboard([
    [ADD_PROJECT_BUTTON],
    [EDIT_PROJECT_BUTTON],
    [DELETE_PROJECT_BUTTON],
    [ADD_CALENDAR_EVENT_BUTTON],
    [TODAY_TASKS_BUTTON],
    [URGENT_TASK_BUTTON],
  ])
    .resize()
    .oneTime(false);
}

function getChatId(ctx: Context) {
  return ctx.chat?.id;
}

async function sendMainMenu(ctx: Context) {
  await ctx.reply('Выберите действие:', mainKeyboard());
}

async function startProjectCreation(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  deleteSessions.delete(chatId);
  calendarSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);
  sessions.set(chatId, {
    step: 'name',
    draft: {},
  });

  await ctx.reply('Создадим проект. Напишите название проекта.');
}

function parseDateInput(value: string) {
  const normalized = value.trim();
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(normalized)) return null;

  const [day, month, year] = normalized.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatDateKey(date);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateRange(start: string, end: string) {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  while (cursor <= last) {
    result.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function formatProjectsList(projects: ApiProject[]) {
  return projects
    .map((project, index) => {
      const address = project.street ? ` - ${project.street}` : '';
      return `${index + 1}. ${project.name}${address}`;
    })
    .join('\n');
}

function parsePositiveNumber(value: string) {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTelegramUsername(value: string) {
  return value.trim().replace(/^@/, '');
}

function parsePerson(value: string): PersonInput | null {
  const trimmed = value.trim();
  if (/^@?[a-zA-Z0-9_]{5,32}$/.test(trimmed) && !trimmed.includes(',')) {
    return {
      telegramUsername: normalizeTelegramUsername(trimmed),
    };
  }

  const [telegramId, firstName, ...lastNameParts] = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!telegramId || !firstName || !/^\d+$/.test(telegramId)) {
    return null;
  }

  const lastName = lastNameParts.join(' ');
  return {
    telegramId,
    firstName,
    ...(lastName ? { lastName } : {}),
  };
}

function parseWorkers(value: string) {
  const lines = value
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const workers = lines.map(parsePerson);
  if (workers.some((worker) => worker === null)) {
    return null;
  }

  return workers as PersonInput[];
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function userLabel(user: ApiUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

async function upsertUser(person: PersonInput, role: 'client' | 'foreman' | 'worker') {
  if (person.telegramUsername && !person.telegramId) {
    const username = normalizeTelegramUsername(person.telegramUsername);
    const user = await apiGet<ApiUser>(`/users/by-telegram-username/${encodeURIComponent(username)}`);

    if (user.role !== 'admin' && user.role !== role) {
      return apiPut<ApiUser>(`/users/${user.id}`, { role });
    }

    return user;
  }

  return apiPost<ApiUser>('/users/telegram-upsert', {
    telegramId: person.telegramId,
    firstName: person.firstName,
    lastName: person.lastName,
    role,
    isActive: true,
  });
}

async function getCurrentTelegramUser(ctx: Context) {
  if (!ctx.from) {
    throw new Error('Не удалось определить пользователя Telegram');
  }

  return apiPost<ApiUser>('/users/telegram-upsert', {
      telegramId: String(ctx.from.id),
      telegramUsername: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      isActive: true,
  });
}

async function getAvailableProjects(ctx: Context) {
  const user = await getCurrentTelegramUser(ctx);
  return apiGet<ApiProject[]>(`/projects?userId=${encodeURIComponent(user.id)}`);
}

async function createProject(draft: Required<ProjectDraft>) {
  const customer = await upsertUser(draft.customer, 'client');
  const foreman = await upsertUser(draft.foreman, 'foreman');
  const workers = await Promise.all(draft.workers.map((worker) => upsertUser(worker, 'worker')));

  const project = await apiPost<ApiProject>('/projects', {
    name: draft.name,
    street: draft.street,
    area: draft.area,
    customerId: customer.id,
    foremanId: foreman.id,
    workerIds: workers.map((worker) => worker.id),
  });

  return { project, customer, foreman, workers };
}

async function startProjectDeletion(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  sessions.delete(chatId);
  calendarSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);

  try {
    const projects = await getAvailableProjects(ctx);

    if (projects.length === 0) {
      deleteSessions.delete(chatId);
      await ctx.reply('Проектов пока нет.', mainKeyboard());
      return;
    }

    deleteSessions.set(chatId, projects);
    await ctx.reply(
      [
        'Выберите проект для полного удаления. Напишите цифру из списка:',
        '',
        formatProjectsList(projects),
      ].join('\n'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось загрузить проекты. Проверьте, что backend запущен.\n${message}`, mainKeyboard());
  }
}

async function startCalendarEventCreation(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  sessions.delete(chatId);
  deleteSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);

  try {
    const projects = await getAvailableProjects(ctx);

    if (projects.length === 0) {
      calendarSessions.delete(chatId);
      await ctx.reply('Сначала добавьте хотя бы один проект.', mainKeyboard());
      return;
    }

    calendarSessions.set(chatId, {
      step: 'project',
      projects,
      draft: {},
    });

    await ctx.reply(
      [
        'Для какого проекта добавить событие? Напишите цифру из списка:',
        '',
        formatProjectsList(projects),
      ].join('\n'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось загрузить проекты.\n${message}`, mainKeyboard());
  }
}

function editActionsText() {
  return [
    'Что изменить? Напишите цифру:',
    '1. Название проекта',
    '2. Заказчика',
    '3. Бригадира',
    '4. Рабочих',
    '5. Добавить камеру',
  ].join('\n');
}

async function startProjectEditing(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  sessions.delete(chatId);
  deleteSessions.delete(chatId);
  calendarSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);

  try {
    const projects = await getAvailableProjects(ctx);

    if (projects.length === 0) {
      editProjectSessions.delete(chatId);
      await ctx.reply('У вас пока нет доступных проектов.', mainKeyboard());
      return;
    }

    editProjectSessions.set(chatId, {
      step: 'project',
      projects,
      draft: {},
    });

    await ctx.reply(
      [
        'Какой проект редактировать? Напишите цифру из списка:',
        '',
        formatProjectsList(projects),
      ].join('\n'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось загрузить проекты.\n${message}`, mainKeyboard());
  }
}

async function updateProjectName(projectId: string, name: string) {
  return apiPut<ApiProject>(`/projects/${projectId}`, { name });
}

async function updateProjectPerson(
  projectId: string,
  field: 'customerId' | 'foremanId',
  person: PersonInput,
  role: 'client' | 'foreman',
) {
  const user = await upsertUser(person, role);
  return apiPut<ApiProject>(`/projects/${projectId}`, { [field]: user.id });
}

async function updateProjectWorkers(projectId: string, workersInput: PersonInput[]) {
  const workers = await Promise.all(workersInput.map((worker) => upsertUser(worker, 'worker')));
  return apiPut<ApiProject>(`/projects/${projectId}`, {
    workerIds: workers.map((worker) => worker.id),
  });
}

async function createCameraForProject(
  projectId: string,
  name: string,
  location: string,
  rtspUrl: string,
  hlsUrl?: string,
) {
  return apiPost('/cameras', {
    projectId,
    name,
    location,
    rtspUrl,
    hlsUrl: hlsUrl || undefined,
    isActive: true,
  });
}

async function handleEditProjectStep(ctx: Context, text: string, session: EditProjectSession) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  switch (session.step) {
    case 'project': {
      const projectNumber = Number(text.trim());
      if (
        !Number.isInteger(projectNumber) ||
        projectNumber < 1 ||
        projectNumber > session.projects.length
      ) {
        await ctx.reply(
          [
            `Напишите цифру от 1 до ${session.projects.length}.`,
            '',
            formatProjectsList(session.projects),
          ].join('\n'),
        );
        return;
      }

      const project = session.projects[projectNumber - 1];
      session.draft.projectId = project.id;
      session.draft.projectName = project.name;
      session.step = 'action';
      await ctx.reply(editActionsText());
      return;
    }
    case 'action': {
      const action = text.trim();
      if (action === '1') {
        session.step = 'name';
        await ctx.reply('Введите новое название проекта.');
        return;
      }
      if (action === '2') {
        session.step = 'customer';
        await ctx.reply('Введите заказчика по Telegram-username. Например: @rsktvv');
        return;
      }
      if (action === '3') {
        session.step = 'foreman';
        await ctx.reply('Введите бригадира по Telegram-username. Например: @rsktvv');
        return;
      }
      if (action === '4') {
        session.step = 'workers';
        await ctx.reply('Введите рабочих по Telegram-username. Каждый с новой строки или через ; например: @worker1; @worker2');
        return;
      }
      if (action === '5') {
        session.step = 'cameraName';
        await ctx.reply('Введите название камеры. Например: Камера у входа');
        return;
      }

      await ctx.reply(editActionsText());
      return;
    }
    case 'name': {
      if (!text.trim()) {
        await ctx.reply('Название не должно быть пустым.');
        return;
      }

      try {
        await updateProjectName(session.draft.projectId!, text.trim());
        editProjectSessions.delete(chatId);
        await ctx.reply('Название проекта обновлено.', mainKeyboard());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось обновить проект.\n${message}`, mainKeyboard());
      }
      return;
    }
    case 'customer': {
      const customer = parsePerson(text);
      if (!customer) {
        await ctx.reply('Введите Telegram-username. Например: @rsktvv');
        return;
      }

      try {
        await updateProjectPerson(session.draft.projectId!, 'customerId', customer, 'client');
        editProjectSessions.delete(chatId);
        await ctx.reply('Заказчик проекта обновлён.', mainKeyboard());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось обновить заказчика.\n${message}`, mainKeyboard());
      }
      return;
    }
    case 'foreman': {
      const foreman = parsePerson(text);
      if (!foreman) {
        await ctx.reply('Введите Telegram-username. Например: @rsktvv');
        return;
      }

      try {
        await updateProjectPerson(session.draft.projectId!, 'foremanId', foreman, 'foreman');
        editProjectSessions.delete(chatId);
        await ctx.reply('Бригадир проекта обновлён.', mainKeyboard());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось обновить бригадира.\n${message}`, mainKeyboard());
      }
      return;
    }
    case 'workers': {
      const workers = parseWorkers(text);
      if (!workers) {
        await ctx.reply('Пример:\n@worker1\n@worker2');
        return;
      }

      try {
        await updateProjectWorkers(session.draft.projectId!, workers);
        editProjectSessions.delete(chatId);
        await ctx.reply('Список рабочих проекта обновлён.', mainKeyboard());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось обновить рабочих.\n${message}`, mainKeyboard());
      }
      return;
    }
    case 'cameraName': {
      if (!text.trim()) {
        await ctx.reply('Название камеры не должно быть пустым.');
        return;
      }

      session.draft.cameraName = text.trim();
      session.step = 'cameraLocation';
      await ctx.reply('Куда смотрит камера? Например: Главный вход');
      return;
    }
    case 'cameraLocation': {
      if (!text.trim()) {
        await ctx.reply('Описание места не должно быть пустым.');
        return;
      }

      session.draft.cameraLocation = text.trim();
      session.step = 'cameraRtsp';
      await ctx.reply('Вставьте RTSP/API ссылку камеры.');
      return;
    }
    case 'cameraRtsp': {
      if (!text.trim()) {
        await ctx.reply('Ссылка камеры не должна быть пустой.');
        return;
      }

      session.draft.cameraRtsp = text.trim();
      session.step = 'cameraHls';
      await ctx.reply('Вставьте HLS ссылку для сайта или напишите -, если её пока нет.');
      return;
    }
    case 'cameraHls': {
      const hlsUrl = text.trim() === '-' ? undefined : text.trim();

      try {
        await createCameraForProject(
          session.draft.projectId!,
          session.draft.cameraName!,
          session.draft.cameraLocation!,
          session.draft.cameraRtsp!,
          hlsUrl,
        );
        editProjectSessions.delete(chatId);
        await ctx.reply('Камера добавлена к проекту. На сайте она появится во вкладке камер.', mainKeyboard());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось добавить камеру.\n${message}`, mainKeyboard());
      }
    }
  }
}

function uniqueUsers(users: Array<ApiUser | undefined>) {
  const seen = new Set<string>();
  const result: ApiUser[] = [];

  for (const user of users) {
    if (!user || seen.has(user.id)) continue;
    seen.add(user.id);
    result.push(user);
  }

  return result;
}

function formatUsersList(users: ApiUser[]) {
  return users
    .map((user, index) => {
      const username = user.telegramUsername ? ` (@${user.telegramUsername})` : '';
      return `${index + 1}. ${userLabel(user)} - ${user.role}${username}`;
    })
    .join('\n');
}

function canIssueUrgentTask(project: ApiProject, user: ApiUser) {
  return user.role === 'admin' || project.foreman?.id === user.id;
}

function projectRecipients(project: ApiProject, sender: ApiUser) {
  return uniqueUsers([project.foreman, project.customer, ...(project.workers ?? [])]).filter((user) =>
    Boolean(user.telegramId),
  );
}

function urgentTaskText(project: ApiProject, sender: ApiUser, taskText: string) {
  return [
    'СРОЧНОЕ ЗАДАНИЕ',
    `Проект: ${project.name}`,
    `Отправитель: ${userLabel(sender)}`,
    '',
    taskText,
  ].join('\n');
}

function activeUrgentTasks(telegramId: string) {
  return (urgentInboxTasks.get(telegramId) ?? []).filter((task) => !task.completedAt);
}

function findUrgentInboxTask(telegramId: string, taskId: string) {
  return (urgentInboxTasks.get(telegramId) ?? []).find((task) => task.id === taskId);
}

function shortUrgentTaskText(task: UrgentInboxTask) {
  const normalized = task.text.replace(/\s+/g, ' ').trim();
  const preview = normalized.length > 70 ? `${normalized.slice(0, 67)}...` : normalized;
  const photo = task.photoFileId ? ' (с фото)' : '';
  return `${task.projectName}: ${preview}${photo}`;
}

function formatUrgentInboxList(tasks: UrgentInboxTask[]) {
  return tasks
    .map((task, index) => `${index + 1}. ${shortUrgentTaskText(task)}`)
    .join('\n');
}

function urgentInboxPrompt(tasks: UrgentInboxTask[]) {
  return [
    'Вы получили срочное задание.',
    `Активных срочных заданий: ${tasks.length}.`,
    'Выберите, какое посмотреть сначала: напишите цифру из списка.',
    '',
    formatUrgentInboxList(tasks),
  ].join('\n');
}

function urgentTaskDetailsText(task: UrgentInboxTask) {
  const createdAt = new Date(task.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    'СРОЧНОЕ ЗАДАНИЕ',
    `Проект: ${task.projectName}`,
    `Отправитель: ${task.senderName}`,
    `Получено: ${createdAt}`,
    '',
    task.text,
  ].join('\n');
}

function urgentTaskDoneKeyboard(taskId: string) {
  return Markup.inlineKeyboard([
    Markup.button.callback('Выполнено', `urgent_done:${taskId}`),
  ]);
}

async function rememberUrgentTask(
  recipient: ApiUser,
  project: ApiProject,
  sender: ApiUser,
  taskText: string,
  photoFileId?: string,
) {
  if (!recipient.telegramId) {
    throw new Error('У получателя нет Telegram ID');
  }

  const savedTask = await apiPost<{
    id: string;
    text: string;
    photoFileId?: string;
    createdAt: string;
    completedAt?: string;
  }>('/urgent-tasks', {
    projectId: project.id,
    senderId: sender.id,
    recipientId: recipient.id,
    text: taskText,
    photoFileId,
  });

  const task: UrgentInboxTask = {
    id: savedTask.id,
    projectId: project.id,
    projectName: project.name,
    recipientId: recipient.id,
    senderName: userLabel(sender),
    text: savedTask.text,
    photoFileId: savedTask.photoFileId,
    createdAt: savedTask.createdAt,
    completedAt: savedTask.completedAt,
  };

  urgentInboxTasks.set(recipient.telegramId, [
    ...(urgentInboxTasks.get(recipient.telegramId) ?? []),
    task,
  ]);

  return task;
}

async function sendUrgentTaskDetails(ctx: Context, task: UrgentInboxTask) {
  const text = urgentTaskDetailsText(task);
  const keyboard = urgentTaskDoneKeyboard(task.id);

  if (task.photoFileId) {
    await ctx.replyWithPhoto(task.photoFileId, {
      caption: text,
      ...keyboard,
    });
    return;
  }

  await ctx.reply(text, keyboard);
}

async function showUrgentInbox(ctx: Context, telegramId: string) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  const tasks = activeUrgentTasks(telegramId);
  if (tasks.length === 0) {
    urgentInboxSessions.delete(chatId);
    await ctx.reply('Активных срочных заданий нет.', mainKeyboard());
    return;
  }

  urgentInboxSessions.set(chatId, { taskIds: tasks.map((task) => task.id) });
  await ctx.reply(urgentInboxPrompt(tasks));
}

async function handleUrgentInbox(ctx: Context, text: string, session: UrgentInboxSession) {
  const chatId = getChatId(ctx);
  if (!chatId || !ctx.from) return;

  const taskNumber = Number(text.trim());
  if (!Number.isInteger(taskNumber) || taskNumber < 1 || taskNumber > session.taskIds.length) {
    const tasks = activeUrgentTasks(String(ctx.from.id));
    if (tasks.length === 0) {
      urgentInboxSessions.delete(chatId);
      await ctx.reply('Активных срочных заданий нет.', mainKeyboard());
      return;
    }

    urgentInboxSessions.set(chatId, { taskIds: tasks.map((task) => task.id) });
    await ctx.reply(
      [
        `Напишите цифру от 1 до ${tasks.length}.`,
        '',
        formatUrgentInboxList(tasks),
      ].join('\n'),
    );
    return;
  }

  const taskId = session.taskIds[taskNumber - 1];
  const task = findUrgentInboxTask(String(ctx.from.id), taskId);
  if (!task || task.completedAt) {
    await showUrgentInbox(ctx, String(ctx.from.id));
    return;
  }

  await sendUrgentTaskDetails(ctx, task);
}

async function sendUrgentTask(
  recipient: ApiUser,
  project: ApiProject,
  sender: ApiUser,
  taskText: string,
  photoFileId?: string,
) {
  if (!recipient.telegramId) {
    throw new Error('У получателя нет Telegram ID');
  }

  await rememberUrgentTask(recipient, project, sender, taskText, photoFileId);
  const activeTasks = activeUrgentTasks(recipient.telegramId);
  urgentInboxSessions.set(Number(recipient.telegramId), {
    taskIds: activeTasks.map((task) => task.id),
  });

  await bot.telegram.sendMessage(recipient.telegramId, urgentInboxPrompt(activeTasks));
}

async function startUrgentTask(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  sessions.delete(chatId);
  deleteSessions.delete(chatId);
  calendarSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);

  try {
    const user = await getCurrentTelegramUser(ctx);
    if (user.role !== 'admin' && user.role !== 'foreman') {
      await ctx.reply('Срочные задания могут выдавать только админ и бригадир.', mainKeyboard());
      return;
    }

    const projects = await getAvailableProjects(ctx);
    if (projects.length === 0) {
      await ctx.reply('У вас пока нет доступных проектов.', mainKeyboard());
      return;
    }

    urgentTaskSessions.set(chatId, {
      step: 'project',
      projects,
    });

    await ctx.reply(
      [
        'По какому проекту выдать срочное задание? Напишите цифру из списка:',
        '',
        formatProjectsList(projects),
      ].join('\n'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось начать выдачу задания.\n${message}`, mainKeyboard());
  }
}

async function handleUrgentTask(ctx: Context, text: string, session: UrgentTaskSession) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  try {
    const sender = await getCurrentTelegramUser(ctx);

    if (session.step === 'project') {
      const projectNumber = Number(text.trim());
      if (
        !Number.isInteger(projectNumber) ||
        projectNumber < 1 ||
        projectNumber > session.projects.length
      ) {
        await ctx.reply(
          [
            `Напишите цифру от 1 до ${session.projects.length}.`,
            '',
            formatProjectsList(session.projects),
          ].join('\n'),
        );
        return;
      }

      const selectedProject = session.projects[projectNumber - 1];
      const project = await apiGet<ApiProject>(`/projects/${selectedProject.id}`);

      if (!canIssueUrgentTask(project, sender)) {
        urgentTaskSessions.delete(chatId);
        await ctx.reply('Вы можете выдавать задания только как админ или бригадир этого проекта.', mainKeyboard());
        return;
      }

      const recipients = projectRecipients(project, sender);
      if (recipients.length === 0) {
        urgentTaskSessions.delete(chatId);
        await ctx.reply('В составе проекта нет получателей с Telegram ID.', mainKeyboard());
        return;
      }

      session.project = project;
      session.recipients = recipients;
      session.step = 'recipient';

      await ctx.reply(
        [
          `Кому отправить срочное задание по проекту "${project.name}"? Напишите цифру:`,
          '',
          formatUsersList(recipients),
        ].join('\n'),
      );
      return;
    }

    if (session.step === 'recipient') {
      const recipientNumber = Number(text.trim());
      const recipients = session.recipients ?? [];

      if (
        !Number.isInteger(recipientNumber) ||
        recipientNumber < 1 ||
        recipientNumber > recipients.length
      ) {
        await ctx.reply(
          [
            `Напишите цифру от 1 до ${recipients.length}.`,
            '',
            formatUsersList(recipients),
          ].join('\n'),
        );
        return;
      }

      session.recipient = recipients[recipientNumber - 1];
      session.step = 'message';
      await ctx.reply('Напишите текст срочного задания.');
      return;
    }

    if (session.step === 'message') {
      const taskText = text.trim();
      if (!taskText) {
        await ctx.reply('Текст задания не должен быть пустым.');
        return;
      }

      session.message = taskText;
      session.step = 'photo';
      await ctx.reply('Можно добавить фотографию к заданию. Отправьте фото или напишите -, если фото не нужно.');
      return;
    }

    if (session.step === 'photo') {
      if (text.trim() !== '-') {
        await ctx.reply('Отправьте фотографию или напишите -, если фото не нужно.');
        return;
      }

      const project = session.project;
      const recipient = session.recipient;
      const taskText = session.message;
      if (!project || !recipient || !taskText) {
        throw new Error('Проект, получатель или текст задания не выбран');
      }

      await sendUrgentTask(recipient, project, sender, taskText);

      urgentTaskSessions.delete(chatId);
      await ctx.reply(`Срочное задание отправлено: ${userLabel(recipient)}.`, mainKeyboard());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(
      `Не удалось отправить срочное задание.\n${message}\n\nПроверьте, что получатель уже запускал этого бота.`,
      mainKeyboard(),
    );
  }
}

async function handleUrgentTaskPhoto(ctx: Context, session: UrgentTaskSession) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  if (session.step !== 'photo') {
    await ctx.reply('Сейчас фото не ожидается. Сначала заполните текст задания.');
    return;
  }

  try {
    const sender = await getCurrentTelegramUser(ctx);
    const project = session.project;
    const recipient = session.recipient;
    const taskText = session.message;

    if (!project || !recipient || !taskText) {
      throw new Error('Проект, получатель или текст задания не выбран');
    }

    if (!('message' in ctx) || !ctx.message || !('photo' in ctx.message)) {
      throw new Error('Фотография не найдена');
    }

    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    await sendUrgentTask(recipient, project, sender, taskText, bestPhoto.file_id);

    urgentTaskSessions.delete(chatId);
    await ctx.reply(`Срочное задание с фото отправлено: ${userLabel(recipient)}.`, mainKeyboard());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(
      `Не удалось отправить срочное задание с фото.\n${message}\n\nПроверьте, что получатель уже запускал этого бота.`,
      mainKeyboard(),
    );
  }
}

async function ensureAdmin(ctx: Context) {
  const user = await getCurrentTelegramUser(ctx);
  if (user.role !== 'admin') {
    await ctx.reply('Этот отчёт доступен только администратору.', mainKeyboard());
    return null;
  }

  return user;
}

function parseMonthInput(value: string) {
  const normalized = value.trim();
  if (!/^\d{2}\.\d{4}$/.test(normalized)) return null;

  const [month, year] = normalized.split('.').map(Number);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;

  return { month, year };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTurnstileDay(dateKey: string, logs: TurnstileAccessLog[]) {
  const rows = logs.map((log) => {
    const action = log.action === 'entry' ? 'вошёл' : 'вышел';
    const person = log.personName || `карта ${log.cardId}`;
    const device = log.deviceName ? `, ${log.deviceName}` : '';
    return `${formatTime(log.occurredAt)} - ${person} ${action}${device}`;
  });

  return [`${dateKey}:`, ...rows].join('\n');
}

function buildTurnstileReport(logs: TurnstileAccessLog[], month: number, year: number, projectName: string) {
  if (logs.length === 0) {
    return [`${projectName}: за ${String(month).padStart(2, '0')}.${year} проходов через турникеты нет.`];
  }

  const grouped = logs.reduce<Record<string, TurnstileAccessLog[]>>((acc, log) => {
    const dateKey = new Date(log.occurredAt).toLocaleDateString('ru-RU');
    acc[dateKey] = [...(acc[dateKey] ?? []), log];
    return acc;
  }, {});

  const chunks: string[] = [
    `Отчёт по турникетам: ${projectName}\nПериод: ${String(month).padStart(2, '0')}.${year}`,
  ];

  for (const [dateKey, dayLogs] of Object.entries(grouped)) {
    const block = formatTurnstileDay(dateKey, dayLogs);
    const last = chunks[chunks.length - 1];

    if (`${last}\n\n${block}`.length > 3500) {
      chunks.push(block);
    } else {
      chunks[chunks.length - 1] = `${last}\n\n${block}`;
    }
  }

  return chunks;
}

async function startTurnstileReport(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  sessions.delete(chatId);
  deleteSessions.delete(chatId);
  calendarSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);

  const admin = await ensureAdmin(ctx);
  if (!admin) return;

  try {
    const projects = await getAvailableProjects(ctx);

    if (projects.length === 0) {
      await ctx.reply('Проектов пока нет.', mainKeyboard());
      return;
    }

    turnstileReportSessions.set(chatId, {
      step: 'project',
      projects,
    });

    await ctx.reply(
      [
        'По какому проекту показать отчёт по турникетам? Напишите цифру из списка:',
        '',
        formatProjectsList(projects),
      ].join('\n'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось загрузить проекты.\n${message}`, mainKeyboard());
  }
}

async function handleTurnstileReport(ctx: Context, text: string, session: TurnstileReportSession) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  const admin = await ensureAdmin(ctx);
  if (!admin) {
    turnstileReportSessions.delete(chatId);
    return;
  }

  if (session.step === 'project') {
    const projectNumber = Number(text.trim());
    if (
      !Number.isInteger(projectNumber) ||
      projectNumber < 1 ||
      projectNumber > session.projects.length
    ) {
      await ctx.reply(
        [
          `Напишите цифру от 1 до ${session.projects.length}.`,
          '',
          formatProjectsList(session.projects),
        ].join('\n'),
      );
      return;
    }

    session.project = session.projects[projectNumber - 1];
    session.step = 'month';
    await ctx.reply('Введите месяц отчёта в формате ММ.ГГГГ. Например: 05.2026');
    return;
  }

  const month = parseMonthInput(text);
  if (!month) {
    await ctx.reply('Месяц должен быть в формате ММ.ГГГГ. Например: 05.2026');
    return;
  }

  try {
    const project = session.project;
    if (!project) throw new Error('Проект отчёта не выбран');

    const logs = await apiGet<TurnstileAccessLog[]>(
      `/turnstile/access-logs/month?year=${month.year}&month=${month.month}&projectId=${encodeURIComponent(project.id)}`,
    );
    turnstileReportSessions.delete(chatId);

    for (const message of buildTurnstileReport(logs, month.month, month.year, project.name)) {
      await ctx.reply(message);
    }

    await sendMainMenu(ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось загрузить отчёт по турникетам.\n${message}`, mainKeyboard());
  }
}

async function handleProjectDeletion(ctx: Context, text: string, projects: ApiProject[]) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  const projectNumber = Number(text.trim());
  if (!Number.isInteger(projectNumber) || projectNumber < 1 || projectNumber > projects.length) {
    await ctx.reply(
      [
        `Напишите цифру от 1 до ${projects.length}.`,
        '',
        formatProjectsList(projects),
      ].join('\n'),
    );
    return;
  }

  const project = projects[projectNumber - 1];

  try {
    await apiDelete(`/projects/${project.id}`);
    deleteSessions.delete(chatId);
    await ctx.reply(`Проект "${project.name}" полностью удалён.`, mainKeyboard());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось удалить проект "${project.name}".\n${message}`, mainKeyboard());
  }
}

async function getAuthorFromTelegram(ctx: Context) {
  return getCurrentTelegramUser(ctx);
}

function parseEventType(value: string): EventType | null {
  const normalized = value.trim().toLowerCase();
  const byNumber: Record<string, EventType> = {
    '1': 'work',
    '2': 'delivery',
    '3': 'problem',
    '4': 'other',
  };
  const byName: Record<string, EventType> = {
    work: 'work',
    delivery: 'delivery',
    problem: 'problem',
    other: 'other',
    работы: 'work',
    поставка: 'delivery',
    проблема: 'problem',
    другое: 'other',
  };

  return byNumber[normalized] ?? byName[normalized] ?? null;
}

const eventTypeLabels: Record<EventType, string> = {
  work: 'Работы',
  delivery: 'Поставка',
  problem: 'Проблема',
  other: 'Другое',
};

function formatTodayTasks(projects: ApiProject[], eventsByProject: Map<string, ApiCalendarEvent[]>, date: string) {
  const lines = [`Дела на сегодня (${date}):`];
  let hasEvents = false;

  for (const project of projects) {
    const events = eventsByProject.get(project.id) ?? [];
    if (events.length === 0) continue;

    hasEvents = true;
    lines.push('', `Объект: ${project.name}`);
    for (const event of events) {
      const description = event.description ? `\n   ${event.description}` : '';
      lines.push(`- ${eventTypeLabels[event.type]}: ${event.title}${description}`);
    }
  }

  if (!hasEvents) {
    return `На сегодня (${date}) дел в доступных календарях нет.`;
  }

  return lines.join('\n');
}

async function showTodayTasks(ctx: Context) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  sessions.delete(chatId);
  deleteSessions.delete(chatId);
  calendarSessions.delete(chatId);
  editProjectSessions.delete(chatId);
  turnstileReportSessions.delete(chatId);
  urgentTaskSessions.delete(chatId);
  urgentInboxSessions.delete(chatId);

  try {
    const user = await getCurrentTelegramUser(ctx);
    const projects = await getAvailableProjects(ctx);
    const today = formatDateKey(new Date());

    if (projects.length === 0) {
      await ctx.reply('У вас пока нет доступных проектов.', mainKeyboard());
      return;
    }

    const eventsByProject = new Map<string, ApiCalendarEvent[]>();
    await Promise.all(
      projects.map(async (project) => {
        const events = await apiGet<ApiCalendarEvent[]>(
          `/calendar/by-project/${project.id}?userId=${encodeURIComponent(user.id)}`,
        );
        eventsByProject.set(
          project.id,
          events
            .filter((event) => event.date === today)
            .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
        );
      }),
    );

    await ctx.reply(formatTodayTasks(projects, eventsByProject, today), mainKeyboard());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    await ctx.reply(`Не удалось загрузить дела на сегодня.\n${message}`, mainKeyboard());
  }
}

async function createCalendarEvents(ctx: Context, draft: Required<CalendarDraft>) {
  const author = await getAuthorFromTelegram(ctx);
  const dates = dateRange(draft.startDate, draft.endDate);

  await Promise.all(
    dates.map((date) =>
      apiPost('/calendar', {
        projectId: draft.projectId,
        authorId: author.id,
        date,
        title: draft.title,
        description: draft.description,
        type: draft.type,
      }),
    ),
  );

  return dates.length;
}

async function handleCalendarStep(ctx: Context, text: string, session: CalendarSession) {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  switch (session.step) {
    case 'project': {
      const projectNumber = Number(text.trim());
      if (
        !Number.isInteger(projectNumber) ||
        projectNumber < 1 ||
        projectNumber > session.projects.length
      ) {
        await ctx.reply(
          [
            `Напишите цифру от 1 до ${session.projects.length}.`,
            '',
            formatProjectsList(session.projects),
          ].join('\n'),
        );
        return;
      }

      const project = session.projects[projectNumber - 1];
      session.draft.projectId = project.id;
      session.draft.projectName = project.name;
      session.step = 'startDate';
      await ctx.reply('Введите дату события или начало диапазона в формате ДД.ММ.ГГГГ. Например: 01.06.2026');
      return;
    }
    case 'startDate': {
      const startDate = parseDateInput(text);
      if (!startDate) {
        await ctx.reply('Дата должна быть в формате ДД.ММ.ГГГГ. Например: 01.06.2026');
        return;
      }

      session.draft.startDate = startDate;
      session.step = 'endDate';
      await ctx.reply('Введите дату окончания диапазона в формате ДД.ММ.ГГГГ. Если событие на один день, напишите -');
      return;
    }
    case 'endDate': {
      const endDate = text.trim() === '-' ? session.draft.startDate : parseDateInput(text);
      if (!endDate) {
        await ctx.reply('Дата окончания должна быть в формате ДД.ММ.ГГГГ или -.');
        return;
      }

      if (new Date(`${endDate}T00:00:00`) < new Date(`${session.draft.startDate}T00:00:00`)) {
        await ctx.reply('Дата окончания не может быть раньше даты начала.');
        return;
      }

      session.draft.endDate = endDate;
      session.step = 'title';
      await ctx.reply('Что будет происходить в этот день или период? Напишите короткое название.');
      return;
    }
    case 'title': {
      if (!text.trim()) {
        await ctx.reply('Название события не должно быть пустым.');
        return;
      }

      session.draft.title = text.trim();
      session.step = 'description';
      await ctx.reply('Добавьте описание или напишите -, если описание не нужно.');
      return;
    }
    case 'description': {
      session.draft.description = text.trim() === '-' ? '' : text.trim();
      session.step = 'type';
      await ctx.reply(
        [
          'Выберите тип события. Напишите цифру:',
          '1. Работы',
          '2. Поставка',
          '3. Проблема',
          '4. Другое',
        ].join('\n'),
      );
      return;
    }
    case 'type': {
      const type = parseEventType(text);
      if (!type) {
        await ctx.reply('Напишите цифру от 1 до 4.');
        return;
      }

      session.draft.type = type;

      try {
        const createdCount = await createCalendarEvents(ctx, session.draft as Required<CalendarDraft>);
        calendarSessions.delete(chatId);
        await ctx.reply(
          `Событие "${session.draft.title}" добавлено в календарь проекта "${session.draft.projectName}" на ${createdCount} дн.`,
          mainKeyboard(),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось добавить событие в календарь.\n${message}`, mainKeyboard());
      }
    }
  }
}

async function handleProjectStep(ctx: Context, text: string, session: Session) {
  if (!('reply' in ctx)) return;

  switch (session.step) {
    case 'name': {
      if (!text.trim()) {
        await ctx.reply('Название не должно быть пустым. Напишите название проекта.');
        return;
      }
      session.draft.name = text.trim();
      session.step = 'street';
      await ctx.reply('Укажите улицу или адрес объекта.');
      return;
    }
    case 'street': {
      if (!text.trim()) {
        await ctx.reply('Адрес не должен быть пустым. Укажите улицу или адрес объекта.');
        return;
      }
      session.draft.street = text.trim();
      session.step = 'area';
      await ctx.reply('Укажите площадь объекта в квадратных метрах. Например: 124.5');
      return;
    }
    case 'area': {
      const area = parsePositiveNumber(text);
      if (area === null) {
        await ctx.reply('Площадь должна быть числом больше или равным 0. Например: 124.5');
        return;
      }
      session.draft.area = area;
      session.step = 'customer';
      await ctx.reply('Укажите заказчика по Telegram-username. Например: @rsktvv');
      return;
    }
    case 'customer': {
      const customer = parsePerson(text);
      if (!customer) {
        await ctx.reply('Не понял заказчика. Напишите Telegram-username, например: @rsktvv');
        return;
      }
      session.draft.customer = customer;
      session.step = 'foreman';
      await ctx.reply('Укажите бригадира по Telegram-username. Например: @rsktvv');
      return;
    }
    case 'foreman': {
      const foreman = parsePerson(text);
      if (!foreman) {
        await ctx.reply('Не понял бригадира. Напишите Telegram-username, например: @rsktvv');
        return;
      }
      session.draft.foreman = foreman;
      session.step = 'workers';
      await ctx.reply('Укажите рабочих по Telegram-username. Каждый с новой строки или через ; например: @worker1; @worker2');
      return;
    }
    case 'workers': {
      const workers = parseWorkers(text);
      if (!workers) {
        await ctx.reply('Не понял список рабочих. Пример:\n@worker1\n@worker2');
        return;
      }

      session.draft.workers = workers;

      try {
        const result = await createProject(session.draft as Required<ProjectDraft>);
        const workerNames = result.workers.map(userLabel).join(', ');
        sessions.delete(ctx.chat!.id);

        await ctx.reply(
          [
            `Проект "${result.project.name}" создан.`,
            `Заказчик: ${userLabel(result.customer)}`,
            `Бригадир: ${userLabel(result.foreman)}`,
            `Рабочие: ${workerNames}`,
          ].join('\n'),
          mainKeyboard(),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
        await ctx.reply(`Не удалось создать проект. Проверьте, что backend запущен.\n${message}`);
      }
    }
  }
}

bot.start(async (ctx) => {
  await ctx.reply('Привет! Я бот Construction CRM.');
  await sendMainMenu(ctx);
});

bot.command('ping', (ctx) => ctx.reply('pong'));
bot.command('menu', sendMainMenu);

bot.hears(ADD_PROJECT_BUTTON, startProjectCreation);
bot.hears(EDIT_PROJECT_BUTTON, startProjectEditing);
bot.hears(DELETE_PROJECT_BUTTON, startProjectDeletion);
bot.hears(ADD_CALENDAR_EVENT_BUTTON, startCalendarEventCreation);
bot.hears(TODAY_TASKS_BUTTON, showTodayTasks);
bot.hears(URGENT_TASK_BUTTON, startUrgentTask);

bot.action(/^urgent_done:(.+)$/, async (ctx) => {
  const taskId = ctx.match[1];
  const telegramId = String(ctx.from.id);
  const currentUser = await getCurrentTelegramUser(ctx);
  const task = findUrgentInboxTask(telegramId, taskId);

  if (false && !task) {
    await ctx.answerCbQuery('Задание не найдено');
    return;
  }

  if (task?.completedAt) {
    await ctx.answerCbQuery('Уже отмечено выполненным');
    return;
  }

  const completedTask = await apiPut<{ completedAt?: string }>(`/urgent-tasks/${taskId}/complete`, {
    recipientId: currentUser.id,
  });
  if (task) {
    task.completedAt = completedTask.completedAt ?? new Date().toISOString();
  }
  await ctx.answerCbQuery('Задание отмечено выполненным');

  const activeTasks = activeUrgentTasks(telegramId);
  if (activeTasks.length === 0) {
    urgentInboxSessions.delete(ctx.chat?.id ?? 0);
    await ctx.reply('Срочное задание выполнено. Активных срочных заданий больше нет.', mainKeyboard());
    return;
  }

  if (ctx.chat?.id) {
    urgentInboxSessions.set(ctx.chat.id, {
      taskIds: activeTasks.map((activeTask) => activeTask.id),
    });
  }

  await ctx.reply(
    [
      `Срочное задание выполнено. Осталось активных: ${activeTasks.length}.`,
      'Выберите следующее задание цифрой:',
      '',
      formatUrgentInboxList(activeTasks),
    ].join('\n'),
  );
});

bot.on('photo', async (ctx) => {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  const urgentTaskSession = urgentTaskSessions.get(chatId);
  if (urgentTaskSession) {
    await handleUrgentTaskPhoto(ctx, urgentTaskSession);
    return;
  }

  await ctx.reply('Фото сейчас не ожидается. Выберите действие в меню.', mainKeyboard());
});

bot.on('text', async (ctx) => {
  const chatId = getChatId(ctx);
  if (!chatId) return;

  const urgentInboxSession = urgentInboxSessions.get(chatId);
  if (urgentInboxSession) {
    await handleUrgentInbox(ctx, ctx.message.text, urgentInboxSession);
    return;
  }

  const projectsToDelete = deleteSessions.get(chatId);
  if (projectsToDelete) {
    await handleProjectDeletion(ctx, ctx.message.text, projectsToDelete);
    return;
  }

  const urgentTaskSession = urgentTaskSessions.get(chatId);
  if (urgentTaskSession) {
    await handleUrgentTask(ctx, ctx.message.text, urgentTaskSession);
    return;
  }

  const editProjectSession = editProjectSessions.get(chatId);
  if (editProjectSession) {
    await handleEditProjectStep(ctx, ctx.message.text, editProjectSession);
    return;
  }

  const calendarSession = calendarSessions.get(chatId);
  if (calendarSession) {
    await handleCalendarStep(ctx, ctx.message.text, calendarSession);
    return;
  }

  const session = sessions.get(chatId);
  if (!session) {
    await sendMainMenu(ctx);
    return;
  }

  await handleProjectStep(ctx, ctx.message.text, session);
});

bot.launch().then(() => {
  console.log('Telegram bot started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
