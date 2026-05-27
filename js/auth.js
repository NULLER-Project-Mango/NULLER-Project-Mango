// js/auth.js
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from './firebase-config.js';

export class AuthManager {
  constructor(app) {
    this.app = app;
    this.attemptCount = 0;
    this.lastAttemptTime = 0;
    this.LOCKOUT_TIME = 60000; // 1 минута блокировки после 5 попыток
    this.MAX_ATTEMPTS = 5;
    this.setup();
  }

  setup() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.tab === 'login';
        document.getElementById('login-form').classList.toggle('hidden', !isLogin);
        document.getElementById('register-form').classList.toggle('hidden', isLogin);
        this.hideError();
      });
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleRegister();
    });
  }

  // RATE LIMITING защита от брутфорса
  checkRateLimit() {
    const now = Date.now();
    if (this.attemptCount >= this.MAX_ATTEMPTS) {
      const elapsed = now - this.lastAttemptTime;
      if (elapsed < this.LOCKOUT_TIME) {
        const wait = Math.ceil((this.LOCKOUT_TIME - elapsed) / 1000);
        this.showError(`Слишком много попыток. Подождите ${wait} сек.`);
        return false;
      } else {
        this.attemptCount = 0;
      }
    }
    return true;
  }

  async handleLogin() {
    if (!this.checkRateLimit()) return;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // ВАЛИДАЦИЯ
    if (!this.validateEmail(email)) {
      this.showError('Некорректный email');
      return;
    }
    if (!password || password.length < 6) {
      this.showError('Введите пароль');
      return;
    }

    this.attemptCount++;
    this.lastAttemptTime = Date.now();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      this.attemptCount = 0; // сброс при успехе
    } catch (err) {
      this.showError(this.getErrorMessage(err.code));
    }
  }

  async handleRegister() {
    if (!this.checkRateLimit()) return;

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-password-confirm').value;

    // ВАЛИДАЦИЯ ИМЕНИ
    if (!name || name.length < 2 || name.length > 20) {
      this.showError('Имя должно быть от 2 до 20 символов');
      return;
    }
    if (!/^[a-zA-Zа-яА-Я0-9_\s-]+$/u.test(name)) {
      this.showError('Имя может содержать только буквы, цифры, пробелы, _ и -');
      return;
    }

    // ВАЛИДАЦИЯ EMAIL
    if (!this.validateEmail(email)) {
      this.showError('Некорректный email');
      return;
    }

    // ВАЛИДАЦИЯ ПАРОЛЯ (надёжность)
    if (password.length < 8) {
      this.showError('Пароль должен быть минимум 8 символов');
      return;
    }
    if (password.length > 128) {
      this.showError('Пароль слишком длинный (макс 128)');
      return;
    }
    if (!/[A-Za-zА-Яа-я]/.test(password)) {
      this.showError('Пароль должен содержать хотя бы одну букву');
      return;
    }
    if (!/[0-9]/.test(password)) {
      this.showError('Пароль должен содержать хотя бы одну цифру');
      return;
    }
    if (password !== confirm) {
      this.showError('Пароли не совпадают');
      return;
    }

    // Проверка на распространённые пароли
    const commonPasswords = ['12345678', 'password', 'qwerty12', 'password1', 'abc12345', '123456789'];
    if (commonPasswords.includes(password.toLowerCase())) {
      this.showError('Этот пароль слишком распространён. Выберите более надёжный.');
      return;
    }

    this.attemptCount++;
    this.lastAttemptTime = Date.now();

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      this.attemptCount = 0;
    } catch (err) {
      this.showError(this.getErrorMessage(err.code));
    }
  }

  validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 100) return false;
    // Базовая RFC проверка
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  showError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = String(msg).substring(0, 200); // textContent + лимит
    el.classList.remove('hidden');
  }

  hideError() {
    document.getElementById('auth-error').classList.add('hidden');
  }

  getErrorMessage(code) {
    const messages = {
      'auth/email-already-in-use': 'Этот email уже зарегистрирован',
      'auth/invalid-email': 'Некорректный email',
      'auth/user-not-found': 'Неверный email или пароль',
      'auth/wrong-password': 'Неверный email или пароль',
      'auth/weak-password': 'Пароль слишком слабый',
      'auth/too-many-requests': 'Слишком много попыток. Подождите.',
      'auth/invalid-credential': 'Неверный email или пароль',
      'auth/network-request-failed': 'Проблема с сетью',
      'auth/operation-not-allowed': 'Операция не разрешена'
    };
    return messages[code] || 'Произошла ошибка. Попробуйте позже.';
  }
}