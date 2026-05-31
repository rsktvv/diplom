'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  auth_date: number;
  hash: string;
  photo_url?: string;
}

interface Props {
  botUsername: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export default function TelegramLoginButton({ botUsername }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    (window as any).onTelegramAuth = async (user: TelegramUser) => {
      try {
        const res = await fetch(`${API_URL}/telegram-auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });

        if (!res.ok) throw new Error('Ошибка авторизации');

        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('role', data.user.role ?? 'customer');
        router.push('/dashboard');
      } catch (e) {
        console.error(e);
        alert('Ошибка входа через Telegram');
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    if (wrapperRef.current) {
      wrapperRef.current.innerHTML = '';
      wrapperRef.current.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [botUsername, router]);

  return <div ref={wrapperRef} />;
}
