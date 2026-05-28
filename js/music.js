// js/music.js
// Полноценный синтезатор с многослойной композицией
// Без mp3 — всё генерируется в реальном времени

export class MusicManager {
  constructor(app) {
    this.app = app;
    this.audioCtx = null;
    this.masterGain = null;
    this.reverbGain = null;
    this.reverbNode = null;

    this.isPlaying = false;
    this.currentTrackId = null;
    this.currentTrack = null;

    this.tempo = 120;          // BPM
    this.beatDuration = 0.5;   // длительность 1 бита в сек
    this.nextNoteTime = 0;
    this.currentBeat = 0;
    this.timerId = null;

    this.volume = 0.25;
    this.scheduleAheadTime = 0.2; // сек вперёд
    this.lookahead = 25;          // мс

    this.tracks = {
      music_chill: this.getChillTrack(),
      music_epic:  this.getEpicTrack(),
      music_retro: this.getRetroTrack(),
    };

    this.setupUI();
  }

  setupUI() {
    const btn = document.getElementById('btn-music-toggle');
    if (btn) btn.addEventListener('click', () => this.toggleMusic());
  }

  // ═══════════════════════════════════════════════
  //                 ИНИЦИАЛИЗАЦИЯ
  // ═══════════════════════════════════════════════

  initAudioContext() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // Master gain (общая громкость)
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.volume;

      // Compressor — выравнивает громкость, не даёт пикам
      const compressor = this.audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 20;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.1;

      // Reverb (через искусственный impulse)
      this.reverbNode = this.audioCtx.createConvolver();
      this.reverbNode.buffer = this._createReverbImpulse(2.5, 2.0);

      this.reverbGain = this.audioCtx.createGain();
      this.reverbGain.gain.value = 0.25;

      // Маршрутизация:
      // источники → masterGain → compressor → destination
      //                      ↘ reverbNode → reverbGain ↗
      this.masterGain.connect(compressor);
      this.masterGain.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(compressor);
      compressor.connect(this.audioCtx.destination);
    } catch (e) {
      console.error('Web Audio API not supported:', e);
    }
  }

  // Создаёт impulse response для реверберации
  _createReverbImpulse(duration, decay) {
    const rate = this.audioCtx.sampleRate;
    const length = rate * duration;
    const impulse = this.audioCtx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // ═══════════════════════════════════════════════
  //                  УПРАВЛЕНИЕ
  // ═══════════════════════════════════════════════

  getActiveMusicTrack() {
    const inv = this.app.userData?.inventory || [];
    if (inv.some(i => i.id === 'music_epic'))  return 'music_epic';
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
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
      this.play(trackId);
      if (btn) btn.classList.add('music-on');
      if (icon) icon.textContent = 'music_note';
      this.app.notify('🎵 Музыка играет!', 'success', 2000);
    }
  }

  play(trackId) {
    if (!this.audioCtx) this.initAudioContext();
    if (!this.audioCtx) return;

    this.currentTrackId = trackId;
    this.currentTrack   = this.tracks[trackId];
    if (!this.currentTrack) return;

    this.tempo = this.currentTrack.tempo || 120;
    this.beatDuration = 60 / this.tempo;

    this.isPlaying    = true;
    this.currentBeat  = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.1;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  // ═══════════════════════════════════════════════
  //                  ПЛАНИРОВЩИК
  // ═══════════════════════════════════════════════

  scheduler() {
    if (!this.isPlaying || !this.currentTrack) return;

    const ctxTime = this.audioCtx.currentTime;

    while (this.nextNoteTime < ctxTime + this.scheduleAheadTime) {
      this._scheduleBeat(this.currentBeat, this.nextNoteTime);
      this.nextNoteTime += this.beatDuration / 2; // полу-биты для большей детализации
      this.currentBeat++;

      // Зацикливание
      if (this.currentBeat >= this.currentTrack.totalBeats) {
        this.currentBeat = 0;
      }
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  _scheduleBeat(beat, time) {
    const track = this.currentTrack;

    // Каждый трек состоит из дорожек: melody, bass, chords, drums
    if (track.melody) this._playFromTrack(track.melody, beat, time, 'melody');
    if (track.bass)   this._playFromTrack(track.bass,   beat, time, 'bass');
    if (track.chords) this._playFromTrack(track.chords, beat, time, 'chords');
    if (track.drums)  this._playDrumPattern(track.drums, beat, time);
  }

  _playFromTrack(trackData, beat, time, type) {
    const noteData = trackData[beat % trackData.length];
    if (!noteData || noteData.skip) return;

    // noteData может быть массивом (аккорд) или объектом (одна нота)
    const notes = Array.isArray(noteData.freq) ? noteData.freq : [noteData.freq];

    notes.forEach(freq => {
      if (freq === 0) return;
      const dur = (noteData.duration || 0.5) * this.beatDuration;
      this._playSynthNote(freq, time, dur, type, noteData.vel || 1);
    });
  }

  // ═══════════════════════════════════════════════
  //                  СИНТЕЗАТОР
  // ═══════════════════════════════════════════════

  /**
   * Многоосциляторный синт с фильтром и огибающей
   * type: 'melody' | 'bass' | 'chords' | 'lead' | 'pluck'
   */
  _playSynthNote(freq, time, duration, type = 'melody', velocity = 1) {
    if (!this.audioCtx || freq <= 0) return;

    const ctx = this.audioCtx;
    const noteGain = ctx.createGain();

    // Низкочастотный фильтр для мягкости
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    // Стерео-панорама
    const panner = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;

    // Настройки по типу инструмента
    const settings = this._getInstrumentSettings(type, freq);
    filter.frequency.value = settings.filterFreq;
    filter.Q.value = settings.filterQ;
    if (panner) panner.pan.value = settings.pan;

    // Создаём несколько осцилляторов для богатого звука
    const oscillators = [];
    settings.oscillators.forEach(oscSettings => {
      const osc = ctx.createOscillator();
      osc.type = oscSettings.type;
      osc.frequency.value = freq * (oscSettings.detune || 1);
      // Детюн в центах для теплоты
      if (oscSettings.detuneCents) osc.detune.value = oscSettings.detuneCents;

      const oscGain = ctx.createGain();
      oscGain.gain.value = oscSettings.gain;
      osc.connect(oscGain);
      oscGain.connect(filter);

      oscillators.push(osc);
    });

    // Огибающая громкости (ADSR)
    const peak = settings.peakGain * velocity;
    const { attack, decay, sustain, release } = settings.envelope;

    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(peak, time + attack);
    noteGain.gain.linearRampToValueAtTime(peak * sustain, time + attack + decay);
    noteGain.gain.setValueAtTime(peak * sustain, time + duration - release);
    noteGain.gain.linearRampToValueAtTime(0.0001, time + duration);

    // Огибающая фильтра (даёт "вау-эффект")
    if (settings.filterEnv) {
      const fStart = settings.filterFreq;
      const fPeak  = settings.filterFreq * settings.filterEnv;
      filter.frequency.setValueAtTime(fStart, time);
      filter.frequency.linearRampToValueAtTime(fPeak, time + attack);
      filter.frequency.exponentialRampToValueAtTime(fStart, time + duration);
    }

    // Маршрутизация
    filter.connect(noteGain);
    if (panner) {
      noteGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      noteGain.connect(this.masterGain);
    }

    // Запуск/остановка
    oscillators.forEach(osc => {
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  /**
   * Настройки инструментов для разных партий
   */
  _getInstrumentSettings(type, freq) {
    switch (type) {
      case 'bass':
        return {
          oscillators: [
            { type: 'sawtooth', gain: 0.5, detuneCents: -5 },
            { type: 'square',   gain: 0.3, detuneCents: 5 },
            { type: 'sine',     gain: 0.6, detune: 0.5 }, // субоктава
          ],
          filterFreq: 600,
          filterQ: 2,
          filterEnv: 1.5,
          peakGain: 0.35,
          pan: 0,
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.15 },
        };

      case 'chords':
        return {
          oscillators: [
            { type: 'sine',     gain: 0.35 },
            { type: 'triangle', gain: 0.25, detuneCents: 8 },
            { type: 'sine',     gain: 0.2,  detuneCents: -8 },
          ],
          filterFreq: 2200,
          filterQ: 0.7,
          peakGain: 0.15,
          pan: 0,
          envelope: { attack: 0.08, decay: 0.2, sustain: 0.6, release: 0.4 },
        };

      case 'lead':
        return {
          oscillators: [
            { type: 'sawtooth', gain: 0.4 },
            { type: 'sawtooth', gain: 0.3, detuneCents: 7 },
            { type: 'square',   gain: 0.2, detuneCents: -7 },
          ],
          filterFreq: 3000,
          filterQ: 1.5,
          filterEnv: 1.3,
          peakGain: 0.22,
          pan: 0.1,
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 },
        };

      case 'pluck':
        return {
          oscillators: [
            { type: 'triangle', gain: 0.5 },
            { type: 'sine',     gain: 0.3, detune: 2 }, // октава
          ],
          filterFreq: 3500,
          filterQ: 1,
          filterEnv: 0.4,
          peakGain: 0.2,
          pan: -0.15,
          envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.15 },
        };

      case 'melody':
      default:
        return {
          oscillators: [
            { type: 'triangle', gain: 0.5 },
            { type: 'sine',     gain: 0.4 },
            { type: 'sine',     gain: 0.15, detune: 2 },
          ],
          filterFreq: 4000,
          filterQ: 0.8,
          peakGain: 0.25,
          pan: 0,
          envelope: { attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.25 },
        };
    }
  }

  // ═══════════════════════════════════════════════
  //                    УДАРНЫЕ
  // ═══════════════════════════════════════════════

  _playDrumPattern(pattern, beat, time) {
    const step = pattern[beat % pattern.length];
    if (!step) return;
    if (step.kick)  this._playKick(time);
    if (step.snare) this._playSnare(time);
    if (step.hihat) this._playHihat(time, step.hihat === 'open');
    if (step.clap)  this._playClap(time);
  }

  _playKick(time) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  _playSnare(time) {
    const ctx = this.audioCtx;
    // Шум
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1500;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(time);

    // Тоновая составляющая
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.08);
    oscGain.gain.setValueAtTime(0.25, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  _playHihat(time, open = false) {
    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * (open ? 0.2 : 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.2 : 0.05));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
  }

  _playClap(time) {
    // Серия коротких шумовых импульсов
    [0, 0.01, 0.02].forEach(offset => {
      const ctx = this.audioCtx;
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(time + offset);
    });
  }

  // ═══════════════════════════════════════════════
  //                 НОТНАЯ ТАБЛИЦА
  // ═══════════════════════════════════════════════

  // Octave-helper: возвращает частоту по названию ноты
  _n(noteName) {
    const notes = { C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11 };
    const match = noteName.match(/^([A-G]#?)(\d)$/);
    if (!match) return 0;
    const [, name, octave] = match;
    const semitones = notes[name] + (parseInt(octave) - 4) * 12;
    return 440 * Math.pow(2, (semitones - 9) / 12);
  }

  _chord(...names) {
    return names.map(n => this._n(n));
  }

  // ═══════════════════════════════════════════════
  //                     ТРЕКИ
  // ═══════════════════════════════════════════════

  /**
   * 🌊 CHILL — расслабляющий lo-fi трек
   * Cmaj7 — Am7 — Fmaj7 — G7 (lofi прогрессия)
   * 4/4, 80 BPM
   */
  getChillTrack() {
    const n = (name) => this._n(name);
    const ch = (...names) => this._chord(...names);

    // 32 полу-бита = 16 ударов = 4 такта
    const TOTAL = 64; // 32 удара × 2 полу-бита

    // === МЕЛОДИЯ === (плавная, синкопированная)
    const melody = [
      // Такт 1: над Cmaj7
      { freq: n('E5'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('G5'), duration: 1.0 }, { skip: true },
      { freq: n('B5'), duration: 0.5 },
      { freq: n('A5'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('G5'), duration: 1.0 }, { skip: true },
      // Такт 2: над Am7
      { freq: n('C5'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('E5'), duration: 1.0 }, { skip: true },
      { freq: n('G5'), duration: 0.5 },
      { freq: n('E5'), duration: 2.0 }, { skip: true }, { skip: true }, { skip: true },
      // Такт 3: над Fmaj7
      { freq: n('F5'), duration: 1.0 }, { skip: true },
      { freq: n('A5'), duration: 1.0 }, { skip: true },
      { freq: n('C6'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('A5'), duration: 1.0 }, { skip: true },
      // Такт 4: над G7
      { freq: n('G5'), duration: 1.0 }, { skip: true },
      { freq: n('B5'), duration: 0.5 },
      { freq: n('D6'), duration: 0.5 },
      { freq: n('C6'), duration: 2.0 }, { skip: true }, { skip: true }, { skip: true },
      { skip: true }, { skip: true },
    ];

    // === БАСОВАЯ ЛИНИЯ === (играет тонику + квинту)
    const bass = [
      // Cmaj7
      { freq: n('C2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('G2'), duration: 0.5 },
      { freq: n('C2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('G2'), duration: 0.5 },
      // Am7
      { freq: n('A2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('E2'), duration: 0.5 },
      { freq: n('A2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('E2'), duration: 0.5 },
      // Fmaj7
      { freq: n('F2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('C3'), duration: 0.5 },
      { freq: n('F2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('C3'), duration: 0.5 },
      // G7
      { freq: n('G2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('D3'), duration: 0.5 },
      { freq: n('G2'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('B2'), duration: 0.5 },
    ];

    // === АККОРДЫ === (мягкие подушки)
    const chords = [
      { freq: ch('C4','E4','G4','B4'), duration: 4.0 },
      { skip: true }, { skip: true }, { skip: true },
      { skip: true }, { skip: true }, { skip: true }, { skip: true },

      { freq: ch('A3','C4','E4','G4'), duration: 4.0 },
      { skip: true }, { skip: true }, { skip: true },
      { skip: true }, { skip: true }, { skip: true }, { skip: true },

      { freq: ch('F3','A3','C4','E4'), duration: 4.0 },
      { skip: true }, { skip: true }, { skip: true },
      { skip: true }, { skip: true }, { skip: true }, { skip: true },

      { freq: ch('G3','B3','D4','F4'), duration: 4.0 },
      { skip: true }, { skip: true }, { skip: true },
      { skip: true }, { skip: true }, { skip: true }, { skip: true },
    ];

    // === УДАРНЫЕ === (lofi: kick, snare, мягкий hihat)
    const drums = [
      { kick: true, hihat: true }, {},
      { hihat: true }, {},
      { snare: true, hihat: true }, {},
      { hihat: 'open' }, {},
      { kick: true, hihat: true }, {},
      { kick: true, hihat: true }, {},
      { snare: true, hihat: true }, {},
      { hihat: true }, {},
    ];

    return {
      tempo: 80,
      totalBeats: TOTAL,
      melody, bass, chords, drums,
    };
  }

  /**
   * ⚔️ EPIC — кинематографичный эпик
   * Em — C — G — D (классическая героическая прогрессия)
   * 4/4, 110 BPM
   */
  getEpicTrack() {
    const n = (name) => this._n(name);
    const ch = (...names) => this._chord(...names);

    const TOTAL = 64;

    // === МЕЛОДИЯ === (величественная, восходящая)
    const melody = [
      // Em
      { freq: n('E4'), duration: 1.0 }, { skip: true },
      { freq: n('G4'), duration: 1.0 }, { skip: true },
      { freq: n('B4'), duration: 1.0 }, { skip: true },
      { freq: n('E5'), duration: 2.0 }, { skip: true }, { skip: true }, { skip: true },
      // C
      { freq: n('D5'), duration: 1.0 }, { skip: true },
      { freq: n('C5'), duration: 1.0 }, { skip: true },
      { freq: n('E5'), duration: 1.0 }, { skip: true },
      { freq: n('G5'), duration: 2.0 }, { skip: true }, { skip: true }, { skip: true },
      // G
      { freq: n('F5'), duration: 0.5 },
      { freq: n('E5'), duration: 0.5 },
      { freq: n('D5'), duration: 1.0 }, { skip: true },
      { freq: n('B4'), duration: 1.0 }, { skip: true },
      { freq: n('G4'), duration: 1.0 }, { skip: true },
      { freq: n('D5'), duration: 1.0 }, { skip: true },
      // D
      { freq: n('F#5'), duration: 1.0 }, { skip: true },
      { freq: n('A5'),  duration: 1.0 }, { skip: true },
      { freq: n('D6'),  duration: 3.0 }, { skip: true }, { skip: true }, { skip: true }, { skip: true }, { skip: true },
    ];

    // === БАС === (мощный, октавный)
    const bass = [
      // Em
      { freq: n('E2'), duration: 0.5 }, { freq: n('E2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('B2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('E2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('B2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('E2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('B2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('E2'), duration: 0.5 },
      { freq: n('E2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      // C
      { freq: n('C2'), duration: 0.5 }, { freq: n('C2'), duration: 0.5 },
      { freq: n('C2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      { freq: n('C2'), duration: 0.5 }, { freq: n('C2'), duration: 0.5 },
      { freq: n('C2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      { freq: n('C2'), duration: 0.5 }, { freq: n('C2'), duration: 0.5 },
      { freq: n('C2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      { freq: n('C2'), duration: 0.5 }, { freq: n('E2'), duration: 0.5 },
      { freq: n('G2'), duration: 0.5 }, { freq: n('E2'), duration: 0.5 },
      // G
      { freq: n('G2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      { freq: n('G2'), duration: 0.5 }, { freq: n('D3'), duration: 0.5 },
      { freq: n('G2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      { freq: n('G2'), duration: 0.5 }, { freq: n('D3'), duration: 0.5 },
      { freq: n('G2'), duration: 0.5 }, { freq: n('B2'), duration: 0.5 },
      { freq: n('D3'), duration: 0.5 }, { freq: n('B2'), duration: 0.5 },
      { freq: n('G2'), duration: 0.5 }, { freq: n('G2'), duration: 0.5 },
      { freq: n('A2'), duration: 0.5 }, { freq: n('B2'), duration: 0.5 },
      // D
      { freq: n('D2'), duration: 0.5 }, { freq: n('D2'), duration: 0.5 },
      { freq: n('D2'), duration: 0.5 }, { freq: n('A2'), duration: 0.5 },
      { freq: n('D2'), duration: 0.5 }, { freq: n('F#2'), duration: 0.5 },
      { freq: n('A2'), duration: 0.5 }, { freq: n('D3'), duration: 0.5 },
      { freq: n('D2'), duration: 0.5 }, { freq: n('D2'), duration: 0.5 },
      { freq: n('D2'), duration: 0.5 }, { freq: n('A2'), duration: 0.5 },
      { freq: n('D2'), duration: 0.5 }, { freq: n('D2'), duration: 0.5 },
      { freq: n('D2'), duration: 0.5 }, { freq: n('A2'), duration: 0.5 },
    ];

    // === АККОРДЫ === (струнные подушки)
    const chords = [
      { freq: ch('E3','G3','B3','E4'), duration: 8.0 },
      ...Array(15).fill({ skip: true }),
      { freq: ch('C3','E3','G3','C4'), duration: 8.0 },
      ...Array(15).fill({ skip: true }),
      { freq: ch('G3','B3','D4','G4'), duration: 8.0 },
      ...Array(15).fill({ skip: true }),
      { freq: ch('D3','F#3','A3','D4'), duration: 8.0 },
      ...Array(15).fill({ skip: true }),
    ];

    // === УДАРНЫЕ === (мощные, эпичные)
    const drums = [
      { kick: true }, {}, { hihat: true }, {},
      { snare: true, hihat: true }, {}, { hihat: true }, { kick: true },
      { kick: true }, {}, { hihat: true }, { kick: true },
      { snare: true, hihat: true }, {}, { hihat: 'open' }, { kick: true },
    ];

    return {
      tempo: 110,
      totalBeats: TOTAL,
      melody, bass, chords, drums,
    };
  }

  /**
   * 🕹️ RETRO — синтвейв 80-х
   * Am — F — C — G (классика синтвейва)
   * 4/4, 100 BPM
   */
  getRetroTrack() {
    const n = (name) => this._n(name);
    const ch = (...names) => this._chord(...names);

    const TOTAL = 64;

    // === МЕЛОДИЯ === (запоминающаяся, аркадная)
    const melody = [
      // Am
      { freq: n('A4'), duration: 0.5 },
      { freq: n('C5'), duration: 0.5 },
      { freq: n('E5'), duration: 0.5 },
      { freq: n('A5'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('G5'), duration: 0.5 },
      { freq: n('E5'), duration: 1.0 }, { skip: true },
      { freq: n('C5'), duration: 0.5 },
      { freq: n('E5'), duration: 1.0 }, { skip: true },
      { freq: n('A4'), duration: 1.0 }, { skip: true },
      { skip: true }, { skip: true },
      // F
      { freq: n('F4'), duration: 0.5 },
      { freq: n('A4'), duration: 0.5 },
      { freq: n('C5'), duration: 0.5 },
      { freq: n('F5'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('E5'), duration: 0.5 },
      { freq: n('C5'), duration: 1.0 }, { skip: true },
      { freq: n('A4'), duration: 0.5 },
      { freq: n('F4'), duration: 2.0 }, { skip: true }, { skip: true }, { skip: true },
      { skip: true }, { skip: true },
      // C
      { freq: n('C5'), duration: 0.5 },
      { freq: n('E5'), duration: 0.5 },
      { freq: n('G5'), duration: 0.5 },
      { freq: n('C6'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('B5'), duration: 0.5 },
      { freq: n('G5'), duration: 1.0 }, { skip: true },
      { freq: n('E5'), duration: 0.5 },
      { freq: n('G5'), duration: 1.0 }, { skip: true },
      { freq: n('C5'), duration: 1.0 }, { skip: true },
      { skip: true }, { skip: true },
      // G
      { freq: n('G4'), duration: 0.5 },
      { freq: n('B4'), duration: 0.5 },
      { freq: n('D5'), duration: 0.5 },
      { freq: n('G5'), duration: 1.5 }, { skip: true }, { skip: true },
      { freq: n('D5'), duration: 0.5 },
      { freq: n('B4'), duration: 0.5 },
      { freq: n('G4'), duration: 0.5 },
      { freq: n('D5'), duration: 0.5 },
      { freq: n('E5'), duration: 0.5 },
      { freq: n('G5'), duration: 2.0 }, { skip: true }, { skip: true }, { skip: true },
    ];

    // === БАС === (быстрые восьмушки — синтвейв)
    const bass = [];
    const bassPattern = [
      ['A2','A2','A3','A2','A2','A2','A3','E3'],  // Am
      ['F2','F2','F3','F2','F2','F2','F3','C3'],  // F
      ['C2','C2','C3','C2','C2','C2','C3','G2'],  // C
      ['G2','G2','G3','G2','G2','G2','G3','D3'],  // G
    ];
    bassPattern.forEach(chordBass => {
      chordBass.forEach((note, i) => {
        bass.push({ freq: n(note), duration: 0.5 });
        bass.push({ skip: true });
      });
    });

    // === АККОРДЫ === (синт-пэд)
    const chords = [
      { freq: ch('A3','C4','E4'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),
      { freq: ch('A3','C4','E4'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),

      { freq: ch('F3','A3','C4'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),
      { freq: ch('F3','A3','C4'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),

      { freq: ch('C3','E3','G3'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),
      { freq: ch('C3','E3','G3'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),

      { freq: ch('G3','B3','D4'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),
      { freq: ch('G3','B3','D4'), duration: 4.0 },
      ...Array(7).fill({ skip: true }),
    ];

    // === УДАРНЫЕ === (драм-машина TR-808)
    const drums = [
      { kick: true, hihat: true }, { hihat: true },
      { hihat: true }, { hihat: true },
      { snare: true, hihat: true }, { hihat: true },
      { hihat: true }, { kick: true, hihat: true },
      { kick: true, hihat: true }, { hihat: true },
      { kick: true, hihat: true }, { hihat: true },
      { snare: true, hihat: true }, { hihat: true },
      { hihat: 'open' }, { hihat: true },
    ];

    return {
      tempo: 100,
      totalBeats: TOTAL,
      melody, bass, chords, drums,
    };
  }

  // ═══════════════════════════════════════════════
  //                  ЗВУК КЛИКА
  // ═══════════════════════════════════════════════

  playClickSound() {
    if (!this.audioCtx) this.initAudioContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Сочный "поп" звук
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ═══════════════════════════════════════════════
  //                ПРОЧЕЕ
  // ═══════════════════════════════════════════════

  refreshTrack() {
    if (!this.isPlaying) return;
    const trackId = this.getActiveMusicTrack();
    if (trackId && trackId !== this.currentTrackId) {
      this.stop();
      this.play(trackId);
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.05);
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
