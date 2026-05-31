'use client';

import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export default function MockLoginButton() {
  const router = useRouter();

  const handleMockLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/users/telegram-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: '1',
          firstName: 'Тестовый',
          lastName: 'Администратор',
          telegramUsername: 'test_admin',
          role: 'admin',
        }),
      });

      if (!res.ok) throw new Error('Не удалось войти как тестовый пользователь');

      const mockUser = await res.json();
      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('role', mockUser.role ?? 'admin');
      router.replace('/dashboard');
    } catch (error) {
      console.error(error);
      alert('Ошибка тестового входа');
    }
  };

  return (
    <button
      onClick={handleMockLogin}
      className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition"
    >
      Войти как тестовый пользователь
    </button>
  );
}
