import TelegramLoginButton from '@/components/auth/TelegramLoginButton';
import MockLoginButton from '@/components/auth/MockLoginButton';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6 max-w-md w-full mx-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
            C
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Construction CRM
          </h1>
          <p className="text-slate-500 text-sm text-center">
            Система управления строительными объектами
          </p>
        </div>

        <div className="w-full border-t border-slate-100" />

        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-slate-600 text-sm font-medium">
            Войдите через Telegram
          </p>

          <TelegramLoginButton
            botUsername={process.env.NEXT_PUBLIC_BOT_USERNAME || 'your_bot'}
          />

          <div className="w-full">
            <MockLoginButton />
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Доступ только для сотрудников. <br />
          Для получения доступа обратитесь к администратору.
        </p>
      </div>
    </main>
  );
}
