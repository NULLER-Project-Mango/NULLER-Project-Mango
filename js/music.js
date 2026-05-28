// js/music.js
// Музыка генерируется в реальном времени через Web Audio API
// Не требует mp3-файлов!

export class MusicManager {
  constructor(app) {
    this.app = app;
    this.audioCtx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.currentTrack = null;
    this.nextNoteTime = 0;
    this.noteIndex = 0;
    this.timerId = null;
    this.volume = 0.15; // не громко

    // Доступные треки (по id из items-database)
    this.tracks = {
      music_chill: this.getChillMelody(),
      music_epic: this.getEpicMelody(),
      music_retro: this.getRetroMelody()
    };

    this.setupUI();
  }

  setupUI() {
    const btn = document.getElementById('btn-music-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggleMusic());
    }
  }

  // Инициализация AudioContext при первом взаимодействии
  initAudioContext() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioCtx.destination);
    } catch (e) {
      console.error('Web Audio API not supported:', e);
    }
  }

  // Проверка какая музыка куплена и активна
  getActiveMusicTrack() {
    const data = this.app.userData;
    if (!data) return null;

    const inv = data.inventory || [];

    // Приоритет: эпик > ретро > чил
    if (inv.some(i => i.id === 'music_epic')) return 'music_epic';
    if (inv.some(i => i.id === 'music_retro')) return 'music_retro';
    if (inv.some(i => i.id === 'music_chill')) return 'music_chill';

    return null;
  }

  toggleMusic() {
    const btn = document.getElementById('btn-music-toggle');
    const icon = btn?.querySelector('.material-icons-round');

    if (this.isPlaying) {
      this.stop();
      if (btn) btn.classList.remove('music-on');
      if (icon) icon.textContent = 'music_off';
      this.app.notify('🔇 Музыка выключена', 'info', 2000);
    } else {
      const trackId = this.getActiveMusicTrack();

      if (!trackId) {
        this.app.notify('🎵 Купите музыку в магазине!', 'warning', 3000);
        return;
      }

      this.initAudioContext();

      // Возобновляем audio context если он приостановлен (требование браузеров)
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      this.play(trackId);
      if (btn) btn.classList.add('music-on');
      if (icon) icon.textContent = 'music_note';
      this.app.notify('🎵 Музыка играет!', 'success', 2000);
    }
  }

  play(trackId) {
    if (!this.audioCtx) this.initAudioContext();
    if (!this.audioCtx) return;

    this.currentTrack = this.tracks[trackId];
    if (!this.currentTrack) return;

    this.isPlaying = true;
    this.noteIndex = 0;
    this.nextNoteTime = this.audioCtx.currentTime;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  // Планировщик нот
  scheduler() {
    if (!this.isPlaying || !this.currentTrack) return;

    // Планируем ноты на 0.1 сек вперёд
    while (this.nextNoteTime < this.audioCtx.currentTime + 0.1) {
      const note = this.currentTrack[this.noteIndex];
      if (note) {
        this.playNote(note.freq, this.nextNoteTime, note.duration, note.type || 'sine');
      }

      this.nextNoteTime += note.duration;
      this.noteIndex++;

      // Зацикливаем
      if (this.noteIndex >= this.currentTrack.length) {
        this.noteIndex = 0;
      }
    }

    this.timerId = setTimeout(() => this.scheduler(), 25);
  }

  // Играем одну ноту
  playNote(frequency, startTime, duration, type = 'sine') {
    if (!this.audioCtx || frequency === 0) return;

    const osc = this.audioCtx.createOscillator();
    const noteGain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    // Огибающая (ADSR упрощённая)
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.02); // attack
    noteGain.gain.linearRampToValueAtTime(0.2, startTime + 0.05); // decay
    noteGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration); // release

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // ===== МЕЛОДИИ =====

  // Расслабляющая мелодия (Чил)
  getChillMelody() {
    const C = 261.63, D = 293.66, E = 329.63, F = 349.23, G = 392.00, A = 440.00, B = 493.88;
    const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;

    return [
      // Основная мелодия (мажорная гамма)
      { freq: C5, duration: 0.5, type: 'sine' },
      { freq: E5, duration: 0.5, type: 'sine' },
      { freq: G5, duration: 0.5, type: 'sine' },
      { freq: E5, duration: 0.5, type: 'sine' },

      { freq: F5, duration: 0.5, type: 'sine' },
      { freq: A,  duration: 0.5, type: 'sine' },
      { freq: C5, duration: 0.5, type: 'sine' },
      { freq: A,  duration: 0.5, type: 'sine' },

      { freq: G,  duration: 0.5, type: 'sine' },
      { freq: B,  duration: 0.5, type: 'sine' },
      { freq: D5, duration: 0.5, type: 'sine' },
      { freq: B,  duration: 0.5, type: 'sine' },

      { freq: C5, duration: 0.5, type: 'sine' },
      { freq: E5, duration: 0.5, type: 'sine' },
      { freq: G5, duration: 0.5, type: 'sine' },
      { freq: C5, duration: 1.0, type: 'sine' },

      // Пауза
      { freq: 0, duration: 1.0 },

      // Вторая часть
      { freq: E5, duration: 0.4, type: 'sine' },
      { freq: D5, duration: 0.4, type: 'sine' },
      { freq: C5, duration: 0.4, type: 'sine' },
      { freq: D5, duration: 0.4, type: 'sine' },
      { freq: E5, duration: 0.4, type: 'sine' },
      { freq: E5, duration: 0.4, type: 'sine' },
      { freq: E5, duration: 0.8, type: 'sine' },

      { freq: D5, duration: 0.4, type: 'sine' },
      { freq: D5, duration: 0.4, type: 'sine' },
      { freq: D5, duration: 0.8, type: 'sine' },

      { freq: E5, duration: 0.4, type: 'sine' },
      { freq: G5, duration: 0.4, type: 'sine' },
      { freq: G5, duration: 0.8, type: 'sine' },

      // Пауза
      { freq: 0, duration: 1.5 },
    ];
  }

  // Эпическая мелодия
  getEpicMelody() {
    const E = 164.81, G = 196.00, A = 220.00, B = 246.94, C5 = 261.63, D5 = 293.66, E5 = 329.63, G5 = 392.00, A5 = 440.00, B5 = 493.88;

    return [
      // Драматическое вступление (квинты)
      { freq: E,  duration: 0.3, type: 'triangle' },
      { freq: E,  duration: 0.3, type: 'triangle' },
      { freq: E,  duration: 0.3, type: 'triangle' },
      { freq: G,  duration: 0.6, type: 'triangle' },

      { freq: B,  duration: 0.6, type: 'sawtooth' },
      { freq: A,  duration: 0.3, type: 'sawtooth' },
      { freq: G,  duration: 0.3, type: 'sawtooth' },
      { freq: A,  duration: 0.6, type: 'sawtooth' },

      // Героическая фраза
      { freq: E5, duration: 0.4, type: 'square' },
      { freq: D5, duration: 0.4, type: 'square' },
      { freq: C5, duration: 0.4, type: 'square' },
      { freq: D5, duration: 0.4, type: 'square' },
      { freq: E5, duration: 0.8, type: 'square' },

      { freq: 0,  duration: 0.3 },

      { freq: G5, duration: 0.3, type: 'triangle' },
      { freq: A5, duration: 0.3, type: 'triangle' },
      { freq: B5, duration: 0.6, type: 'triangle' },
      { freq: A5, duration: 0.3, type: 'triangle' },
      { freq: G5, duration: 0.3, type: 'triangle' },
      { freq: E5, duration: 0.8, type: 'triangle' },

      // Финал
      { freq: E,  duration: 0.3, type: 'sawtooth' },
      { freq: G,  duration: 0.3, type: 'sawtooth' },
      { freq: B,  duration: 0.3, type: 'sawtooth' },
      { freq: E5, duration: 1.2, type: 'sawtooth' },

      { freq: 0, duration: 1.0 },
    ];
  }

  // Ретро 8-bit мелодия
  getRetroMelody() {
    const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.00, B5 = 987.77, C6 = 1046.50;

    return [
      // Веселая 8-bit мелодия
      { freq: C5, duration: 0.2, type: 'square' },
      { freq: E5, duration: 0.2, type: 'square' },
      { freq: G5, duration: 0.2, type: 'square' },
      { freq: C6, duration: 0.4, type: 'square' },

      { freq: G5, duration: 0.2, type: 'square' },
      { freq: C6, duration: 0.6, type: 'square' },

      { freq: A5, duration: 0.2, type: 'square' },
      { freq: G5, duration: 0.2, type: 'square' },
      { freq: E5, duration: 0.2, type: 'square' },
      { freq: G5, duration: 0.4, type: 'square' },

      { freq: F5, duration: 0.2, type: 'square' },
      { freq: D5, duration: 0.2, type: 'square' },
      { freq: C5, duration: 0.6, type: 'square' },

      { freq: 0, duration: 0.3 },

      { freq: E5, duration: 0.2, type: 'square' },
      { freq: G5, duration: 0.2, type: 'square' },
      { freq: A5, duration: 0.2, type: 'square' },
      { freq: B5, duration: 0.2, type: 'square' },
      { freq: A5, duration: 0.2, type: 'square' },
      { freq: G5, duration: 0.2, type: 'square' },
      { freq: F5, duration: 0.2, type: 'square' },
      { freq: E5, duration: 0.4, type: 'square' },

      { freq: D5, duration: 0.2, type: 'square' },
      { freq: F5, duration: 0.2, type: 'square' },
      { freq: A5, duration: 0.2, type: 'square' },
      { freq: G5, duration: 0.4, type: 'square' },

      { freq: 0, duration: 0.5 },
    ];
  }

  // Звук клика по манго
  playClickSound() {
    if (!this.audioCtx) this.initAudioContext();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  // Перезапуск при покупке новой музыки
  refreshTrack() {
    if (!this.isPlaying) return;
    const trackId = this.getActiveMusicTrack();
    if (trackId) {
      this.stop();
      this.play(trackId);
    }
  }

  destroy() {
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
